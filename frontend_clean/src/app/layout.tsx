import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import Shell from "@/components/layout/Shell";

export const metadata: Metadata = {
  title: "FraudGraph | Graph Intelligence & Ring Detection Platform",
  description: "University NoSQL fraud-ring detection and identity-resolution platform built on Neo4j and PostgreSQL.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full bg-dark-bg text-dark-text antialiased selection:bg-brand/20 selection:text-brand font-sans">
        <AuthProvider>
          <Shell>{children}</Shell>
        </AuthProvider>
      </body>
    </html>
  );
}
