import { MachinePage } from "@/components/labs/MachinePage";
import { BiasDetector, Headlines, Patience, SpotTheCoin } from "@/components/labs/mind/Games";
import { pageMeta } from "@/lib/meta";

const DESCRIPTION =
  "Four games about the person in front of the screen: tell coin flips from a built-in tilt, sit on a trade with only a Close button, answer six questions that show common leans of mind, and say which way a headline sends a price. Generated charts and invented headlines; nothing is stored.";

export const metadata = pageMeta({ title: "The Mind Room", description: DESCRIPTION, path: "/labs/mind" });

export default function Page() {
  return (
    <MachinePage
      path="/labs/mind"
      title="The Mind Room"
      description={DESCRIPTION}
      lead="Four games about the person in front of the screen. Each sets a well-known trap, lets you walk into it, and then says what happened."
      punch="small"
      machines={[
        { id: "coin", eyebrow: "Spot the coin flips", title: "Chance draws convincing trends.", lead: "Two charts. One is nothing but coin flips; the other has a real tilt built in. Which is the coin?", go: { href: "/labs/scale", label: "The Long Scroll" }, body: <SpotTheCoin /> },
        { id: "patience", eyebrow: "The patience game", title: "One trade. One button.", lead: "The only control is Close. Notice how soon your hand goes to it on a gain, and how long it stays away on a loss.", go: { href: "/academy/managing-trading-psychology", label: "Lesson: trading psychology" }, body: <Patience /> },
        { id: "bias", eyebrow: "The bias detector", title: "Six questions, answered fast.", lead: "Each is a classic from the study of decisions. Your answers show which common leans you have today.", go: { href: "/academy/practice#museum", label: "The mistake museum" }, body: <BiasDetector /> },
        { id: "headline", eyebrow: "The headline game", title: "Up, down, or cannot say?", lead: "An invented headline, then both stories: how such news has sent a price up, and how it has sent it down.", go: { href: "/academy/trading-the-news", label: "Lesson: scheduled news" }, body: <Headlines /> },
      ]}
      next={[
        { kind: "Labs", label: "The Screening Room", href: "/labs/cinema", note: "Six set pieces, each a picture of one idea." },
        { kind: "Academy", label: "Practice room", href: "/academy/practice", note: "Build an order, fix a ticket, race the glossary." },
        { kind: "Labs", label: "The Workshop", href: "/labs/workshop", note: "Candle forge, tightrope, pip reels and sixty seconds." },
        { kind: "Legal", label: "Risk disclosure", href: "/legal/risk", note: "Read this before trading with leverage." },
      ]}
    />
  );
}
