import type { Metadata } from "next";
import { FirebaseClientProvider } from "@optimus/components/providers/FirebaseClientProvider";
import "./globals.css";

const cinzelVariable = "--font-cinzel";
const ralewayVariable = "--font-raleway";

export const metadata: Metadata = {
  title: {
    default: "Optimus · DemiTech",
    template: "%s · Optimus · DemiTech"
  },
  description:
    "Optimus — DemiTech private business operating system (owner/admin only).",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_OPTIMUS_URL ?? "http://localhost:3001"
  ),
  robots: { index: false, follow: false },
  openGraph: {
    title: "Optimus · DemiTech",
    description: "Private Optimus portal for DemiTech.",
    type: "website"
  },
  icons: {
    icon: "/demitech-logo.svg"
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${cinzelVariable} ${ralewayVariable}`}
    >
      <body className="bg-bg-500 text-neutral-100 min-h-screen">
        <FirebaseClientProvider>{children}</FirebaseClientProvider>
      </body>
    </html>
  );
}
