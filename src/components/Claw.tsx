"use client";

import { CITIES, CITY_STORAGE_KEY } from "@/data/cities";
import { CORPORA, CORPUS_ORDER, prizesFor } from "@/data/corpora";
import { HeapPhysics } from "@/lib/physics";
import type { CityId, CorpusId, Prize } from "@/lib/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClawMark } from "./ClawMark";

const RADIUS = 18;
const POSTER_CELL = { width: 124, height: 186 };
const CHIP_CELL = { width: 118, height: 88 };
const SUGGEST = ["text-claw/80 hover:text-claw", "text-ivory/70 hover:text-ivory", "text-brass hover:text-claw"];
const cache = new Map<string, Map<string, number>>();

type Coords = { lat: number; lng: number };

function readCity(): CityId | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(CITY_STORAGE_KEY);
  return CITIES.some((city) => city.id === value) ? (value as CityId) : null;
}

export function Claw() {
  const [corpusId, setCorpusId] = useState<CorpusId>("eats");
  const [city, setCity] = useState<CityId | null>(null);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [placeLabel, setPlaceLabel] = useState("");
  const [catalogSource, setCatalogSource] = useState("");
  const [liveItems, setLiveItems] = useState<Prize[] | null>(null);
  const [loadingPit, setLoadingPit] = useState(false);
  const [locating, setLocating] = useState(false);
  const [phone, setPhone] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"idle" | "thinking" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [verdicts, setVerdicts] = useState<Map<string, number> | null>(null);
  const [missing, setMissing] = useState(0);
  const [source, setSource] = useState("");
  const [size, setSize] = useState({ width: 390, height: 844 });
  const [suggestTick, setSuggestTick] = useState(0);
  const [exampleTick, setExampleTick] = useState(0);
  const readyAt = useRef(0);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<HeapPhysics | null>(null);
  const nodes = useRef(new Map<string, HTMLElement>());
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const frameRef = useRef(0);

  const corpus = CORPORA[corpusId];
  const needsPlace = corpus.live === "nearby" ? !coords && !city : corpus.needsPlace && !city;
  const fallbackItems = useMemo(() => prizesFor(corpus, city), [corpus, city]);
  const items = liveItems ?? fallbackItems;
  const cell = corpus.shape === "poster" ? POSTER_CELL : CHIP_CELL;

  useEffect(() => {
    setCity(readCity());
    const media = window.matchMedia("(max-width: 700px)");
    const apply = () => setPhone(media.matches);
    apply();
    media.addEventListener("change", apply);
    const params = new URLSearchParams(window.location.search);
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      setCoords({ lat, lng });
    }
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      if (corpus.live === "nearby" && !coords && !city) {
        setLiveItems(null);
        setCatalogSource("");
        return;
      }
      setLoadingPit(true);
      try {
        const params = new URLSearchParams({ corpus: corpusId });
        if (city) params.set("city", city);
        if (coords) {
          params.set("lat", String(coords.lat));
          params.set("lng", String(coords.lng));
        }
        const response = await fetch(`/api/catalog?${params}`, { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "catalog");
        setLiveItems(payload.items ?? []);
        setCatalogSource(payload.source ?? "");
        if (payload.placeLabel) setPlaceLabel(payload.placeLabel);
      } catch (caught) {
        if ((caught as { name?: string }).name === "AbortError") return;
        setLiveItems(fallbackItems);
        setCatalogSource("snapshot");
      } finally {
        setLoadingPit(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [corpusId, city, coords, corpus.live, fallbackItems]);

  const layout = useMemo(() => {
    const width = Math.max(1, size.width);
    const height = Math.max(1, size.height);
    const unit = phone
      ? corpus.shape === "poster"
        ? { width: 108, height: 168 }
        : { width: 96, height: 86 }
      : cell;
    const perRow = Math.max(1, Math.floor(Math.min(width - 24, phone ? width - 16 : 1100) / unit.width));
    const top = phone ? Math.max(24, 0.08 * height) : Math.max(80, 0.18 * height);
    const rows = Math.max(1, Math.floor((height - (phone ? 180 : 220) - top) / unit.height));
    return { cell: unit, perRow, top, capacity: perRow * rows };
  }, [size, cell, phone, corpus.shape]);

  const risen = useMemo(() => {
    if (!verdicts) return [];
    return items
      .map((item) => ({ item, probability: verdicts.get(item.id) ?? 0 }))
      .filter((row) => row.probability >= 0.5)
      .sort((a, b) => b.probability - a.probability)
      .slice(0, layout.capacity);
  }, [items, verdicts, layout]);

  const risenIds = useMemo(() => new Set(risen.map((row) => row.item.id)), [risen]);
  const matchCount = useMemo(
    () => (verdicts ? items.filter((item) => (verdicts.get(item.id) ?? 0) >= 0.5).length : 0),
    [items, verdicts],
  );

  const refinement = useMemo(() => {
    if (status !== "ready" || !query.trim()) return "";
    const lower = query.toLowerCase();
    const options = corpus.refinements.filter((hint) => {
      const core = hint.toLowerCase().replace(/^(and|without|somewhere|that|with|on)\s+/, "");
      return !lower.includes(core);
    });
    if (!options.length) return "";
    return options[((suggestTick % options.length) + options.length) % options.length];
  }, [status, query, suggestTick, corpus]);

  const example = useMemo(
    () => (query || status === "thinking" || needsPlace ? "" : corpus.examples[exampleTick % corpus.examples.length]),
    [query, status, exampleTick, corpus, needsPlace],
  );

  const bindNode = useCallback((id: string, node: HTMLElement | null) => {
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
  }, []);

  const applyTargets = useCallback(() => {
    const root = rootRef.current;
    const engine = engineRef.current;
    if (!root || !engine) return;
    const targets = new Map<string, { x: number; y: number }>();
    if (risen.length) {
      const width = root.clientWidth;
      const { cell: unit, perRow, top } = layout;
      risen.forEach((_, index) => {
        const row = Math.floor(index / perRow);
        const inRow = Math.min(perRow, risen.length - row * perRow);
        const origin = (width - inRow * unit.width) / 2 + unit.width / 2;
        targets.set(risen[index].item.id, {
          x: origin + (index % perRow) * unit.width,
          y: top + row * unit.height,
        });
      });
    }
    engine.setTargets(targets, performance.now());
  }, [risen, layout]);

  const physicsIds = needsPlace ? [] : items.map((item) => item.id);
  const physicsKey = `${corpusId}:${city ?? "none"}:${coords ? "geo" : "nogeo"}:${physicsIds.length}:${phone ? "p" : "d"}`;
  const radius = phone ? 22 : RADIUS;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const engine = new HeapPhysics(radius);
    engineRef.current = engine;
    engine.setBounds(root.clientWidth, root.clientHeight, phone ? 24 : 36, Math.max(1, physicsIds.length));
    if (physicsIds.length) engine.seed(physicsIds);
    setSize({ width: root.clientWidth, height: root.clientHeight });
    const tick = (now: number) => {
      engine.step(now);
      for (const body of engine.bodies) {
        const node = nodes.current.get(body.id);
        if (!node) continue;
        node.style.transform = `translate3d(${Math.round(body.x)}px, ${Math.round(body.y)}px, 0) translate(-50%, -50%)`;
        node.style.setProperty("--arrived", body.target && body.phase === "seeking" ? "1" : "0");
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    const onResize = () => {
      engine.setBounds(root.clientWidth, root.clientHeight, phone ? 24 : 36, Math.max(1, physicsIds.length));
      setSize({ width: root.clientWidth, height: root.clientHeight });
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, [physicsKey, physicsIds.length, radius, phone]);

  useEffect(() => {
    applyTargets();
  }, [applyTargets]);

  const resetAnswers = () => {
    setVerdicts(null);
    setStatus("idle");
    setError("");
    setSource("");
  };

  const chooseCity = (next: CityId) => {
    window.localStorage.setItem(CITY_STORAGE_KEY, next);
    abortRef.current?.abort();
    nodes.current.clear();
    setCoords(null);
    setCity(next);
    setPlaceLabel(CITIES.find((entry) => entry.id === next)?.label ?? next);
    setQuery("");
    resetAnswers();
  };

  const useHere = () => {
    if (!navigator.geolocation) {
      setError("This phone will not share a location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        abortRef.current?.abort();
        nodes.current.clear();
        setCity(null);
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setQuery("");
        resetAnswers();
      },
      () => {
        setLocating(false);
        setError("Location denied. Pick a city instead.");
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  };

  const switchCorpus = (id: CorpusId) => {
    abortRef.current?.abort();
    nodes.current.clear();
    setCorpusId(id);
    setLiveItems(null);
    setCatalogSource("");
    setQuery("");
    resetAnswers();
  };

  const ask = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      abortRef.current?.abort();
      if (needsPlace || trimmed.length < 3) {
        setVerdicts(null);
        setStatus("idle");
        setError("");
        setSource("");
        return;
      }
      const key = `${corpusId}::${city ?? "any"}::${coords ? `${coords.lat.toFixed(3)},${coords.lng.toFixed(3)}` : ""}::${trimmed.toLowerCase().replace(/\s+/g, " ")}`;
      const hit = cache.get(key);
      if (hit) {
        setVerdicts(hit);
        setMissing(0);
        readyAt.current = Date.now();
        setStatus("ready");
        return;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus("thinking");
      setError("");
      try {
        const response = await fetch("/api/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            query: trimmed,
            corpus: corpusId,
            group: city,
            lat: coords?.lat,
            lng: coords?.lng,
          }),
          signal: controller.signal,
        });
        const payload = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setStatus("error");
          setError(payload?.error ?? "The claw missed.");
          return;
        }
        const next = new Map<string, number>();
        for (const row of payload.verdicts as { id: string; probability: number }[]) {
          next.set(row.id, row.probability);
        }
        if (!payload.missing?.length) cache.set(key, next);
        setVerdicts(next);
        setMissing(payload.missing?.length ?? 0);
        setSource(payload.source ?? "");
        if (payload.catalogSource) setCatalogSource(payload.catalogSource);
        if (payload.placeLabel) setPlaceLabel(payload.placeLabel);
        readyAt.current = Date.now();
        setStatus("ready");
      } catch (caught) {
        if ((caught as { name?: string }).name === "AbortError") return;
        setStatus("error");
        setError("Could not reach Jev. Check the line and try again.");
      }
    },
    [corpusId, city, coords, needsPlace],
  );

  useEffect(() => {
    const timer = setTimeout(() => void ask(query), 450);
    return () => clearTimeout(timer);
  }, [query, ask]);

  useEffect(() => {
    if (query) return;
    const timer = setInterval(() => setExampleTick((n) => n + 1), 2800);
    return () => clearInterval(timer);
  }, [query]);

  useEffect(() => {
    if (status !== "ready") return;
    const timer = setTimeout(() => setSuggestTick((n) => n + 1), 3400);
    return () => clearTimeout(timer);
  }, [status, suggestTick]);

  const addRefinement = () => {
    if (!refinement) return;
    setQuery((current) => `${current.trim()} ${refinement}`.trim());
    setSuggestTick(0);
    inputRef.current?.focus();
  };

  const footerSource = [
    catalogSource,
    source === "heuristic" ? "local heuristic" : source === "gateway" ? "Jev via Gateway" : source ? "TypeSafe Jev" : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const hereLabel = placeLabel || (coords ? "Near you" : CITIES.find((entry) => entry.id === city)?.label);

  const askDock = (
    <div className="ask-dock relative rounded-2xl focus-within:border-claw">
      <div className="pointer-events-none absolute inset-0 z-20 flex items-center overflow-hidden pr-14 pl-5 text-[17px] whitespace-pre">
        <span aria-hidden className="invisible">
          {query}
        </span>
        {example ? (
          <button
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setQuery(example);
              inputRef.current?.focus();
            }}
            tabIndex={-1}
            className="animate-example pointer-events-auto text-left text-ivory/35 transition-colors hover:text-ivory/80"
          >
            {example}
          </button>
        ) : null}
        {refinement ? (
          <button
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setSuggestTick((n) => n + 1)}
            tabIndex={-1}
            className={`animate-example pointer-events-auto ${SUGGEST[suggestTick % SUGGEST.length]}`}
          >
            {" "}
            {refinement}
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        value={query}
        disabled={needsPlace}
        onChange={(event) => {
          setQuery(event.target.value);
          setSuggestTick(0);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            if (refinement) addRefinement();
            else void ask(query);
          } else if (event.key === "Escape") {
            setQuery("");
            resetAnswers();
          }
        }}
        maxLength={160}
        aria-label="Ask the claw"
        className="relative z-10 h-16 w-full bg-transparent pr-16 pl-5 text-[17px] text-ivory outline-none disabled:opacity-40"
      />
      <div className="absolute top-1/2 right-4 z-30 flex -translate-y-1/2 items-center gap-1">
        {status === "thinking" || loadingPit ? (
          <span className="hud-label text-claw">{loadingPit ? "loading" : "asking"}</span>
        ) : query ? (
          <button
            onClick={() => {
              abortRef.current?.abort();
              setQuery("");
              resetAnswers();
            }}
            aria-label="Clear"
            className="grid size-7 place-items-center rounded-full text-muted hover:text-ivory"
          >
            ×
          </button>
        ) : (
          <span className="hud-label">ask</span>
        )}
      </div>
    </div>
  );

  return (
    <main
      className="cabinet relative h-dvh w-full overflow-hidden"
      data-phone={phone}
      data-wdi-product-proof="runnable-dom"
      data-wdi-source-ref="src/app/page.tsx"
      style={{ ["--token-size" as string]: `${2 * radius}px` }}
    >
      <div className="felt-floor pointer-events-none absolute inset-x-0 bottom-0 h-[42%] opacity-90" />
      {!phone ? (
        <div className="claw-rig" data-asking={status === "thinking"}>
          <ClawMark className="h-24 w-24" />
        </div>
      ) : null}

      <header className="phone-header pointer-events-auto relative z-40 flex items-center justify-between gap-3 px-5 py-3 sm:px-8">
        <div className="flex min-w-0 items-center gap-2">
          <ClawMark className="size-8 shrink-0 text-claw" />
          <div className="min-w-0">
            <p className="hud-label hidden sm:block">Player 1 · Insert ask</p>
            <h1 className="wordmark text-[28px] leading-none sm:text-[42px]">THE CLAW</h1>
          </div>
        </div>
        {corpus.live === "nearby" || corpus.needsPlace ? (
          <button
            type="button"
            onClick={() => {
              if (coords || city) {
                setCoords(null);
                window.localStorage.removeItem(CITY_STORAGE_KEY);
                setCity(null);
                setLiveItems(null);
                setPlaceLabel("");
                resetAnswers();
              } else useHere();
            }}
            className="shrink-0 rounded-full border border-brass/40 px-3 py-2 text-xs text-ivory"
          >
            {hereLabel ? `${hereLabel} · change` : locating ? "Finding you…" : "Location"}
          </button>
        ) : null}
      </header>

      <nav aria-label="Prize pits" className="phone-tabs tab-scroll ticket relative z-40 mx-3 flex items-center gap-0.5 overflow-x-auto rounded-full p-1 sm:absolute sm:top-4 sm:right-8 sm:mx-0 sm:max-w-[60%]">
        {CORPUS_ORDER.map((id) => (
          <button
            key={id}
            onClick={() => switchCorpus(id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium tracking-wide transition-colors ${
              corpusId === id ? "bg-claw text-cabinet" : "text-muted hover:text-ivory"
            }`}
          >
            {CORPORA[id].label}
          </button>
        ))}
      </nav>

      <div ref={rootRef} className="phone-pit relative z-10 min-h-0 flex-1 overflow-hidden">
        {loadingPit && !needsPlace && items.length === 0 ? (
          <p className="relative z-30 mt-8 text-center text-sm text-muted">Filling the pit…</p>
        ) : needsPlace ? (
          <section className="relative z-30 mx-auto mt-4 max-w-md px-4">
            <p className="mb-3 text-center text-[15px] text-ivory">This pit is around you. Share a location.</p>
            <button type="button" className="here-btn mb-3" onClick={useHere} disabled={locating}>
              {locating ? "Finding you…" : "Use my location"}
            </button>
            <div className="place-grid">
              {CITIES.map((entry) => (
                <button key={entry.id} type="button" className="place-chip" onClick={() => chooseCity(entry.id)}>
                  <span className="mr-1">{entry.glyph}</span>
                  {entry.label}
                </button>
              ))}
            </div>
          </section>
        ) : (
          <div className="absolute inset-0">
            {items.map((item) => {
              const probability = verdicts?.get(item.id) ?? 0;
              const isUp = risenIds.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  ref={(node) => bindNode(item.id, node)}
                  className="token"
                  data-risen={isUp}
                  data-shape={corpus.shape}
                  style={{ opacity: verdicts && !isUp ? 0.38 : 1 }}
                  title={isUp ? `${item.name} — ${Math.round(100 * probability)}%` : item.name}
                  onClick={() => {
                    if (item.href) window.open(item.href, "_blank", "noopener");
                  }}
                >
                  <span className="token-glyph">
                    <span className="token-face">
                      {item.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.image} alt="" className="token-photo" />
                      ) : (
                        <span>{item.glyph}</span>
                      )}
                      <span className="token-face-title">{item.name}</span>
                    </span>
                  </span>
                  <span className="token-label" style={{ maxWidth: layout.cell.width - 12 }}>
                    <span className="line-clamp-2 block text-[11px] leading-tight font-medium text-ivory">{item.name}</span>
                    <span className="mt-0.5 block text-[10px] leading-tight text-muted">{item.meta}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className={`pointer-events-none absolute inset-x-0 z-30 flex flex-col items-center px-4 ${phone ? "bottom-28" : "top-28"}`}>
        <div className="pointer-events-auto w-full max-w-2xl">
          {!phone && !needsPlace ? <p className="mb-3 text-center text-[13px] text-muted">{corpus.tagline}</p> : null}
          {!phone ? askDock : null}
          <div className="mt-2 min-h-8 text-center">
            {status === "error" ? <p className="text-[12px] text-claw">{error}</p> : null}
            {status === "ready" && matchCount === 0 ? (
              <p className="animate-rise-in text-[12px] text-muted">Nothing in this pit fits. Loosen it.</p>
            ) : null}
            {status === "ready" && matchCount > 0 && missing > 0 ? (
              <p className="animate-rise-in text-[12px] text-claw">{missing} could not be reached this time.</p>
            ) : null}
          </div>
        </div>
      </div>

      {phone && !needsPlace ? <div className="pointer-events-auto relative z-40">{askDock}</div> : null}

      <div className="pointer-events-none relative z-30 px-4 pb-2 text-[10px] text-muted/80 sm:absolute sm:inset-x-0 sm:bottom-2 sm:flex sm:justify-between sm:px-8">
        <span>
          {needsPlace
            ? "Share a location and the pit fills"
            : `${items.length} ${corpus.collection}${loadingPit ? " · loading" : ""}`}
        </span>
        <span className="mt-1 block sm:mt-0">{footerSource}</span>
      </div>
    </main>
  );
}
