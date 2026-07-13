# Keylogger Scanner Bot

A Discord bot (discord.js v14) that automatically scans file attachments posted in a single, designated channel and reports a cautious, heuristic threat assessment as a Discord embed with interactive buttons. No slash commands — scanning is fully automatic and silent everywhere except the configured scan channel. The `!hesu` status command works in any channel.

## How it works

1. A user uploads a file in the scan channel (`SCAN_CHANNEL_ID`).
2. The bot replies "⏳ Sedang menganalisis file..." immediately.
3. It downloads the attachment, detects the file type, and:
   - Extracts ZIP archives and scans every file inside.
   - Reads `.luac` headers to identify the Lua bytecode version and best-effort extracts embedded strings; parses `.lua` source into a real AST (via luaparse).
   - Recognizes RAR/7z/EXE/DLL by magic bytes and still runs entropy + raw-string indicator scanning over them, but is explicit that container extraction/decompilation is **not** performed (no such library is used) rather than fabricating a fake analysis.
   - Runs a catalog of regex-based indicators: Discord webhooks, tokens, URLs/IPs/domains (including pastebin, GitHub raw, top4top, Dropbox, Google Drive, MediaFire, raw TCP/UDP/DNS patterns), base64/hex/decimal/octal-escape/gzip/zlib blobs, keylogger/clipboard/screenshot/browser-password/token-grabber/exfiltration/remote-download/dynamic-exec patterns, suspicious Lua functions, etc.
   - Attempts layered deobfuscation (base64, hex/unicode/decimal/octal escape, `string.char()`, single-byte XOR brute force, gzip/zlib decompression) and re-scans anything it successfully recovers.
4. It edits the status message into a final, concise embed with a **Confidence Score** (0-100, weighted from the indicators actually found) and a row of buttons: **Full Preview**, **Download Preview**, **Copy Webhook**, **Copy Indicators**, **Scan Again**.

Messages in any other channel, and messages without attachments, are ignored without any response (except `!hesu`, which works everywhere).

## Honesty guarantees

- The bot never states flatly that a file "aman" (safe) or "is a keylogger" — every status line is framed as "berdasarkan hasil analisis saat ini" (based on the current analysis), with wording that scales in caution as the Confidence Score rises.
- The bot never fabricates a result. If a file is encrypted, uses an unrecognized obfuscator/packer, or fails to parse, it reports **UNKNOWN** along with the specific reason.
- RAR/7z/EXE/DLL containers are explicitly reported as "limited analysis" — no fake decompilation, extraction, or opcode-level detail is invented for them.
- Deobfuscation only reports success when the decoded output is verified to be mostly printable text; it does not claim to defeat strong/custom encryption or obfuscation.
- Any unexpected error during download or analysis is caught and reported as UNKNOWN with the error reason — the bot process itself never crashes.

## Project structure

```
index.js               Bot entry point: Discord client + message/interaction listeners
config/config.js       Env var loading and validation
scanner/
  detector.js           Detection engine: file type (incl. RAR/7z/EXE/DLL magic bytes),
                         Lua variant, known obfuscator/protection signatures
  parser.js             Parsing engine: Lua bytecode header parsing + real Lua
                         AST parsing (via luaparse) for source files
  decoder.js            Decode primitives: Base64, hex/unicode/decimal/octal escape,
                         string.char(), single-byte XOR brute force, gzip/zlib inflate
  deobfuscator.js       Recovery engine: runs every decoder layer, strips simple junk
                         code, folds constant expressions, re-scans recovered text
  riskScore.js          Weighted 0-100 Risk Score / Confidence Score + the 5-band
                         (0-20/21-40/41-60/61-80/81-100) status text and colors
  scorer.js             Threat scoring narrative: explanation/summary/conclusion/
                         recommendation text per band, cautious non-absolute wording
  report.js             Assembles the final result object for the embed
  zipScanner.js         ZIP extraction with size/entry guard rails
  scanFile.js           Top-level orchestrator: runs every method in order
                         before ever falling back to UNKNOWN
  messageHandler.js     Discord message handling (status reply -> scan -> embed + buttons)
  interactionHandler.js Button interaction handling (Full Preview/Download/Copy/Rescan)
  scanContextStore.js   In-memory, TTL-based store backing the buttons
  hesuCommand.js         `!hesu` status command
heuristic/indicators.js Indicator scanning (webhooks, tokens, keylogger/stealer/
                         exfiltration/network patterns, dynamic exec, etc.)
utils/                 Logger, formatting helpers, embed builder, Full Preview embed,
                       button row builder, Download Preview report builder
.env.example           Documented environment variables
```

### Scan pipeline order

Deteksi tipe file (incl. RAR/7z/EXE/DLL via magic bytes) → Deteksi Lua
Source/Bytecode → Analisis entropy (deteksi enkripsi/packing) → Deteksi
obfuscator/protection → Recovery berlapis (setiap layer mencoba
string.char/Base64/Hex/Unicode/Decimal/Octal escape, gzip/zlib inflate pada
layer pertama, XOR brute force pada layer pertama) → Analisis bytecode (jika
bisa) → Hilangkan junk code sederhana → Simplify expression → Scan ulang
hasil recovery → Cek status webhook (jika ditemukan) → Scoring. **UNKNOWN**
is only returned once every method above has genuinely been tried and still
produced no usable text.

### Confidence Score bands

The Confidence Score *is* the weighted Risk Score (0-100), shown with its
band's color and cautious status text:

| Score  | Color            | Meaning                                                             |
| ------ | ---------------- | -------------------------------------------------------------------- |
| 0-20   | 🟢 Hijau         | Risiko sangat rendah; belum ditemukan indikator berarti.             |
| 21-40  | 🟩 Hijau Muda    | Tidak cukup bukti untuk memastikan keamanan file.                    |
| 41-60  | 🟡 Kuning        | Perlu diperiksa lebih lanjut secara manual.                          |
| 61-80  | 🟠 Orange        | Banyak indikator mencurigakan; hasil belum final.                    |
| 81-100 | 🔴 Merah         | Kemungkinan besar mengandung perilaku Keylogger/Stealer.             |

"Recovery %" (how much of the file's content could actually be read) is
reported separately and never conflated with the Confidence Score.

### Buttons

Each scan result embed ships with a row of buttons (backed by an in-memory,
30-minute TTL context store keyed by scan ID — cleared on bot restart). Every
button reply is **ephemeral** — only visible to the person who clicked it:

- **Full Preview** — exhaustive embed: entropy, decoded layers, full
  indicator list, URLs/IPs, AST result, risk score breakdown, recommendation.
- **Download Preview** — generates and attaches a `.txt` file with the full
  analysis report (not the original scanned file).
- **Copy Webhook** — ephemeral message with the raw webhook URL, if found.
- **Copy Indicators** — ephemeral message with the full indicator list.
- **Scan Again** — re-runs the whole pipeline on the same bytes.

### `!hesu` command

Works in any channel. Reports bot uptime/latency, scanner version, and real
counts (indicator categories, known obfuscator signatures) pulled directly
from the arrays used at scan time — never hardcoded/fabricated numbers.

## Configuration

Set these as environment variables (Replit Secrets for `BOT_TOKEN`):

| Variable          | Description                                            |
| ----------------- | -------------------------------------------------------- |
| `BOT_TOKEN`       | Discord bot token from the Developer Portal.            |
| `SCAN_CHANNEL_ID` | The only channel ID the bot scans attachments in.        |

## Supported file formats

`.lua`, `.luac`, `.js`, `.py`, `.txt`, `.json`, `.zip` (zip contents are extracted and each file inside is scanned), plus limited-analysis support for `.rar`, `.7z`, `.exe`, `.dll` (entropy + raw-string scanning only — no extraction/decompilation).

## Running

```
pnpm --filter @workspace/keylogger-scanner-bot run dev
```
