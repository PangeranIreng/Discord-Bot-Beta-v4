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

/**
 * Claim button while open, Close button while claimed, no buttons once closed.
 * @param {"open"|"claimed"|"closed"} status
 */
export function buildTicketButtons(status, ticketNumber) {
  if (status === "open") {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:claim:${ticketNumber}`)
        .setLabel("Claim Ticket")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success),
    );
  }
  if (status === "claimed") {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:close:${ticketNumber}`)
        .setLabel("Close Ticket")
        .setEmoji("🔒")
        .setStyle(ButtonStyle.Danger),
    );
  }
  return null; // closed — no actionable buttons
}
