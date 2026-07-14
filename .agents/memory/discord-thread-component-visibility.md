---
name: Discord thread component visibility & permission limits
description: Why per-viewer button visibility and per-member thread permission overwrites are not achievable inside a single Discord thread, and the workaround used in this project's Ticket system.
---

Discord has no concept of showing a message component (button/select) to only
some viewers of a channel or thread — every member with access to that
thread/channel sees the same message and the same components. There is also
no per-member permission-overwrite support on `ThreadChannel` in discord.js
v14 (`ThreadChannel extends BaseChannel`, not `GuildChannel`, so it has no
`.permissionOverwrites`); thread access is controlled only by explicit
membership (`thread.members.add()`), not by per-user overwrites.

**Why:** This came up implementing a Ticket system where the ticket creator
must never see a staff-only "Claim Ticket" button that staff need in the same
thread as the creator's chat.

**How to apply:** When a control/action button must be hidden from some
members of a shared thread, do not try to solve it inside the thread. Move
the button to a separate message in a different, genuinely staff-only
channel (e.g. a "Ticket Logs"/staff channel whose Discord-side permissions
already restrict who can see it), and keep the shared thread limited to
plain text/status embeds with no actionable components. Update both messages
independently when state changes (e.g. claim/close).

Separately: Discord only supports true `ephemeral: true` replies on
**interactions** (slash commands, buttons, modals). A flow triggered by a
plain `messageCreate` event has no interaction to reply to, so there is no
way to send a real ephemeral message from it. The closest private-notice
equivalent is a DM to the user (edited in place for updates), with a
fallback to a single edited-in-place channel message if their DMs are
closed. Used for the BoomBox FIFO queue's position/ETA notice.
