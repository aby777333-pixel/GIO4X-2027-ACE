"use client";

import { useEffect, useState } from "react";
import { allCentreStatus, stateLabel, type CentreStatus } from "@/lib/sessions";

/**
 * The text equivalent of the homepage instrument, for assistive technology.
 * The instrument itself is a decorative canvas; what it shows that is real
 * (each financial centre's local time and the state of its regular session)
 * is said here in words, refreshed each minute from the visitor's clock.
 */
export function CentreSummary() {
  const [summary, setSummary] = useState<CentreStatus[] | null>(null);

  useEffect(() => {
    const read = () => setSummary(allCentreStatus(new Date()));
    read();
    const id = window.setInterval(read, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="sr-only">
      <p>A globe showing the world&apos;s financial centres and whether each is inside its regular trading hours right now.</p>
      {summary && (
        <ul>
          {summary.map((s) => (
            <li key={s.centre.key}>
              {s.centre.city}: {stateLabel[s.state]}, local time {s.local.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
