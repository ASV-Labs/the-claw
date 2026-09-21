import assert from "node:assert/strict";
import test from "node:test";
import { CORPORA, CORPUS_ORDER } from "../data/corpora";
import { EATS } from "../data/places";
import { scorePrize } from "./heuristic";

test("eight pits exist", () => {
  assert.equal(CORPUS_ORDER.length, 8);
  for (const id of CORPUS_ORDER) {
    assert.ok(CORPORA[id].items.length > 10, id);
  }
});

test("place pits need a city", () => {
  assert.equal(CORPORA.eats.live, "nearby");
  assert.equal(CORPORA.pubs.live, "nearby");
  assert.equal(CORPORA.movies.live, "screen");
  assert.equal(CORPORA.series.live, "screen");
});

test("quiet London rooms score", () => {
  const noble = EATS.find((item) => item.id === "lon-noble-rot");
  const tayyabs = EATS.find((item) => item.id === "lon-tayyabs");
  assert.ok(noble && tayyabs);
  assert.ok(scorePrize(noble, "somewhere quiet enough to actually talk") > scorePrize(tayyabs, "somewhere quiet enough to actually talk"));
});
