/**
 * ticketEmbed.js — Embed & component builders for the Ticket system.
 *
 * Panel embed:  posted once in panel_channel via /cticket, has the
 *               "Open Ticket" button.
 * Status embed: posted inside each ticket thread, edited in place as the
 *               ticket moves open → claimed → closed.
 */

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { padTicketNumber } from "./ticketUtils.js";

const COLOR_PANEL  = 0x5865f2; // Blurple
const COLOR_OPEN   = 0xf1c40f; // Yellow  — Menunggu Handle
const COLOR_CLAIMED = 0x57f287; // Green  — Di Handle
const COLOR_CLOSED = 0xed4245; // Red    — Closed
const FOOTER_TEXT  = "Pangeran Assistant AI • Ticket System";

// ── Panel (posted once per /cticket panel_channel) ────────────────────────

export function buildPanelEmbed() {
  return new EmbedBuilder()
    .setColor(COLOR_PANEL)
    .setTitle("🎫 Open Ticket")
    .setDescription(
      [
        "Butuh bantuan?",
        "",
        "💢 Kesel kehabisan limit terus?",
        "🤖 Mau sewa Bot?",
        "🎤 Ready Jasa MC?",
        "",
        "Buka Ticket sesuai kebutuhan Anda.",
        "",
        "⚠️ Mohon gunakan Ticket dengan bijak.",
        "Dilarang membuat Ticket untuk bercanda, spam, atau tanpa tujuan yang jelas.",
        "Pelanggaran dapat dikenakan sanksi sesuai aturan yang berlaku.",
      ].join("\n"),
    )
    .setFooter({ text: FOOTER_TEXT });
}

export function buildPanelButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("ticket:open")
      .setLabel("Open Ticket")
      .setEmoji("🎫")
      .setStyle(ButtonStyle.Primary),
  );
}

// ── Ticket thread status embed (edited as the ticket progresses) ─────────

/**
 * @param {number} ticketNumber
 * @param {"open"|"claimed"|"closed"} status
 * @param {string|null} handlerId
 */
export function buildTicketStatusEmbed(ticketNumber, status, handlerId) {
  const statusLine =
    status === "open"    ? "🟡 Menunggu Handle..." :
    status === "claimed" ? "🟢 Di Handle" :
                            "🔴 Closed";

  const color =
    status === "open"    ? COLOR_OPEN :
    status === "claimed" ? COLOR_CLAIMED :
                            COLOR_CLOSED;

  const fields = [{ name: "Status", value: statusLine, inline: false }];
  if (status !== "open" && handlerId) {
    fields.push({ name: "Handler", value: `<@${handlerId}>`, inline: false });
  }

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`🎫 Ticket #${padTicketNumber(ticketNumber)}`)
    .setDescription("Selamat Datang.\n\nSilakan sampaikan kebutuhan atau keperluan Anda.")
    .addFields(fields)
    .setFooter({ text: FOOTER_TEXT })
    .setTimestamp();
}

// ── Staff-only control message (posted in the logs channel, NOT the thread) ─
//
// Discord has no concept of "show this button to some viewers of a message
// but not others" — everyone with access to a channel/thread sees the same
// components. Since a ticket thread is shared with the requester, the
// Claim/Close buttons cannot live there without the requester also seeing
// them. Instead they live on a separate message in the (staff-only) Ticket
// Logs channel; the thread itself only ever shows plain status text.

/**
 * @param {number} ticketNumber
 * @param {"open"|"claimed"|"closed"} status
 * @param {string} userId      Ticket creator
 * @param {string|null} handlerId
 */
export function buildControlEmbed(ticketNumber, status, userId, handlerId) {
  const statusLine =
    status === "open"    ? "🟡 Menunggu Handle..." :
    status === "claimed" ? "🟢 Being Handled" :
                            "🔴 Closed";

  const color =
    status === "open"    ? COLOR_OPEN :
    status === "claimed" ? COLOR_CLAIMED :
                            COLOR_CLOSED;

  const fields = [
    { name: "Requester", value: `<@${userId}>`, inline: true },
    { name: "Status",    value: statusLine,     inline: true },
  ];
  if (handlerId) fields.push({ name: "Handled by", value: `<@${handlerId}>`, inline: true });

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(`🎫 Ticket #${padTicketNumber(ticketNumber)} — Staff Controls`)
    .addFields(fields)
    .setFooter({ text: FOOTER_TEXT })
    .setTimestamp();
}

/**
 * Claim button while open, Close button while claimed, no buttons once closed.
 * Only ever rendered in the staff-only control message.
 * @param {"open"|"claimed"|"closed"} status
 */
export function buildControlButtons(status, ticketNumber) {
  if (status === "open") {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket:claim:${ticketNumber}`)
          .setLabel("Claim Ticket")
          .setEmoji("✅")
          .setStyle(ButtonStyle.Success),
      ),
    ];
  }
  if (status === "claimed") {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket:close:${ticketNumber}`)
          .setLabel("Close Ticket")
          .setEmoji("🔒")
          .setStyle(ButtonStyle.Danger)
          .setDisabled(false),
      ),
    ];
  }
  return []; // closed — no actionable buttons
}
