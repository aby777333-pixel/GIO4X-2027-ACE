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
      what={pamm.what}
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
