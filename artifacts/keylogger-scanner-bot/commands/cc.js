/**
 * commands/cc.js — /cc <jumlah>
 *
 * Hapus N pesan terakhir dari channel saat ini.
 * Owner/Developer only.
 */

import { SlashCommandBuilder } from "discord.js";
import { denyIfNotStaff } from "./permissions.js";
import { logger } from "../utils/logger.js";

export const data = new SlashCommandBuilder()
  .setName("cc")
  .setDescription("Hapus pesan terakhir di channel ini (Owner/Developer only)")
  .addIntegerOption((opt) =>
    opt
      .setName("jumlah")
      .setDescription("Jumlah pesan yang akan dihapus (1–100)")
      .setMinValue(1)
      .setMaxValue(100)
      .setRequired(true),
  );

export async function execute(interaction) {
  if (await denyIfNotStaff(interaction)) return;

  const jumlah = interaction.options.getInteger("jumlah", true);

  await interaction.deferReply({ ephemeral: true });

  try {
    const channel = interaction.channel;
    if (!channel?.isTextBased()) {
      await interaction.editReply({ content: "❌ Command ini hanya bisa digunakan di channel teks." });
      return;
    }

    // Discord bulk-delete API only works for messages younger than 14 days.
    // Fetch up to `jumlah` messages and split them into bulk-delete-eligible
    // vs older (must be deleted one-by-one, slower).
    const fetched = await channel.messages.fetch({ limit: jumlah });
    if (fetched.size === 0) {
      await interaction.editReply({ content: "ℹ️ Tidak ada pesan yang ditemukan." });
      return;
    }

    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000; // 14 days ago
    const bulk   = fetched.filter((m) => m.createdTimestamp > cutoff);
    const old    = fetched.filter((m) => m.createdTimestamp <= cutoff);

    let deleted = 0;

    if (bulk.size >= 2) {
      await channel.bulkDelete(bulk, true);
      deleted += bulk.size;
    } else if (bulk.size === 1) {
      await bulk.first().delete().catch(() => {});
      deleted += 1;
    }

    // Delete older messages one by one (rate-limited path)
    for (const msg of old.values()) {
      await msg.delete().catch(() => {});
      deleted++;
      // Small delay to respect rate limits
      await new Promise((r) => setTimeout(r, 400));
    }

    await interaction.editReply({
      content: `✅ Berhasil menghapus **${deleted}** pesan dari ${channel}.`,
    });
    logger.info(`[CC] ${interaction.user.tag} menghapus ${deleted} pesan di #${channel.name}`);
  } catch (e) {
    logger.error(`[CC] Error: ${e.message}`);
    await interaction.editReply({
      content: `❌ Gagal menghapus pesan: ${e.message.slice(0, 200)}`,
    }).catch(() => {});
  }
}
