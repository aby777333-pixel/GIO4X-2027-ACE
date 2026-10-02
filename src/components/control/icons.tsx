import type { ReactNode } from "react";

/**
 * The console's icons: small line drawings, drawn for this project (no icon
 * package is installed). 24 × 24, stroke only, the colour of the text around
 * them. Always decorative: the label beside an icon carries the meaning.
 */
const PATHS = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </>
  ),
  command: (
    <>
      <path d="M4 17a8.5 8.5 0 1 1 16 0" />
      <path d="m12 14 4-5" />
      <circle cx="12" cy="14.5" r="1.4" />
    </>
  ),
  chats: (
    <>
      <path d="M4 4h10a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 14 13H8l-4 3.5z" />
      <path d="M18.5 9H20a1.5 1.5 0 0 1 1.5 1.5v10L18 17.5h-6A1.5 1.5 0 0 1 10.5 16" />
    </>
  ),
  tickets: (
    <>
      <path d="M3 9V6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5V9a3 3 0 0 0 0 6v2.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5V15a3 3 0 0 0 0-6z" />
      <path d="M14 5v2.5M14 11v2M14 16.5V19" />
    </>
  ),
  leads: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10.5" r="2.2" />
      <path d="M5.5 16.5c.6-1.8 1.9-2.6 3.5-2.6s2.900.8 3.500 2.6M15 9.500h3.500M15 13h3.500" />
    </>
  ),
  pipeline: (
    <>
      <path d="M3 5h18l-7 8.500V19l-4 2v-7.500z" />
    </>
  ),
  tasks: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <path d="m8 12.500 2.800 2.800L16.500 9.500" />
    </>
  ),
  customers: (
    <>
      <circle cx="9" cy="8.500" r="3.200" />
      <path d="M3 20c.5-3.500 2.900-5.300 6-5.300s5.500 1.800 6 5.300" />
      <path d="M16 5.600a3.200 3.200 0 0 1 0 5.800M18 14.900c1.700.7 2.700 2.400 3 5.100" />
    </>
  ),
  kyc: (
    <>
      <path d="M12 3 4.500 6v5.500c0 4.600 3.100 8 7.500 9.500 4.400-1.500 7.500-4.900 7.500-9.500V6z" />
      <path d="m8.800 12 2.300 2.300 4.200-4.400" />
    </>
  ),
  compliance: (
    <>
      <path d="M4 8V5.500A1.500 1.500 0 0 1 5.500 4H8M16 4h2.500A1.500 1.500 0 0 1 20 5.500V8M20 16v2.500a1.500 1.500 0 0 1-1.500 1.500H16M8 20H5.500A1.500 1.500 0 0 1 4 18.500V16" />
      <circle cx="11.500" cy="11.500" r="3.200" />
      <path d="m14 14 2.500 2.500" />
    </>
  ),
  funds: (
    <>
      <rect x="2.500" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.600" />
      <path d="M6 9.500v5M18 9.500v5" />
    </>
  ),
  fees: (
    <>
      <path d="M5.500 3h13v18l-2.200-1.500L14 21l-2-1.500L10 21l-2.300-1.500L5.500 21z" />
      <path d="M9 8h6M9 12h6M9 16h3.500" />
    </>
  ),
  ib: (
    <>
      <rect x="9.500" y="3" width="5" height="5" rx="1" />
      <rect x="3" y="16" width="5" height="5" rx="1" />
      <rect x="16" y="16" width="5" height="5" rx="1" />
      <path d="M12 8v4M5.500 16v-2.500a1.500 1.500 0 0 1 1.500-1.500h10a1.500 1.500 0 0 1 1.500 1.500V16" />
    </>
  ),
  copy: (
    <>
      <rect x="8.500" y="8.500" width="12" height="12" rx="2" />
      <path d="M15.500 5.500v-.500a1.500 1.500 0 0 0-1.500-1.500H5A1.500 1.500 0 0 0 3.500 5v9A1.500 1.500 0 0 0 5 15.500h.500" />
    </>
  ),
  pamm: (
    <>
      <path d="M12 3a9 9 0 1 0 9 9h-9z" />
      <path d="M15 3.500A9 9 0 0 1 20.500 9H15z" />
    </>
  ),
  trades: (
    <>
      <path d="M7 3v3M7 14v4M17 6v3M17 16v5M12 9v2M12 18v3" />
      <rect x="5" y="6" width="4" height="8" rx="1" />
      <rect x="15" y="9" width="4" height="7" rx="1" />
      <rect x="10" y="11" width="4" height="7" rx="1" />
    </>
  ),
  reports: (
    <>
      <path d="M6 3h8l5 5v11.500a1.500 1.500 0 0 1-1.500 1.500h-11A1.500 1.500 0 0 1 5 19.500v-15A1.500 1.500 0 0 1 6.500 3z" />
      <path d="M14 3v5h5M9 17v-3M12 17v-5.500M15 17v-2" />
    </>
  ),
  broker: (
    <>
      <path d="M3 9.500 12 4l9 5.500zM5 10v7.500M9.500 10v7.500M14.500 10v7.500M19 10v7.500M3 20h18" />
    </>
  ),
  ledger: (
    <>
      <path d="M12 6.500C10.500 5 8.300 4.500 4 4.500V18c4.300 0 6.500.5 8 2 1.500-1.500 3.700-2 8-2V4.500c-4.300 0-6.500.5-8 2zM12 6.500V20" />
    </>
  ),
  events: (
    <>
      <circle cx="12" cy="12" r="1.800" />
      <path d="M8.200 15.800a5.400 5.400 0 0 1 0-7.600M15.800 8.200a5.400 5.400 0 0 1 0 7.600M5.300 18.700a9.500 9.500 0 0 1 0-13.400M18.700 5.300a9.500 9.500 0 0 1 0 13.400" />
    </>
  ),
  documents: (
    <>
      <path d="M6.500 3H14l5 5v11.500a1.500 1.500 0 0 1-1.500 1.500h-11A1.500 1.500 0 0 1 5 19.500v-15A1.500 1.500 0 0 1 6.500 3z" />
      <path d="M14 3v5h5M8.500 12.500h7M8.500 16h7" />
    </>
  ),
  emailer: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.500 7 8.500 6.500L20.500 7" />
    </>
  ),
  subscribers: (
    <>
      <path d="M3 13.500 5.800 5.800A2 2 0 0 1 7.700 4.500h8.600a2 2 0 0 1 1.900 1.300L21 13.500v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 13.500h5l1.500 2.500h5L16 13.500h5" />
    </>
  ),
  config: (
    <>
      <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
  team: (
    <>
      <circle cx="9.500" cy="8" r="3.300" />
      <path d="M3 20c.5-3.600 3-5.500 6.500-5.500 1 0 1.900.2 2.700.5" />
      <circle cx="17.500" cy="17" r="2" />
      <path d="M17.500 13.200v1.300M17.500 19.500v1.300M21.300 17H20M15 17h-1.300M20.200 14.300l-.9.9M15.700 18.800l-.900.900M20.200 19.700l-.900-.900M15.700 15.200l-.900-.900" />
    </>
  ),
  audit: (
    <>
      <path d="M6 3h12a1.500 1.500 0 0 1 1.500 1.500v15A1.500 1.500 0 0 1 18 21H6a1.500 1.500 0 0 1-1.500-1.500v-15A1.500 1.500 0 0 1 6 3z" />
      <path d="m8 8.500 1.200 1.200L11.500 7.500M14 8.500h2.500M8 14.500l1.200 1.200 2.300-2.200M14 14.500h2.500" />
    </>
  ),
  signout: (
    <>
      <path d="M9.500 20H6a1.500 1.500 0 0 1-1.500-1.500v-13A1.500 1.500 0 0 1 6 4h3.500M15.500 16.500 20 12l-4.500-4.500M20 12H9.500" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  inbox: (
    <>
      <path d="M3 13.500 5.800 5.800A2 2 0 0 1 7.700 4.500h8.600a2 2 0 0 1 1.900 1.300L21 13.500v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 13.500h5l1.500 2.500h5L16 13.500h5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.500" />
      <path d="M12 7.500V12l3 2" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 17, className = "" }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`shrink-0 ${className}`}>
      {PATHS[name]}
    </svg>
  );
}
