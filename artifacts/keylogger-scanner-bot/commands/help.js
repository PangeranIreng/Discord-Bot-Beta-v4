/**
 * commands/help.js — /help slash command.
 *
 * The command *list* (names) is still pulled live from the registry so it
 * can never drift out of sync with what's actually deployed to Discord —
 * but each command gets a hand-written description + example here since
 * SlashCommandBuilder descriptions are too short for full usage docs.
 */

import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Tampilkan semua perintah BoomBox & Keylogger Scanner");

const SEP = "─────────────────────────";

/** Hand-written usage docs, keyed by command name. Falls back to the live
 * SlashCommandBuilder description for any command not listed here. */
const USAGE = {
  addprem: {
    emoji: "👑",
    summary: "Berikan BoomBox Premium (akses tak terbatas) ke user atau role.",
    examples: [
      "`/addprem @user 7d` → Premium 7 hari",
      "`/addprem @user 12h` → Premium 12 jam",
      "`/addprem @user 30m` → Premium 30 menit",
      "`/addprem @user 7` → **Permanent** (angka saja = Permanent)",
    ],
  },
  removeprem: {
    emoji: "❌",
    summary: "Cabut BoomBox Premium dari user atau role — berlaku segera.",
    examples: ["`/removeprem @user`", "`/removeprem @Premium`"],
  },
  setlimit: {
    emoji: "📊",
    summary: "Atur limit permintaan BoomBox per hari untuk user atau role.",
    examples: [
      "`/setlimit @user 20` → Permanent, 20x/hari",
      "`/setlimit @user 20 7d` → Temporary, 20x/hari selama 7 hari",
      "`/setlimit @Free 15` → berlaku untuk semua pemegang role Free",
    ],
  },
  resetlimit: {
    emoji: "🔄",
    summary: "Hapus limit khusus (kembali ke default) & pulihkan penggunaan hari ini ke penuh.",
    examples: ["`/resetlimit @user`", "`/resetlimit @Free`"],
  },
  help: {
    emoji: "📖",
    summary: "Tampilkan pesan bantuan ini.",
    examples: ["`/help`"],
  },
};

export async function execute(interaction, ctx) {
  const names = [...ctx.commands.keys()].sort();

  const commandFields = names.map((name) => {
    const cmd   = ctx.commands.get(name);
    const usage = USAGE[name];
    if (!usage) {
      return { name: `/${name}`, value: cmd.data.description, inline: false };
    }
    return {
      name:  `${usage.emoji} /${name}`,
      value: [usage.summary, ...usage.examples].join("\n"),
      inline: false,
    };
  });

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("📖 Bantuan — BoomBox & Keylogger Scanner")
    .setDescription(
      [
        "🎵 **BoomBox** mengubah link YouTube/TikTok menjadi link audio MP3 permanen.",
        "Kirim link ke channel BoomBox — bot akan memproses otomatis.",
        "",
        "**Platform didukung:**",
        "• YouTube: `youtube.com`, `youtu.be`, `music.youtube.com`",
        "• TikTok: `tiktok.com`, `vt.tiktok.com`, `vm.tiktok.com`, `m.tiktok.com`, `music.tiktok.com`",
        "",
        SEP,
        "**Perintah tersedia:**",
      ].join("\n"),
    )
    .addFields(commandFields)
    .addFields({
      name: "ℹ️ Perintah lain (non-slash)",
      value: "`!hesu` — status Keylogger Scanner Bot (perintah teks, bukan slash command)",
    })
    .setFooter({ text: `${names.length} slash command terdaftar` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
