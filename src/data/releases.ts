/**
 * What has been added to the site lately, newest first, for the "recently
 * added" ribbon (components/play/Guided.tsx). An id is a date and a letter and
 * sorts as text: the ribbon is put away until an entry with a later id exists.
 * A new entry goes at the top.
 */
export const RELEASES: readonly { id: string; title: string; href: string }[] = [
  { id: "2026-10-03f", title: "Fun@Finance: jokes, comics and riddles", href: "/fun" },
  { id: "2026-10-03e", title: "Your first trade: a ten-minute course", href: "/academy/first-trade" },
  { id: "2026-10-03d", title: "The glossary as a star map", href: "/glossary/map" },
  { id: "2026-10-03c", title: "Send us a riddle", href: "/verse#readers" },
  { id: "2026-10-03b", title: "The Screening Room", href: "/labs/cinema" },
  { id: "2026-10-03a", title: "The practice room", href: "/academy/practice" },
];
