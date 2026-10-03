import { Canyon, City, Gravity, NightFloor, OrderFlight, Storm } from "@/components/labs/cinema/Pieces";
import { MachinePage } from "@/components/labs/MachinePage";
import { pageMeta } from "@/lib/meta";

const DESCRIPTION =
  "Six set pieces, each a picture of one idea: a dark trading floor whose screens are doors, an order\u2019s journey seen from the order, a canyon between the bid and the ask, volatility as weather, support and resistance as gravity, and nine towers that light as their exchanges open. Metaphors, not market data.";

export const metadata = pageMeta({ title: "The Screening Room", description: DESCRIPTION, path: "/labs/cinema" });

export default function Page() {
  return (
    <MachinePage
      path="/labs/cinema"
      title="The Screening Room"
      description={DESCRIPTION}
      lead="Six set pieces, each a picture of one idea. They are metaphors and say so: no price is shown and nothing is forecast."
      punch="trend"
      machines={[
        { id: "floor", wide: true, eyebrow: "The floor at night", title: "Six screens. Six ways in.", lead: "A dark room of lit screens. Each is a door into one part of the site.", go: { href: "/explore", label: "Everything on the site" }, body: <NightFloor /> },
        { id: "flight", eyebrow: "Order in flight", title: "Ride with the order.", lead: "Five gates between the ticket and a live position, passed in the order they happen.", go: { href: "/labs/trade-anatomy", label: "Trade Anatomy" }, body: <OrderFlight /> },
        { id: "canyon", eyebrow: "The spread canyon", title: "Two walls: the bid and the ask.", lead: "Walk the day between them. The canyon is narrow when the market is full and wide in the quiet hours.", go: { href: "/tools/spread-visualizer", label: "Spread visualiser" }, body: <Canyon /> },
        { id: "storm", eyebrow: "The storm chart", title: "Volatility is weather.", lead: "A boat leaves its path behind it, and the path is the chart. Change the sea, and let a release strike.", go: { href: "/glossary/volatility", label: "Volatility, defined" }, body: <Storm /> },
        { id: "gravity", eyebrow: "Gravity wells", title: "A floor, a ceiling, and a comet.", lead: "Support and resistance, pictured. Push the comet and see a level hold, then give way and change its role.", go: { href: "/academy/support-and-resistance-levels", label: "Lesson: support and resistance" }, body: <Gravity /> },
        { id: "city", eyebrow: "The city, in time-lapse", title: "Nine towers, lit in turn.", lead: "Each tower is a financial centre. Its windows light while its exchange is in session.", go: { href: "/markets/clock", label: "World Market Clock" }, body: <City /> },
      ]}
      next={[
        { kind: "Labs", label: "The Mind Room", href: "/labs/mind", note: "Four games about the person at the screen." },
        { kind: "Labs", label: "The Engine Room", href: "/labs/engine-room", note: "Six machines about what happens to a trade." },
        { kind: "Verse", label: "The Verse Room", href: "/verse", note: "Riddles, an alphabet and a wall of old sayings." },
        { kind: "Labs", label: "All experiments", href: "/labs", note: "What Labs is, and what is on the bench." },
      ]}
    />
  );
}
