/**
 * premiumSweep.js — Background sweep that expires Premium grants and
 * custom limit overrides once their expiresAt timestamp has passed.
 *
 * premiumDB's getters already treat an expired record as absent (lazy
 * check), so access control never has a bug window -- but without this
 * sweep the Discord Premium *role* would only ever be removed the next
 * time that user happens to trigger a premiumDB read, and no expiration
 * would ever be logged to the Premium Dashboard. This turns that into an
 * active process running on an interval.
 */

import { IDS } from "../config/ids.js";
import { premDB } from "./db.js";
import { revokePremiumRole } from "./premiumRoleSync.js";
import { appendToPremiumLog } from "./premiumLog.js";
import { updateMonitoringDashboard } from "./monitoringDashboard.js";
import { logger } from "../utils/logger.js";
import { logError } from "../utils/errorLogger.js";

const SWEEP_INTERVAL_MS = 60 * 1000; // every 60s

async function sweepOnce(client) {
  try {
    let anyChanged = false;

    // ── Expired Premium users → revoke role, delete record, log ──────────
    for (const userId of premDB.getExpiredPremiumUsers()) {
      premDB.deletePremiumUser(userId);
      await revokePremiumRole(client, IDS.GUILD_ID, userId);
      await appendToPremiumLog(client, {
        action:   "Premium Expired",
        target:   `<@${userId}>`,
        executor: "System (auto-expire)",
        status:   "Expired",
      });
      logger.info(`[Premium] Expired premium for user ${userId}`);
      anyChanged = true;
    }

    // ── Expired Premium roles → just delete record, log ───────────────────
    for (const roleId of premDB.getExpiredPremiumRoles()) {
      premDB.deletePremiumRole(roleId);
      await appendToPremiumLog(client, {
        action:   "Premium Expired",
        target:   `<@&${roleId}>`,
        executor: "System (auto-expire)",
        status:   "Expired",
      });
      logger.info(`[Premium] Expired premium for role ${roleId}`);
      anyChanged = true;
    }

    // ── Expired custom limits → clean up quietly (revert to default) ──────
    for (const userId of premDB.getExpiredCustomLimitUsers()) {
      premDB.deleteCustomLimitUser(userId);
      logger.debug(`[Premium] Expired custom limit for user ${userId}`);
      anyChanged = true;
    }
    for (const roleId of premDB.getExpiredCustomLimitRoles()) {
      premDB.deleteCustomLimitRole(roleId);
      logger.debug(`[Premium] Expired custom limit for role ${roleId}`);
      anyChanged = true;
    }

    // ── Update dashboard if anything changed ──────────────────────────────
    if (anyChanged) {
      await updateMonitoringDashboard(client);
    }
  } catch (e) {
    logger.error(`[Premium] Sweep failed: ${e.message}`);
    await logError({
      feature: "Premium",
      reason:  `Sweep failed: ${e.message}`,
      stage:   "Premium Expiration Sweep",
      error:   e,
    });
  }
}

/**
 * Start the periodic sweep. Call once from clientReady.
 * @param {import("discord.js").Client} client
 */
export function startPremiumSweep(client) {
  // Run once immediately so anything that expired while the bot was down
  // is cleaned up right away, then on a fixed interval afterwards.
  sweepOnce(client);
  setInterval(() => sweepOnce(client), SWEEP_INTERVAL_MS);
  logger.info(`[Premium] Expiration sweep started (every ${SWEEP_INTERVAL_MS / 1000}s)`);
}
