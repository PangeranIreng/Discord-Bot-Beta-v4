---
name: Keylogger scanner missing utils
description: Five utility files in the keylogger-scanner-bot were empty or missing at project import time; all have been written and verified.
---

## What was missing / empty

| File | State | Effect |
|------|-------|--------|
| `utils/errorLogger.js` | 0-byte (empty) | `initErrorLogger`/`logError` were undefined → crash on any error path |
| `utils/logger.js` | Missing entirely | Every module fails to start |
| `utils/fileUtils.js` | Missing | `formatBytes`, `truncate`, `getExtension`, `calculateEntropy`, `printableRatio` unresolvable → scan pipeline crash |
| `utils/fullPreviewEmbed.js` | Missing | "Full Preview" button crashes with module-not-found |
| `utils/reportBuilder.js` | Missing | "Download Preview" button crashes with module-not-found |

## Exports written

- **logger.js** — `{ logger }` with `.debug/.info/.warn/.error`; respects `LOG_LEVEL` env var; trailing `Error` arg prints stack.
- **fileUtils.js** — `formatBytes(n)`, `truncate(str, max)`, `getExtension(filename)`, `calculateEntropy(buffer)`, `printableRatio(buffer)`.
- **errorLogger.js** — `initErrorLogger(client)` (call once in clientReady), `logError(payload)` (safe before init — queues internally). Posts EmbedBuilder to `IDS.ERROR_LOG_CHANNEL_ID`.
- **fullPreviewEmbed.js** — `buildFullPreviewEmbed(result)` → EmbedBuilder with risk breakdown, all indicators, entropy, decode layers, AST info, methods, conclusion.
- **reportBuilder.js** — `buildTextReport(result)` → plain-text `.txt` content covering all scan fields.

## No duplicate-execution bugs found

After a complete audit of every handler, listener, scheduler, and dedup guard:
- Single `new Client()` + single `client.login()` + single `messageCreate` + single `interactionCreate` listener.
- BoomBox `processingSet` dedup is correctly placed BEFORE any expensive download/upload work.
- Scanner `processedMessageIds` Set (max 500) dedup covers `handleAttachmentMessage` only — BoomBox has its own guard.
- `startPremiumSweep` and `deployCommands` called exactly once inside `clientReady`.
- DB singletons (`db`, `premDB`) correctly exported from `boombox/db.js` — no divergent in-memory caches.

**Why:** Worth recording because a future change that adds another listener registration or calls `startPremiumSweep` outside `clientReady` would silently introduce duplicates.

**How to apply:** Any new handler/scheduler must be wired inside `clientReady` exactly once; never at module top-level or in response to repeated events.
