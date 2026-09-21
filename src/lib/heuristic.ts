import type { Prize } from "./types";

const STOP = new Set([
  "a", "an", "and", "the", "to", "for", "of", "on", "in", "it", "i", "me", "my", "we",
  "with", "want", "something", "one", "that", "this", "can", "both", "kind", "the",
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9£$+]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP.has(word));
}

function has(query: string, ...needles: string[]): boolean {
  return needles.some((needle) => query.includes(needle));
}

export function scorePrize(item: Prize, query: string): number {
  const q = query.toLowerCase().trim();
  if (q.length < 3) return 0;
  let score = 0.12;
  const hay = `${item.name} ${item.meta} ${item.facts}`.toLowerCase();
  for (const word of tokens(q)) {
    if (hay.includes(word)) score += 0.08;
  }
  if (has(q, "quiet", "talk", "conversation", "date")) score += hay.includes("quiet") || hay.includes("talk") ? 0.28 : -0.12;
  if (has(q, "cheap", "under", "budget", "end of the month")) score += hay.includes("£") && (hay.includes("£ ·") || hay.includes("price: £ ") || hay.includes("£.")) ? 0.12 : 0;
  if (has(q, "cheap", "under £", "under $")) score += /£$|£ ·|price: low|£ \(/.test(hay) || hay.includes("cheap") ? 0.25 : -0.08;
  if (has(q, "vegetarian", "vegan", "plant")) score += hay.includes("vegetarian") || hay.includes("vegan") || hay.includes("plant") ? 0.35 : -0.2;
  if (has(q, "spicy")) score += hay.includes("spicy") || hay.includes("chilli") || hay.includes("hot") ? 0.35 : -0.15;
  if (has(q, "late", "after the pub", "midnight")) score += hay.includes("late") || hay.includes("open late") || hay.includes("midnight") ? 0.3 : -0.1;
  if (has(q, "queue", "no wait", "walk-in")) score += hay.includes("queue") ? (has(q, "without a queue", "no queue") ? -0.25 : 0.1) : 0.05;
  if (has(q, "without a queue", "no queue")) score += hay.includes("queue") ? -0.3 : 0.2;
  if (has(q, "garden")) score += hay.includes("garden") ? 0.4 : -0.15;
  if (has(q, "fire", "no music")) score += hay.includes("fire") || hay.includes("no music") ? 0.3 : -0.1;
  if (has(q, "cask", "ale")) score += hay.includes("ale") || hay.includes("cask") ? 0.35 : -0.1;
  if (has(q, "free")) score += hay.includes("free") ? 0.4 : -0.15;
  if (has(q, "indoors", "raining")) score += hay.includes("indoors") || hay.includes("indoor") ? 0.28 : -0.08;
  if (has(q, "kids", "child", "four year")) score += hay.includes("kid") || hay.includes("family") || hay.includes("child") ? 0.32 : -0.15;
  if (has(q, "short", "few episode", "under two hours", "twenty minutes", "30 min", "under 30")) {
    score += hay.includes("min") || hay.includes("eps") && /\b([1-9]|1[0-6])\b/.test(hay) ? 0.2 : 0.05;
  }
  if (has(q, "finished", "ended")) score += hay.includes("finished") || hay.includes("ended") ? 0.28 : -0.15;
  if (has(q, "background", "no plot")) score += hay.includes("background") || hay.includes("comfort") ? 0.3 : -0.12;
  if (has(q, "parents", "mum", "mom")) score += hay.includes("family") || hay.includes("parents") || hay.includes("wholesome") ? 0.28 : -0.1;
  if (has(q, "scary", "gripped", "tense")) score += hay.includes("thriller") || hay.includes("tense") || hay.includes("horror") ? 0.28 : -0.1;
  if (has(q, "funny", "comedy")) score += hay.includes("comedy") || hay.includes("funny") ? 0.28 : -0.1;
  if (has(q, "nothing heavy", "not upset", "comfort", "light")) score += hay.includes("comfort") || hay.includes("gentle") || hay.includes("light") ? 0.28 : hay.includes("violent") ? -0.25 : 0;
  return Math.round(Math.min(0.97, Math.max(0.02, score)) * 100) / 100;
}

export function scoreCatalog(items: Prize[], query: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) map.set(item.id, scorePrize(item, query));
  return map;
}
