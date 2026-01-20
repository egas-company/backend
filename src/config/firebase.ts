import admin from "firebase-admin";
import { existsSync, readFileSync } from "node:fs";
import { logger } from "../lib/logger";

let firebaseApp: admin.app.App | null = null;

function loadCredentials(): admin.ServiceAccount | undefined {
  if (process.env.FIREBASE_CREDENTIALS) {
    try {
      return JSON.parse(process.env.FIREBASE_CREDENTIALS) as admin.ServiceAccount;
    } catch (error) {
      logger.error("Failed to parse FIREBASE_CREDENTIALS env", error);
      throw error;
    }
  }

  const credentialPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH; 
  if (credentialPath) {
    if (!existsSync(credentialPath)) {
      throw new Error(`Firebase service account file not found at ${credentialPath}`);
    }

    const fileContents = readFileSync(credentialPath, "utf8");
    return JSON.parse(fileContents) as admin.ServiceAccount;
  }

  return undefined;
}

export const getFirebaseApp = (): admin.app.App => {
  if (firebaseApp) {
    return firebaseApp;
  }

  const credentials = loadCredentials();

  if (credentials) {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(credentials),
    });
  } else {
    firebaseApp = admin.initializeApp();
  }

  logger.info("Firebase admin initialized");
  return firebaseApp;
};

export const getMessaging = (): admin.messaging.Messaging => {
  return getFirebaseApp().messaging();
};
