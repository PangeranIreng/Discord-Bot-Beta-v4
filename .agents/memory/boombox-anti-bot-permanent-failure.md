---
name: BoomBox anti-bot vs permanent-failure classification bug
description: Why YouTube downloads in BoomBox were failing after only one attempt despite a multi-method fallback loop existing.
---

## The bug

`ytmp3gg.js`'s YouTube fallback tries several yt-dlp player clients in sequence, but only continues to the next one if `_isPermanentFailure(err)` returns false. That function matched on the substring `"login"` in the translated error message to detect real login-gated videos.

YouTube's anti-bot message ("Sign in to confirm you're not a bot") got translated by the generic `lower.includes("sign in")` branch into a message containing the word "login" — which then matched `_isPermanentFailure`'s `"login"` check and aborted the whole fallback loop after the very first player-client attempt, even though the other player clients (android/ios/tv_embedded/mweb) are exactly the ones likely to succeed where the default web client got bot-gated.

**Why:** Anti-bot detection is a per-client/per-IP fingerprint issue, not a real permanent block — it's the textbook case where trying a different client is expected to help. Age-restriction/real-login-required is a different, genuinely permanent condition. Both produced overlapping substrings ("sign in") once translated, so the permanent-failure classifier silently conflated them.

**How to apply:** When adding new error classification branches to a multi-method fallback (or generally, to any `_translateError`-style function feeding an `_isPermanentFailure`-style gate), check translated message text for keyword overlap with existing permanent-failure keywords before merging cases. Anti-bot-style errors should always be classified as retryable, not permanent, and should be checked/translated *before* more generic keyword branches that could otherwise swallow them.
