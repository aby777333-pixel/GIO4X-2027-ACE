# Content audit: legal documents

Scope: the four legal documents carried over from the previous GIO4X website (`.tmp/ref/new/app/legal/{terms,risk,privacy,aml}/page.tsx`) into `src/data/legal-docs.ts`, plus the new Cookie & Storage Notice.

Audit date: 1 October 2026. Reference fact sheet: `.tmp/facts.md` (sections 1, 7, 8, 12).

## Rules applied

1. The body text of each carried-over document is reproduced sentence for sentence.
2. A sentence was **removed** when it contained a flagged or conflicting claim: a provider-specific retail-loss percentage, a "regulated/licensed" assertion, a specific regulator-style promise, a guaranteed protection, a conflicting leverage maximum, a support-hours claim, or a processing-time promise that conflicts across the previous sites.
3. A sentence was also removed when it would be factually untrue of this website (one case: analytics and personalisation cookies).
4. **Nothing was added to the legal text.** Where a removal leaves a visible gap, the page shows an "Editor's note · not part of the document" block in a different visual voice. Those notes are editorial, are listed below, and make no legal promise.
5. Legacy contact addresses not in facts.md §1.5's GIO4X list would have been replaced. None of the four source documents contained one (see "Contact addresses").
6. "Last updated" is printed exactly as on the previous site: **March 2026**. The previous site printed no version numbers, so none was invented: the version label is "Carried-over text".
7. Every carried-over document shows the notice: "This document is carried over from the previous GIO4X website and is under legal review."

## Removals

| # | Document, section | Original sentence (verbatim) | Reason |
|---|---|---|---|
| R1 | Risk Disclosure, §1 What Are CFDs | "75% of retail client accounts lose money when trading CFDs with this provider." | Provider-specific retail-loss percentage. facts.md §1.8 [FLAG][CONFLICT] and §12 item 16: the previous sites published 75% and 63.21%; neither is sourced from GIO4X client data. |
| R2 | Risk Disclosure, §9 Leverage and Margin | "GIO4X offers leverage up to 500:1 — while this increases buying power, it proportionally increases risk." | Conflicting leverage maximum. facts.md §2.2 and §12 item 5: 1:500 vs 1:1000 vs 1:300–500 vs 200/400/500 by tier vs 1:100 (ECN DMA) vs 1:2000 (PAMM). |
| R3 | Risk Disclosure, §12 Insolvency | "In the unlikely event of GIO4X's insolvency, client funds held in segregated accounts are protected in accordance with applicable regulations." | Guaranteed protection plus an unnamed-regulation assertion. facts.md §1.2 [FLAG] (no regulator identified) and §7.1. |
| R4 | Risk Disclosure, §12 Insolvency | "GIO4X maintains capital adequacy requirements and holds client funds in segregated accounts at reliable banking institutions." | Regulator-style promise ("capital adequacy requirements"), flagged in facts.md §1.2 and §7.1; bank description also conflicts across the previous sites (§7.1 [CONFLICT]). The underlying client-funds statement is presented separately, in plain words and without embellishment, on `/trust/client-funds`. |
| R5 | Terms, §5 Deposits & Withdrawals | "Withdrawal requests are processed within 1-3 business days." | Processing-time promise that conflicts across the previous sites. facts.md §12 item 12: 24h vs 1–2 days vs 1–3 days, and conflicting cut-off times. |
| R6 | Privacy Policy, §5 Cookies | "We use cookies and similar technologies to enhance your experience, analyze traffic, and personalize content." | Untrue of this website: it sets no analytics or advertising cookies and loads no third-party scripts. Replaced by a pointer (editor's note) to the Cookie & Storage Notice, which lists what actually exists. |

Consequence of R3 and R4: section 12 of the Risk Disclosure now consists of the single remaining sentence, "However, there is no guarantee that all funds will be recovered." It is kept word for word, including the leading "However", and the editor's note explains why.

## Page furniture not carried over

These were not part of the document bodies; they are recorded for completeness.

| Item | Original (verbatim) | Decision |
|---|---|---|
| AML page hero caption | "Our AML and Know-Your-Customer commitments that keep client funds and the platform secure." | Not used: an unverifiable protection claim. The registry summary was rewritten as a description of what the policy states ("The identity checks, transaction monitoring, reporting and record keeping GIO4X states it applies…"). |
| Terms, Privacy, Risk hero captions | "The terms and conditions governing your use of GIO4X services." / "How GIO4X collects, uses, and protects your personal information." / "Please read this risk disclosure carefully before opening an account or placing any trades with GIO4X." | Used verbatim as the registry summaries. |
| Risk page amber banner | "Trading foreign exchange, CFDs, and other derivative products carries a high level of risk and may not be suitable for all investors. You should carefully consider your objectives, financial situation, and risk tolerance before trading. You may lose more than your initial investment." | Kept verbatim and promoted: it opens the document in large reading type instead of a small coloured banner. |
| Risk page footer note | "GIO4X, a subsidiary of 777 Capital Markets Limited (UK), Company No. 17049134. By opening an account with GIO4X, you acknowledge…" | Kept verbatim as the document's closing statement. |
| Risk page link row and CTA band | Links to `/accounts`, `/platforms`, `/contact`; "CTABand" | Dropped (marketing furniture; old paths). The shared layout ends with links to the other documents. |
| Section numbering | "1. Introduction", "2. Eligibility", … | Numbers are generated by the layout (01, 02, …); titles are verbatim. |

## Typographic normalisation (no change of wording)

- `&apos;` / `'` rendered as ’ (client’s, account’s, GIO4X’s).
- `—` rendered as — (only in the removed sentence R2).
- Spelling left as published (US spellings such as "authorized" are the previous site's).

## Additions that are not legal text

| Where | What | Why |
|---|---|---|
| All four carried-over documents | "Under legal review" notice (wording given in the task) and a two-sentence explanation of how the text was handled. | Required notice. |
| Terms §2 Eligibility | The restricted-jurisdictions list (36 countries) from `src/data/accounts.ts`, labelled "The list published on the previous GIO4X websites." | The Terms refer to "restricted jurisdictions" without listing them. The 36-country list is identical on both previous sites (facts.md §1.9). |
| Terms §4, §6 | Cross-reference links ("Trading conditions as currently published", "Read the Risk Disclosure"). | Navigation only. |
| Terms §5; Risk §1, §9, §12; Privacy §5 | Editor's notes marking removals R5, R1, R2, R3+R4, R6. | So that a removal is visible, not silent. |
| Terms §8 Governing Law | Editor's note: the text names no governing law, court or arbitration body. | States a gap; adds no term. |
| Privacy §3 Data Protection | Editor's note pointing to `/trust/security`. | The section is retained as carried over (see below); the note points to statements that can be checked. |

## Retained after review (owner / counsel to confirm)

These sentences were examined against the removal rules and **kept**, because they are cautionary, descriptive, or not within a removal category. Each is a candidate for the legal review.

| # | Document, section | Sentence | Why kept, and the open point |
|---|---|---|---|
| K1 | Terms §6; Risk opening; Risk §9 | "You may lose more than your initial deposit." / "You may lose more than your initial investment." / "…substantial losses that exceed your initial deposit." | facts.md §12 item 17 records a conflict between these warnings and the previous sites' promise of negative balance protection. The conflict is resolved here on the cautious side: the warnings stay, and the protection promise is published nowhere on this site. Note the site-wide footer warning (`src/config/legal.ts`) says "some or all of your initial investment"; counsel should align the two. |
| K2 | Risk §1 | "…you enter into a contract with GIO4X to exchange the difference in the value of an asset…" | Describes GIO4X as the counterparty. facts.md §8 notes this conflicts with "A-book/STP" marketing on the previous site; that marketing is not republished. Which legal entity contracts with clients is unresolved (§12 item 1). |
| K3 | Privacy §2 | "…comply with regulatory requirements…" | Not an assertion that GIO4X is regulated; identity and anti-money-laundering obligations apply regardless. |
| K4 | Privacy §3 | "We implement industry-standard security measures including encryption, secure servers, and access controls. Your personal data is stored in compliance with applicable data protection regulations." | Not flagged in facts.md and not a graded claim (no "256-bit", no audits). Unverified; counsel to confirm or replace. |
| K5 | Privacy §4 | "We may share data with regulatory authorities, payment processors, and service providers…" | A disclosure of possible sharing, not a status claim. |
| K6 | Privacy §6 | "…contact our Data Protection Officer at privacy@gio4x.com." | `privacy@gio4x.com` is in facts.md §1.5's GIO4X list. Whether a Data Protection Officer is appointed and the mailbox is monitored needs owner confirmation. |
| K7 | Privacy §7; AML §5 | "Trading records are retained for a minimum of 5 years as required by financial regulations." / "…retained for a minimum of 5 years in compliance with regulatory requirements." | Consistent between the two documents and not flagged. They describe a retention period, not a protection. Counsel to confirm the period and the legal basis once the contracting entity and jurisdiction are settled. |
| K8 | AML §4 | "Suspicious activities are reported to the relevant financial intelligence units." | No authority is named; kept as a description of policy. Counsel to name the unit once jurisdiction is settled. |
| K9 | Terms §4 | "GIO4X provides execution on a best-effort basis and does not guarantee specific prices or fill rates." | A disclaimer, not a promise. |
| K10 | Terms §8 | "These terms shall be governed by and construed in accordance with applicable laws. Disputes shall be resolved through arbitration or in the courts of the relevant jurisdiction." | No jurisdiction named (facts.md §8). Kept verbatim with an editor's note. |
| K11 | AML §2 | "Required documents include government-issued photo ID and proof of address dated within the last 3 months." | Consistent with the previous site's account FAQ. |

## Contact addresses

The four source documents contain one address: `privacy@gio4x.com` (Privacy §6), which is in facts.md §1.5's GIO4X list and was kept. No legacy address (`support@icfxl.com`, `support@icareforex.com`, `support@icareforexmail.com`) appears in the carried-over text, so no replacement was needed. The shared layout's "Questions about this document" line uses `site.email` (`info@gio4x.com`).

## Not carried over at all

- The OLD site's "Terms & Conditions" accordion (about 5,500 words), its Risk Disclosure, KYC panel and the Introducing Broker agreements. facts.md §8 identifies them as another broker's template (ICFXL / Icareforex entities, MetaTrader 4 terminal definitions, Jordanian courts, forfeiture clause). They are not a GIO4X legal set and were not merged.
- The OLD site-wide legal block (complaints, client funds, office list). Its client-funds sentence is the basis, together with the NEW site's equivalent, for the plain-words statement on `/trust/client-funds`; nothing else from it is used.

## New document

**Cookie & Storage Notice** (`/legal/cookies`), version 1.0, dated 1 October 2026, written for this website. It lists only what exists:

- no advertising or analytics cookies; no third-party scripts (see the Content-Security-Policy in `next.config.mjs`);
- the local-storage keys in `LOCAL_KEYS` (`src/lib/prefs.ts`), one row each. The purposes are typed against `LOCAL_KEYS`, so adding a key there without describing it in `src/data/legal-docs.ts` fails the type-check;
- an authentication cookie only for staff who sign in to the internal console;
- TradingView chart frames as third-party content loaded on request.

To confirm before launch: at the time of writing only `gx:prefs` and `gx:calc` are written by code in the repository. The purposes given for `gx:recent`, `gx:saved`, `gx:consent` and `gx:watch` follow their names and intended features; whoever implements those features should check the wording in `LOCAL_KEY_PURPOSE`.

## Open items for the owner and counsel

1. The contracting legal entity and its jurisdiction; governing law and dispute forum for the Terms.
2. Regulatory status (authority, licence number, register link) or an explicit statement that there is none.
3. A sourced retail-loss percentage, if one is required in the applicable jurisdiction (R1).
4. The maximum leverage, per account and jurisdiction (R2).
5. Client-money arrangements: institutions, insolvency treatment, any compensation scheme or insurance (R3, R4).
6. Withdrawal processing times (R5).
7. Whether losses can exceed deposits or negative balance protection applies, and alignment of the three risk-warning wordings (K1).
8. Whether United Kingdom and United States residents are restricted (the older site said so; the 36-country list does not include them).
9. Data Protection Officer and the `privacy@gio4x.com` mailbox (K6); retention periods (K7).
10. Documents not yet published: order execution policy, swap schedule, funding fees and times, client agreement per account type, complaints procedure, regulatory status statement.
