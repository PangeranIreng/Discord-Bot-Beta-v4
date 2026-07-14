# Keylogger Scanner Bot

A Discord bot (discord.js v14) that automatically scans file attachments posted in a designated channel and reports a cautious, heuristic threat assessment. Also bundles a BoomBox music module, a ticket system, and a bug report system for the same Discord server.

## Run & Operate

- `pnpm --filter @workspace/keylogger-scanner-bot run dev` — run the bot (bound to the "Keylogger Scanner Bot" workflow)
- Required secrets: `BOT_TOKEN` (Discord bot token from the Discord Developer Portal) — already set
- Config: `artifacts/keylogger-scanner-bot/.env.example` documents `SCAN_CHANNEL_ID` and other env vars; see `artifacts/keylogger-scanner-bot/config/config.js` and `config/ids.js`

## Stack

- pnpm workspaces, Node.js 24
- Discord bot: discord.js v14, ESM (`"type": "module"`)
- Lua parsing: luaparse; ZIP handling: adm-zip; media: @distube/ytdl-core

## Where things live

- `artifacts/keylogger-scanner-bot/scanner/` — file-scanning/deobfuscation engine (detector, parser, decoder, deobfuscator, riskScore, scorer, report)
- `artifacts/keylogger-scanner-bot/boombox/` — music/BoomBox module (ytmp3gg, top4top downloaders, JSON-file DB, premium role sync)
- `artifacts/keylogger-scanner-bot/ticket/` and `bugreport/` — ticket and bug-report subsystems, each with their own JSON-file DB
- `artifacts/keylogger-scanner-bot/data/*.json` — flat-file JSON databases (no external DB)
- Other workspace packages (`lib/api-server`, `lib/api-spec`, etc.) are unused scaffolding from the pnpm-workspace template, not part of this bot

## Architecture decisions

- No slash-command-driven scanning: file scanning is fully automatic in `SCAN_CHANNEL_ID`, silent everywhere else (except `!hesu` status command).
- The scanner never fabricates results it can't produce (e.g. RAR/7z/EXE bytecode decompilation) — reports "limited analysis" instead of a fake verdict. See `.agents/memory/keylogger-scanner-honesty-scope.md`.
- Persistence uses flat JSON files per subsystem rather than a real database — matches the bot's original design; not migrated.

## Product

- Auto-scans uploaded files for keylogger/malware indicators and posts a threat-assessment embed with Full Preview / Download / Copy Webhook / Copy Indicators / Scan Again buttons.
- BoomBox: play/queue music in voice channels via YouTube/top4top downloads, with a premium tier synced to a Discord role.
- Ticket and bug-report systems with their own commands and dashboards.

## User preferences

_None recorded yet._

## Gotchas

- Run `pnpm install` inside `artifacts/keylogger-scanner-bot` after a fresh import/clone — `node_modules` is not checked in and the workflow will fail with `ERR_MODULE_NOT_FOUND` until dependencies are installed.
- This project does not use the monorepo's `api-server`/`db`/Postgres stack at all; ignore those packages when working on the bot.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See `.agents/memory/` topic files for BoomBox architecture, the anti-bot/permanent-failure bug fix, and Lua AST analysis pitfalls
