import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { withBase } from "@/lib/base-path";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--color-bg)]">
      <div className="absolute inset-0">
        <Image
          src={withBase("/auth-bg.jpg")}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        {/* Gentle wash, a touch stronger at the very top/bottom so the header
            logo and footer text stay legible, but light enough through the
            middle that the photo reads clearly behind the card. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.34) 0%, rgba(247,250,253,0.14) 42%, rgba(238,245,251,0.12) 68%, rgba(244,245,247,0.40) 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(41,171,226,0.22) 0%, rgba(41,171,226,0.08) 40%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
        <div
          className="pointer-events-none absolute -left-40 -bottom-40 h-[440px] w-[440px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(201,168,76,0.16) 0%, rgba(201,168,76,0.05) 40%, transparent 70%)",
            filter: "blur(40px)",
          }}
        />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 py-5">
        <Link href="/" aria-label="GIO4X home">
          <Image
            src={withBase("/logo.png")}
            alt="GIO4X"
            width={2924}
            height={976}
            priority
            className="h-9 w-auto"
          />
        </Link>
        <Link
          href="https://lustrous-youtiao-52c8ea.netlify.app"
          target="_blank"
          rel="noreferrer"
          className="text-xs font-medium text-steel hover:text-sky"
        >
          ← gio4x.com
        </Link>
      </header>

      <main className="relative z-10 flex min-h-[calc(100vh-100px)] items-center justify-center px-4 pb-12">
        {children}
      </main>
    </div>
  );
}
