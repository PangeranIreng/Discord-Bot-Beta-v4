// `!hesu` status command -- reports real, honest numbers about the bot's
// current state (latency, signature counts derived from the actual arrays
// used at scan time, not hardcoded/fabricated figures).

import { EmbedBuilder } from "discord.js";
import { INDICATOR_CATEGORIES } from "../heuristic/indicators.js";
import { KNOWN_OBFUSCATOR_NAMES } from "../detectors/obfuscatorDetector.js";

// Bumped alongside package.json when the analysis pipeline changes.
export const SCANNER_VERSION = "2.0.0";

export async function handleHesuCommand(message, client) {
  const wsPing = Math.round(client.ws.ping);
  const start = Date.now();
  const pending = await message.reply("🔄 Mengecek status...");
  const roundTripMs = Date.now() - start;

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle("📡 Status Keylogger Scanner Bot")
    .addFields(
      { name: "🟢 Status", value: "Online", inline: true },
      { name: "📶 WS Ping", value: `${Number.isFinite(wsPing) ? wsPing : "-"} ms`, inline: true },
      { name: "⏱ Round-trip", value: `${roundTripMs} ms`, inline: true },
      { name: "🧬 Versi Scanner", value: SCANNER_VERSION, inline: true },
      { name: "📋 Kategori Indikator", value: `${INDICATOR_CATEGORIES.length}`, inline: true },
      { name: "🧪 Signature Obfuscator Dikenal", value: `${KNOWN_OBFUSCATOR_NAMES.length}`, inline: true },
      {
        name: "🧩 Komponen Aktif",
        value: [
          "✅ Entropy analysis",
          "✅ Layered decode (base64/hex/unicode/octal/decimal/gzip/zlib/XOR)",
          "✅ Obfuscator signature detection",
          "✅ Lua AST parsing",
          "✅ ZIP extraction",
          "✅ Webhook liveness check",
          "✅ Weighted risk scoring (Confidence 0-100)",
          "⚠ RAR/7z/EXE/DLL: deteksi format saja (tanpa ekstraksi/disassembly penuh)",
        ].join("\n"),
      },
    )
    .setFooter({ text: "Semua angka di atas dihitung langsung dari komponen bot yang berjalan." })
    .setTimestamp();

  await pending.edit({ content: "", embeds: [embed] });
}
