import { Head } from "@/components/markets/Head";
import type { AssetClass, Instrument } from "@/data/instruments";
import { OBJECT, factsFor } from "./facts";
import { RoundViewer } from "./RoundViewer";

/**
 * The asset-class page's "in the round" section: the class as one object that
 * can be turned, with facts from the page pinned to it. The facts are worked
 * out here, on the server, from the class's own data (facts.ts); the picture
 * and the list are the client component.
 */
export function InTheRound({ cls, list }: { cls: AssetClass; list: Instrument[] }) {
  const facts = factsFor(cls, list);
  if (facts.length === 0) return null;
  return (
    <section className="section hairline" aria-labelledby="round-title">
      <div className="wrap">
        <Head
          eyebrow="In the round"
          id="round-title"
          title={<>{cls.name}, as one object.</>}
          lead="What this page says about the asset class, pinned to something you can turn. Drag it, or choose a fact and it turns to face you."
        />
        <RoundViewer kind={cls.key} name={cls.name} object={OBJECT[cls.key]} facts={facts} />
      </div>
    </section>
  );
}
