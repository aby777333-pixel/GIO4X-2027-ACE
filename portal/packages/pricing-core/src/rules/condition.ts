export type Facts = Record<string, number | string | boolean | undefined>;

function cmp(a: unknown, op: string, b: unknown): boolean {
  switch (op) {
    case ">": return (a as number) > (b as number);
    case ">=": return (a as number) >= (b as number);
    case "<": return (a as number) < (b as number);
    case "<=": return (a as number) <= (b as number);
    case "==": return a === b;
    case "!=": return a !== b;
    case "in": return Array.isArray(b) && (b as unknown[]).includes(a);
    default: return false;
  }
}

// Recursive AND/OR condition tree, shared by dynamic spread + smart rules.
export function evalCondition(node: unknown, facts: Facts): boolean {
  if (node == null || typeof node !== "object") return false;
  const n = node as Record<string, unknown>;
  if (Array.isArray(n.all)) return (n.all as unknown[]).every((x) => evalCondition(x, facts));
  if (Array.isArray(n.any)) return (n.any as unknown[]).some((x) => evalCondition(x, facts));
  const field = n.field as string | undefined;
  if (!field) return false;
  const fact = facts[field];
  if (fact === undefined) return false;
  return cmp(fact, n.op as string, n.value);
}
