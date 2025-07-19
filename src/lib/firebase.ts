import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "your-api-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "your-auth-domain",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "your-project-id",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "your-storage-bucket",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "your-sender-id",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "your-app-id",
};

// Initialize app only if all config values are provided
const app = 
  !getApps().length &&
  firebaseConfig.apiKey && firebaseConfig.apiKey !== "your-api-key" &&
  firebaseConfig.authDomain && firebaseConfig.authDomain !== "your-auth-domain" &&
  firebaseConfig.projectId && firebaseConfig.projectId !== "your-project-id"
    ? initializeApp(firebaseConfig) 
    : getApps().length > 0 
    ? getApp()
    : null;

const auth = app ? getAuth(app) : null;

export { app, auth };
