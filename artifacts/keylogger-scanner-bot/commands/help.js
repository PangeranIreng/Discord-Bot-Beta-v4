/**
 * commands/help.js — /help slash command.
 *
 * The command *list* (names) is still pulled live from the registry so it
 * can never drift out of sync with what's actually deployed to Discord —
 * but each command gets a hand-written description + example here since
 * SlashCommandBuilder descriptions are too short for full usage docs.
 * Commands are grouped by category for readability.
 */

import { SlashCommandBuilder, EmbedBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Tampilkan semua perintah BoomBox & Keylogger Scanner");

const SEP = "─────────────────────────";

/** Hand-written usage docs, keyed by command name. Falls back to the live
 * SlashCommandBuilder description for any command not listed here. */
const USAGE = {
  // 🎫 Ticket
  cticket: {
    emoji: "🎫",
    category: "🎫 Ticket",
    summary: "Konfigurasi sistem Open Ticket (panel, logs, mention role). Owner/Developer.",
    examples: ["`/cticket panel_channel:#tiket logs_channel:#log-tiket mention_role:@Staff`"],
  },
  delcticket: {
    emoji: "🗑️",
    category: "🎫 Ticket",
    summary: "Hapus panel, dashboard, dan konfigurasi Ticket System. Owner only.",
    examples: ["`/delcticket`"],
  },

  // 🐞 Report
  cbug: {
    emoji: "🐞",
    category: "🐞 Report",
    summary: "Konfigurasi Report Center — panel Bug Report & Feature Request. Owner only.",
    examples: ["`/cbug panel_channel:#lapor logs_channel:#log-lapor developer_role:@Dev`"],
  },
  delcbug: {
    emoji: "🗑️",
    category: "🐞 Report",
    summary: "Hapus panel dan konfigurasi Report Center. Owner only.",
    examples: ["`/delcbug`"],
  },

  // 👑 Premium
  addprem: {
    emoji: "👑",
    category: "👑 Premium",
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
    category: "👑 Premium",
    summary: "Cabut BoomBox Premium dari user atau role — berlaku segera.",
    examples: ["`/removeprem @user`", "`/removeprem @Premium`"],
  },
  setlimit: {
    emoji: "📊",
    category: "👑 Premium",
    summary: "Atur limit permintaan BoomBox per hari untuk user atau role.",
    examples: [
      "`/setlimit @user 20` → Permanent, 20x/hari",
      "`/setlimit @user 20 7d` → Temporary, 20x/hari selama 7 hari",
      "`/setlimit @Free 15` → berlaku untuk semua pemegang role Free",
    ],
  },
  resetlimit: {
    emoji: "🔄",
    category: "👑 Premium",
    summary: "Hapus limit khusus (kembali ke default) & pulihkan penggunaan hari ini ke penuh.",
    examples: ["`/resetlimit @user`", "`/resetlimit @Free`"],
  },

  // ℹ️ Umum
  help: {
    emoji: "📖",
    category: "ℹ️ Umum",
    summary: "Tampilkan pesan bantuan ini.",
    examples: ["`/help`"],
  },
};

const CATEGORY_ORDER = ["🎫 Ticket", "🐞 Report", "🎵 BoomBox", "👑 Premium", "📊 Monitoring", "ℹ️ Umum"];

export async function execute(interaction, ctx) {
  const names = [...ctx.commands.keys()].sort();

  const byCategory = new Map();
  for (const name of names) {
    const cmd   = ctx.commands.get(name);
    const usage = USAGE[name];
    const category = usage?.category ?? "ℹ️ Umum";
    const field = usage
      ? { name: `${usage.emoji} /${name}`, value: [usage.summary, ...usage.examples].join("\n") }
      : { name: `/${name}`, value: cmd.data.description };

    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push(field);
  }

  const commandFields = [];
  const orderedCategories = [
    ...CATEGORY_ORDER.filter((c) => byCategory.has(c)),
    ...[...byCategory.keys()].filter((c) => !CATEGORY_ORDER.includes(c)),
  ];
  for (const category of orderedCategories) {
    commandFields.push({ name: `${SEP}\n**${category}**`, value: "\u200B" });
    for (const field of byCategory.get(category)) {
      commandFields.push({ ...field, inline: false });
    }
  }

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
        "📊 **Monitoring** — dashboard Premium Monitoring (di channel monitoring) menampilkan status Premium/Custom Limit secara live, dengan tombol Premium / Custom Limit / Expired Soon / Refresh.",
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
