import type { Prize } from "@/lib/types";

const UA = "THE-CLAW/1.0 (ASV Labs; https://github.com/ASV-Labs/the-claw)";

async function getJson(url: string, signal?: AbortSignal, headers?: HeadersInit) {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": UA, ...headers },
    signal,
  });
  if (!response.ok) throw new Error(`${url} ${response.status}`);
  return response.json();
}

function tmdbEnabled() {
  return Boolean(process.env.TMDB_API_KEY?.trim() || process.env.TMDB_READ_TOKEN?.trim());
}

function tmdbHeaders(): HeadersInit {
  const token = process.env.TMDB_READ_TOKEN?.trim();
  if (token) return { accept: "application/json", authorization: `Bearer ${token}` };
  return { accept: "application/json" };
}

function tmdbUrl(path: string, extra = "") {
  const key = process.env.TMDB_API_KEY?.trim();
  const token = process.env.TMDB_READ_TOKEN?.trim();
  const query = token ? extra.replace(/^&/, "") : `api_key=${key ?? ""}${extra}`;
  const joiner = path.includes("?") ? "&" : "?";
  return `https://api.themoviedb.org/3${path}${query ? joiner + query : ""}`;
}

export async function liveMovies(signal?: AbortSignal): Promise<{ items: Prize[]; source: string }> {
  if (tmdbEnabled()) {
    try {
      const headers = tmdbHeaders();
      const now = await getJson(tmdbUrl("/movie/now_playing", "&region=US&language=en-US"), signal, headers);
      const upcoming = await getJson(tmdbUrl("/movie/upcoming", "&region=US&language=en-US"), signal, headers);
      const trending = await getJson(tmdbUrl("/trending/movie/week", "&language=en-US"), signal, headers);
      const rows = [...(now.results ?? []), ...(upcoming.results ?? []), ...(trending.results ?? [])];
      const items = dedupe(rows.map(movieFromTmdb).filter(Boolean) as Prize[]).slice(0, 48);
      if (items.length) return { items, source: "TMDB now playing / upcoming" };
    } catch (error) {
      console.warn("[the-claw] TMDB movies failed", error);
    }
  }
  const rss = await getJson("https://itunes.apple.com/us/rss/topmovies/limit=50/json", signal);
  const entries = rss?.feed?.entry ?? [];
  const items = dedupe(entries.map(movieFromItunes).filter(Boolean) as Prize[]).slice(0, 48);
  return { items, source: "iTunes top movies (US)" };
}

export async function liveSeries(signal?: AbortSignal): Promise<{ items: Prize[]; source: string }> {
  if (tmdbEnabled()) {
    try {
      const headers = tmdbHeaders();
      const airing = await getJson(tmdbUrl("/tv/on_the_air", "&language=en-US"), signal, headers);
      const trending = await getJson(tmdbUrl("/trending/tv/week", "&language=en-US"), signal, headers);
      const rows = [...(airing.results ?? []), ...(trending.results ?? [])];
      const items = dedupe(rows.map(showFromTmdb).filter(Boolean) as Prize[]).slice(0, 48);
      if (items.length) return { items, source: "TMDB on the air / trending" };
    } catch (error) {
      console.warn("[the-claw] TMDB series failed", error);
    }
  }
  const [itunes, pageA, pageB] = await Promise.all([
    getJson("https://itunes.apple.com/us/rss/toptvseasons/limit=40/json", signal).catch(() => null),
    getJson("https://api.tvmaze.com/shows?page=280", signal).catch(() => []),
    getJson("https://api.tvmaze.com/shows?page=290", signal).catch(() => []),
  ]);
  const fromItunes = ((itunes?.feed?.entry ?? []) as ItunesEntry[])
    .map(showFromItunes)
    .filter(Boolean) as Prize[];
  const fromPages = ([...(pageA as TvMazeShow[]), ...(pageB as TvMazeShow[])] as TvMazeShow[])
    .filter((show) => {
      if (!show?.image) return false;
      if (show.language && show.language !== "English") return false;
      if (!["Scripted", "Animation"].includes(show.type || "")) return false;
      const year = Number((show.premiered || "").slice(0, 4));
      if (year && year < 2023) return false;
      return true;
    })
    .map(showFromTvMaze)
    .filter(Boolean) as Prize[];
  const items = dedupe([...fromItunes, ...fromPages]).slice(0, 48);
  return { items, source: "iTunes top TV + TVMaze recent (IMDb ids when present)" };
}

function movieFromTmdb(row: TmdbMovie): Prize | null {
  if (!row?.id || !row.title) return null;
  const year = (row.release_date || "").slice(0, 4);
  const poster = row.poster_path ? `https://image.tmdb.org/t/p/w342${row.poster_path}` : undefined;
  return {
    id: `tmdb-m-${row.id}`,
    name: row.title,
    glyph: "🎬",
    group: "screen",
    meta: [year, row.vote_average ? `${row.vote_average.toFixed(1)} TMDB` : ""].filter(Boolean).join(" · "),
    image: poster,
    href: row.imdb_id ? `https://www.imdb.com/title/${row.imdb_id}/` : `https://www.themoviedb.org/movie/${row.id}`,
    facts: [
      `${row.title} (${year || "recent"}).`,
      row.overview || "No synopsis.",
      `TMDB score ${row.vote_average ?? "n/a"}. Now playing or upcoming in the US catalog.`,
      row.adult ? "Adult." : "General listing.",
    ].join(" "),
  };
}

function showFromTmdb(row: TmdbShow): Prize | null {
  if (!row?.id || !row.name) return null;
  const year = (row.first_air_date || "").slice(0, 4);
  const poster = row.poster_path ? `https://image.tmdb.org/t/p/w342${row.poster_path}` : undefined;
  return {
    id: `tmdb-tv-${row.id}`,
    name: row.name,
    glyph: "📺",
    group: "screen",
    meta: [year, row.vote_average ? `${row.vote_average.toFixed(1)} TMDB` : ""].filter(Boolean).join(" · "),
    image: poster,
    href: `https://www.themoviedb.org/tv/${row.id}`,
    facts: [
      `${row.name} (${year || "recent"}).`,
      row.overview || "No synopsis.",
      `Currently airing or trending this week. TMDB score ${row.vote_average ?? "n/a"}.`,
    ].join(" "),
  };
}

function movieFromItunes(entry: ItunesEntry): Prize | null {
  const name = entry?.["im:name"]?.label;
  if (!name) return null;
  const year = (entry["im:releaseDate"]?.label || "").slice(0, 4);
  const image = entry["im:image"]?.at(-1)?.label?.replace(/\d+x\d+bb/, "300x300bb");
  const href = entry.link?.attributes?.href || entry.id?.label;
  const summary = entry.summary?.label || "";
  const category = entry.category?.attributes?.label || "Film";
  return {
    id: `itunes-${slug(name)}-${year}`,
    name,
    glyph: "🎬",
    group: "screen",
    meta: [year, category].filter(Boolean).join(" · "),
    image,
    href,
    facts: [
      `${name} (${year || "recent"}). ${category}.`,
      summary.slice(0, 400),
      "Listed in the current US iTunes top movies feed.",
    ].join(" "),
  };
}

function showFromItunes(entry: ItunesEntry): Prize | null {
  const raw = entry?.["im:name"]?.label;
  if (!raw) return null;
  const name = raw.replace(/,?\s*(The )?Complete Series.*$/i, "").replace(/,?\s*Season \d+.*$/i, "").trim() || raw;
  const year = (entry["im:releaseDate"]?.label || "").slice(0, 4);
  const image = entry["im:image"]?.at(-1)?.label?.replace(/\d+x\d+bb/, "300x300bb");
  const href = entry.link?.attributes?.href || entry.id?.label;
  const summary = entry.summary?.label || "";
  return {
    id: `itunes-tv-${slug(name)}-${year}`,
    name,
    glyph: "📺",
    group: "screen",
    meta: [year, "iTunes"].filter(Boolean).join(" · "),
    image,
    href,
    facts: [
      `${name} (${year || "recent"}). Television.`,
      summary.slice(0, 400),
      "Listed in the current US iTunes top TV seasons feed.",
    ].join(" "),
  };
}

type TvMazeShow = {
  id: number;
  name: string;
  type?: string;
  language?: string;
  genres?: string[];
  summary?: string;
  rating?: { average?: number | null };
  image?: { medium?: string; original?: string } | null;
  externals?: { imdb?: string | null };
  network?: { name?: string } | null;
  webChannel?: { name?: string } | null;
  status?: string;
  premiered?: string;
};

function showFromTvMaze(show: TvMazeShow): Prize | null {
  if (!show?.id || !show.name) return null;
  const imdb = show.externals?.imdb;
  const year = (show.premiered || "").slice(0, 4);
  const where = show.webChannel?.name || show.network?.name || "streaming";
  const summary = (show.summary || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return {
    id: `tvmaze-${show.id}`,
    name: show.name,
    glyph: "📺",
    group: "screen",
    meta: [where, year, show.genres?.[0]].filter(Boolean).join(" · "),
    image: show.image?.medium || show.image?.original,
    href: imdb ? `https://www.imdb.com/title/${imdb}/` : `https://www.tvmaze.com/shows/${show.id}`,
    facts: [
      `${show.name} (${year || "current"}). ${show.type || "Series"} on ${where}.`,
      show.genres?.length ? `Genres: ${show.genres.join(", ")}.` : "",
      summary.slice(0, 400),
      show.rating?.average ? `TVMaze rating ${show.rating.average}.` : "",
      imdb ? `IMDb ${imdb}.` : "",
      `Status: ${show.status || "unknown"}. On tonight's or this week's US/web schedule.`,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48);
}

function dedupe(items: Prize[]) {
  const seen = new Set<string>();
  const out: Prize[] = [];
  for (const item of items) {
    const key = item.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

type TmdbMovie = {
  id: number;
  title: string;
  overview?: string;
  release_date?: string;
  poster_path?: string | null;
  vote_average?: number;
  adult?: boolean;
  imdb_id?: string;
};

type TmdbShow = {
  id: number;
  name: string;
  overview?: string;
  first_air_date?: string;
  poster_path?: string | null;
  vote_average?: number;
};

type ItunesEntry = {
  "im:name"?: { label: string };
  "im:image"?: { label: string }[];
  "im:releaseDate"?: { label: string };
  summary?: { label: string };
  category?: { attributes?: { label?: string } };
  link?: { attributes?: { href?: string } };
  id?: { label?: string };
};
