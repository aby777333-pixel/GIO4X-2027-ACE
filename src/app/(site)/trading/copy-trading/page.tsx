import { Arrangement } from "@/components/trading/Arrangement";
import { CopyDiagram } from "@/components/trading/Diagrams";
import { copyTrading } from "@/data/trading";
import { pageMeta } from "@/lib/meta";

export const metadata = pageMeta({
  title: "Copy trading",
  description: "What copy trading is, how it works mechanically, what GIO4X has published about its own offering, the risks, and the questions to ask before you copy anyone.",
  path: "/trading/copy-trading",
});

export default function CopyTradingPage() {
  return (
    <Arrangement
      crumbs={[
        { name: "Trading", href: "/trading" },
        { name: "Copy trading", href: "/trading/copy-trading" },
      ]}
      eyebrow="Copy trading"
      title="Another trader’s decisions, in your account."
      lead="Copy trading reproduces a provider’s trades in your own account, at your own scale and your own risk. This page explains the mechanism before anything else."
      diagram={<CopyDiagram className="h-auto w-full" />}
      diagramCaption="Illustration of the mechanism. It shows no real provider and no results."
      what={copyTrading.what}
      mechanics={copyTrading.mechanics}
      gioTitle="What GIO4X has published."
      gioLead="GIO4X offers copy trading. Both previous websites describe the same four steps and the same two controls; on almost everything else they differ, so the rest is listed as pending."
      gioSteps={copyTrading.gioSteps}
      gioAgreed={copyTrading.gioAgreed}
      pending={copyTrading.pending}
      risks={copyTrading.risks}
      risksLead="Copying a trader does not transfer the risk to them. It transfers their decisions to you."
      questions={copyTrading.questions}
      next={[
        { kind: "Trading", label: "PAMM", href: "/trading/pamm", note: "The pooled alternative, and how it differs." },
        { kind: "Tools", label: "Drawdown mathematics", href: "/tools/drawdown", note: "Why a loss needs a larger gain to recover." },
        { kind: "Tools", label: "Leverage, visualised", href: "/tools/leverage-visualizer", note: "Exposure and risk move together." },
        { kind: "Legal", label: "Risk disclosure", href: "/legal/risk", note: "Read this first." },
      ]}
    />
  );
}
