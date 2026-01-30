/**
 * Send a single test FCM notification from the command line.
 * Use this to verify backend Firebase credentials and a device token.
 *
 * Prerequisites:
 *   - Backend .env has FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_CREDENTIALS set.
 *
 * Usage (from backend folder):
 *   FCM_TOKEN="your-fcm-token" npx ts-node scripts/send-test-notification.ts
 *   FCM_TOKEN="..." NOTIF_TITLE="Hi" NOTIF_BODY="Test" npx ts-node scripts/send-test-notification.ts
 *
 * Windows PowerShell:
 *   $env:FCM_TOKEN = "your-fcm-token"; npx ts-node scripts/send-test-notification.ts
 */

import * as path from "path";
import * as fs from "fs";

// Load .env from backend root
const backendRoot = path.resolve(__dirname, "..");
const envPath = path.join(backendRoot, ".env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const eq = trimmed.indexOf("=");
      if (eq > 0) {
        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1).replace(/\\"/g, '"');
        }
        if (!process.env[key]) process.env[key] = value;
      }
    }
  }
}

const token = process.env.FCM_TOKEN?.trim();
if (!token || token.length < 20) {
  console.error("Missing or invalid FCM_TOKEN. Set it to the device FCM token.");
  console.error("Example: FCM_TOKEN=\"your-token\" npx ts-node scripts/send-test-notification.ts");
  process.exit(1);
}

const title = process.env.NOTIF_TITLE ?? "Notification Test";
const body = process.env.NOTIF_BODY ?? "Test push from send-test-notification script.";

async function main() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const admin = require("firebase-admin");

  let credentials: admin.ServiceAccount | undefined;

  if (process.env.FIREBASE_CREDENTIALS) {
    try {
      credentials = JSON.parse(process.env.FIREBASE_CREDENTIALS) as admin.ServiceAccount;
    } catch (e) {
      console.error("FIREBASE_CREDENTIALS is not valid JSON.");
      process.exit(1);
    }
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const credPath = path.isAbsolute(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
      ? process.env.FIREBASE_SERVICE_ACCOUNT_PATH
      : path.join(backendRoot, process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
    if (!fs.existsSync(credPath)) {
      console.error("FIREBASE_SERVICE_ACCOUNT_PATH file not found:", credPath);
      process.exit(1);
    }
    credentials = JSON.parse(fs.readFileSync(credPath, "utf8")) as admin.ServiceAccount;
  } else {
    console.error("Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_CREDENTIALS in .env (or environment).");
    process.exit(1);
  }

  if (!admin.apps?.length) {
    admin.initializeApp({ credential: admin.credential.cert(credentials) });
  }

  const messaging = admin.messaging();

  try {
    await messaging.send({
      token,
      notification: { title, body },
      android: { priority: "high" as const },
      apns: {
        payload: { aps: { sound: "default" } },
      },
      data: { type: "LOCAL_DEBUG" },
    });
    console.log("Sent successfully. Check the device for the notification.");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Send failed:", message);
    if (err && typeof (err as { code?: string }).code === "string") {
      console.error("Code:", (err as { code: string }).code);
    }
    process.exit(1);
  }
}

main();
