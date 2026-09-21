import { scoreCatalog } from "./heuristic";
import type { Prize, Verdict } from "./types";

const TYPESAFE_URL = "https://api.typesafe.ai/v1/systemone";
const GATEWAY_URL = "https://ai-gateway.vercel.sh/v4/ai/evaluation-model";
const BATCH = 28;

export type AskResult = {
  verdicts: Verdict[];
  missing: string[];
  source: "typesafe" | "gateway" | "heuristic";
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function questions(items: Prize[], dialect: "noul" | "boolean") {
  const out: Record<string, object> = {};
  for (const item of items) {
    out[item.id] = {
      type: dialect,
      instructions: `Does ${item.name} fit the request in \`request\`? Judge only this row in \`catalog\`.`,
      criteria: {
        true: "Someone who asked for this would be glad this came up.",
        false: "Wrong tone, price, place, length, or energy for this request.",
      },
    };
  }
  return out;
}

function probabilityOf(answer: unknown): number | null {
  if (!answer || typeof answer !== "object") return null;
  const row = answer as Record<string, unknown>;
  if (typeof row.noul === "number") return row.noul;
  if (typeof row.probability === "number") return row.probability;
  return null;
}

async function postJson(url: string, apiKey: string, body: unknown, signal?: AbortSignal) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const message =
      (typeof json.error === "string" && json.error) ||
      (typeof json.message === "string" && json.message) ||
      `Jev ${response.status}`;
    throw new Error(message);
  }
  return json;
}

function catalogState(group: Prize[]) {
  return {
    catalog: group.map((item) => ({ id: item.id, name: item.name, facts: item.facts })),
  };
}

async function askTypeSafe(items: Prize[], query: string, apiKey: string, signal?: AbortSignal) {
  const model = process.env.JEV_MODEL?.trim() || "jev-latest";
  const answers: Record<string, unknown> = {};
  for (const group of chunk(items, BATCH)) {
    const json = await postJson(
      TYPESAFE_URL,
      apiKey,
      {
        model,
        state: { request: query, ...catalogState(group) },
        questions: questions(group, "noul"),
      },
      signal,
    );
    Object.assign(answers, (json.answers as object) ?? {});
  }
  return answers;
}

async function askGateway(items: Prize[], query: string, apiKey: string, signal?: AbortSignal) {
  const answers: Record<string, unknown> = {};
  for (const group of chunk(items, BATCH)) {
    const json = await postJson(
      GATEWAY_URL,
      apiKey,
      {
        model: "typesafe-ai/jev",
        state: { request: query, ...catalogState(group) },
        questions: questions(group, "boolean"),
      },
      signal,
    );
    Object.assign(answers, (json.answers as object) ?? {});
  }
  return answers;
}

function toVerdicts(items: Prize[], answers: Record<string, unknown>) {
  const verdicts: Verdict[] = [];
  const missing: string[] = [];
  for (const item of items) {
    const probability = probabilityOf(answers[item.id]);
    if (probability == null) missing.push(item.id);
    else verdicts.push({ id: item.id, probability });
  }
  return { verdicts, missing };
}

export async function askJev(items: Prize[], query: string, signal?: AbortSignal): Promise<AskResult> {
  const typesafe = process.env.TYPESAFE_API_KEY?.trim();
  const gateway = process.env.AI_GATEWAY_API_KEY?.trim();

  const tryProvider = async (
    source: "typesafe" | "gateway",
    fn: () => Promise<Record<string, unknown>>,
  ): Promise<AskResult | null> => {
    try {
      const answers = await fn();
      const { verdicts, missing } = toVerdicts(items, answers);
      if (verdicts.length === 0) return null;
      return { verdicts, missing, source };
    } catch (error) {
      if ((error as { name?: string }).name === "AbortError") throw error;
      console.warn(`[the-claw] ${source} failed:`, error);
      return null;
    }
  };

  if (typesafe) {
    const hit = await tryProvider("typesafe", () => askTypeSafe(items, query, typesafe, signal));
    if (hit) return hit;
  }
  if (gateway) {
    const hit = await tryProvider("gateway", () => askGateway(items, query, gateway, signal));
    if (hit) return hit;
  }

  const map = scoreCatalog(items, query);
  return {
    source: "heuristic",
    missing: [],
    verdicts: items.map((item) => ({ id: item.id, probability: map.get(item.id) ?? 0 })),
  };
}
