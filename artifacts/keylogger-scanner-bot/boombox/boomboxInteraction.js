/**
 * boomboxInteraction.js — Handles Discord button interactions for BoomBox.
 *
 * Button custom IDs:
 *   bm:url:<boomboxUrl>   →  Reply ephemerally with the BoomBox URL.
 */

import { logger } from "../utils/logger.js";

/**
 * Handle a Discord button interaction from BoomBox.
 * Call this from the main interactionCreate listener for interactions whose
 * customId starts with "bm:".
 *
 * @param {import("discord.js").ButtonInteraction} interaction
 */
export async function handleBoomBoxInteraction(interaction) {
  if (!interaction.isButton()) return;

  const id = interaction.customId ?? "";

  // ── Show URL ──────────────────────────────────────────────────────────────
  if (id.startsWith("bm:url:")) {
    const boomboxUrl = id.slice("bm:url:".length);

    if (!boomboxUrl) {
      await interaction.reply({
        content: "❌ URL tidak tersedia.",
        ephemeral: true,
      }).catch(() => {});
      return;
    }

    logger.debug(`[BoomBox] Show URL button | url=${boomboxUrl}`);
    await interaction.reply({
      content: `🔗 **BoomBox URL:**\n${boomboxUrl}`,
      ephemeral: true,
    }).catch(err => {
      logger.warn(`[BoomBox] Failed to reply to Show URL: ${err.message}`);
    });
    return;
  }

  // Unknown bm: prefix — ignore
  logger.debug(`[BoomBox] Unknown interaction customId: ${id}`);
}
