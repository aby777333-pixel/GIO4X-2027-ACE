import type { ReactNode } from "react";
import { CockpitBoot } from "@/components/cockpit/Boot";
import { CockpitFx } from "@/components/cockpit/CockpitFx";
import { StageTransition } from "@/components/cockpit/StageTransition";
import { MicroFx } from "@/components/fx/MicroFx";
import { SunTheme } from "@/components/fx/SunTheme";
import { RecentRecorder } from "@/components/desk/RecentRecorder";
import { AmbienceFollower, CurrencyRain, Season } from "@/components/fx/Extras";
import { Polish } from "@/components/fx/Polish";
import { NewRibbon } from "@/components/play/Guided";
import { PassportRecorder } from "@/components/play/Passport";
import { JsonLd } from "@/components/seo/JsonLd";
import { AnnouncementBar } from "@/components/shell/AnnouncementBar";
import { ChatWidget } from "@/components/shell/ChatWidget";
import { CommandBar } from "@/components/shell/CommandBar";
import { Lens } from "@/components/shell/Lens";
import { OfflineRegister } from "@/components/shell/OfflineRegister";
import { PointerLayer } from "@/components/shell/PointerLayer";
import { Pulse } from "@/components/shell/Pulse";
import { ScrollArrows } from "@/components/shell/ScrollArrows";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { SiteHeader } from "@/components/shell/SiteHeader";
import { SoundFx } from "@/components/sound/SoundFx";
import { Tour } from "@/components/tour/Tour";
import { organizationSchema, websiteSchema } from "@/lib/schema";

/**
 * The public site chrome: header, main landmark, footer, command bar, Lens,
 * the announcement line and chat window that staff control from GIO4X Control,
 * and the organisation structured data. Used by the (site) route group and by the
 * root 404. GIO4X Control has its own shell and never renders this.
 */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="pt-[var(--header-h)] focus:outline-none">
        {/* what staff publish from Control: one line above the page, when there is one */}
        <AnnouncementBar />
        {/* what has been added lately; put away with one button */}
        <NewRibbon />
        {children}
      </main>
      <SiteFooter />
      <CommandBar />
      <Lens />
      <CockpitFx />
      {/* mouse and pen only: the cursor light, the magnetic buttons and the tilt of tiles and panels (off under reduced motion, low effects, or its switch at /preferences) */}
      <PointerLayer />
      <CockpitBoot />
      {/* between two pages that both open with a stage, the old instrument turns into the new one */}
      <StageTransition />
      {/* first view: constants marked data-count count up, small line figures draw themselves (off under reduced motion and low effects) */}
      <MicroFx />
      {/* "Sun" at /preferences: light by day, dark by night, from this device's clock; does nothing unless chosen */}
      <SunTheme />
      <ScrollArrows />
      {/* live chat: offered only while a member of staff is present to answer */}
      <ChatWidget />
      {/* the first-visit tour, and interface sounds (off unless switched on at /preferences) */}
      <Tour />
      <SoundFx />
      {/* the site's own visit counter: one cookieless request per page view, none when the visitor has said no (/legal/cookies, "Counting visits") */}
      <Pulse />
      {/* My desk: the "recently viewed" list (only once switched on there), and the offline worker (production builds only) */}
      <RecentRecorder />
      {/* the passport on My desk: a stamp for the page that is open, only once the visitor has started it */}
      <PassportRecorder />
      {/* a tint for three stretches of the year, a symbol that falls when its code is typed, and the pitch of the ambient sound if it is on */}
      {/* the light in a machine's card, the keys that work a machine, and the part of the day */}
      <Polish />
      <div className="gx-grain no-print" aria-hidden />
      <Season />
      <CurrencyRain />
      <AmbienceFollower />
      <OfflineRegister />
      <JsonLd data={[organizationSchema(), websiteSchema()]} />
    </>
  );
}
