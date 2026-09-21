export type CityId = "london" | "new-york" | "tokyo" | "los-angeles";

export type CorpusId = "eats" | "dinner" | "pubs" | "wine" | "movies" | "series" | "do" | "gifts";

export type Prize = {
  id: string;
  name: string;
  glyph: string;
  group: string;
  meta: string;
  facts: string;
};

export type Corpus = {
  id: CorpusId;
  label: string;
  tagline: string;
  collection: string;
  subject: string;
  shape: "chip" | "poster";
  needsPlace: boolean;
  examples: string[];
  refinements: string[];
  items: Prize[];
};

export type Verdict = {
  id: string;
  probability: number;
};
