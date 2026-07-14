/**
 * ticketHandler.js — Core Ticket lifecycle: panel send, open, first-reply,
 * claim, close.
 *
 * Thread visibility note: private threads are only visible to explicitly
 * added members, OR any member with the "Manage Threads" permission on the
 * parent channel/server (this is standard Discord behavior, not something a
 * bot can override). This bot does not have the privileged Server Members
 * intent enabled, so it cannot reliably enumerate every holder of the
 * mention/Owner/Developer roles to auto-add them to new ticket threads.
 * Practical effect: the ticket creator always gets access (added
 * explicitly); Owner/Developer/Handler staff get automatic access as long
 * as their role(s) carry "Manage Threads" (bundled into Administrator, or
 * grantable directly) — a one-time server permission setup, not a per-ticket
 * step. Claim/Close actions are independently permission-checked on every
 * click regardless of thread visibility.
 */

import { ChannelType } from "discord.js";
import { ticketDB } from "./ticketDB.js";
import { isStaff } from "../commands/permissions.js";
import {
  buildPanelEmbed,
  buildPanelButtonRow,
  buildTicketStatusEmbed,
  buildControlEmbed,
  buildControlButtons,
} from "./ticketEmbed.js";
import { padTicketNumber } from "./ticketUtils.js";
import { updateTicketDashboard } from "./ticketDashboard.js";
import { logger } from "../utils/logger.js";
import { logError } from "../utils/errorLogger.js";

const THREAD_AUTO_ARCHIVE_MIN = 10080; // 7 days — longest option, avoids premature archive on quiet tickets

/** True for Owner/Developer, or a member of the configured mention_role. */
export function isHandler(member, config) {
  if (!member) return false;
  if (isStaff(member)) return true;
  if (config.mentionRoleId && member.roles.cache.has(config.mentionRoleId)) return true;
  return false;
}

/** Send the "Open Ticket" panel to a channel. Returns the sent message. */
export async function sendTicketPanel(channel) {
  return channel.send({ embeds: [buildPanelEmbed()], components: [buildPanelButtonRow()] });
}

/** Best-effort: add any staff already in the guild member cache to the thread. */
async function addCachedStaffToThread(thread, config) {
  const guild = thread.guild;
  const staffRoleIds = [config.mentionRoleId].filter(Boolean);
  const candidates = guild.members.cache.filter((m) => isHandler(m, config) || staffRoleIds.some((id) => m.roles.cache.has(id)));
  for (const member of candidates.values()) {
    await thread.members.add(member.id).catch(() => {});
  }
}

// ── Open ─────────────────────────────────────────────────────────────────

export async function openTicket(interaction) {
  const config = ticketDB.getConfig();
  if (!config.panelChannelId || !config.logsChannelId) {
    await interaction.reply({ content: "❌ Sistem Ticket belum dikonfigurasi sepenuhnya. Hubungi Admin.", ephemeral: true });
    return;
  }

  const existing = ticketDB.getAllTickets().find((t) => t.userId === interaction.user.id && t.status !== "closed");
  if (existing) {
    await interaction.reply({
      content: `❌ Kamu sudah memiliki Ticket yang masih terbuka: <#${existing.threadId}>`,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const number = ticketDB.nextTicketNumber();
  const panelChannel = interaction.channel;

  let thread;
  try {
    thread = await panelChannel.threads.create({
      name: `Ticket #${padTicketNumber(number)}`,
      type: ChannelType.PrivateThread,
      autoArchiveDuration: THREAD_AUTO_ARCHIVE_MIN,
      invitable: false,
      reason: `Ticket dibuka oleh ${interaction.user.tag}`,
    });
  } catch (e) {
    logger.warn(`[Ticket] Private thread gagal dibuat (${e.message}) — fallback ke Public Thread`);
    thread = await panelChannel.threads.create({
      name: `Ticket #${padTicketNumber(number)}`,
      type: ChannelType.PublicThread,
      autoArchiveDuration: THREAD_AUTO_ARCHIVE_MIN,
      reason: `Ticket dibuka oleh ${interaction.user.tag} (fallback publik — private thread tidak tersedia di server ini)`,
    });
  }

  await thread.members.add(interaction.user.id).catch(() => {});
  await addCachedStaffToThread(thread, config).catch(() => {});

  const record = {
    number,
    threadId:         thread.id,
    userId:           interaction.user.id,
    handlerId:        null,
    status:           "open",
    createdAt:        new Date().toISOString(),
    closedAt:         null,
    durationMs:       null,
    firstReplySent:   false,
    statusMessageId:  null,
    controlMessageId: null,
  };
  ticketDB.addTicket(record);

  if (config.mentionRoleId) {
    await thread.send({ content: `<@&${config.mentionRoleId}>` }).catch(() => {});
  }

  // Thread message: plain status only, NO buttons — the requester shares
  // this thread, so any component here would be visible to them too.
  const statusMsg = await thread.send({ embeds: [buildTicketStatusEmbed(number, "open", null)] });
  ticketDB.updateTicket(thread.id, { statusMessageId: statusMsg.id });

  // Claim/Close controls live only in the staff-only Ticket Logs channel.
  const logsChannel = await interaction.client.channels.fetch(config.logsChannelId).catch(() => null);
  if (logsChannel?.isTextBased()) {
    try {
      const controlMsg = await logsChannel.send({
        embeds:     [buildControlEmbed(number, "open", interaction.user.id, null)],
        components: buildControlButtons("open", number),
      });
      ticketDB.updateTicket(thread.id, { controlMessageId: controlMsg.id });
    } catch (e) {
      logger.warn(`[Ticket] Gagal mengirim staff control message untuk Ticket #${number}: ${e.message}`);
    }
  }

  await interaction.editReply({ content: `✅ Ticket kamu telah dibuat: ${thread}` });

  await updateTicketDashboard(interaction.client);
}

/** Re-render the plain (button-free) status embed inside the ticket thread. */
async function updateThreadStatus(client, ticket, status, handlerId) {
  if (!ticket.statusMessageId) return;
  try {
    const thread = await client.channels.fetch(ticket.threadId).catch(() => null);
    if (!thread) return;
    const msg = await thread.messages.fetch(ticket.statusMessageId).catch(() => null);
    if (!msg) return;
    await msg.edit({ embeds: [buildTicketStatusEmbed(ticket.number, status, handlerId)] });
  } catch (e) {
    logger.debug(`[Ticket] Gagal update status thread #${ticket.number}: ${e.message}`);
  }
}

// ── First user reply (auto-ack, once) ───────────────────────────────────

export async function handleTicketThreadMessage(message) {
  if (!message.channel?.isThread()) return;

  const ticket = ticketDB.getTicketByThread(message.channel.id);
  if (!ticket) return;                        // not a ticket thread
  if (message.author.id !== ticket.userId) return; // only the requester triggers this
  if (ticket.firstReplySent) return;

  ticketDB.updateTicket(ticket.threadId, { firstReplySent: true });

  await message.reply(
    "Terima kasih.\n\nTicket Anda telah diterima.\n\nSilakan tunggu,\nHandler akan segera merespons Ticket Anda.",
  ).catch(() => {});
}

// ── Claim ────────────────────────────────────────────────────────────────

export async function claimTicket(interaction, ticketNumber) {
  const config = ticketDB.getConfig();
  if (!isHandler(interaction.member, config)) {
    await interaction.reply({ content: "❌ Kamu tidak memiliki izin untuk claim Ticket ini.", ephemeral: true });
    return;
  }

  const ticket = ticketDB.getTicketByNumber(ticketNumber);
  if (!ticket) {
    await interaction.reply({ content: "❌ Ticket tidak ditemukan.", ephemeral: true });
    return;
  }
  if (ticket.status !== "open") {
    await interaction.reply({ content: "⚠️ Ticket ini sudah di-claim atau sudah ditutup.", ephemeral: true });
    return;
  }

  ticketDB.updateTicket(ticket.threadId, { status: "claimed", handlerId: interaction.user.id });

  // This button click always comes from the staff-only control message —
  // interaction.update() edits that same message in place.
  await interaction.update({
    embeds:     [buildControlEmbed(ticketNumber, "claimed", ticket.userId, interaction.user.id)],
    components: buildControlButtons("claimed", ticketNumber),
  });

  await updateThreadStatus(interaction.client, { ...ticket, status: "claimed" }, "claimed", interaction.user.id);

  const thread = await interaction.client.channels.fetch(ticket.threadId).catch(() => null);
  await thread?.send(`🟢 Ticket sedang di-handle oleh <@${interaction.user.id}>.`).catch(() => {});

  await updateTicketDashboard(interaction.client);
}

// ── Close ────────────────────────────────────────────────────────────────

export async function closeTicket(interaction, ticketNumber) {
  const ticket = ticketDB.getTicketByNumber(ticketNumber);
  if (!ticket) {
    await interaction.reply({ content: "❌ Ticket tidak ditemukan.", ephemeral: true });
    return;
  }
  if (ticket.status === "closed") {
    await interaction.reply({ content: "⚠️ Ticket ini sudah ditutup.", ephemeral: true });
    return;
  }

  const isClaimer = ticket.handlerId === interaction.user.id;
  if (!isStaff(interaction.member) && !isClaimer) {
    await interaction.reply({
      content: "❌ Hanya Handler yang meng-claim Ticket ini atau Owner yang dapat menutupnya.",
      ephemeral: true,
    });
    return;
  }

  const closedAt   = new Date();
  const durationMs = closedAt.getTime() - new Date(ticket.createdAt).getTime();
  ticketDB.updateTicket(ticket.threadId, { status: "closed", closedAt: closedAt.toISOString(), durationMs });

  // Close can be triggered either from the staff control message (normal
  // path) or, defensively, from any other context — only .update() the
  // interaction's own message when it actually IS the control message.
  if (ticket.controlMessageId && interaction.message?.id === ticket.controlMessageId) {
    await interaction.update({
      embeds:     [buildControlEmbed(ticketNumber, "closed", ticket.userId, ticket.handlerId)],
      components: [],
    });
  } else {
    await interaction.reply({ content: "✅ Ticket ditutup.", ephemeral: true }).catch(() => {});
  }

  await updateThreadStatus(interaction.client, ticket, "closed", ticket.handlerId);

  const thread = await interaction.client.channels.fetch(ticket.threadId).catch(() => interaction.channel);
  try {
    await thread.setLocked(true, "Ticket ditutup");
    await thread.setArchived(true, "Ticket ditutup");
  } catch (e) {
    logger.warn(`[Ticket] Gagal lock/archive thread ${thread.id}: ${e.message}`);
    await logError({
      feature: "Ticket",
      reason:  `Gagal lock/archive thread saat close: ${e.message}`,
      stage:   "Close Ticket",
      error:   e,
    }).catch(() => {});
  }

  await updateTicketDashboard(interaction.client);
}
