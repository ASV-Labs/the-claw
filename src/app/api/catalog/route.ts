import { CORPORA } from "@/data/corpora";
import { getCatalog } from "@/lib/catalog";
import type { CorpusId } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const corpusId = url.searchParams.get("corpus") as CorpusId | null;
  const city = url.searchParams.get("city");
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  if (!corpusId || !CORPORA[corpusId]) {
    return Response.json({ error: "Unknown pit." }, { status: 400 });
  }
  try {
    const result = await getCatalog({
      corpus: corpusId,
      city,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      signal: request.signal,
    });
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Catalog failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}
