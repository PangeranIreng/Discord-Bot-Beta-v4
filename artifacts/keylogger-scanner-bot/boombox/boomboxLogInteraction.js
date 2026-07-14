/**
 * boomboxLogInteraction.js — Handles all Discord interactions whose customId
 * starts with "bblog:" (BoomBox Logs dashboard nav buttons + page select).
 *
 *   bblog:nav:<prev|refresh|next>:<page>
 *   bblog:pagesel  (select, value = page number string)
 */

import { db } from "./db.js";
import { buildLogDashboardEmbed, buildLogDashboardComponents } from "./boomboxLogDashboard.js";
import { logger } from "../utils/logger.js";

export async function handleBoomBoxLogInteraction(interaction) {
  const id = interaction.customId ?? "";

  try {
    const navMatch = /^bblog:nav:(prev|refresh|next):(\d+)$/.exec(id);
    if (navMatch) {
      const [, action, curPageStr] = navMatch;
      const curPage = Number(curPageStr);
      let page = curPage;
      if (action === "prev")    page = Math.max(1, curPage - 1);
      else if (action === "next")    page = curPage + 1;
      // "refresh" keeps the current page as-is.

      const entries = db.getLogState().entries ?? [];
      await interaction.update({
        embeds:     [buildLogDashboardEmbed(entries, page)],
        components: buildLogDashboardComponents(entries, page),
      });
      return;
    }

    if (id === "bblog:pagesel" && interaction.isStringSelectMenu()) {
      const page    = Number(interaction.values[0]);
      const entries = db.getLogState().entries ?? [];
      await interaction.update({
        embeds:     [buildLogDashboardEmbed(entries, page)],
        components: buildLogDashboardComponents(entries, page),
      });
      return;
    }
  } catch (e) {
    logger.error(`[BoomBox] Log interaction error for "${id}": ${e.message}`);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "❌ Terjadi kesalahan pada BoomBox Logs.", ephemeral: true }).catch(() => {});
    }
  }
}
