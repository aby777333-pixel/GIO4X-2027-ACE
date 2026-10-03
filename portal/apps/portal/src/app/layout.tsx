import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/lib/session-provider";
import { getCurrentUser } from "@/lib/session";
import { LiveChatWidget } from "@/components/LiveChatWidget";

export const metadata: Metadata = {
  title: "GIO4X Trader Area",
  description: "Client + IB portal for GIO4X traders and partners.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentUser();
  return (
    <html lang="en">
      <body className="antialiased">
        <SessionProvider
          value={{
            userId: session?.id ?? null,
            email: session?.email ?? null,
            profile: session?.profile ?? null,
          }}
        >
          {children}
          <LiveChatWidget />
        </SessionProvider>
      </body>
    </html>
  );
}
