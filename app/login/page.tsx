import { Suspense } from "react";
import LoginPageClient from "./login-page-client";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bg-500">
          <nav className="navbar" style={{ visibility: "hidden" }}>
            <div className="nav-inner h-16"></div>
          </nav>
          <div style={{ height: 320 }} />
        </div>
      }
    >
      <LoginPageClient />
    </Suspense>
  );
}
