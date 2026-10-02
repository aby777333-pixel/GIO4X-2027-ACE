import Link from "next/link";
import { FigureNote } from "@/components/figures/Figure";
import { HeroCompanion } from "@/components/figures/stage/HeroCompanion";
import { PoolBraid } from "@/components/figures/stage/PoolBraid";
import { PeriodGate } from "@/components/figures/trading/PeriodGate";
import { Vessels } from "@/components/figures/trading/Vessels";
import { Arrangement } from "@/components/trading/Arrangement";
import { PoolDiagram } from "@/components/trading/Diagrams";
import { pamm } from "@/data/trading";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "PAMM accounts",
  description: "What a PAMM account is, how allocation and distribution work, what GIO4X has published about its own offering, the risks, and the questions to ask a manager first.",
  path: "/trading/pamm",
});

export default function PammPage() {
  return (
    <Arrangement
      crumbs={[
        { name: "Trading", href: "/trading" },
        { name: "PAMM", href: "/trading/pamm" },
      ]}
      eyebrow="PAMM · Percentage Allocation Management Module"
      title="One pool, shared by percentage."
      lead="In a PAMM arrangement a manager trades a pooled account and every result is divided among the investors according to what each allocated. This page explains the mechanism before anything else."
      diagram={<PoolDiagram className="h-auto w-full" />}
      diagramCaption="Illustration of the mechanism. It shows no real manager and no results."
      companion={
        <HeroCompanion figure={<PoolBraid />} label="One pool">
          It differs from{" "}
          <Link href="/trading/copy-trading" className="link">
            copy trading
          </Link>{" "}
          in one important way: the manager trades the pool, and an investor’s control is limited to allocating and withdrawing. Investors do not place or modify trades.
        </HeroCompanion>
      }
      what={pamm.what}
      whatAside={
        <FigureNote figure={<Vessels ratio={2.5} />} label="In practice">
          The percentage works in both directions: a loss is divided by the same shares as a gain, and an investor cannot close a position the manager has opened. The{" "}
          <Link href="#arr-risks" className="link">
            risks
          </Link>{" "}
          are set out below.
        </FigureNote>
      }
      gioAside={
        <FigureNote figure={<PeriodGate ratio={3} />} className="!mt-21">
          A request made part of the way through a period waits for its end. How long a period lasts has not been published, which is why it is among the{" "}
          <Link href="#arr-q" className="link">
            questions worth asking first
          </Link>
          .
        </FigureNote>
      }
      mechanics={pamm.mechanics}
      gioTitle="What GIO4X has published."
      gioLead="GIO4X offers PAMM accounts. The two previous websites agree on little beyond that, so this page publishes no minimums, no fees and no manager statistics."
      gioAgreed={pamm.gioAgreed}
      pending={pamm.pending}
      risks={pamm.risks}
      risksLead="Allocating to a manager means accepting decisions you do not make and cannot reverse in the moment."
      questions={pamm.questions}
      next={[
        { kind: "Trading", label: "Copy trading", href: "/trading/copy-trading", note: "Trades reproduced in your own account instead." },
        { kind: "Partners", label: "Money managers", href: "/partners/money-managers", note: "If you are the one managing." },
        { kind: "Tools", label: "Drawdown mathematics", href: "/tools/drawdown", note: "Why a loss needs a larger gain to recover." },
        { kind: "Legal", label: "Risk disclosure", href: "/legal/risk", note: "Read this first." },
      ]}
    />
  );
}
