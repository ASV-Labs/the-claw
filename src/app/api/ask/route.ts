import { CORPORA } from "@/data/corpora";
import { askJev } from "@/lib/jev";
import type { CorpusId } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { query?: unknown; corpus?: unknown; group?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send JSON." }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  const corpusId = typeof body.corpus === "string" ? body.corpus : "";
  const group = typeof body.group === "string" ? body.group : null;

  if (query.length < 3 || query.length > 160) {
    return Response.json({ error: "Ask in a short sentence." }, { status: 400 });
  }
  const corpus = CORPORA[corpusId as CorpusId];
  if (!corpus) {
    return Response.json({ error: "Unknown pit." }, { status: 400 });
  }
  if (corpus.needsPlace && !group) {
    return Response.json({ error: "This pit needs a city." }, { status: 400 });
  }

  const items = corpus.needsPlace ? corpus.items.filter((item) => item.group === group) : corpus.items;
  try {
    const result = await askJev(items, query, request.signal);
    return Response.json(result);
  } catch (error) {
    if ((error as { name?: string }).name === "AbortError") {
      return new Response(null, { status: 499 });
    }
    const message = error instanceof Error ? error.message : "The claw missed.";
    return Response.json({ error: message }, { status: 502 });
  }
}
