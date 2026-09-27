import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import type { FirebaseStorage } from "firebase/storage";

const publicConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firebaseDb: Firestore | null = null;
let firebaseStorage: FirebaseStorage | null = null;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function ensureInitialized(): {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
} {
  if (!isBrowser()) {
    throw new Error(
      "lib/firebase/client must only be used in client components; use lib/firebase/admin on server."
    );
  }
  if (firebaseApp && firebaseAuth && firebaseDb && firebaseStorage) {
    return { app: firebaseApp, auth: firebaseAuth, db: firebaseDb, storage: firebaseStorage };
  }
  const { initializeApp, getApps, getApp } = require("firebase/app") as typeof import("firebase/app");
  const { getAuth } = require("firebase/auth") as typeof import("firebase/auth");
  const { getFirestore } = require("firebase/firestore") as typeof import("firebase/firestore");
  const { getStorage } = require("firebase/storage") as typeof import("firebase/storage");

  const existing = getApps();
  firebaseApp = existing.length > 0 ? getApp() : initializeApp(publicConfig);
  firebaseAuth = getAuth(firebaseApp);
  firebaseDb = getFirestore(firebaseApp);
  firebaseStorage = getStorage(firebaseApp);
  return { app: firebaseApp, auth: firebaseAuth, db: firebaseDb, storage: firebaseStorage };
}

export function getFirebaseClientAuth(): Auth {
  return ensureInitialized().auth;
}

export function getFirebaseClientDb(): Firestore {
  return ensureInitialized().db;
}

export function getFirebaseClientStorage(): FirebaseStorage {
  return ensureInitialized().storage;
}

export function getFirebaseClientApp(): FirebaseApp {
  return ensureInitialized().app;
}

export { firebaseApp, firebaseAuth, firebaseDb, firebaseStorage };

export type UserRole = "admin" | "client";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string | null;
  role: UserRole;
  phone?: string | null;
  company?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
}
