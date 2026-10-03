'use client'

/* ─────────────────────────────────────────────────────────────
   Document Builder — drag-to-reorder section editor

   Lets the admin compose an arbitrary document from typed blocks
   (heading, paragraph, key-value list, bullet list, image, signature
   line) and export the result as PDF (via jspdf) or Word .docx
   (via the `docx` library). The output has no GHL/Landmaxo
   branding — purely the content the admin entered, so it doubles
   as a generic letter / report builder.

   Blocks can be added, removed, and re-ordered via HTML5
   drag-and-drop. State is kept in memory only; if the admin
   wants to keep a draft they can re-open the modal in the same
   tab session (we stash state in sessionStorage on every change).
   ───────────────────────────────────────────────────────────── */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus, Trash2, GripVertical, Download, Eye, Type, ListChecks,
  Heading1, AlignLeft, AlignJustify, Image as ImageIcon, PenLine, FileText, Loader2,
  RefreshCw, Library, Table as TableIcon, Building2, Move, ChevronUp, ChevronDown,
  Calendar, Mail, Phone, Link2, Minus, FileX2, BarChart3, Send, Upload,
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  ImageRun, Table, TableRow, TableCell, WidthType, BorderStyle,
} from 'docx'
import { DOCUMENT_TEMPLATES, type DocumentKind } from '@/lib/document-templates'

// ── Block model ─────────────────────────────────────────────────
type BlockKind =
  | 'heading' | 'paragraph' | 'kv-list' | 'bullet-list' | 'image'
  | 'signature' | 'table' | 'footer' | 'spacer'
  // 2026-05-18 Document Builder expansion: communication + structural blocks.
  | 'date' | 'email' | 'phone' | 'link'
  | 'divider' | 'page-break' | 'chart'

interface BaseBlock { id: string; kind: BlockKind }
interface HeadingBlock extends BaseBlock { kind: 'heading'; text: string; level: 1 | 2 | 3; align: 'left' | 'center' | 'right' }
interface ParagraphBlock extends BaseBlock { kind: 'paragraph'; text: string; justify?: boolean }
interface KvListBlock extends BaseBlock { kind: 'kv-list'; rows: { label: string; value: string }[] }
interface BulletListBlock extends BaseBlock { kind: 'bullet-list'; items: string[] }
interface ImageBlock extends BaseBlock {
  kind: 'image'
  dataUrl: string
  width: number
  align: 'left' | 'center' | 'right'
  /** Natural aspect ratio (height / width) captured from the source image
   *  when uploaded or fetched. PDF + DOCX exporters use this so wide logos
   *  don't get squashed into the legacy hard-coded 0.6 ratio. */
  aspectRatio?: number
}
interface SignatureBlock extends BaseBlock { kind: 'signature'; labels: string[] } // two signature lines
interface TableBlock extends BaseBlock {
  kind: 'table'
  headers: string[]
  rows: string[][]
  align: ('left' | 'center' | 'right')[]
}
interface FooterBlock extends BaseBlock {
  kind: 'footer'
  companyName: string
  lines: string[]
  bgColor: string                  // CSS color string e.g. '#FFF6D9'
}
/** 2026-05-15: vertical spacer between blocks. Height is in mm to match
 *  the PDF coordinate space (jsPDF unit:'pt' converts via 1mm ≈ 2.834pt). */
interface SpacerBlock extends BaseBlock {
  kind: 'spacer'
  heightMm: number
}
/** Date block — ISO date plus a display format. Format options match
 *  the most common Indian investor-doc styles. */
interface DateBlock extends BaseBlock {
  kind: 'date'
  label: string                    // e.g. "Date of Issue"
  iso: string                      // YYYY-MM-DD
  format: 'long' | 'short' | 'iso' // "18 May 2026" / "18/05/2026" / "2026-05-18"
  align: 'left' | 'center' | 'right'
}
interface EmailBlock extends BaseBlock {
  kind: 'email'
  label: string
  address: string
  align: 'left' | 'center' | 'right'
}
interface PhoneBlock extends BaseBlock {
  kind: 'phone'
  label: string
  number: string
  align: 'left' | 'center' | 'right'
}
interface LinkBlock extends BaseBlock {
  kind: 'link'
  display: string
  url: string
  align: 'left' | 'center' | 'right'
}
/** Thin horizontal rule between sections. */
interface DividerBlock extends BaseBlock {
  kind: 'divider'
  thickness: number                // px (PDF maps to pt)
  color: string                    // hex
}
/** Forces a page break in PDF; expands to N blank paragraphs in DOCX. */
interface PageBreakBlock extends BaseBlock {
  kind: 'page-break'
}
/** Simple bar chart from {label, value} pairs. Rendered to a data URL via
 *  an offscreen canvas at export time so PDF + DOCX get the same artifact. */
interface ChartBlock extends BaseBlock {
  kind: 'chart'
  title: string
  rows: { label: string; value: number }[]
  variant: 'bar' | 'column' | 'doughnut'
  width: number                    // px
  align: 'left' | 'center' | 'right'
  color: string                    // hex bar color
}

type Block =
  | HeadingBlock | ParagraphBlock | KvListBlock | BulletListBlock | ImageBlock
  | SignatureBlock | TableBlock | FooterBlock | SpacerBlock
  | DateBlock | EmailBlock | PhoneBlock | LinkBlock
  | DividerBlock | PageBreakBlock | ChartBlock

const STORAGE_KEY = 'ghl-admin-document-builder-draft-v1'

const blankBlock = (kind: BlockKind): Block => {
  const id = `b-${Math.random().toString(36).slice(2, 10)}`
  switch (kind) {
    case 'heading':     return { id, kind, text: 'Untitled heading', level: 1, align: 'center' }
    case 'paragraph':   return { id, kind, text: '', justify: true }
    case 'kv-list':     return { id, kind, rows: [{ label: 'Label', value: 'Value' }] }
    case 'bullet-list': return { id, kind, items: [''] }
    case 'image':       return { id, kind, dataUrl: '', width: 280, align: 'center' }
    case 'signature':   return { id, kind, labels: ['Authorised Signatory', 'Authorised Signatory'] }
    case 'table':       return {
      id, kind,
      headers: ['Column 1', 'Column 2', 'Column 3'],
      rows: [['', '', ''], ['', '', '']],
      align: ['left', 'left', 'left'],
    }
    case 'footer':      return {
      id, kind,
      companyName: 'GHL INDIA VENTURES PRIVATE LIMITED',
      lines: [
        'CIN: U70109TN2022PTC151180',
        'Email: info@ghlindiaventures.com',
        'Desk No 12, 2D, Queens Court, Montieth Road, Egmore, Chennai-600008.',
      ],
      bgColor: '#FFF6D9',
    }
    case 'spacer':      return { id, kind, heightMm: 8 }
    case 'date':        return {
      id, kind,
      label: 'Date',
      iso: new Date().toISOString().slice(0, 10),
      format: 'long',
      align: 'left',
    }
    case 'email':       return { id, kind, label: 'Email', address: 'info@ghlindiaventures.com', align: 'left' }
    case 'phone':       return { id, kind, label: 'Phone', number: '+91 7200 255 252', align: 'left' }
    case 'link':        return { id, kind, display: 'GHL India Ventures', url: 'https://ghlindiaventures.com', align: 'left' }
    case 'divider':     return { id, kind, thickness: 1, color: '#9CA3AF' }
    case 'page-break':  return { id, kind }
    case 'chart':       return {
      id, kind,
      title: 'Portfolio Allocation',
      rows: [
        { label: 'AIF Direct', value: 60 },
        { label: 'Co-Invest',  value: 25 },
        { label: 'Debenture',  value: 15 },
      ],
      variant: 'bar',
      width: 420,
      align: 'center',
      color: '#BA181B',
    }
  }
}

// ── Date formatting helper used by both editor preview + exporters ──
function formatDate(iso: string, format: DateBlock['format']): string {
  if (!iso) return ''
  // Accept either YYYY-MM-DD or full ISO; bail to raw input on parse failure.
  const parts = iso.length >= 10 ? iso.slice(0, 10).split('-') : []
  if (parts.length !== 3) return iso
  const y = Number(parts[0]), m = Number(parts[1]), d = Number(parts[2])
  if (!y || !m || !d) return iso
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const dd = String(d).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  if (format === 'iso')   return `${y}-${mm}-${dd}`
  if (format === 'short') return `${dd}/${mm}/${y}`
  return `${dd} ${months[m - 1] || mm} ${y}`
}

// ── Chart rasteriser ─────────────────────────────────────────
// Renders a ChartBlock to a data:image/png URL via an offscreen
// <canvas>. Same artifact gets embedded in PDF and DOCX so the two
// exports look identical. Supports bar / column / doughnut.
function renderChartToDataUrl(block: ChartBlock): string {
  if (typeof document === 'undefined') return ''
  const rows = (block.rows || []).filter(r => Number.isFinite(r.value))
  if (rows.length === 0) return ''
  const W = Math.max(160, Math.min(1200, Math.round(block.width || 420)))
  const H = block.variant === 'doughnut' ? Math.round(W * 0.62) : Math.round(W * 0.55)
  const canvas = document.createElement('canvas')
  canvas.width = W * 2  // retina-ish
  canvas.height = H * 2
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.scale(2, 2)
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, W, H)

  const title = (block.title || '').trim()
  const titleH = title ? 22 : 0
  if (title) {
    ctx.fillStyle = '#111827'
    ctx.font = 'bold 13px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(title, W / 2, 16)
  }

  const padding = { top: titleH + 6, right: 12, bottom: 22, left: block.variant === 'bar' ? 110 : 32 }
  const plotW = W - padding.left - padding.right
  const plotH = H - padding.top - padding.bottom
  const maxVal = Math.max(...rows.map(r => r.value), 1)

  ctx.fillStyle = block.color || '#BA181B'
  ctx.strokeStyle = '#E5E7EB'
  ctx.lineWidth = 0.5

  if (block.variant === 'doughnut') {
    const total = rows.reduce((s, r) => s + r.value, 0) || 1
    const cx = W / 2
    const cy = padding.top + plotH / 2
    const radius = Math.min(plotW, plotH) / 2 - 4
    const inner = radius * 0.55
    const palette = ['#BA181B', '#660708', '#A4161A', '#E5383B', '#9CA3AF', '#374151', '#D4A017']
    let angle = -Math.PI / 2
    rows.forEach((r, i) => {
      const slice = (r.value / total) * Math.PI * 2
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, radius, angle, angle + slice)
      ctx.closePath()
      ctx.fillStyle = palette[i % palette.length]
      ctx.fill()
      angle += slice
    })
    // Punch out the doughnut hole.
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(cx, cy, inner, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
    // Legend on the right edge.
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'left'
    rows.forEach((r, i) => {
      const ly = padding.top + 4 + i * 14
      ctx.fillStyle = palette[i % palette.length]
      ctx.fillRect(W - padding.right - 100, ly, 8, 8)
      ctx.fillStyle = '#111827'
      const pct = ((r.value / total) * 100).toFixed(0)
      ctx.fillText(`${r.label} ${pct}%`, W - padding.right - 86, ly + 7)
    })
  } else if (block.variant === 'column') {
    const barW = plotW / rows.length * 0.6
    const gap = plotW / rows.length
    rows.forEach((r, i) => {
      const h = (r.value / maxVal) * plotH
      const x = padding.left + i * gap + (gap - barW) / 2
      const y = padding.top + plotH - h
      ctx.fillRect(x, y, barW, h)
      ctx.fillStyle = '#374151'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(String(r.value), x + barW / 2, y - 3)
      ctx.fillText(r.label.slice(0, 14), x + barW / 2, padding.top + plotH + 12)
      ctx.fillStyle = block.color || '#BA181B'
    })
  } else {
    // Horizontal bar — default. Easier to read for portfolio splits.
    const barH = plotH / rows.length * 0.6
    const gap = plotH / rows.length
    ctx.font = '10px sans-serif'
    rows.forEach((r, i) => {
      const w = (r.value / maxVal) * plotW
      const y = padding.top + i * gap + (gap - barH) / 2
      ctx.fillStyle = block.color || '#BA181B'
      ctx.fillRect(padding.left, y, w, barH)
      ctx.fillStyle = '#374151'
      ctx.textAlign = 'right'
      ctx.fillText(r.label.slice(0, 16), padding.left - 6, y + barH / 2 + 3)
      ctx.textAlign = 'left'
      ctx.fillText(String(r.value), padding.left + w + 4, y + barH / 2 + 3)
    })
  }

  try {
    return canvas.toDataURL('image/png')
  } catch {
    return ''
  }
}

const blockPalette: { kind: BlockKind; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { kind: 'heading',     label: 'Heading',     icon: Heading1 },
  { kind: 'paragraph',   label: 'Paragraph',   icon: AlignJustify },
  { kind: 'kv-list',     label: 'Field List',  icon: ListChecks },
  { kind: 'bullet-list', label: 'Bullets',     icon: Type },
  { kind: 'table',       label: 'Table',       icon: TableIcon },
  { kind: 'image',       label: 'Image',       icon: ImageIcon },
  { kind: 'chart',       label: 'Chart',       icon: BarChart3 },
  { kind: 'date',        label: 'Date',        icon: Calendar },
  { kind: 'email',       label: 'Email',       icon: Mail },
  { kind: 'phone',       label: 'Phone',       icon: Phone },
  { kind: 'link',        label: 'Link',        icon: Link2 },
  { kind: 'signature',   label: 'Signatures',  icon: PenLine },
  { kind: 'footer',      label: 'Footer',      icon: Building2 },
  { kind: 'divider',     label: 'Divider',     icon: Minus },
  { kind: 'page-break',  label: 'Page Break',  icon: FileX2 },
  { kind: 'spacer',      label: 'Spacer',      icon: Move },
]

// Convert a CSS hex like '#FFF6D9' to a [r,g,b] tuple in 0–255 (jsPDF fillColor input).
function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return [255, 246, 217]
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

interface Props {
  open?: boolean
  onClose?: () => void
  showToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  inline?: boolean
}

interface LibraryImage {
  id: string
  title: string
  fileName: string
  url: string                       // resolved public OR signed URL
  bucket?: string | null
  path?: string | null
  thumbUrl?: string                 // same as url; UI uses <img>
}

export default function DocumentBuilder({ open = true, showToast: propShowToast, inline = true }: Props) {
  const [toastMsg, setToastMsg] = useState<{ msg: string; type: string } | null>(null)
  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    if (propShowToast) { propShowToast(msg, type); return }
    setToastMsg({ msg, type })
    if (typeof window !== 'undefined') window.setTimeout(() => setToastMsg(null), 3500)
  }, [propShowToast])
  const [docTitle, setDocTitle] = useState('Untitled Document')
  const [blocks, setBlocks] = useState<Block[]>([
    { id: 'b-init-heading', kind: 'heading', text: 'Untitled Document', level: 1, align: 'center' },
    { id: 'b-init-para', kind: 'paragraph', text: '' },
  ])
  const [busy, setBusy] = useState<null | 'pdf' | 'docx' | 'preview'>(null)
  const dragId = useRef<string | null>(null)

  // ── Library ──────────────────────────────────────────────────────
  // Pulls uploaded images from public.documents on open and on Refresh.
  // The admin clicks (or drags) a tile to insert it into the canvas; the
  // image is fetched on demand and inlined as a base64 data URL so the
  // PDF / DOCX exporters can embed it without any further network call.
  const [libraryImages, setLibraryImages] = useState<LibraryImage[]>([])
  const [libraryLoading, setLibraryLoading] = useState(false)
  const [insertingId, setInsertingId] = useState<string | null>(null)
  // 2026-05-16: per-tile delete state so a spinner shows on the tile being
  // removed instead of locking the whole panel.
  const [deletingId, setDeletingId] = useState<string | null>(null)
  // Tracks which item is being dragged out of the library so canvas
  // can decide whether to handle an external-drop vs. a reorder-drop.
  const draggedLibraryImageRef = useRef<LibraryImage | null>(null)

  // Restore + autosave draft to sessionStorage.
  // In inline mode the builder is "always open" so we restore once on mount;
  // in modal mode we restore each time the modal opens.
  useEffect(() => {
    if (!inline && !open) return
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed?.blocks)) setBlocks(parsed.blocks)
        if (typeof parsed?.docTitle === 'string') setDocTitle(parsed.docTitle)
      }
    } catch { /* ignore */ }
  }, [open, inline])

  useEffect(() => {
    if (!inline && !open) return
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ docTitle, blocks })) } catch { /* ignore */ }
  }, [open, inline, docTitle, blocks])

  // ── Block ops ─────────────────────────────────────────────────
  const addBlock = (kind: BlockKind) => setBlocks(bs => [...bs, blankBlock(kind)])
  const removeBlock = (id: string) => setBlocks(bs => bs.filter(b => b.id !== id))
  const updateBlock = useCallback((id: string, patch: Partial<Block>) => {
    setBlocks(bs => bs.map(b => b.id === id ? ({ ...b, ...patch } as Block) : b))
  }, [])
  // 2026-05-16: explicit Up / Down reorder. HTML5 drag-and-drop is fragile
  // here because every block hosts <input>/<textarea> editors — clicking to
  // edit text routinely starts a drag and breaks selection, and many admins
  // never figured out the drag at all. Buttons are predictable.
  const moveBlock = useCallback((id: string, dir: -1 | 1) => {
    setBlocks(bs => {
      const idx = bs.findIndex(b => b.id === id)
      if (idx < 0) return bs
      const target = idx + dir
      if (target < 0 || target >= bs.length) return bs
      const next = bs.slice()
      const [moved] = next.splice(idx, 1)
      next.splice(target, 0, moved)
      return next
    })
  }, [])

  const onDragStart = (id: string) => { dragId.current = id }
  const onDragOver = (e: React.DragEvent) => { e.preventDefault() }
  const onDrop = (overId: string) => {
    // Library-image drag takes priority: insert a new Image block at the
    // drop target rather than reorder.
    const libImg = draggedLibraryImageRef.current
    if (libImg) {
      draggedLibraryImageRef.current = null
      void insertImageFromLibrary(libImg, overId)
      return
    }
    const fromId = dragId.current
    if (!fromId || fromId === overId) return
    setBlocks(bs => {
      const from = bs.findIndex(b => b.id === fromId)
      const to = bs.findIndex(b => b.id === overId)
      if (from < 0 || to < 0) return bs
      const next = bs.slice()
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    dragId.current = null
  }

  // ── Library loaders ───────────────────────────────────────────
  // Local-only image library: images are uploaded from the staff member's
  // device and held in memory for the session (no Supabase fetch).
  const loadLibrary = useCallback(() => { setLibraryLoading(false) }, [])

  useEffect(() => { if (open || inline) loadLibrary() }, [open, inline, loadLibrary])

  // 2026-05-15: refresh the library whenever DocumentUploadModal finishes an
  // upload, so newly-uploaded images appear without the user clicking the
  // small Refresh button. The event is dispatched on the window so this
  // component doesn't need a direct prop wire-up.
  useEffect(() => {
    if (!open && !inline) return
    if (typeof window === 'undefined') return
    const handler = () => { loadLibrary() }
    window.addEventListener('ghl-library-uploaded', handler)
    return () => window.removeEventListener('ghl-library-uploaded', handler)
  }, [open, inline, loadLibrary])

  // (insertImageFromLibrary defined below; the related useEffect is mounted
  // after the callback so the dependency reference resolves correctly.)

  // ── Library actions ───────────────────────────────────────────
  // Fetches the chosen image and converts to a data URL so the exporters
  // can embed it without another network hop. The fetch is CORS-friendly
  // — Supabase storage sets `Access-Control-Allow-Origin: *` on object URLs.
  const fetchAsDataUrl = async (url: string): Promise<string> => {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const blob = await resp.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('Read failed'))
      reader.readAsDataURL(blob)
    })
  }

  const insertImageFromLibrary = useCallback(async (img: LibraryImage, anchorId?: string | null) => {
    setInsertingId(img.id)
    try {
      const dataUrl = await fetchAsDataUrl(img.url)
      // Probe natural dimensions so PDF/DOCX export respects the aspect ratio.
      const aspectRatio = await new Promise<number>((resolve) => {
        const probe = new window.Image()
        probe.onload = () => {
          const w = probe.naturalWidth || 1
          const h = probe.naturalHeight || 1
          resolve(h / w)
        }
        probe.onerror = () => resolve(0.6)
        probe.src = dataUrl
      })
      setBlocks(bs => {
        const block: ImageBlock = {
          id: `b-${Math.random().toString(36).slice(2, 10)}`,
          kind: 'image',
          dataUrl,
          width: 320,
          align: 'center',
          aspectRatio,
        }
        if (!anchorId) return [...bs, block]
        const idx = bs.findIndex(b => b.id === anchorId)
        if (idx < 0) return [...bs, block]
        const next = bs.slice()
        next.splice(idx + 1, 0, block)
        return next
      })
      showToast(`Inserted "${img.title}".`, 'success')
    } catch (e: any) {
      showToast(`Could not insert image: ${e?.message || 'fetch failed'}`, 'error')
    } finally {
      setInsertingId(null)
    }
  }, [showToast])

  // 2026-05-16: Delete a library image — removes the storage object AND the
  // public.documents row in one click. Confirm dialog up front since this
  // is irreversible; the screenshot uploader will simply re-insert a fresh
  // row + object next time the admin uploads the same file.
  // Upload images from the device into the in-memory library.
  const addLocalImages = useCallback((files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = () => {
        const url = String(reader.result)
        setLibraryImages(prev => [
          { id: `lib-${Math.random().toString(36).slice(2, 10)}`, title: file.name.replace(/\.[^.]+$/, ''), fileName: file.name, url, thumbUrl: url },
          ...prev,
        ])
      }
      reader.readAsDataURL(file)
    })
  }, [])

  // Local-only library: just drop the in-memory tile.
  const deleteLibraryImage = useCallback((img: LibraryImage) => {
    setLibraryImages(prev => prev.filter(x => x.id !== img.id))
  }, [])

  // 2026-05-15: when an admin clicks Insert on a library tile inside the
  // View Library modal, drop a fresh Image block into the canvas. The
  // event carries the resolved public/signed URL + a display title.
  // (Mounted after insertImageFromLibrary so the reference resolves.)
  useEffect(() => {
    if (!open && !inline) return
    if (typeof window === 'undefined') return
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {}
      const img: LibraryImage = {
        id: `lib-${Math.random().toString(36).slice(2, 10)}`,
        title: String(detail.title || 'Library image'),
        fileName: String(detail.fileName || detail.title || 'image'),
        url: String(detail.url || ''),
        thumbUrl: String(detail.url || ''),
      }
      if (img.url) void insertImageFromLibrary(img)
    }
    window.addEventListener('ghl-library-insert-image', handler)
    return () => window.removeEventListener('ghl-library-insert-image', handler)
  }, [open, inline, insertImageFromLibrary])

  // Field templates — drop a ready-made document sourced from
  // DOCUMENT_TEMPLATES (Acknowledgement, Debenture Agreement, Allotment Letter,
  // Debenture Certificate). 08-06-2026: previously this only inserted a heading
  // + field list; now it lays out the full document — headline, the field table
  // (pre-filled with each field's default or a {{TOKEN}} placeholder), the body
  // paragraphs and the footer — so the admin gets a complete, fill-in template
  // rather than a bare field list.
  const insertFieldTemplate = useCallback((kind: DocumentKind) => {
    const t = DOCUMENT_TEMPLATES[kind]
    if (!t) return
    const uid = () => `b-${Math.random().toString(36).slice(2, 10)}`
    const tplBlocks: Block[] = [
      { id: uid(), kind: 'heading', text: t.headline, level: 1, align: 'center' },
      { id: uid(), kind: 'kv-list', rows: t.fields.map(f => ({ label: f.label, value: f.defaultValue || `{{${f.key}}}` })) },
    ]
    // Body is an array where '' marks a paragraph break — group runs of
    // non-empty lines into one paragraph block each.
    let group: string[] = []
    const flush = () => {
      if (group.length) { tplBlocks.push({ id: uid(), kind: 'paragraph', text: group.join('\n'), justify: true }); group = [] }
    }
    for (const line of t.body) {
      if (line === '') flush()
      else group.push(line)
    }
    flush()
    if (t.footer) tplBlocks.push({ id: uid(), kind: 'paragraph', text: t.footer, justify: false })

    setBlocks(bs => {
      // Replace the pristine default canvas; otherwise append so in-progress
      // work isn't lost.
      const isPristine = bs.length <= 2
        && bs.every(b => (b.kind === 'heading' && b.text === 'Untitled Document') || (b.kind === 'paragraph' && !(b as ParagraphBlock).text))
      return isPristine ? tplBlocks : [...bs, ...tplBlocks]
    })
    setDocTitle(prev => (prev && prev !== 'Untitled Document') ? prev : t.title)
    showToast(`Inserted the ${t.title} template.`, 'success')
  }, [showToast])

  // ── Export: PDF ──────────────────────────────────────────────
  const renderPdfBlob = (): Blob => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const margin = 56
    let y = margin

    const ensureSpace = (h: number) => {
      if (y + h > pageH - margin) { doc.addPage(); y = margin }
    }

    for (const b of blocks) {
      if (b.kind === 'heading') {
        const size = b.level === 1 ? 18 : b.level === 2 ? 14 : 12
        doc.setFont('helvetica', 'bold').setFontSize(size)
        const lines = doc.splitTextToSize(b.text || '', pageW - margin * 2)
        const lineH = size + 4
        ensureSpace(lines.length * lineH + 6)
        for (const line of lines) {
          const x = b.align === 'center' ? pageW / 2 : b.align === 'right' ? pageW - margin : margin
          doc.text(line, x, y, { align: b.align })
          y += lineH
        }
        y += 6
      } else if (b.kind === 'paragraph') {
        doc.setFont('helvetica', 'normal').setFontSize(11)
        const maxW = pageW - margin * 2
        const lines = doc.splitTextToSize(b.text || '', maxW)
        const justify = b.justify !== false
        for (let i = 0; i < lines.length; i++) {
          ensureSpace(16)
          const line = lines[i]
          const isLast = i === lines.length - 1 || lines[i + 1] === ''
          if (justify && !isLast && line.trim().includes(' ')) {
            // Distribute extra space across word gaps to justify the line.
            const words = line.split(' ').filter(Boolean)
            if (words.length > 1) {
              const naturalW = doc.getTextWidth(words.join(' '))
              const extra = maxW - naturalW
              const gap = doc.getTextWidth(' ') + extra / (words.length - 1)
              let x = margin
              for (let j = 0; j < words.length; j++) {
                doc.text(words[j], x, y)
                x += doc.getTextWidth(words[j]) + gap
              }
            } else {
              doc.text(line, margin, y)
            }
          } else {
            doc.text(line, margin, y)
          }
          y += 14
        }
        y += 6
      } else if (b.kind === 'table') {
        doc.setFontSize(10)
        const cols = Math.max(1, b.headers.length)
        const cellW = (pageW - margin * 2) / cols
        const padX = 4
        const padY = 5
        // header row
        const hdrLines = b.headers.map(h => doc.splitTextToSize(h || '', cellW - padX * 2))
        const hdrH = Math.max(18, ...hdrLines.map((ls: string[]) => ls.length * 12)) + padY * 2
        ensureSpace(hdrH + 28)
        doc.setFillColor(245, 245, 245)
        doc.rect(margin, y, cellW * cols, hdrH, 'F')
        doc.setFont('helvetica', 'bold')
        for (let c = 0; c < cols; c++) {
          const x = margin + cellW * c
          doc.rect(x, y, cellW, hdrH)
          doc.text(hdrLines[c], x + cellW / 2, y + padY + 10, { align: 'center' })
        }
        y += hdrH
        // body rows
        doc.setFont('helvetica', 'normal')
        for (const row of b.rows) {
          const cellLines = row.map((cell, c) => doc.splitTextToSize(cell || '', cellW - padX * 2))
          const rowH = Math.max(16, ...cellLines.map((ls: string[]) => ls.length * 12)) + padY * 2
          ensureSpace(rowH)
          for (let c = 0; c < cols; c++) {
            const x = margin + cellW * c
            doc.rect(x, y, cellW, rowH)
            const align = (b.align && b.align[c]) || 'left'
            const tx = align === 'center' ? x + cellW / 2
                    : align === 'right' ? x + cellW - padX
                    : x + padX
            doc.text(cellLines[c], tx, y + padY + 10, { align })
          }
          y += rowH
        }
        y += 8
      } else if (b.kind === 'footer') {
        // Render at the current y as a coloured band spanning the full width.
        const [r, g, bl] = hexToRgb(b.bgColor)
        const bandLines = [b.companyName, ...b.lines].filter(Boolean)
        const lineH = 14
        const titleH = 20
        const bandH = titleH + (bandLines.length - 1) * lineH + 14
        ensureSpace(bandH + 8)
        doc.setFillColor(r, g, bl)
        doc.rect(0, y, pageW, bandH, 'F')
        let cy = y + 14
        doc.setFont('helvetica', 'bold').setFontSize(13).setTextColor(20, 20, 20)
        doc.text(bandLines[0] || '', pageW / 2, cy, { align: 'center' })
        cy += titleH
        doc.setFont('helvetica', 'normal').setFontSize(9.5)
        for (let i = 1; i < bandLines.length; i++) {
          doc.text(bandLines[i] || '', pageW / 2, cy, { align: 'center' })
          cy += lineH
        }
        doc.setTextColor(0, 0, 0)
        y += bandH + 6
      } else if (b.kind === 'spacer') {
        // 2026-05-15: arbitrary vertical gap between blocks. 1mm ≈ 2.834pt.
        const pts = Math.max(0, Math.min(80, b.heightMm)) * 2.834
        ensureSpace(pts)
        y += pts
      } else if (b.kind === 'kv-list') {
        doc.setFontSize(11)
        for (const row of b.rows) {
          ensureSpace(20)
          doc.setFont('helvetica', 'bold')
          doc.text(`${row.label}:`, margin, y)
          doc.setFont('helvetica', 'normal')
          const valLines = doc.splitTextToSize(row.value || '', pageW - margin - (margin + 180))
          doc.text(valLines, margin + 180, y)
          y += Math.max(20, valLines.length * 14)
        }
        y += 6
      } else if (b.kind === 'bullet-list') {
        doc.setFont('helvetica', 'normal').setFontSize(11)
        for (const item of b.items) {
          const lines = doc.splitTextToSize(item || '', pageW - margin * 2 - 16)
          ensureSpace(lines.length * 14 + 4)
          for (let i = 0; i < lines.length; i++) {
            doc.text(i === 0 ? '•  ' + lines[i] : '   ' + lines[i], margin, y)
            y += 14
          }
        }
        y += 6
      } else if (b.kind === 'image' && b.dataUrl) {
        // 2026-05-15: respect the image's natural aspect ratio so wide logos
        // (e.g. GHL India Ventures' 3:1 wordmark) don't get vertically
        // stretched into the legacy 0.6 hard-coded ratio.
        const aspect = (typeof b.aspectRatio === 'number' && b.aspectRatio > 0) ? b.aspectRatio : 0.6
        const drawH = b.width * aspect
        ensureSpace(drawH + 12)
        const x = b.align === 'center' ? (pageW - b.width) / 2 : b.align === 'right' ? pageW - margin - b.width : margin
        try {
          // Detect PNG vs JPEG from data URL prefix so jsPDF doesn't lossy-recompress.
          const fmt = /^data:image\/jpe?g/i.test(b.dataUrl) ? 'JPEG' : 'PNG'
          doc.addImage(b.dataUrl, fmt, x, y, b.width, drawH, undefined, 'FAST')
        } catch { /* ignore — broken image */ }
        y += drawH + 12
      } else if (b.kind === 'signature') {
        ensureSpace(40)
        const halves = b.labels.slice(0, 2)
        const x1 = margin
        const x2 = pageW / 2 + 10
        doc.setFontSize(11)
        doc.line(x1, y, x1 + 180, y)
        if (halves[1]) doc.line(x2, y, x2 + 180, y)
        y += 14
        doc.text(halves[0] || '', x1, y)
        if (halves[1]) doc.text(halves[1], x2, y)
        y += 20
      } else if (b.kind === 'date') {
        ensureSpace(20)
        doc.setFont('helvetica', 'normal').setFontSize(11)
        const text = `${b.label ? b.label + ': ' : ''}${formatDate(b.iso, b.format)}`
        const x = b.align === 'center' ? pageW / 2 : b.align === 'right' ? pageW - margin : margin
        doc.text(text, x, y, { align: b.align })
        y += 16
      } else if (b.kind === 'email') {
        ensureSpace(20)
        doc.setFont('helvetica', 'normal').setFontSize(11)
        const text = `${b.label ? b.label + ': ' : ''}${b.address || ''}`
        const x = b.align === 'center' ? pageW / 2 : b.align === 'right' ? pageW - margin : margin
        doc.setTextColor(20, 20, 220)
        doc.textWithLink(text, x, y, { align: b.align, url: `mailto:${b.address || ''}` })
        doc.setTextColor(0, 0, 0)
        y += 16
      } else if (b.kind === 'phone') {
        ensureSpace(20)
        doc.setFont('helvetica', 'normal').setFontSize(11)
        const text = `${b.label ? b.label + ': ' : ''}${b.number || ''}`
        const x = b.align === 'center' ? pageW / 2 : b.align === 'right' ? pageW - margin : margin
        const tel = (b.number || '').replace(/[^+\d]/g, '')
        doc.setTextColor(20, 20, 220)
        doc.textWithLink(text, x, y, { align: b.align, url: tel ? `tel:${tel}` : '#' })
        doc.setTextColor(0, 0, 0)
        y += 16
      } else if (b.kind === 'link') {
        ensureSpace(20)
        doc.setFont('helvetica', 'normal').setFontSize(11)
        const display = b.display || b.url || ''
        const x = b.align === 'center' ? pageW / 2 : b.align === 'right' ? pageW - margin : margin
        doc.setTextColor(20, 20, 220)
        doc.textWithLink(display, x, y, { align: b.align, url: b.url || '#' })
        doc.setTextColor(0, 0, 0)
        y += 16
      } else if (b.kind === 'divider') {
        ensureSpace(12)
        const [dr, dg, db] = hexToRgb(b.color || '#9CA3AF')
        doc.setDrawColor(dr, dg, db)
        doc.setLineWidth(Math.max(0.4, Math.min(4, b.thickness || 1)))
        doc.line(margin, y, pageW - margin, y)
        doc.setDrawColor(0, 0, 0)
        doc.setLineWidth(0.4)
        y += 10
      } else if (b.kind === 'page-break') {
        doc.addPage()
        y = margin
      } else if (b.kind === 'chart') {
        const dataUrl = renderChartToDataUrl(b)
        if (dataUrl) {
          // Match the embed sizing logic used for image blocks.
          const w = Math.max(120, Math.min(pageW - margin * 2, b.width))
          // Mirror chart aspect from renderChartToDataUrl (variant-specific).
          const aspect = b.variant === 'doughnut' ? 0.62 : 0.55
          const h = w * aspect
          ensureSpace(h + 12)
          const x = b.align === 'center' ? (pageW - w) / 2
                  : b.align === 'right' ? pageW - margin - w
                  : margin
          try { doc.addImage(dataUrl, 'PNG', x, y, w, h, undefined, 'FAST') } catch { /* ignore */ }
          y += h + 10
        }
      }
    }

    return doc.output('blob')
  }

  // ── Export: Word ──────────────────────────────────────────────
  const renderDocxBlob = async (): Promise<Blob> => {
    const children: any[] = []
    const headingLevelMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
      1: HeadingLevel.HEADING_1,
      2: HeadingLevel.HEADING_2,
      3: HeadingLevel.HEADING_3,
    }

    for (const b of blocks) {
      if (b.kind === 'heading') {
        children.push(new Paragraph({
          text: b.text || '',
          heading: headingLevelMap[b.level],
          alignment: b.align === 'center' ? AlignmentType.CENTER : b.align === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT,
        }))
      } else if (b.kind === 'paragraph') {
        // Preserve newlines by splitting into multiple paragraphs.
        const parts = (b.text || '').split('\n')
        const align = b.justify !== false ? AlignmentType.JUSTIFIED : AlignmentType.LEFT
        for (const part of parts) children.push(new Paragraph({ children: [new TextRun(part)], alignment: align }))
      } else if (b.kind === 'table') {
        const tableRows: TableRow[] = []
        const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
        const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }
        // Header row
        tableRows.push(new TableRow({
          children: b.headers.map(h => new TableCell({
            borders,
            children: [new Paragraph({
              children: [new TextRun({ text: h || '', bold: true })],
              alignment: AlignmentType.CENTER,
            })],
          })),
        }))
        for (const row of b.rows) {
          tableRows.push(new TableRow({
            children: b.headers.map((_, c) => {
              const align = (b.align && b.align[c]) || 'left'
              const dxa = align === 'center' ? AlignmentType.CENTER
                        : align === 'right' ? AlignmentType.RIGHT
                        : AlignmentType.LEFT
              return new TableCell({
                borders,
                children: [new Paragraph({ children: [new TextRun(row[c] || '')], alignment: dxa })],
              })
            }),
          }))
        }
        children.push(new Table({
          rows: tableRows,
          width: { size: 100, type: WidthType.PERCENTAGE },
        }))
        children.push(new Paragraph({ text: '' }))
      } else if (b.kind === 'footer') {
        children.push(new Paragraph({
          children: [new TextRun({ text: b.companyName || '', bold: true })],
          alignment: AlignmentType.CENTER,
        }))
        for (const ln of b.lines) {
          if (!ln) continue
          children.push(new Paragraph({ children: [new TextRun(ln)], alignment: AlignmentType.CENTER }))
        }
      } else if (b.kind === 'spacer') {
        // Approximate one blank paragraph per ~6mm of requested spacing.
        const count = Math.max(1, Math.min(20, Math.round(b.heightMm / 6)))
        for (let i = 0; i < count; i++) children.push(new Paragraph({ text: '' }))
      } else if (b.kind === 'kv-list') {
        for (const row of b.rows) {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: `${row.label}: `, bold: true }),
              new TextRun({ text: row.value || '' }),
            ],
          }))
        }
      } else if (b.kind === 'bullet-list') {
        for (const item of b.items) {
          children.push(new Paragraph({ text: item || '', bullet: { level: 0 } }))
        }
      } else if (b.kind === 'image' && b.dataUrl) {
        try {
          const base64 = b.dataUrl.split(',')[1] || ''
          const bin = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
          // Respect natural aspect ratio so logos don't get squashed.
          const aspect = (typeof b.aspectRatio === 'number' && b.aspectRatio > 0) ? b.aspectRatio : 0.6
          children.push(new Paragraph({
            children: [new ImageRun({
              data: bin,
              transformation: { width: b.width, height: Math.round(b.width * aspect) },
            } as any)],
            alignment: b.align === 'center' ? AlignmentType.CENTER : b.align === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT,
          }))
        } catch { /* ignore */ }
      } else if (b.kind === 'signature') {
        children.push(new Paragraph({ text: '' }))
        children.push(new Paragraph({ text: '_________________________            _________________________' }))
        children.push(new Paragraph({ text: `${b.labels[0] || ''}                                  ${b.labels[1] || ''}` }))
      } else if (b.kind === 'date') {
        const align = b.align === 'center' ? AlignmentType.CENTER : b.align === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT
        children.push(new Paragraph({
          alignment: align,
          children: [
            new TextRun({ text: b.label ? `${b.label}: ` : '', bold: !!b.label }),
            new TextRun({ text: formatDate(b.iso, b.format) }),
          ],
        }))
      } else if (b.kind === 'email') {
        const align = b.align === 'center' ? AlignmentType.CENTER : b.align === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT
        children.push(new Paragraph({
          alignment: align,
          children: [
            new TextRun({ text: b.label ? `${b.label}: ` : '', bold: !!b.label }),
            new TextRun({ text: b.address || '', color: '1A56DB', underline: {} as any }),
          ],
        }))
      } else if (b.kind === 'phone') {
        const align = b.align === 'center' ? AlignmentType.CENTER : b.align === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT
        children.push(new Paragraph({
          alignment: align,
          children: [
            new TextRun({ text: b.label ? `${b.label}: ` : '', bold: !!b.label }),
            new TextRun({ text: b.number || '' }),
          ],
        }))
      } else if (b.kind === 'link') {
        const align = b.align === 'center' ? AlignmentType.CENTER : b.align === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT
        children.push(new Paragraph({
          alignment: align,
          children: [new TextRun({ text: b.display || b.url || '', color: '1A56DB', underline: {} as any })],
        }))
      } else if (b.kind === 'divider') {
        // Approximate a horizontal rule in Word with a long em-dash row.
        children.push(new Paragraph({ children: [new TextRun({ text: '—'.repeat(40), color: (b.color || '#9CA3AF').replace('#', '') })] }))
      } else if (b.kind === 'page-break') {
        children.push(new Paragraph({ children: [new TextRun({ text: '', break: 1 })], pageBreakBefore: true } as any))
      } else if (b.kind === 'chart') {
        try {
          const dataUrl = renderChartToDataUrl(b)
          if (dataUrl) {
            const base64 = dataUrl.split(',')[1] || ''
            const bin = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
            const aspect = b.variant === 'doughnut' ? 0.62 : 0.55
            children.push(new Paragraph({
              alignment: b.align === 'center' ? AlignmentType.CENTER : b.align === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT,
              children: [new ImageRun({
                data: bin,
                transformation: { width: b.width, height: Math.round(b.width * aspect) },
              } as any)],
            }))
          }
        } catch { /* ignore */ }
      }
    }

    const doc = new Document({
      creator: 'GHL India Ventures Admin',
      title: docTitle,
      sections: [{ properties: {}, children }],
    })

    return await Packer.toBlob(doc)
  }

  const safeName = useMemo(() => (docTitle || 'document').replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-'), [docTitle])

  const downloadBlob = (blob: Blob, ext: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${safeName}.${ext}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  const handlePreview = () => {
    try {
      setBusy('preview')
      const blob = renderPdfBlob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank', 'noopener,noreferrer')
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e: any) {
      showToast(`Preview failed: ${e?.message || 'unknown'}`, 'error')
    } finally { setBusy(null) }
  }

  const handleExportPdf = () => {
    try {
      setBusy('pdf')
      const blob = renderPdfBlob()
      downloadBlob(blob, 'pdf')
      showToast('PDF downloaded.', 'success')
    } catch (e: any) {
      showToast(`PDF export failed: ${e?.message || 'unknown'}`, 'error')
    } finally { setBusy(null) }
  }

  const handleExportDocx = async () => {
    try {
      setBusy('docx')
      const blob = await renderDocxBlob()
      downloadBlob(blob, 'docx')
      showToast('Word document downloaded.', 'success')
    } catch (e: any) {
      showToast(`Word export failed: ${e?.message || 'unknown'}`, 'error')
    } finally { setBusy(null) }
  }

  // Send-to-Clients lives in the Bulk Emailer module (/staff/emailer).

  // Toolbar action buttons.
  const btnBase = 'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50'
  const actionButtons = (
    <>
      <button onClick={handlePreview} disabled={!!busy} className={`${btnBase} bg-white border border-slate-200 text-navy hover:bg-slate-100`}>
        {busy === 'preview' ? (<><Loader2 className="w-4 h-4 animate-spin" /> Rendering…</>) : (<><Eye className="w-4 h-4" /> Preview PDF</>)}
      </button>
      <button onClick={handleExportDocx} disabled={!!busy} className={`${btnBase} bg-white border border-slate-200 text-navy hover:bg-slate-100`}>
        {busy === 'docx' ? (<><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>) : (<><Download className="w-4 h-4" /> Export .docx</>)}
      </button>
      <button onClick={handleExportPdf} disabled={!!busy} className={`${btnBase} bg-sky-600 text-white hover:bg-sky-500`}>
        {busy === 'pdf' ? (<><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>) : (<><FileText className="w-4 h-4" /> Export PDF</>)}
      </button>
    </>
  )

  const body = (
    <div className={`grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4${inline ? ' docbuilder-inline-grid' : ''}`}>
        {/* Block palette + Library */}
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 px-1">Add Block</div>
          {blockPalette.map(p => {
            const Icon = p.icon
            return (
              <button key={p.kind} onClick={() => addBlock(p.kind)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 hover:bg-slate-100 hover:text-navy transition-colors">
                <Icon className="w-3.5 h-3.5" /> {p.label}
              </button>
            )
          })}

          {/* Document Templates — click to load a ready-made document (fields
              + body) for one of the four known kinds, incl. Allotment Letter
              and Debenture Certificate. */}
          <div className="pt-3 border-t border-slate-200">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 px-1 mb-1.5">Document Templates</div>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(DOCUMENT_TEMPLATES) as DocumentKind[]).map(k => (
                <button
                  key={k}
                  onClick={() => insertFieldTemplate(k)}
                  className="px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[10px] font-medium text-amber-700 hover:bg-amber-100 transition-colors text-left"
                  title={`Load the ${DOCUMENT_TEMPLATES[k].title} template`}
                >
                  {DOCUMENT_TEMPLATES[k].title}
                </button>
              ))}
            </div>
          </div>

          {/* Image Library — pulled from uploaded documents (mime image/*).
              2026-05-15: surfaced more prominently in inline mode so admins
              can see at a glance which uploaded images are insertable into
              the canvas. Each tile is click-to-insert OR drag-to-canvas. */}
          <div className="pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between px-1 mb-1.5">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Library className="w-3 h-3" /> Image Library
                {libraryImages.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] rounded-full bg-sky-600/20 text-sky-600 text-[9px] font-bold px-1">{libraryImages.length}</span>
                )}
              </div>
              <label className="text-[10px] text-sky-600 hover:text-navy inline-flex items-center gap-1 cursor-pointer" title="Upload images to the library">
                <Upload className="w-3 h-3" /> Upload
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addLocalImages(e.target.files); e.target.value = '' }} />
              </label>
            </div>
            {libraryLoading && libraryImages.length === 0 ? (
              <div className="text-[10px] text-slate-500 px-1 py-2">Loading…</div>
            ) : libraryImages.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-center">
                <Library className="w-5 h-5 text-slate-500 mx-auto mb-1.5" />
                <p className="text-[11px] text-slate-700 font-medium mb-0.5">Your library is empty</p>
                <p className="text-[10px] text-slate-500 leading-snug">
                  Click <span className="text-sky-600 font-medium">Upload</span> above to add PNGs / JPGs.
                  Tiles appear here — click any tile to insert it into the canvas.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {libraryImages.map(img => (
                  <div
                    key={img.id}
                    className="group relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-50 hover:border-sky-600/40 hover:ring-2 hover:ring-sky-600/30 transition-all"
                  >
                    {/* Insert (click) + drag surface. The tile itself is the
                        click target; the delete button below floats above. */}
                    <button
                      type="button"
                      draggable
                      onDragStart={(e) => {
                        draggedLibraryImageRef.current = img
                        // Hide the reorder semantic during this drag.
                        dragId.current = null
                        try { e.dataTransfer.setData('text/plain', img.id) } catch { /* ignore */ }
                        e.dataTransfer.effectAllowed = 'copy'
                      }}
                      onDragEnd={() => { draggedLibraryImageRef.current = null }}
                      onClick={() => insertImageFromLibrary(img)}
                      disabled={insertingId === img.id || deletingId === img.id}
                      className="absolute inset-0 w-full h-full disabled:opacity-60 disabled:cursor-not-allowed"
                      title={`Click to insert "${img.title}"`}
                      aria-label={`Insert ${img.title}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.thumbUrl} alt={img.title} className="w-full h-full object-cover pointer-events-none" />
                      {/* Hover overlay — confirms the click action */}
                      <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 px-2 py-1 rounded-md bg-sky-600 text-white text-[9px] font-semibold uppercase tracking-wider">
                          <Plus className="w-3 h-3" /> Insert
                        </span>
                      </span>
                    </button>
                    {/* Delete chip — only appears on hover; click stops
                        propagation so it doesn't also trigger insert. */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); void deleteLibraryImage(img) }}
                      disabled={deletingId === img.id || insertingId === img.id}
                      className="absolute top-1 right-1 z-10 p-1 rounded-md bg-black/70 text-red-300 opacity-0 group-hover:opacity-100 hover:bg-red-500/80 hover:text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                      title={`Delete "${img.title}" from library`}
                      aria-label={`Delete ${img.title}`}
                    >
                      {deletingId === img.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    </button>
                    {insertingId === img.id && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/60 pointer-events-none">
                        <Loader2 className="w-4 h-4 animate-spin text-navy" />
                      </span>
                    )}
                    <span className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 text-[9px] text-white bg-black/60 truncate pointer-events-none">{img.title}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[9px] text-slate-500 px-1 mt-1.5">
              <span className="text-emerald-600">Click</span> a tile to insert · or <span className="text-emerald-600">drag</span> onto a specific block to drop it after that block.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-200">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 px-1 mb-1.5">Title (file name)</div>
            <input value={docTitle} onChange={e => setDocTitle(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-navy focus:outline-none focus:border-sky-600/40" />
          </div>
        </div>

        {/* Canvas */}
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {blocks.length === 0 && (
            <div className="py-10 rounded-xl border-2 border-dashed border-slate-200 text-center text-sm text-slate-500">
              No blocks yet — add one from the panel on the left.
            </div>
          )}
          {blocks.map((b, idx) => (
            <div
              key={b.id}
              onDragOver={onDragOver}
              onDrop={() => onDrop(b.id)}
              className="rounded-xl bg-slate-50 border border-slate-200 p-3"
            >
              <div className="flex items-start gap-2">
                {/* Reorder controls — explicit Up/Down + drag handle.
                    Drag is scoped to the handle only so input/textarea
                    selection inside the block never triggers a drag. */}
                <div className="flex flex-col items-center gap-0.5 mt-0.5">
                  <button
                    type="button"
                    onClick={() => moveBlock(b.id, -1)}
                    disabled={idx === 0}
                    className="p-0.5 text-slate-500 hover:text-navy disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Move block up"
                    aria-label="Move block up"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                  <span
                    draggable
                    onDragStart={() => onDragStart(b.id)}
                    title="Drag to reorder"
                    className="cursor-grab active:cursor-grabbing"
                  >
                    <GripVertical className="w-4 h-4 text-slate-500" />
                  </span>
                  <button
                    type="button"
                    onClick={() => moveBlock(b.id, 1)}
                    disabled={idx === blocks.length - 1}
                    className="p-0.5 text-slate-500 hover:text-navy disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Move block down"
                    aria-label="Move block down"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex-1">
                  <BlockEditor block={b} onChange={(patch) => updateBlock(b.id, patch)} />
                </div>
                <button onClick={() => removeBlock(b.id)} className="p-1 text-slate-500 hover:text-red-300" title="Remove block">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          <div className="pt-1">
            <button onClick={() => addBlock('paragraph')} className="inline-flex items-center gap-1.5 text-[11px] text-sky-600 hover:underline">
              <Plus className="w-3 h-3" /> Add paragraph
            </button>
          </div>
        </div>
      </div>
  )

  // Always rendered as an inline panel inside the staff page.
  void open
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-navy">Document Builder</h2>
          <p className="text-[11px] text-slate-600 mt-0.5 max-w-2xl">
            Drag blocks to reorder. Insert headings, paragraphs (justified), field lists, tables, bullet lists, images, dates, emails, phones, links, charts, dividers, page breaks, signatures, and footers. Export as PDF or Word.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">{actionButtons}</div>
      </div>
      {body}
      {toastMsg && (
        <div className={`fixed bottom-6 right-6 z-50 rounded-lg px-4 py-2 text-sm shadow-lg border ${toastMsg.type === 'error' ? 'bg-rose-950 border-rose-700 text-rose-100' : toastMsg.type === 'success' ? 'bg-emerald-950 border-emerald-700 text-emerald-100' : 'bg-slate-900 border-slate-700 text-slate-100'}`}>
          {toastMsg.msg}
        </div>
      )}
    </div>
  )
}

// ── Per-block editors ────────────────────────────────────────────
function BlockEditor({ block, onChange }: { block: Block; onChange: (patch: Partial<Block>) => void }) {
  const input = 'w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-navy placeholder-slate-400 focus:outline-none focus:border-sky-600/40'

  if (block.kind === 'heading') {
    return (
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Heading</div>
        <input value={block.text} onChange={e => onChange({ text: e.target.value } as any)} className={input + ' text-sm font-semibold'} placeholder="Heading text" />
        <div className="flex gap-2 text-[11px]">
          <select value={String(block.level)} onChange={e => onChange({ level: Number(e.target.value) as 1 | 2 | 3 } as any)} className={input + ' max-w-[100px]'}>
            <option value="1">H1</option><option value="2">H2</option><option value="3">H3</option>
          </select>
          <select value={block.align} onChange={e => onChange({ align: e.target.value as any } as any)} className={input + ' max-w-[120px]'}>
            <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
          </select>
        </div>
      </div>
    )
  }

  if (block.kind === 'paragraph') {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Paragraph</div>
          <label className="flex items-center gap-1.5 text-[10px] text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={block.justify !== false}
              onChange={e => onChange({ justify: e.target.checked } as any)}
              className="accent-sky-600"
            />
            Justified
          </label>
        </div>
        <textarea value={block.text} onChange={e => onChange({ text: e.target.value } as any)} rows={3} placeholder="Write your paragraph…" className={input + ' resize-none text-[12px] leading-relaxed'} style={{ textAlign: block.justify !== false ? 'justify' : 'left' }} />
      </div>
    )
  }

  if (block.kind === 'table') {
    const setHeader = (i: number, v: string) =>
      onChange({ headers: block.headers.map((h, j) => j === i ? v : h) } as any)
    const setAlign = (i: number, v: 'left' | 'center' | 'right') =>
      onChange({ align: block.align.map((a, j) => j === i ? v : a) } as any)
    const setCell = (r: number, c: number, v: string) =>
      onChange({ rows: block.rows.map((row, ri) => ri === r ? row.map((cell, ci) => ci === c ? v : cell) : row) } as any)
    const addColumn = () =>
      onChange({
        headers: [...block.headers, `Column ${block.headers.length + 1}`],
        rows: block.rows.map(r => [...r, '']),
        align: [...block.align, 'left'],
      } as any)
    const removeColumn = (i: number) =>
      onChange({
        headers: block.headers.filter((_, j) => j !== i),
        rows: block.rows.map(r => r.filter((_, j) => j !== i)),
        align: block.align.filter((_, j) => j !== i),
      } as any)
    const addRow = () =>
      onChange({ rows: [...block.rows, block.headers.map(() => '')] } as any)
    const removeRow = (i: number) =>
      onChange({ rows: block.rows.filter((_, j) => j !== i) } as any)
    return (
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Table</div>
        {/* Headers */}
        <div className="space-y-1.5">
          <div className="text-[10px] text-slate-500">Column headings & alignment</div>
          {block.headers.map((h, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input value={h} onChange={e => setHeader(i, e.target.value)} placeholder={`Heading ${i + 1}`} className={input + ' flex-1'} />
              <select value={block.align[i] || 'left'} onChange={e => setAlign(i, e.target.value as any)} className={input + ' max-w-[70px]'} title="Column alignment">
                <option value="left">L</option><option value="center">C</option><option value="right">R</option>
              </select>
              {block.headers.length > 1 && (
                <button onClick={() => removeColumn(i)} className="p-1 text-slate-500 hover:text-red-300" title="Remove column">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
        {/* Rows */}
        <div className="space-y-1.5 pt-1">
          <div className="text-[10px] text-slate-500">Rows</div>
          {block.rows.map((row, ri) => (
            <div key={ri} className="rounded-lg bg-slate-50 border border-slate-200 p-1.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] text-slate-500">Row {ri + 1}</span>
                {block.rows.length > 1 && (
                  <button onClick={() => removeRow(ri)} className="p-0.5 text-slate-500 hover:text-red-300" title="Remove row">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {row.map((cell, ci) => (
                  <input
                    key={ci}
                    value={cell}
                    onChange={e => setCell(ri, ci, e.target.value)}
                    placeholder={block.headers[ci] || `Col ${ci + 1}`}
                    className={input + ' text-[11px]'}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 text-[11px] pt-1">
          <button onClick={addColumn} className="text-sky-600 hover:underline">+ Column</button>
          <button onClick={addRow} className="text-sky-600 hover:underline">+ Row</button>
        </div>
      </div>
    )
  }

  if (block.kind === 'footer') {
    const setLine = (i: number, v: string) =>
      onChange({ lines: block.lines.map((l, j) => j === i ? v : l) } as any)
    return (
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Footer</div>
        <input value={block.companyName} onChange={e => onChange({ companyName: e.target.value } as any)} placeholder="Company name" className={input + ' text-sm font-semibold'} />
        <div className="space-y-1.5">
          {block.lines.map((l, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input value={l} onChange={e => setLine(i, e.target.value)} placeholder={`Footer line ${i + 1}`} className={input + ' flex-1'} />
              {block.lines.length > 1 && (
                <button onClick={() => onChange({ lines: block.lines.filter((_, j) => j !== i) } as any)} className="p-1 text-slate-500 hover:text-red-300" title="Remove line">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <button onClick={() => onChange({ lines: [...block.lines, ''] } as any)} className="text-sky-600 hover:underline">+ Line</button>
          <label className="flex items-center gap-1.5 text-slate-600 ml-auto">
            Strip colour
            <input type="color" value={block.bgColor} onChange={e => onChange({ bgColor: e.target.value } as any)} className="h-6 w-9 rounded border border-slate-200 bg-transparent cursor-pointer" />
          </label>
        </div>
      </div>
    )
  }

  if (block.kind === 'spacer') {
    // 2026-05-15: vertical breathing room between blocks. Height is in mm
    // so the PDF coordinate space stays predictable across A4 pages.
    const presets: Array<{ label: string; mm: number }> = [
      { label: 'XS', mm: 4 },
      { label: 'S', mm: 8 },
      { label: 'M', mm: 16 },
      { label: 'L', mm: 28 },
      { label: 'XL', mm: 40 },
    ]
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Spacer</div>
          <span className="text-[10px] text-slate-500 font-mono">{block.heightMm}mm</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {presets.map(p => (
            <button
              key={p.label}
              onClick={() => onChange({ heightMm: p.mm } as any)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium uppercase tracking-wider transition-colors ${
                block.heightMm === p.mm
                  ? 'bg-sky-600/20 text-navy border border-sky-600/30'
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
              title={`${p.mm}mm gap`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={1}
            max={80}
            step={1}
            value={block.heightMm}
            onChange={e => onChange({ heightMm: Number(e.target.value) || 8 } as any)}
            className="flex-1 accent-sky-600"
          />
          <input
            type="number"
            min={1}
            max={80}
            value={block.heightMm}
            onChange={e => onChange({ heightMm: Math.max(1, Math.min(80, Number(e.target.value) || 8)) } as any)}
            className={input + ' max-w-[80px] text-center'}
          />
        </div>
        <div
          className="rounded bg-slate-50 border border-dashed border-slate-200"
          style={{ height: Math.max(4, Math.min(120, block.heightMm * 3)) + 'px' }}
          aria-hidden
        />
      </div>
    )
  }

  if (block.kind === 'kv-list') {
    return (
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Field List</div>
        <div className="space-y-1.5">
          {block.rows.map((row, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input value={row.label} onChange={e => onChange({ rows: block.rows.map((r, j) => j === i ? { ...r, label: e.target.value } : r) } as any)} placeholder="Label" className={input} />
              <input value={row.value} onChange={e => onChange({ rows: block.rows.map((r, j) => j === i ? { ...r, value: e.target.value } : r) } as any)} placeholder="Value" className={input} />
            </div>
          ))}
        </div>
        <div className="flex gap-2 text-[11px]">
          <button onClick={() => onChange({ rows: [...block.rows, { label: '', value: '' }] } as any)} className="text-sky-600 hover:underline">+ Add field</button>
          {block.rows.length > 1 && <button onClick={() => onChange({ rows: block.rows.slice(0, -1) } as any)} className="text-slate-600 hover:text-navy">Remove last</button>}
        </div>
      </div>
    )
  }

  if (block.kind === 'bullet-list') {
    return (
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Bullet List</div>
        <div className="space-y-1.5">
          {block.items.map((item, i) => (
            <input key={i} value={item} onChange={e => onChange({ items: block.items.map((v, j) => j === i ? e.target.value : v) } as any)} placeholder={`Item ${i + 1}`} className={input} />
          ))}
        </div>
        <div className="flex gap-2 text-[11px]">
          <button onClick={() => onChange({ items: [...block.items, ''] } as any)} className="text-sky-600 hover:underline">+ Add item</button>
          {block.items.length > 1 && <button onClick={() => onChange({ items: block.items.slice(0, -1) } as any)} className="text-slate-600 hover:text-navy">Remove last</button>}
        </div>
      </div>
    )
  }

  if (block.kind === 'image') {
    // Resolve the image's natural aspect ratio (height / width) so the PDF
    // and DOCX renderers don't squash wide logos. Falls back to 0.6 only if
    // probing fails. Synchronous-feeling: we await the Image.onload before
    // committing dataUrl + aspectRatio to state.
    const loadFile = (file: File) => {
      const reader = new FileReader()
      reader.onload = () => {
        const url = String(reader.result || '')
        const probe = new window.Image()
        probe.onload = () => {
          const w = probe.naturalWidth || 1
          const h = probe.naturalHeight || 1
          onChange({ dataUrl: url, aspectRatio: h / w } as any)
        }
        probe.onerror = () => onChange({ dataUrl: url, aspectRatio: 0.6 } as any)
        probe.src = url
      }
      reader.readAsDataURL(file)
    }
    return (
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Image</div>
        {!block.dataUrl ? (
          <label className="flex flex-col items-center justify-center gap-1 py-6 border border-dashed border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
            <ImageIcon className="w-5 h-5 text-slate-500" />
            <div className="text-[11px] text-slate-600">Click to pick an image (PNG/JPG)</div>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) loadFile(f)
            }} />
          </label>
        ) : (
          <>
            <img src={block.dataUrl} alt="" className="max-h-40 rounded-lg border border-slate-200" />
            <div className="flex gap-2 text-[11px]">
              <label className="bg-slate-50 border border-slate-200 rounded-md px-2 py-1 text-slate-700 cursor-pointer hover:text-navy">
                Replace
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) loadFile(f)
                }} />
              </label>
              <button onClick={() => onChange({ dataUrl: '' } as any)} className="text-slate-600 hover:text-navy">Clear</button>
              <select value={block.align} onChange={e => onChange({ align: e.target.value as any } as any)} className={input + ' max-w-[120px]'}>
                <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
              </select>
              <input type="number" min={120} max={600} value={block.width} onChange={e => onChange({ width: Math.max(120, Math.min(600, Number(e.target.value) || 280)) } as any)} className={input + ' max-w-[120px]'} placeholder="Width px" />
            </div>
          </>
        )}
      </div>
    )
  }

  if (block.kind === 'signature') {
    return (
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Signatures</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {block.labels.map((label, i) => (
            <input key={i} value={label} onChange={e => onChange({ labels: block.labels.map((v, j) => j === i ? e.target.value : v) } as any)} placeholder={`Signatory ${i + 1}`} className={input} />
          ))}
        </div>
      </div>
    )
  }

  if (block.kind === 'date') {
    return (
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Date</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            value={block.label}
            onChange={e => onChange({ label: e.target.value } as any)}
            placeholder="Label (optional)"
            className={input}
          />
          <input
            type="date"
            value={block.iso}
            onChange={e => onChange({ iso: e.target.value } as any)}
            className={input}
          />
        </div>
        <div className="flex gap-2 text-[11px]">
          <select value={block.format} onChange={e => onChange({ format: e.target.value as any } as any)} className={input + ' max-w-[160px]'}>
            <option value="long">18 May 2026</option>
            <option value="short">18/05/2026</option>
            <option value="iso">2026-05-18</option>
          </select>
          <select value={block.align} onChange={e => onChange({ align: e.target.value as any } as any)} className={input + ' max-w-[120px]'}>
            <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
          </select>
          <div className="text-[10px] text-slate-500 self-center">Preview: <span className="text-slate-700">{formatDate(block.iso, block.format) || '—'}</span></div>
        </div>
      </div>
    )
  }

  if (block.kind === 'email') {
    return (
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Email Address</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input value={block.label} onChange={e => onChange({ label: e.target.value } as any)} placeholder="Label (optional)" className={input} />
          <input type="email" value={block.address} onChange={e => onChange({ address: e.target.value } as any)} placeholder="name@example.com" className={input} />
        </div>
        <select value={block.align} onChange={e => onChange({ align: e.target.value as any } as any)} className={input + ' max-w-[120px] text-[11px]'}>
          <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
        </select>
      </div>
    )
  }

  if (block.kind === 'phone') {
    return (
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Phone</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input value={block.label} onChange={e => onChange({ label: e.target.value } as any)} placeholder="Label (optional)" className={input} />
          <input type="tel" value={block.number} onChange={e => onChange({ number: e.target.value } as any)} placeholder="+91 7200 255 252" className={input} />
        </div>
        <select value={block.align} onChange={e => onChange({ align: e.target.value as any } as any)} className={input + ' max-w-[120px] text-[11px]'}>
          <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
        </select>
      </div>
    )
  }

  if (block.kind === 'link') {
    return (
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Link</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input value={block.display} onChange={e => onChange({ display: e.target.value } as any)} placeholder="Display text" className={input} />
          <input type="url" value={block.url} onChange={e => onChange({ url: e.target.value } as any)} placeholder="https://…" className={input} />
        </div>
        <select value={block.align} onChange={e => onChange({ align: e.target.value as any } as any)} className={input + ' max-w-[120px] text-[11px]'}>
          <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
        </select>
      </div>
    )
  }

  if (block.kind === 'divider') {
    return (
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Divider</div>
        <div className="flex items-center gap-2 text-[11px]">
          <label className="text-slate-500">Thickness</label>
          <input
            type="number" min={1} max={6} value={block.thickness}
            onChange={e => onChange({ thickness: Math.max(1, Math.min(6, Number(e.target.value) || 1)) } as any)}
            className={input + ' max-w-[80px]'}
          />
          <label className="text-slate-500 ml-2">Color</label>
          <input
            type="color" value={block.color}
            onChange={e => onChange({ color: e.target.value } as any)}
            className="w-9 h-7 rounded cursor-pointer bg-transparent border border-slate-200"
          />
          <div className="flex-1 ml-2">
            <hr style={{ borderColor: block.color, borderTopWidth: block.thickness, opacity: 0.9 }} />
          </div>
        </div>
      </div>
    )
  }

  if (block.kind === 'page-break') {
    return (
      <div className="flex items-center gap-2 text-[11px] text-slate-600">
        <FileX2 className="w-3.5 h-3.5" />
        Page Break — next block starts on a new PDF page.
      </div>
    )
  }

  if (block.kind === 'chart') {
    const updateRow = (i: number, patch: Partial<{ label: string; value: number }>) =>
      onChange({ rows: block.rows.map((r, j) => j === i ? { ...r, ...patch } : r) } as any)
    const addRow = () => onChange({ rows: [...block.rows, { label: 'Item', value: 10 }] } as any)
    const removeRow = (i: number) => onChange({ rows: block.rows.filter((_, j) => j !== i) } as any)
    return (
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">Chart</div>
        <input value={block.title} onChange={e => onChange({ title: e.target.value } as any)} placeholder="Chart title" className={input} />
        <div className="flex gap-2 text-[11px]">
          <select value={block.variant} onChange={e => onChange({ variant: e.target.value as any } as any)} className={input + ' max-w-[140px]'}>
            <option value="bar">Horizontal bar</option>
            <option value="column">Vertical column</option>
            <option value="doughnut">Doughnut</option>
          </select>
          <select value={block.align} onChange={e => onChange({ align: e.target.value as any } as any)} className={input + ' max-w-[120px]'}>
            <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
          </select>
          <input
            type="number" min={200} max={720} value={block.width}
            onChange={e => onChange({ width: Math.max(200, Math.min(720, Number(e.target.value) || 420)) } as any)}
            className={input + ' max-w-[100px]'} placeholder="Width px"
          />
          <input
            type="color" value={block.color}
            onChange={e => onChange({ color: e.target.value } as any)}
            className="w-9 h-7 rounded cursor-pointer bg-transparent border border-slate-200"
            title="Bar color"
          />
        </div>
        <div className="space-y-1.5">
          <div className="text-[10px] text-slate-500">Data</div>
          {block.rows.map((r, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input value={r.label} onChange={e => updateRow(i, { label: e.target.value })} placeholder="Label" className={input + ' flex-1'} />
              <input
                type="number" value={Number.isFinite(r.value) ? r.value : 0}
                onChange={e => updateRow(i, { value: Number(e.target.value) || 0 })}
                placeholder="Value" className={input + ' max-w-[100px]'}
              />
              {block.rows.length > 1 && (
                <button onClick={() => removeRow(i)} className="p-1 text-slate-500 hover:text-red-300" title="Remove">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
          <button onClick={addRow} className="inline-flex items-center gap-1.5 text-[10px] text-sky-600 hover:underline">
            <Plus className="w-3 h-3" /> Add data point
          </button>
        </div>
      </div>
    )
  }

  return null
}
