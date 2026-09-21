import { CORPORA } from "@/data/corpora";
import { getCatalog } from "@/lib/catalog";
import { askJev } from "@/lib/jev";
import type { CorpusId } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { query?: unknown; corpus?: unknown; group?: unknown; lat?: unknown; lng?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send JSON." }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  const corpusId = typeof body.corpus === "string" ? body.corpus : "";
  const group = typeof body.group === "string" ? body.group : null;
  const lat = typeof body.lat === "number" ? body.lat : Number(body.lat);
  const lng = typeof body.lng === "number" ? body.lng : Number(body.lng);

  if (query.length < 3 || query.length > 160) {
    return Response.json({ error: "Ask in a short sentence." }, { status: 400 });
  }
  const corpus = CORPORA[corpusId as CorpusId];
  if (!corpus) {
    return Response.json({ error: "Unknown pit." }, { status: 400 });
  }

  try {
    const catalog = await getCatalog({
      corpus: corpusId as CorpusId,
      city: group,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      signal: request.signal,
    });
    if (!catalog.items.length) {
      return Response.json({ error: "This pit is empty. Share a location or pick a city." }, { status: 400 });
    }
    const result = await askJev(catalog.items, query, request.signal);
    return Response.json({ ...result, catalogSource: catalog.source, placeLabel: catalog.placeLabel });
  } catch (error) {
    if ((error as { name?: string }).name === "AbortError") {
      return new Response(null, { status: 499 });
    }
    const message = error instanceof Error ? error.message : "The claw missed.";
    return Response.json({ error: message }, { status: 502 });
  }
}
