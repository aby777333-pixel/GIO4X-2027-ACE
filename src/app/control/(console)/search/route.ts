/**
 * POST /control/search   { "q": "…" }   →  JSON
 *
 * What the console's command palette (Ctrl K) asks while somebody types: the
 * few records that match, across the kinds the caller may read. Each kind is
 * asked for only if the caller holds its capability, and is read AS THE
 * SIGNED-IN MEMBER OF STAFF, so row-level security decides what comes back
 * exactly as it does on that kind's own screen.
 *
 *   enquiries   by reference or e-mail address          leads.read
 *   tickets     by reference, subject or e-mail address tickets.read
 *   customers   through people_list() (name or address) customers.read
 *   blog posts  by title or slug                        blog.read
 *   FAQ entries by question                             content.read
 *
 * A POST although it changes nothing: what is typed may be an e-mail address,
 * and a query string would put it in the address of a request (and so in
 * server logs). In a body it is not. Being a POST it carries the same-origin
 * rule as the console's other POST routes. The answer links by id or key,
 * never by address, and is never cached.
 *
 * The text is reduced with cleanSearch (letters, digits and @ . _ + - only)
 * before it comes near a filter, so it cannot alter one.
 */
import { fail, isJsonRequest, isSameOrigin, json, readBodyCapped } from "@/lib/server/http";
import { can, getAccess } from "@/lib/server/staff";
import { cleanSearch } from "@/lib/server/validate";
import type { PaletteRecord, PaletteSearch } from "@/components/control/CommandPalette";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "private, no-store" };

/** At most this many of each kind: the palette is for jumping, the lists are for browsing. */
const PER_KIND = 5;
/** Fewer characters than this match nearly everything. */
const MIN_CHARS = 2;
/** A search is a few words; each must appear in a title, a subject or a question. */
const MAX_WORDS = 5;
/** `{"q":"…"}` with 200 characters of any script fits several times over. */
const MAX_BODY_BYTES = 2048;

type Kind = PaletteRecord["kind"];

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return fail(403, "Not allowed.", undefined, PRIVATE);

  const access = await getAccess();
  if (access.state === "unconfigured" || access.state === "unavailable") return fail(503, "Search is not available just now.", undefined, PRIVATE);
  if (access.state === "anonymous") return fail(401, "Sign in to continue.", undefined, PRIVATE);
  if (access.state !== "staff") return fail(403, "This account has no access to the console.", undefined, PRIVATE);

  if (!isJsonRequest(request)) return fail(415, "Send the search as JSON.", undefined, PRIVATE);
  const body = await readBodyCapped(request, MAX_BODY_BYTES);
  if (!body.ok) return fail(413, "That search is too long.", undefined, PRIVATE);
  let raw: unknown;
  try {
    raw = (JSON.parse(body.text) as { q?: unknown } | null)?.q;
  } catch {
    return fail(400, "That request was not valid.", undefined, PRIVATE);
  }
  if (typeof raw !== "string") return fail(400, "That request was not valid.", undefined, PRIVATE);

  // Each word reduced on its own, and the whole with the spaces gone: a reference or an address has no
  // spaces in it, a title or a subject is matched word by word.
  const words = raw.slice(0, 200).split(/\s+/).map(cleanSearch).filter(Boolean).slice(0, MAX_WORDS);
  const whole = cleanSearch(words.join(""));
  const empty: PaletteSearch = { ok: true, records: [], failed: [] };
  if (whole.length < MIN_CHARS) return json(empty, 200, PRIVATE);

  const { supabase } = access;
  // every value below contains only [A-Za-z0-9@._+-]; the quotes keep dots inside the value
  const like = (column: string, value: string) => `${column}.ilike."%${value}%"`;
  const allWords = (column: string) => (words.length === 1 ? like(column, words[0] ?? whole) : `and(${words.map((w) => like(column, w)).join(",")})`);

  const records: PaletteRecord[] = [];
  const failed: Kind[] = [];

  const leads = async () => {
    const { data, error } = await supabase
      .from("leads")
      .select("id, reference, name, topic")
      .or(`${like("reference", whole)},${like("email", whole)}`)
      .order("created_at", { ascending: false })
      .limit(PER_KIND);
    if (error) return void failed.push("lead");
    for (const row of data ?? []) records.push({ kind: "lead", href: `/control/leads/${row.id}`, title: row.reference, note: `${row.name} · ${row.topic}` });
  };

  const tickets = async () => {
    const { data, error } = await supabase
      .from("tickets")
      .select("id, reference, subject")
      .or(`${like("reference", whole)},${like("email", whole)},${allWords("subject")}`)
      .order("created_at", { ascending: false })
      .limit(PER_KIND);
    if (error) return void failed.push("ticket");
    for (const row of data ?? []) records.push({ kind: "ticket", href: `/control/tickets/${row.id}`, title: row.reference, note: row.subject });
  };

  const customers = async () => {
    // people_list() checks customers.read itself and uses the text as a plain substring of a name or an
    // address. A name typed in full has a space in it, which the reduction removes: its first word is used.
    const { data, error } = await supabase.rpc("people_list", { p_search: words.length === 1 ? whole : (words[0] ?? whole), p_limit: PER_KIND, p_offset: 0 });
    if (error) return void failed.push("customer");
    // linked by the person's key (a hash), never by the address
    for (const row of data ?? []) records.push({ kind: "customer", href: `/control/customers/${row.key}`, title: row.name ?? row.email, note: row.name ? row.email : "" });
  };

  const posts = async () => {
    let query = supabase.from("blog_posts").select("id, title, slug");
    for (const word of words) query = query.or(`${like("title", word)},${like("slug", word)}`);
    const { data, error } = await query.order("updated_at", { ascending: false }).limit(PER_KIND);
    if (error) return void failed.push("post");
    for (const row of data ?? []) records.push({ kind: "post", href: `/control/blog/${row.id}`, title: row.title, note: row.slug });
  };

  const faq = async () => {
    // only the questions changed or added in the console are rows; the rest of the FAQ lives in the code
    let query = supabase.from("faq_entries").select("id, question");
    for (const word of words) query = query.ilike("question", `%${word}%`);
    const { data, error } = await query.order("updated_at", { ascending: false }).limit(PER_KIND);
    if (error) return void failed.push("faq");
    for (const row of data ?? []) records.push({ kind: "faq", href: `/control/content/faq/${row.id}`, title: row.question, note: "" });
  };

  const jobs: [Kind, boolean, () => Promise<void>][] = [
    ["lead", can(access, "leads.read"), leads],
    ["ticket", can(access, "tickets.read"), tickets],
    ["customer", can(access, "customers.read"), customers],
    ["post", can(access, "blog.read"), posts],
    ["faq", can(access, "content.read"), faq],
  ];
  await Promise.all(
    jobs
      .filter(([, allowed]) => allowed)
      .map(([kind, , run]) =>
        // a kind that cannot be read is named in `failed`; the others are still answered
        run().catch(() => {
          failed.push(kind);
        }),
      ),
  );

  // the kinds in one fixed order, whichever answered first
  const order: Kind[] = ["lead", "ticket", "customer", "post", "faq"];
  records.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));

  const answer: PaletteSearch = { ok: true, records, failed: order.filter((k) => failed.includes(k)) };
  return json(answer, 200, PRIVATE);
}
