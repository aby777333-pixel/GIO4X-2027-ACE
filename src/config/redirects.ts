import data from "./redirects.json";

/**
 * REDIRECT REGISTRY (data in redirects.json so next.config.ts can read it).
 * Every URL of the previous GIO4X site (GIO4X-NEW, 39 URLs) either still
 * exists at the same path or is listed there with a single-hop permanent
 * redirect to its successor. No chains: A -> D, never A -> B -> C -> D.
 */
export const legacyRedirects: { source: string; destination: string }[] = data;
