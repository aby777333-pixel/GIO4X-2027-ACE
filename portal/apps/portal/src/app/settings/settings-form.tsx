"use client";

import { useState, useTransition } from "react";
import { Card, CardBody, CardHeader, CardTitle, Button } from "@gio4x/ui";
import { saveSettings } from "./settings-actions";
import type { Preferences } from "./preferences";

export type AccountOption = { value: string; label: string };

export function SettingsForm({
  prefs,
  language,
  timezone,
  accounts,
}: {
  prefs: Preferences;
  language: string;
  timezone: string;
  accounts: AccountOption[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await saveSettings(fd);
      if (res.ok) setSuccess(res.message ?? "Saved.");
      else setError(res.error);
    });
  }

  const sel = "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm";

  return (
    <form onSubmit={onSubmit}>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-steel">Density</label>
              <select name="density" defaultValue={prefs.density} className={sel}>
                <option>Comfortable</option>
                <option>Compact</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-steel">Sidebar</label>
              <select name="sidebar" defaultValue={prefs.sidebar} className={sel}>
                <option>Expanded</option>
                <option>Collapsed (icons only)</option>
                <option>Auto (collapse on mobile)</option>
              </select>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Region</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-steel">Language</label>
              <select name="language" defaultValue={language} className={sel}>
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
                <option value="ta">தமிழ்</option>
                <option value="ar">العربية</option>
                <option value="zh">中文</option>
                <option value="es">Español</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-steel">Time zone</label>
              <select name="timezone" defaultValue={timezone} className={sel}>
                <option>Asia/Kolkata</option>
                <option>UTC</option>
                <option>Asia/Dubai</option>
                <option>America/New_York</option>
                <option>Europe/London</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-steel">Display currency</label>
              <select name="displayCurrency" defaultValue={prefs.displayCurrency} className={sel}>
                <option>USD</option>
                <option>INR</option>
                <option>EUR</option>
                <option>AED</option>
                <option>BTC</option>
              </select>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Trading defaults</CardTitle></CardHeader>
          <CardBody className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-steel">Default account for new trades</label>
              <select name="defaultAccount" defaultValue={prefs.defaultAccount} className={sel}>
                <option>Ask each time</option>
                {accounts.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-steel">Default lot size</label>
              <input
                type="number"
                name="defaultLot"
                defaultValue={prefs.defaultLot}
                step={0.01}
                min={0.01}
                className={sel}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-steel">Confirm before each trade</label>
              <select name="confirmTrades" defaultValue={prefs.confirmTrades} className={sel}>
                <option>Always</option>
                <option>Only for size &gt; 1 lot</option>
                <option>Never</option>
              </select>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Privacy</CardTitle></CardHeader>
          <CardBody className="space-y-3 text-sm">
            <label className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
              <span className="text-navy">Allow GIO4X to use my trade data for product improvement</span>
              <input type="checkbox" name="privacyTradeData" defaultChecked={prefs.privacyTradeData} />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
              <span className="text-navy">Personalised marketing emails</span>
              <input type="checkbox" name="privacyMarketing" defaultChecked={prefs.privacyMarketing} />
            </label>
            <label className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
              <span className="text-navy">Show me in public leaderboards</span>
              <input type="checkbox" name="privacyLeaderboard" defaultChecked={prefs.privacyLeaderboard} />
            </label>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 flex items-center justify-end gap-3">
        {error ? (
          <span className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700">{error}</span>
        ) : null}
        {success ? (
          <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">{success}</span>
        ) : null}
        <Button variant="primary" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
