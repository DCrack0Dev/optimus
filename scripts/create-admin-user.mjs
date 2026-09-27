import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import admin from "firebase-admin";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const ENV_PATHS = [
  join(repoRoot, ".env.local"),
  join(repoRoot, ".env"),
  resolve(repoRoot, "..", "DTWS WEBSITE", ".env.local"),
  resolve(repoRoot, "..", "DTWS WEBSITE", ".env")
];

function readEnvVars() {
  const map = new Map();
  for (const p of ENV_PATHS) {
    if (!existsSync(p)) continue;
    const lines = readFileSync(p, "utf8").split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!map.has(key)) map.set(key, val);
    }
  }
  return map;
}

function tryInitAdmin(env) {
  const serviceJsonRaw = env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  let app = null;
  try { app = admin.app("admin-user-bootstrap"); } catch {}
  const init = (opts) => app ?? admin.initializeApp(opts, "admin-user-bootstrap");
  if (serviceJsonRaw && /^\s*\{/.test(serviceJsonRaw)) {
    try {
      const serviceAccount = JSON.parse(serviceJsonRaw);
      return init({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || env.get("FIREBASE_ADMIN_PROJECT_ID")
      });
    } catch { /* fall through */ }
  }
  const projectId = env.get("FIREBASE_ADMIN_PROJECT_ID") || env.get("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  const clientEmail = env.get("FIREBASE_ADMIN_CLIENT_EMAIL");
  const privateKeyRaw = env.get("FIREBASE_ADMIN_PRIVATE_KEY");
  if (projectId && clientEmail && privateKeyRaw) {
    const privateKey = privateKeyRaw.replace(/\\n/g, "\n").replace(/^"|"$/g, "");
    return init({
      credential: admin.credential.cert({
        type: "service_account",
        project_id: projectId,
        private_key: privateKey,
        client_email: clientEmail,
        token_uri: "https://oauth2.googleapis.com/token"
      }),
      projectId
    });
  }
  return null;
}

async function createAuthUserViaRest(env, email, password) {
  const apiKey = env.get("NEXT_PUBLIC_FIREBASE_API_KEY");
  if (!apiKey) throw new Error("NEXT_PUBLIC_FIREBASE_API_KEY missing — cannot create user via REST.");
  const projectId = env.get("NEXT_PUBLIC_FIREBASE_PROJECT_ID") || "dtws-web";
  const authDomain = env.get("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN") || `${projectId}.firebaseapp.com`;
  const fakeOrigin = env.get("SCRIPT_FIREBASE_ORIGIN") || `https://${authDomain}`;
  const headers = {
    "Content-Type": "application/json",
    "X-Client-Version": "FirebaseJS/10.13.2",
    "X-Firebase-Locale": "en",
    "X-Firebase-GMPID": "1:652254765397:web:d4e335aecd7fe69e588fdc",
    Origin: fakeOrigin,
    Referer: `${fakeOrigin}/`
  };
  const signUp = async () => {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    return { res, data: await res.json().catch(() => ({})) };
  };
  const signIn = async () => {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    return { res, data: await res.json().catch(() => ({})) };
  };
  let { res, data } = await signUp();
  if (!res.ok) {
    const msg = data?.error?.message;
    if (msg === "EMAIL_EXISTS") {
      const si = await signIn();
      if (si.res.ok && si.data?.localId) {
        console.log(`[+] Firebase Auth user already exists (REST): ${si.data.localId} <${email}>`);
        return { uid: si.data.localId, email, projectId, via: "rest-exists" };
      }
      if (!si.res.ok) {
        res = si.res; data = si.data;
      }
    } else if (msg && /KEY_INVALID|not valid/i.test(msg)) {
      // Try again with localhost referrer (some keys restricted to localhost only)
      const localhostHeaders = {
        ...headers,
        Origin: "http://localhost:3000",
        Referer: "http://localhost:3000/"
      };
      const retry = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: localhostHeaders,
          body: JSON.stringify({ email, password, returnSecureToken: true })
        }
      );
      const retryData = await retry.json().catch(() => ({}));
      if (retry.ok && retryData.localId) {
        console.log(`[+] Created Firebase Auth user (REST localhost): ${retryData.localId} <${email}>`);
        return { uid: retryData.localId, email, projectId, via: "rest-new" };
      }
      const exists = retryData?.error?.message === "EMAIL_EXISTS";
      if (exists) {
        const si2 = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
          {
            method: "POST",
            headers: localhostHeaders,
            body: JSON.stringify({ email, password, returnSecureToken: true })
          }
        );
        const si2d = await si2.json().catch(() => ({}));
        if (si2.ok && si2d.localId) {
          console.log(`[+] Firebase Auth user already exists (REST localhost): ${si2d.localId} <${email}>`);
          return { uid: si2d.localId, email, projectId, via: "rest-exists" };
        }
      }
      throw new Error(
        `Firebase REST Auth key invalid (status ${retry.status}): ${JSON.stringify(
          (retryData?.error && (retryData.error.message || retryData.error)) || retryData
        )}\n    Go to Google Cloud Console → APIs & Services → Credentials → Browser key for Firebase.\n    Either add IP none / no HTTP referrer restriction, OR add "http://localhost:*" and "https://${authDomain}/*" to allowed referrers.`
      );
    }
  }
  if (!res.ok) {
    throw new Error(
      `Firebase REST Auth failed: ${res.status} ${JSON.stringify(data?.error || data)}`
    );
  }
  console.log(`[+] Created Firebase Auth user (REST): ${data.localId} <${email}>`);
  return { uid: data.localId, email, projectId, via: "rest-new" };
}

async function main() {
  const ADMIN_EMAIL = process.env.DTWS_CREATE_OWNER_EMAIL || "owner@demitechwebservices.live";
  const ADMIN_PASSWORD = process.env.DTWS_CREATE_OWNER_PASSWORD || "1111ttttC";

  const env = readEnvVars();
  let uid = null;
  let mode = "";

  const adminApp = tryInitAdmin(env);
  if (adminApp) {
    mode = "admin-sdk";
    const auth = admin.auth(adminApp);
    let record;
    try {
      record = await auth.getUserByEmail(ADMIN_EMAIL);
      console.log(`[+] Firebase Auth user already exists (Admin SDK): ${record.uid} <${ADMIN_EMAIL}>`);
      await auth.updateUser(record.uid, { password: ADMIN_PASSWORD });
      console.log(`[+] Password updated for ${ADMIN_EMAIL}`);
    } catch (e) {
      if (e.code !== "auth/user-not-found") throw e;
      record = await auth.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        emailVerified: true,
        displayName: "DemiTech Owner"
      });
      console.log(`[+] Created Firebase Auth user (Admin SDK): ${record.uid} <${ADMIN_EMAIL}>`);
    }
    uid = record.uid;
    await auth.setCustomUserClaims(uid, { role: "admin", admin: true });
    console.log("[+] Custom claims set (Admin SDK): role=admin, admin=true");
    const db = admin.firestore(adminApp);
    await db.collection("profiles").doc(uid).set(
      {
        uid,
        email: ADMIN_EMAIL,
        role: "admin",
        displayName: "DemiTech Owner",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    console.log(`[+] Firestore profiles/${uid} written (Admin SDK): role=admin`);
  } else {
    mode = "rest-api";
    const user = await createAuthUserViaRest(env, ADMIN_EMAIL, ADMIN_PASSWORD);
    uid = user.uid;
    console.log("[!] Admin SDK NOT configured — skipping custom claims + Firestore profile write.");
    console.log("    Add the 2 fields below MANUALLY in Firebase Console UI:");
    console.log("");
    console.log(`    1. Firestore Database → Collection "profiles" → Document ID "${uid}" → fields:`);
    console.log(`         role         : "admin"  (string)`);
    console.log(`         email        : "${ADMIN_EMAIL}"  (string)`);
    console.log(`         uid          : "${uid}"  (string)`);
    console.log(`         displayName  : "DemiTech Owner"  (string, optional)`);
    console.log("");
    console.log(`    2. (Optional) Custom claims role=admin via Firebase CLI:`);
    console.log(`       firebase auth:import --hash-algo=... is not needed. Instead run:`);
    console.log(`       firebase use ${user.projectId};`);
    console.log(`       node -e "const a=require('firebase-admin');a.initializeApp({credential:a.credential.applicationDefault(),projectId:'${user.projectId}'});a.auth().setCustomUserClaims('${uid}',{role:'admin',admin:true}).then(()=>console.log('ok'))"`);
  }

  console.log("");
  console.log("================ LOGIN CREDENTIALS ================");
  console.log(`  Mode:     ${mode}`);
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  if (mode === "admin-sdk") {
    console.log(`  Role:     admin (claims + firestore profile) — READY`);
  } else {
    console.log(`  Role:     pending (MANUAL Firestore profile write REQUIRED — see above)`);
  }
  console.log("  UID:      " + uid);
  console.log("==================================================");
  console.log("");
  if (mode === "rest-api") {
    console.log("Reminder: paste the Firestore profile document (see [!] box above) before logging in.");
    console.log("The login route reads profiles/{uid}.role — without that doc you'll get forbidden_owner_only 403.");
    console.log("");
  }
}

main().catch((e) => {
  console.error("[-] FAILED:", e.message || String(e));
  process.exit(1);
});
