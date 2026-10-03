/* ─────────────────────────────────────────────────────────────
   Document Template Definitions

   The Super Admin Documents section ships a small set of blank PDF
   templates (Acknowledgement Letter, Debenture Agreement, Allotment
   Letter, Debenture Certificate). This module defines, for each kind:

     • the field set the admin populates (label, key, type, required)
     • the field layout (single-column or two-column key-value table)
     • the body paragraphs to render under the field table
     • a `kind` discriminator that the UI keys off when picking which
       template applies to a given document row

   Both the Templates sub-tab and the Documents sub-tab use these
   definitions: the Generate button opens a modal with the matching
   field set and produces a populated PDF via `jspdf`. The rendered
   PDF intentionally has no GHL/Landmaxo branding so the result is
   self-contained — exactly what the admin filled in, nothing more.
   ───────────────────────────────────────────────────────────── */

export type DocumentKind = 'acknowledgement' | 'agreement' | 'allotment' | 'certificate'

export interface DocumentField {
  key: string
  label: string
  /** `textarea` renders multi-line input + word-wraps in the PDF. `currency` adds a ₹ prefix and renders Indian-comma-grouped figure. */
  type: 'text' | 'textarea' | 'date' | 'currency' | 'number' | 'email' | 'tel'
  required?: boolean
  /** Optional helper hint shown under the input. */
  hint?: string
  /** Optional default value (e.g. constants from the spec). */
  defaultValue?: string
}

export interface DocumentTemplate {
  kind: DocumentKind
  title: string
  headline: string
  fields: DocumentField[]
  body: string[]
  /** Optional small footer line — defaults to a "system generated" notice. */
  footer?: string
}

// ── Templates ────────────────────────────────────────────────────
export const DOCUMENT_TEMPLATES: Record<DocumentKind, DocumentTemplate> = {
  acknowledgement: {
    kind: 'acknowledgement',
    title: 'Acknowledgement Letter',
    headline: 'Acknowledgement of Investment Receipt',
    fields: [
      { key: 'REFERENCE_NUMBER',         label: 'Reference Number',     type: 'text',     required: true,  hint: 'e.g. GIO/119/2627 — sequence / financial year' },
      { key: 'CREDIT_DATE',              label: 'Credit Date',          type: 'date',     required: true },
      { key: 'INVESTOR_NAME',            label: 'Investor Name',        type: 'text',     required: true },
      { key: 'INVESTOR_ADDRESS',         label: 'Investor Address',     type: 'textarea', required: true },
      { key: 'INVESTOR_PHONE',           label: 'Phone Number',         type: 'tel',      required: false },
      { key: 'INVESTMENT_AMOUNT',        label: 'Amount (in figures)',  type: 'currency', required: true },
      { key: 'INVESTMENT_AMOUNT_WORDS',  label: 'Amount (in words)',    type: 'text',     required: true, hint: 'e.g. Ten Lakh Rupees Only' },
    ],
    body: [
      'We acknowledge receipt of your investment towards the subscription of debentures.',
      '',
      'The debentures carry an interest rate of 1% per month along with an annual appreciation of 12%, for a minimum tenure of three (3) years from the date of investment. Interest will be paid on or before the 10th of each month, after deduction of applicable TDS (currently 10%) under the Income Tax Act, 1961.',
      '',
      'Debentures may be redeemed at the investor\'s option after completion of the 3-year tenure. TDS credits will be reflected in the investor\'s PAN account on a quarterly basis.',
    ],
    footer: 'This is a system-generated document. Signature authentication is not required.',
  },

  agreement: {
    kind: 'agreement',
    title: 'Debenture Agreement',
    headline: 'Debenture Subscription Agreement',
    fields: [
      { key: 'CREDIT_DATE',        label: 'Date',                type: 'date',     required: true },
      { key: 'INVESTOR_NAME',      label: 'Investor Name',       type: 'text',     required: true },
      { key: 'INVESTOR_ADDRESS',   label: 'Investor Address',    type: 'textarea', required: true },
      { key: 'INVESTOR_EMAIL',     label: 'Investor Email',      type: 'email',    required: true },
      { key: 'NUM_DEBENTURES',     label: 'No. of Debentures',   type: 'number',   required: true, hint: 'Nominal value ÷ 10' },
      { key: 'INVESTMENT_AMOUNT',  label: 'Nominal Value (₹)',   type: 'currency', required: true, hint: 'Same as the total investment amount' },
    ],
    body: [
      'This agreement is entered into between the Company and the Investor for the subscription of debentures as per Schedule I below.',
      '',
      'The Investor agrees to the terms set out in the principal agreement, including the interest, tenure and redemption clauses.',
      '',
      'Schedule I — Particulars',
      '• Date of allotment, Investor name, number of debentures and nominal value as specified above.',
    ],
  },

  allotment: {
    kind: 'allotment',
    title: 'Allotment Letter',
    headline: 'Letter of Allotment',
    fields: [
      { key: 'ALLOTMENT_DATE',     label: 'Allotment Date',       type: 'date',     required: true },
      { key: 'INVESTOR_NAME',      label: 'Investor Name',        type: 'text',     required: true },
      { key: 'INVESTOR_ADDRESS',   label: 'Investor Address',     type: 'textarea', required: true },
      { key: 'FOLIO_NUMBER',       label: 'Folio Number',         type: 'text',     required: true },
      { key: 'NUM_DEBENTURES',     label: 'No. of Debentures',    type: 'number',   required: true, hint: 'Nominal value ÷ 10' },
      { key: 'DISTINCTIVE_FROM',   label: 'Distinctive No. From', type: 'text',     required: true },
      { key: 'DISTINCTIVE_TO',     label: 'Distinctive No. To',   type: 'text',     required: true },
      { key: 'INVESTMENT_AMOUNT',  label: 'Amount Received (₹)',  type: 'currency', required: true },
      { key: 'FUND_TYPE',          label: 'Fund Type',            type: 'text',     required: true, hint: 'e.g. Direct AIF or Debenture', defaultValue: 'Debenture' },
      { key: 'INTEREST_RATE',      label: 'Rate of Interest',     type: 'text',     required: true, defaultValue: '1% per month' },
      { key: 'TENURE',             label: 'Tenure',               type: 'text',     required: true, defaultValue: '3 years' },
    ],
    body: [
      'We are pleased to inform you that you have been allotted the debentures detailed above against the amount received from you.',
      '',
      'The interest, tenure and other terms applicable to this allotment are as per the principal Debenture Subscription Agreement.',
    ],
  },

  certificate: {
    kind: 'certificate',
    title: 'Debenture Certificate',
    headline: 'Debenture Certificate',
    fields: [
      { key: 'FOLIO_NUMBER',        label: 'Regd. Folio No.',          type: 'text',     required: true },
      { key: 'CERTIFICATE_NUMBER',  label: 'Certificate No.',          type: 'text',     required: true },
      { key: 'INVESTOR_NAME',       label: 'Name of the Holder',       type: 'text',     required: true },
      { key: 'NUM_DEBENTURES',      label: 'No. of Debentures Held',   type: 'number',   required: true },
      { key: 'DISTINCTIVE_RANGE',   label: 'Distinctive Nos.',         type: 'text',     required: true, hint: 'e.g. 1001 — 2000' },
      { key: 'INVESTMENT_AMOUNT',   label: 'Total Value of Debentures (₹)', type: 'currency', required: true },
    ],
    body: [
      'This is to certify that the holder named above is the registered holder of the debentures detailed in this certificate.',
      '',
      '________________________            ________________________',
      'Authorised Signatory                Authorised Signatory',
    ],
  },
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Map a `documents.category` value to the matching template kind.
 * Returns null when the category isn't one of the four supported kinds,
 * so the UI can hide the Generate button for unrelated rows (spec docs,
 * general uploads, etc.).
 */
export function pickTemplateKind(category: string | null | undefined): DocumentKind | null {
  const c = (category || '').toLowerCase()
  if (c === 'acknowledgement') return 'acknowledgement'
  if (c === 'agreement')        return 'agreement'
  if (c === 'allotment')        return 'allotment'
  if (c === 'certificate')      return 'certificate'
  return null
}

/** Convenience getter that throws if a non-template kind is passed in (caller has narrowed via pickTemplateKind). */
export function getTemplate(kind: DocumentKind): DocumentTemplate {
  const t = DOCUMENT_TEMPLATES[kind]
  if (!t) throw new Error(`No template defined for kind '${kind}'`)
  return t
}

/**
 * Format a numeric amount in Indian comma style (1,00,000 / 12,34,567).
 * Returns the input unchanged when the value can't be parsed as a number.
 */
export function formatIndianCurrency(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined || raw === '') return ''
  const n = Number(String(raw).replace(/[^0-9.]/g, ''))
  if (!isFinite(n)) return String(raw)
  const fixed = n.toFixed(2).replace(/\.00$/, '')
  const [intPart, decPart] = fixed.split('.')
  const last3 = intPart.slice(-3)
  const rest = intPart.slice(0, -3)
  const grouped = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3
  return decPart ? `${grouped}.${decPart}` : grouped
}

/** Format an ISO date string `YYYY-MM-DD` as `DD-MM-YYYY` for the PDF body. */
export function formatPdfDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return String(iso)
  return `${m[3]}-${m[2]}-${m[1]}`
}
