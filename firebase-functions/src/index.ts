import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import axios from "axios";

import { SMSService, db } from "./smsService";

// ==========================================
// 1. IRD Proxy
//
// This function is being retired in favor of the Java backend submitting to
// IRD directly (see billing-backend IrdCbmsService). Invoice creation,
// payment re-sync, and credit notes for appointments/pathology/pharmacy all
// route through the Java backend now — this proxy remains live only as a
// fallback for invoices created before that migration (no javaInvoiceId on
// the Firestore record), via the legacy path in
// src/services/irdCbmsService.ts. Locked down from its original state,
// which accepted any `endpoint` from an unauthenticated caller (an open
// SSRF proxy that would forward arbitrary payloads to any URL).
// ==========================================
const ALLOWED_IRD_HOSTS = ["https://cbapi.ird.gov.np"];

export const irdProxy = onRequest({ cors: true }, async (req, res) => {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ success: false, message: "Method not allowed" });

      return;
    }

    const authHeader = req.headers.authorization || "";

    if (!authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Missing or invalid Authorization header",
      });

      return;
    }
    try {
      await admin.auth().verifyIdToken(authHeader.substring(7));
    } catch (authErr) {
      res
        .status(401)
        .json({ success: false, message: "Invalid or expired token" });

      return;
    }

    const { endpoint, payload } = req.body || {};

    if (!endpoint || !payload) {
      res
        .status(400)
        .json({ success: false, message: "Missing endpoint or payload" });

      return;
    }

    if (
      !ALLOWED_IRD_HOSTS.some(
        (host) => typeof endpoint === "string" && endpoint.startsWith(host),
      )
    ) {
      logger.warn(
        `Rejected irdProxy request to disallowed endpoint: ${endpoint}`,
      );
      res.status(400).json({
        success: false,
        message: "Endpoint is not an allowed IRD host",
      });

      return;
    }

    logger.info(`Proxying request to IRD API: ${endpoint}`);

    const irdResponse = await axios.post(endpoint, payload, {
      headers: { "Content-Type": "application/json" },
      validateStatus: () => true,
    });

    res.json({
      success: true,
      status: irdResponse.status,
      data: irdResponse.data,
    });
  } catch (err: any) {
    logger.error(`Failed to proxy to IRD: ${err.message}`);
    res.status(500).json({
      success: false,
      message: "Failed to proxy request",
      error: err.message,
    });
  }
});

// ==========================================
// 2. SMS Tester
// ==========================================
export const smsTester = onRequest({ cors: true }, async (req, res) => {
  const smsService = new SMSService();

  try {
    const { method } = req;

    if (method === "GET" || !req.body || Object.keys(req.body).length === 0) {
      res.json({
        success: true,
        message: "SMS Tester Function is running",
        timestamp: new Date().toISOString(),
      });

      return;
    }

    if (method === "POST") {
      const { action, phoneNumber, message, scheduledTime, recipients } =
        req.body;

      switch (action) {
        case "send_test_sms": {
          const result = await smsService.sendMessage(phoneNumber, message);

          await smsService.logSMSResult({
            phone_number: phoneNumber,
            message,
            status: result.success ? "sent" : "failed",
            response: JSON.stringify(result),
            test_type: "manual_test",
          });
          res.json({
            success: true,
            data: {
              sent: result.success,
              response: result,
              phoneNumber,
              message,
            },
          });

          return;
        }
        case "send_batch_test": {
          if (!Array.isArray(recipients)) {
            res.status(400).json({
              success: false,
              message: "Recipients array is required",
            });

            return;
          }
          const results = [];

          for (const recipient of recipients) {
            try {
              const result = await smsService.sendMessage(
                recipient.phoneNumber,
                recipient.message,
              );

              await smsService.logSMSResult({
                phone_number: recipient.phoneNumber,
                message: recipient.message,
                status: result.success ? "sent" : "failed",
                response: JSON.stringify(result),
                test_type: "batch_test",
              });
              results.push({
                phoneNumber: recipient.phoneNumber,
                success: result.success,
                response: result,
              });
            } catch (err: any) {
              await smsService.logSMSResult({
                phone_number: recipient.phoneNumber,
                message: recipient.message,
                status: "error",
                error_message: err.message,
                test_type: "batch_test",
              });
              results.push({
                phoneNumber: recipient.phoneNumber,
                success: false,
                error: err.message,
              });
            }
          }
          const successCount = results.filter((r) => r.success).length;

          res.json({
            success: true,
            data: {
              total: recipients.length,
              successful: successCount,
              failed: recipients.length - successCount,
              results,
            },
          });

          return;
        }
        case "schedule_test": {
          const scheduleDate = new Date(scheduledTime);

          if (scheduleDate <= new Date()) {
            res.status(400).json({
              success: false,
              message: "Scheduled time must be in the future.",
            });

            return;
          }
          await smsService.logSMSResult({
            phone_number: phoneNumber,
            message,
            status: "scheduled",
            scheduled_time: scheduleDate.toISOString(),
            test_type: "scheduled_test",
          });
          res.json({
            success: true,
            data: {
              phoneNumber,
              message,
              scheduledTime: scheduleDate.toISOString(),
              status: "scheduled",
            },
          });

          return;
        }
        case "get_test_logs": {
          const snapshot = await db
            .collection("sms_test_logs")
            .orderBy("timestamp", "desc")
            .limit(100)
            .get();
          const logs = snapshot.docs.map((doc) => ({
            $id: doc.id,
            ...doc.data(),
          }));

          res.json({ success: true, data: logs });

          return;
        }
        default:
          res.status(400).json({ success: false, message: "Invalid action" });

          return;
      }
    }
    res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (err: any) {
    logger.error("Function error:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
});

// ==========================================
// 3. SMS Scheduler
// ==========================================
export const smsScheduler = onSchedule("every 1 minutes", async (event) => {
  const smsService = new SMSService();

  try {
    const now = new Date();
    const snapshot = await db
      .collection("sms_test_logs")
      .where("status", "==", "scheduled")
      .get();

    const dueSMS = snapshot.docs.filter((doc) => {
      const data = doc.data();

      if (!data.scheduled_time) return false;
      const scheduledDate = new Date(data.scheduled_time);

      return !isNaN(scheduledDate.getTime()) && scheduledDate <= now;
    });

    if (dueSMS.length === 0) return;

    for (const doc of dueSMS) {
      const sms = doc.data();

      try {
        const result = await smsService.sendMessage(
          sms.phone_number,
          sms.message,
        );

        await doc.ref.update({
          status: result.success ? "sent" : "failed",
          response: JSON.stringify(result),
          error_message: result.success
            ? null
            : result.error || "Failed to send SMS",
          timestamp: new Date().toISOString(),
        });
      } catch (err: any) {
        await doc.ref.update({
          status: "failed",
          error_message: err.message,
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    logger.error("SMS Scheduler error:", err);
  }
});
