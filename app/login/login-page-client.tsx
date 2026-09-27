"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useFirebase } from "@optimus/components/providers/FirebaseClientProvider";

const WEBSITE_URL =
  (process.env.NEXT_PUBLIC_WEBSITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  );

export default function LoginPageClient() {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const { signInEmail, initialising } = useFirebase();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialising) return;
  }, [initialising]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const profileRes = await signInEmail(email, password);
      const role = profileRes.role as unknown as string;
      if (role !== "admin" && role !== "staff") {
        setError("Optimus access is restricted to owner/admin accounts.");
        return;
      }
      router.replace(next ?? "/dashboard/command");
    } catch {
      setError("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (initialising) {
    return (
      <main className="min-h-screen bg-bg-500 text-neutral-100">
        <div className="h-16" />
        <div style={{ height: 240 }} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg-500 text-neutral-100">
      <nav className="navbar border-b border-white/10">
        <div className="nav-inner h-16 flex items-center justify-between">
          <Link
            href={WEBSITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3"
          >
            <Image
              src="/demitech-logo.svg"
              alt="DemiTech"
              width={32}
              height={32}
              priority
            />
            <span className="text-base font-semibold tracking-wide">
              Optimus <span className="text-gold-300">·</span> DemiTech
            </span>
          </Link>
          <a
            href={WEBSITE_URL}
            className="text-sm text-neutral-300 hover:text-gold-300 transition-colors"
          >
            ← Back to site
          </a>
        </div>
      </nav>

      <section className="auth-section">
        <div className="auth-container fade-up d1">
          <span className="section-tag">// Owner Access Only</span>
          <h1 className="section-title">
            Optimus <span className="gold">Sign In</span>
          </h1>
          <div className="divider"></div>
          <p className="text-sm text-neutral-300">
            DemiTech private operating system. This portal is not for
            customer accounts.
          </p>
          <form className="auth-form" onSubmit={onSubmit}>
            <div className="form-group">
              <label>Admin Email</label>
              <input
                type="email"
                required
                autoComplete="username"
                placeholder="admin@demitechwebservices.live"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button
              className="btn btn-gold btn-full"
              type="submit"
              disabled={loading}
            >
              {loading ? "Signing in..." : "🔒 Secure Login"}
            </button>
            {error && (
              <div className="auth-error" style={{ display: "block" }}>
                {error}
              </div>
            )}
          </form>
        </div>
      </section>
    </main>
  );
}
