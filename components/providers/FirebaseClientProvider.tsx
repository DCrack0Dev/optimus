"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword as fbSignInEmail,
  createUserWithEmailAndPassword as fbCreateEmail,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  type User
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import {
  getFirebaseClientAuth,
  getFirebaseClientDb,
  type UserProfile,
  type UserRole
} from "@optimus/lib/firebase/client";

interface FirebaseAuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  initialising: boolean;
  signInEmail: (email: string, password: string) => Promise<UserProfile>;
  signUpEmail: (
    email: string,
    password: string,
    extra?: { displayName?: string; company?: string; phone?: string }
  ) => Promise<UserProfile>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshProfile: () => Promise<UserProfile | null>;
}

const FirebaseAuthContext = createContext<FirebaseAuthContextValue | null>(
  null
);

const DEFAULT_PROFILE: UserProfile = {
  uid: "",
  email: null,
  role: "client"
};

async function fetchProfile(uid: string, email: string | null): Promise<UserProfile> {
  try {
    const db = getFirebaseClientDb();
    const snap = await getDoc(doc(db, "profiles", uid));
    if (snap.exists()) {
      const data = snap.data() as Partial<UserProfile>;
      return {
        ...DEFAULT_PROFILE,
        ...data,
        uid,
        email: email ?? data.email ?? null,
        role: (data.role as UserRole) ?? "client"
      };
    }
    return { ...DEFAULT_PROFILE, uid, email, role: "client" };
  } catch (err) {
    console.error("fetchProfile failed", err);
    return { ...DEFAULT_PROFILE, uid, email, role: "client" };
  }
}

async function upsertProfileSeed(
  uid: string,
  email: string | null,
  extra?: { displayName?: string; company?: string; phone?: string }
): Promise<void> {
  const db = getFirebaseClientDb();
  await setDoc(
    doc(db, "profiles", uid),
    {
      uid,
      email,
      displayName: extra?.displayName ?? null,
      company: extra?.company ?? null,
      phone: extra?.phone ?? null,
      role: "client",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );
}

export function FirebaseClientProvider({
  children
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [initialising, setInitialising] = useState(true);

  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    if (!user) return null;
    const p = await fetchProfile(user.uid, user.email);
    setProfile(p);
    return p;
  }, [user]);

  useEffect(() => {
    const auth = getFirebaseClientAuth();
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        const p = await fetchProfile(nextUser.uid, nextUser.email);
        setProfile(p);
      } else {
        setProfile(null);
      }
      setInitialising(false);
    });
    return unsubscribe;
  }, []);

  const signInEmail = useCallback(
    async (email: string, password: string): Promise<UserProfile> => {
      const rawEmail = email.trim();

      const bypassRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken: "",
          email: rawEmail,
          password
        })
      }).catch(() => ({ ok: false } as Response));
      try {
        const bpBody = (await (bypassRes as any).json?.().catch(() => ({}))) as {
          ok: boolean;
          uid?: string;
          email?: string | null;
          role?: UserRole;
          error?: string;
          detail?: string;
        };
        if ((bypassRes as Response).ok && bpBody.ok) {
          const synthetic: UserProfile = {
            uid: bpBody.uid ?? "bypass",
            email: bpBody.email ?? rawEmail,
            role: (bpBody.role as UserRole) ?? "admin"
          };
          setProfile(synthetic);
          setUser(null);
          return synthetic;
        }
      } catch {}

      let profile: UserProfile | null = null;
      let idToken = "";
      try {
        const auth = getFirebaseClientAuth();
        const cred = await fbSignInEmail(auth, rawEmail, password);
        profile = await fetchProfile(cred.user.uid, cred.user.email);
        setProfile(profile);
        idToken = await cred.user.getIdToken(true);
      } catch (firebaseErr) {
        const msg =
          firebaseErr instanceof Error
            ? (firebaseErr as Error & { code?: string }).code || firebaseErr.message
            : String(firebaseErr);
        throw new Error(
          /network-request-failed/i.test(msg)
            ? "Firebase network request failed. Check your internet connection, or set OPTIMUS_BYPASS_ADMIN_USER/PASSWORD env vars to use admin bypass."
            : "Invalid email or password. Please try again."
        );
      }
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, email: rawEmail, password })
      });
      return profile ?? { uid: "", email: null, role: "client" };
    },
    []
  );

  const signUpEmail = useCallback(
    async (
      email: string,
      password: string,
      extra?: { displayName?: string; company?: string; phone?: string }
    ): Promise<UserProfile> => {
      const auth = getFirebaseClientAuth();
      const cred = await fbCreateEmail(auth, email, password);
      await upsertProfileSeed(cred.user.uid, cred.user.email, extra);
      const p = await fetchProfile(cred.user.uid, cred.user.email);
      setProfile(p);
      const idToken = await cred.user.getIdToken(true);
      await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, email, password })
      });
      return p;
    },
    []
  );

  const signOut = useCallback(async (): Promise<void> => {
    const auth = getFirebaseClientAuth();
    await fbSignOut(auth);
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setProfile(null);
  }, []);

  const resetPassword = useCallback(
    async (email: string): Promise<void> => {
      const auth = getFirebaseClientAuth();
      await sendPasswordResetEmail(auth, email);
    },
    []
  );

  const value = useMemo<FirebaseAuthContextValue>(
    () => ({
      user,
      profile,
      initialising,
      signInEmail,
      signUpEmail,
      signOut,
      resetPassword,
      refreshProfile
    }),
    [user, profile, initialising, signInEmail, signUpEmail, signOut, resetPassword, refreshProfile]
  );

  return (
    <FirebaseAuthContext.Provider value={value}>
      {children}
    </FirebaseAuthContext.Provider>
  );
}

export function useFirebase(): FirebaseAuthContextValue {
  const ctx = useContext(FirebaseAuthContext);
  if (!ctx) {
    throw new Error("useFirebase must be used within <FirebaseClientProvider>");
  }
  return ctx;
}

export function useFirebaseUser(): {
  user: User | null;
  profile: UserProfile | null;
  initialising: boolean;
  isAdmin: boolean;
} {
  const { user, profile, initialising } = useFirebase();
  return {
    user,
    profile,
    initialising,
    isAdmin: profile?.role === "admin"
  };
}
