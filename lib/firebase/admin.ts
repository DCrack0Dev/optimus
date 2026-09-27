import admin from "firebase-admin";

type ServiceAccountJson = {
  project_id: string;
  private_key: string;
  client_email: string;
};

const requiredEnv = (name: string): string | undefined => {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
};

function buildServiceAccountFromEnv(): ServiceAccountJson | null {
  const projectId = requiredEnv("FIREBASE_ADMIN_PROJECT_ID");
  const privateKey = requiredEnv("FIREBASE_ADMIN_PRIVATE_KEY");
  const clientEmail = requiredEnv("FIREBASE_ADMIN_CLIENT_EMAIL");
  if (!projectId || !privateKey || !clientEmail) return null;
  const normalizedKey = privateKey.includes("\\n")
    ? privateKey.replace(/\\n/g, "\n")
    : privateKey;
  return { project_id: projectId, private_key: normalizedKey, client_email: clientEmail };
}

function buildServiceAccountFromJsonString(): ServiceAccountJson | null {
  const raw = requiredEnv("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as ServiceAccountJson;
    if (!obj.project_id || !obj.private_key || !obj.client_email) return null;
    const normalizedKey = obj.private_key.includes("\\n")
      ? obj.private_key.replace(/\\n/g, "\n")
      : obj.private_key;
    return { ...obj, private_key: normalizedKey };
  } catch {
    return null;
  }
}

let cachedApp: admin.app.App | null = null;
let cachedAdminAuth: admin.auth.Auth | null = null;
let cachedAdminDb: admin.firestore.Firestore | null = null;
let cachedAdminStorage: admin.storage.Storage | null = null;
let initialised = false;
let initError: Error | null = null;

function ensureAdminInit(): void {
  if (initialised) return;
  initialised = true;
  try {
    const existingApps = admin.apps.filter((a) => a);
    if (existingApps.length > 0) {
      cachedApp = existingApps[0] ?? null;
    } else {
      const account =
        buildServiceAccountFromJsonString() ?? buildServiceAccountFromEnv();
      if (!account) {
        throw new Error(
          "Firebase Admin not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_ADMIN_PROJECT_ID+FIREBASE_ADMIN_PRIVATE_KEY+FIREBASE_ADMIN_CLIENT_EMAIL server env vars."
        );
      }
      cachedApp = admin.initializeApp({
        credential: admin.credential.cert(
          account as admin.ServiceAccount
        ),
        storageBucket:
          requiredEnv("FIREBASE_ADMIN_STORAGE_BUCKET") ??
          `${account.project_id}.appspot.com`,
        projectId: account.project_id
      });
    }
    cachedAdminAuth = admin.auth(cachedApp ?? undefined);
    cachedAdminDb = admin.firestore(cachedApp ?? undefined);
    cachedAdminStorage = admin.storage(cachedApp ?? undefined);
  } catch (err) {
    initError = err instanceof Error ? err : new Error(String(err));
  }
}

function must<T>(v: T | null, label: string): T {
  ensureAdminInit();
  if (initError) throw initError;
  if (!v) throw new Error(`Firebase admin: ${label} not initialised`);
  return v;
}

export function getAdminApp(): admin.app.App {
  return must(cachedApp, "app");
}
export function getAdminAuth(): admin.auth.Auth {
  return must(cachedAdminAuth, "auth");
}
export function getAdminDb(): admin.firestore.Firestore {
  return must(cachedAdminDb, "firestore");
}
export function getAdminStorage(): admin.storage.Storage {
  return must(cachedAdminStorage, "storage");
}

export function isAdminConfigured(): boolean {
  try {
    ensureAdminInit();
    return !initError && Boolean(cachedApp);
  } catch {
    return false;
  }
}

export function _setAdminStubsForTesting(
  stubs:
    | {
        app: admin.app.App | null;
        auth: admin.auth.Auth | null;
        db: admin.firestore.Firestore | null;
        storage: admin.storage.Storage | null;
      }
): void {
  initialised = true;
  initError = null;
  cachedApp = stubs.app;
  cachedAdminAuth = stubs.auth;
  cachedAdminDb = stubs.db;
  cachedAdminStorage = stubs.storage;
}

export function _clearAdminStubsForTesting(): void {
  initialised = false;
  initError = null;
  cachedApp = null;
  cachedAdminAuth = null;
  cachedAdminDb = null;
  cachedAdminStorage = null;
}
