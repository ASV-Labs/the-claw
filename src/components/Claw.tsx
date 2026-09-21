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
const SUGGEST = [
  "text-claw/80 hover:text-claw",
  "text-ivory/70 hover:text-ivory",
  "text-brass hover:text-claw",
];

const cache = new Map<string, Map<string, number>>();

function readCity(): CityId | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(CITY_STORAGE_KEY);
  return CITIES.some((city) => city.id === value) ? (value as CityId) : null;
}

export function Claw() {
  const [corpusId, setCorpusId] = useState<CorpusId>("eats");
  const [city, setCity] = useState<CityId | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"idle" | "thinking" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [verdicts, setVerdicts] = useState<Map<string, number> | null>(null);
  const [answeredQuery, setAnsweredQuery] = useState("");
  const [missing, setMissing] = useState(0);
  const [source, setSource] = useState("");
  const [size, setSize] = useState({ width: 1440, height: 900 });
  const [suggestTick, setSuggestTick] = useState(0);
  const [exampleTick, setExampleTick] = useState(0);
  const readyAt = useRef(0);
  const rootRef = useRef<HTMLElement | null>(null);
  const engineRef = useRef<HeapPhysics | null>(null);
  const nodes = useRef(new Map<string, HTMLElement>());
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const frameRef = useRef(0);

  const corpus = CORPORA[corpusId];
  const needsCity = corpus.needsPlace && !city;
  const items = useMemo(() => prizesFor(corpus, city), [corpus, city]);
  const cell = corpus.shape === "poster" ? POSTER_CELL : CHIP_CELL;

  useEffect(() => {
    setCity(readCity());
  }, []);

  const layout = useMemo(() => {
    const perRow = Math.max(1, Math.floor(Math.min(size.width - 64, 1100) / cell.width));
    const top = Math.max(250, 0.28 * size.height);
    const rows = Math.max(1, Math.floor((size.height - 220 - top) / cell.height));
    return { cell, perRow, top, capacity: perRow * rows };
  }, [size, cell]);

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
    () => (query || status === "thinking" ? "" : corpus.examples[exampleTick % corpus.examples.length]),
    [query, status, exampleTick, corpus],
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

  const physicsKey = `${corpusId}:${city ?? "none"}:${needsCity ? "ask" : items.length}`;
  const physicsIds = needsCity ? CITIES.map((entry) => entry.id) : items.map((item) => item.id);
  const radius = needsCity ? 42 : RADIUS;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const engine = new HeapPhysics(radius);
    engineRef.current = engine;
    engine.setBounds(root.clientWidth, root.clientHeight, 52, physicsIds.length);
    engine.seed(physicsIds);
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
      engine.setBounds(root.clientWidth, root.clientHeight, 52, physicsIds.length);
      setSize({ width: root.clientWidth, height: root.clientHeight });
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", onResize);
    };
  }, [physicsKey, physicsIds.length, radius]);

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
    setCity(next);
    setQuery("");
    resetAnswers();
  };

  const switchCorpus = (id: CorpusId) => {
    abortRef.current?.abort();
    nodes.current.clear();
    setCorpusId(id);
    setQuery("");
    resetAnswers();
  };

  const ask = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      abortRef.current?.abort();
      if (needsCity || trimmed.length < 3) {
        setVerdicts(null);
        setStatus("idle");
        setError("");
        setSource("");
        return;
      }
      const key = `${corpusId}::${city ?? "any"}::${trimmed.toLowerCase().replace(/\s+/g, " ")}`;
      const hit = cache.get(key);
      if (hit) {
        setVerdicts(hit);
        setMissing(0);
        setAnsweredQuery(trimmed);
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
          body: JSON.stringify({ query: trimmed, corpus: corpusId, group: city }),
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
        setAnsweredQuery(trimmed);
        readyAt.current = Date.now();
        setStatus("ready");
      } catch (caught) {
        if ((caught as { name?: string }).name === "AbortError") return;
        setStatus("error");
        setError("Could not reach Jev. Check the line and try again.");
      }
    },
    [corpusId, city, needsCity],
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

  const footerSource =
    source === "heuristic"
      ? "local heuristic · add a TypeSafe key for live Jev"
      : source === "gateway"
        ? "TypeSafe Jev via Vercel AI Gateway"
        : "TypeSafe Jev";

  const cityLabel = CITIES.find((entry) => entry.id === city)?.label;
  const tokens: Prize[] = needsCity
    ? CITIES.map((entry) => ({
        id: entry.id,
        name: entry.label,
        glyph: entry.glyph,
        group: entry.id,
        meta: "pick a city",
        facts: "",
      }))
    : items;

  return (
    <main
      ref={rootRef}
      className="cabinet relative h-dvh w-full overflow-hidden"
      style={{ ["--token-size" as string]: `${2 * RADIUS}px` }}
    >
      <div className="felt-floor pointer-events-none absolute inset-x-0 bottom-0 h-[42%] opacity-90" />
      <div className="claw-rig" data-asking={status === "thinking"}>
        <ClawMark className="h-24 w-24" />
      </div>

      <div className="absolute inset-0">
        {tokens.map((item) => {
          const probability = verdicts?.get(item.id) ?? 0;
          const isUp = risenIds.has(item.id);
          return (
            <button
              key={item.id}
              type="button"
              ref={(node) => bindNode(item.id, node)}
              className="token"
              data-risen={isUp}
              data-city={needsCity}
              data-shape={needsCity ? "chip" : corpus.shape}
              style={{ opacity: verdicts && !isUp ? 0.38 : 1 }}
              title={isUp ? `${item.name} — ${Math.round(100 * probability)}%` : item.name}
              onClick={() => {
                if (needsCity) chooseCity(item.id as CityId);
              }}
            >
              <span className="token-glyph">
                <span className="token-face">
                  <span>{item.glyph}</span>
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

      <div
        className="pointer-events-none relative z-30 flex h-full flex-col"
        data-wdi-product-proof="runnable-dom"
        data-wdi-source-ref="src/app/page.tsx"
      >
        <header className="pointer-events-auto flex flex-wrap items-start justify-between gap-3 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <ClawMark className="size-10 text-claw" />
            <div>
              <p className="hud-label">Player 1 · Insert ask</p>
              <h1 className="wordmark text-[34px] sm:text-[42px]">THE CLAW</h1>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-end gap-2">
            <nav aria-label="Prize pits" className="tab-scroll ticket flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full p-1">
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
            {corpus.needsPlace ? (
              <div className="flex items-center gap-2">
                <span className="hud-label">Location</span>
                {city ? (
                  <button
                    onClick={() => {
                      window.localStorage.removeItem(CITY_STORAGE_KEY);
                      abortRef.current?.abort();
                      nodes.current.clear();
                      setCity(null);
                      setQuery("");
                      resetAnswers();
                    }}
                    className="rounded-full border border-brass/40 px-3 py-1 text-xs text-ivory hover:border-claw hover:text-claw"
                  >
                    {cityLabel} · change
                  </button>
                ) : (
                  <span className="text-xs text-claw">needed</span>
                )}
              </div>
            ) : null}
          </div>
        </header>

        <div className="pointer-events-none flex flex-col items-center px-5">
          <div className="pointer-events-auto w-full max-w-2xl">
            <p className="mb-3 text-center text-[13px] text-muted">
              {needsCity ? "This pit is a place. Pick a city. Then ask." : corpus.tagline}
            </p>
            <div className="ask-dock relative rounded-2xl focus-within:border-claw">
              <div className="pointer-events-none absolute inset-0 z-20 flex items-center overflow-hidden pr-14 pl-5 text-[17px] whitespace-pre">
                <span aria-hidden className="invisible">
                  {query}
                </span>
                {needsCity ? (
                  <span className="text-ivory/35">London, New York, Tokyo, or Los Angeles</span>
                ) : example ? (
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
                  <>
                    <button
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setSuggestTick((n) => n + 1)}
                      tabIndex={-1}
                      className={`animate-example pointer-events-auto ${SUGGEST[suggestTick % SUGGEST.length]}`}
                    >
                      {" "}
                      {refinement}
                    </button>
                    <button
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => setSuggestTick((n) => n + 1)}
                      aria-label="Another suggestion"
                      className="pointer-events-auto ml-1.5 grid size-7 place-items-center text-muted/70 hover:text-ivory"
                    >
                      ⇅
                    </button>
                  </>
                ) : null}
              </div>
              <input
                ref={inputRef}
                value={query}
                disabled={needsCity}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSuggestTick(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Tab" && refinement) {
                    event.preventDefault();
                    addRefinement();
                  } else if (event.key === "Enter") {
                    if (refinement) addRefinement();
                    else void ask(query);
                  } else if (event.key === "Escape") {
                    setQuery("");
                    resetAnswers();
                  }
                }}
                maxLength={160}
                aria-label="Ask the claw"
                className="relative z-10 h-16 w-full bg-transparent pr-14 pl-5 text-[17px] text-ivory outline-none disabled:opacity-40"
              />
              <div className="absolute top-1/2 right-4 z-30 flex -translate-y-1/2 items-center gap-1">
                {status === "thinking" ? (
                  <span className="hud-label text-claw">asking</span>
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
            <div className="mt-4 min-h-14 text-center">
              {status === "error" ? (
                <p className="text-[12px] text-claw">
                  {error}
                  {verdicts && answeredQuery ? <span className="text-muted"> Still holding “{answeredQuery}”.</span> : null}
                </p>
              ) : null}
              {status === "ready" && matchCount === 0 ? (
                <p className="animate-rise-in text-[12px] text-muted">Nothing in this pit fits. Loosen it.</p>
              ) : null}
              {status === "ready" && matchCount > 0 && missing > 0 ? (
                <p className="animate-rise-in text-[12px] text-claw">{missing} could not be reached this time.</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-auto flex items-end justify-between px-5 pb-3 text-[10px] text-muted/80 sm:px-8">
          <span>
            {needsCity
              ? "4 cities · pick one and the pit fills"
              : `${items.length} ${corpus.collection} · every one considered on every question`}
          </span>
          <span className="hidden sm:inline">{footerSource}</span>
        </div>
        <noscript>
          <p>JavaScript runs the pit. The catalog is listed here.</p>
          <ol>
            {corpus.items.map((item) => (
              <li key={item.id}>{item.name}</li>
            ))}
          </ol>
        </noscript>
      </div>
    </main>
  );
}
