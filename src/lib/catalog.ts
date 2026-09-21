import { CORPORA, prizesFor } from "@/data/corpora";
import { liveNearby } from "@/lib/live/nearby";
import { liveMovies, liveSeries } from "@/lib/live/screen";
import type { CatalogResult, CityId, CorpusId, Prize } from "@/lib/types";

const cache = new Map<string, { at: number; value: CatalogResult }>();
const TTL = 10 * 60 * 1000;

export async function getCatalog(opts: {
  corpus: CorpusId;
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
  signal?: AbortSignal;
}): Promise<CatalogResult> {
  const key = `${opts.corpus}:${opts.city ?? ""}:${opts.lat?.toFixed(3) ?? ""}:${opts.lng?.toFixed(3) ?? ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  const corpus = CORPORA[opts.corpus];
  let value: CatalogResult;

  if (corpus.live === "screen") {
    const live = opts.corpus === "movies" ? await liveMovies(opts.signal) : await liveSeries(opts.signal);
    value = live;
  } else if (corpus.live === "nearby") {
    if (opts.lat != null && opts.lng != null && Number.isFinite(opts.lat) && Number.isFinite(opts.lng)) {
      const kind = opts.corpus === "pubs" ? "pubs" : "eats";
      value = await liveNearby(kind, opts.lat, opts.lng, opts.signal);
    } else {
      const items = prizesFor(corpus, (opts.city as CityId) || null);
      value = { items, source: opts.city ? `snapshot · ${opts.city}` : "pick a place" };
    }
  } else {
    value = { items: corpus.items as Prize[], source: "curated snapshot" };
  }

  cache.set(key, { at: Date.now(), value });
  return value;
}
