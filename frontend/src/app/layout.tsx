import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import Shell from "@/components/layout/Shell";

export const metadata: Metadata = {
  title: "FraudGraph | Graph Intelligence & Financial Crime Detection Platform",
  description: "Enterprise fraud-ring detection and identity-resolution platform built on Neo4j and PostgreSQL.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-[#F8FAFC] text-slate-900 antialiased selection:bg-indigo-100 selection:text-indigo-900 font-sans">
        <AuthProvider>
          <Shell>{children}</Shell>
        </AuthProvider>
      </body>
    </html>
  );
}
