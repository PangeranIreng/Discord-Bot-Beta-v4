/**
 * boomboxLogDashboard.js — Paginated BoomBox Logs dashboard.
 *
 * Mirrors ticket/ticketDashboard.js: a single message is edited in place
 * (never spammed as new messages) with First/Previous/Refresh/Next/Last nav
 * buttons plus a "📁 BB Page" dropdown once there is more than one page.
 * Entries carry no requester info by design (see boomboxEmbed.js).
 */

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";

import { BOOMBOX_CONFIG }       from "./boomboxConfig.js";
import { db }                   from "./db.js";
import { buildLogEntryBlock, LOG_SEP } from "./boomboxEmbed.js";
import { logger }               from "../utils/logger.js";

const COLOR_LOG        = 0x3ba4ff;
const PAGE_SIZE         = 20;
/** Discord hard-caps embed description at 4096 chars; stay comfortably under it. */
const DESC_SAFE_LIMIT   = 3900;

function resolvePage(entries, requestedPage) {
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const page       = Math.min(Math.max(1, requestedPage || 1), totalPages);
  const slice       = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return { totalPages, page, slice };
}

/** Build the description for one page, trimming further if a pathological
 * entry (e.g. very long URL) would still blow past Discord's limit. */
function buildPageDescription(slice) {
  if (slice.length === 0) return LOG_SEP;
  let blocks = slice.map(buildLogEntryBlock);
  let desc   = `${LOG_SEP}\n\n${blocks.join(`\n\n${LOG_SEP}\n\n`)}\n\n${LOG_SEP}`;
  while (desc.length > DESC_SAFE_LIMIT && blocks.length > 1) {
    blocks = blocks.slice(0, -1);
    desc   = `${LOG_SEP}\n\n${blocks.join(`\n\n${LOG_SEP}\n\n`)}\n\n${LOG_SEP}`;
  }
  return desc;
}

export function buildLogDashboardEmbed(entries, requestedPage = 1) {
  const { totalPages, page, slice } = resolvePage(entries, requestedPage);
  return new EmbedBuilder()
    .setColor(COLOR_LOG)
    .setTitle("🎵 BoomBox Logs")
    .setDescription(buildPageDescription(slice))
    .setFooter({ text: `Pangeran Assistant AI • BoomBox Logs • Halaman ${page} / ${totalPages} • Total: ${entries.length} entri` })
    .setTimestamp();
}

// Per spec: only Previous / Next / Refresh — no First/Last, no Clear Logs.
function buildNavRow(page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bblog:nav:prev:${page}`).setEmoji("◀️").setLabel("Previous").setStyle(ButtonStyle.Secondary).setDisabled(page <= 1),
    new ButtonBuilder().setCustomId(`bblog:nav:next:${page}`).setEmoji("▶️").setLabel("Next").setStyle(ButtonStyle.Secondary).setDisabled(page >= totalPages),
    new ButtonBuilder().setCustomId(`bblog:nav:refresh:${page}`).setEmoji("🔄").setLabel("Refresh").setStyle(ButtonStyle.Secondary),
  );
}

function buildPageSelectRow(totalPages) {
  const options = Array.from({ length: Math.min(totalPages, 25) }, (_, i) => ({
    label: `📂 BB Page — Page ${i + 1}`,
    value: `${i + 1}`,
  }));
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("bblog:pagesel")
      .setPlaceholder("📂 BB Page")
      .addOptions(options),
  );
}

export function buildLogDashboardComponents(entries, requestedPage = 1) {
  const { totalPages, page } = resolvePage(entries, requestedPage);
  const rows = [buildNavRow(page, totalPages)];
  if (totalPages > 1) rows.push(buildPageSelectRow(totalPages));
  return rows;
}

/**
 * Recalculate and update (or create) the single BoomBox Logs dashboard
 * message. Always resets to page 1 on auto-refresh (new entry arriving) —
 * manual page navigation is handled directly in boomboxLogInteraction.js via
 * interaction.update(), same pattern as Ticket Logs.
 */
export async function updateBoomBoxLogDashboard(client, { resetToFirstPage = true } = {}) {
  try {
    const ch = await client.channels.fetch(BOOMBOX_CONFIG.BOOMBOX_LOG_CHANNEL_ID).catch(() => null);
    if (!ch?.isTextBased()) {
      logger.warn(`[BoomBox] Log channel ${BOOMBOX_CONFIG.BOOMBOX_LOG_CHANNEL_ID} not found or not text-based`);
      return;
    }

    const state   = db.getLogState();
    const entries = state.entries ?? [];
    const page    = resetToFirstPage ? 1 : 1;
    const payload = {
      content:    "",
      embeds:     [buildLogDashboardEmbed(entries, page)],
      components: buildLogDashboardComponents(entries, page),
    };

    if (state.messageId) {
      try {
        const msg = await ch.messages.fetch(state.messageId);
        await msg.edit(payload);
        logger.debug("[BoomBox] Log dashboard updated");
        return;
      } catch {
        logger.info("[BoomBox] Previous BoomBox Log message is gone — creating a new one");
      }
    }

    const newMsg = await ch.send(payload);
    db.setLogState({ messageId: newMsg.id });
    logger.info(`[BoomBox] BoomBox Log dashboard created: ${newMsg.id}`);
  } catch (e) {
    logger.error(`[BoomBox] Failed to update log dashboard: ${e.message}`);
  }
}
