const crypto = require("crypto");
const { IdempotencyKey } = require("../models");

// In-memory tracking for automated double-click debounce
const inFlightRequests = new Set();
const recentSubmissions = new Map();

/**
 * Generate SHA-256 hash from request payload
 */
function hashPayload(payload) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload || {}))
    .digest("hex");
}

/**
 * Idempotency & Duplicate Request Protection Middleware
 *
 * Supports two layers of protection:
 * 1. Explicit Header ('X-Idempotency-Key' or 'Idempotency-Key'):
 *    Persists request/response in the database for 24 hours. Replays cached response for duplicates.
 * 2. Automated Rapid-Debounce (no header required):
 *    Prevents double-clicks and concurrent identical submissions within 2 seconds.
 *
 * @param {Object} options
 * @param {number} options.debounceMs - Debounce window in milliseconds (default: 2000ms)
 */
function idempotency(options = {}) {
  const debounceMs = options.debounceMs || 2000;

  return async (req, res, next) => {
    // Only apply to authenticated mutation requests
    if (!req.user || !req.user.id) {
      return next();
    }

    const userId = req.user.id;
    const clientKey =
      req.headers["x-idempotency-key"] ||
      req.headers["idempotency-key"] ||
      (req.body && req.body.client_order_id);
    const requestHash = hashPayload(req.body);
    const endpoint = req.originalUrl || req.baseUrl + req.path;

    if (clientKey) {
      // ===== Layer 1: Explicit Idempotency Key =====
      const keyString = String(clientKey).trim();

      try {
        const existingRecord = await IdempotencyKey.findOne({
          where: {
            user_id: userId,
            key: keyString,
          },
        });

        if (existingRecord) {
          // Check expiration
          const isExpired =
            existingRecord.expires_at &&
            new Date() > new Date(existingRecord.expires_at);

          if (!isExpired) {
            // Mismatched payload check
            if (existingRecord.request_hash !== requestHash) {
              return res.status(422).json({
                error:
                  "Idempotency key was previously used with a different request payload",
              });
            }

            // In-flight concurrent request check
            if (existingRecord.status === "processing") {
              return res.status(409).json({
                error:
                  "A request with this idempotency key is currently being processed",
              });
            }

            // Completed request replay
            if (existingRecord.status === "completed") {
              let parsedBody = existingRecord.response_body;
              try {
                parsedBody = JSON.parse(existingRecord.response_body);
              } catch (_) {}

              res.setHeader("X-Cache-Lookup", "HIT-IDEMPOTENT");
              return res
                .status(existingRecord.response_code || 200)
                .json(parsedBody);
            }
          } else {
            // Expired key, clean up
            await existingRecord.destroy();
          }
        }

        // Register key as 'processing'
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h TTL
        let record;
        try {
          record = await IdempotencyKey.create({
            user_id: userId,
            key: keyString,
            endpoint,
            request_hash: requestHash,
            status: "processing",
            expires_at: expiresAt,
          });
        } catch (dbErr) {
          if (
            dbErr.name === "SequelizeUniqueConstraintError" ||
            dbErr.name === "SequelizeDatabaseError"
          ) {
            return res.status(409).json({
              error:
                "A request with this idempotency key is currently being processed",
            });
          }
          throw dbErr;
        }

        // Intercept response to save status and payload
        const originalJson = res.json.bind(res);
        res.json = function (body) {
          const statusCode = res.statusCode || 200;
          const status = statusCode >= 200 && statusCode < 400 ? "completed" : "failed";

          record
            .update({
              status,
              response_code: statusCode,
              response_body: JSON.stringify(body),
            })
            .catch((err) => {
              console.error("Failed to update idempotency record:", err.message);
            });

          return originalJson(body);
        };

        return next();
      } catch (err) {
        return next(err);
      }
    } else {
      // ===== Layer 2: Automated Double-Click Debouncing =====
      const flightKey = `${userId}:${endpoint}:${requestHash}`;

      // In-flight concurrency check
      if (inFlightRequests.has(flightKey)) {
        return res.status(409).json({
          error:
            "A duplicate request is already in progress. Please wait for completion.",
        });
      }

      // Rapid consecutive submit check
      const lastSubmitTime = recentSubmissions.get(flightKey);
      const now = Date.now();
      if (lastSubmitTime && now - lastSubmitTime < debounceMs) {
        return res.status(429).json({
          error:
            "Duplicate submission detected. Please wait a moment before trying again.",
        });
      }

      inFlightRequests.add(flightKey);
      recentSubmissions.set(flightKey, now);

      // Periodically clean up debounce cache
      if (recentSubmissions.size > 2000) {
        for (const [key, timestamp] of recentSubmissions.entries()) {
          if (now - timestamp > 10000) {
            recentSubmissions.delete(key);
          }
        }
      }

      const originalEnd = res.end.bind(res);
      res.end = function (...args) {
        inFlightRequests.delete(flightKey);
        return originalEnd(...args);
      };

      return next();
    }
  };
}

module.exports = idempotency;
