"use client";

import { useState } from "react";
import { Card, CardBody } from "@gio4x/ui";
import { MessageCircle, Mail, Phone, BookOpen, type LucideIcon } from "lucide-react";
import { LINKS } from "@/lib/constants";

// Client-side contact cards. Every card does something visible in-app — opens the
// chat widget, copies the address/number (with feedback) + fires mailto/tel, or
// scrolls to the help answers — so nothing relies on a desktop OS handler.
export function SupportContactCards() {
  const [copied, setCopied] = useState<string | null>(null);
  const phoneDigits = LINKS.support.phone.replace(/[^\d+]/g, "");

  function copy(key: string, value: string) {
    try { navigator.clipboard?.writeText(value); } catch { /* ignore */ }
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
  }

  const cards: { key: string; icon: LucideIcon; label: string; detail: string; action: string; onClick: () => void }[] = [
    {
      key: "chat", icon: MessageCircle, label: "Live chat", detail: "24/7 · avg response < 90s", action: "Start chat",
      onClick: () => window.dispatchEvent(new Event("gio4x:open-chat")),
    },
    {
      key: "email", icon: Mail, label: "Email", detail: LINKS.support.email, action: copied === "email" ? "Copied ✓" : "Send",
      onClick: () => { copy("email", LINKS.support.email); window.location.href = `mailto:${LINKS.support.email}`; },
    },
    {
      key: "phone", icon: Phone, label: "Phone", detail: LINKS.support.phone, action: copied === "phone" ? "Copied ✓" : "Call",
      onClick: () => { copy("phone", phoneDigits); window.location.href = `tel:${phoneDigits}`; },
    },
    {
      key: "help", icon: BookOpen, label: "Help centre", detail: "Browse the answers below", action: "Browse",
      onClick: () => document.getElementById("help-topics")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    },
  ];

  return (
    <div className="mb-6 grid gap-4 md:grid-cols-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.key}>
            <CardBody>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky/10 text-sky">
                <Icon size={18} />
              </div>
              <div className="mt-3 text-sm font-semibold text-navy">{c.label}</div>
              <div className="mt-0.5 text-[11px] text-steel">{c.detail}</div>
              <button type="button" onClick={c.onClick} className="mt-3 text-xs font-medium text-sky hover:underline">
                {c.action} →
              </button>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
