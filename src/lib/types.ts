export type CityId = "london" | "new-york" | "tokyo" | "los-angeles";

export type CorpusId = "eats" | "dinner" | "pubs" | "wine" | "movies" | "series" | "do" | "gifts";

export type Prize = {
  id: string;
  name: string;
  glyph: string;
  group: string;
  meta: string;
  facts: string;
  image?: string;
  href?: string;
};

export type Corpus = {
  id: CorpusId;
  label: string;
  tagline: string;
  collection: string;
  subject: string;
  shape: "chip" | "poster";
  needsPlace: boolean;
  live: "nearby" | "screen" | "static";
  examples: string[];
  refinements: string[];
  items: Prize[];
};

export type Verdict = {
  id: string;
  probability: number;
};

export type CatalogResult = {
  items: Prize[];
  source: string;
  placeLabel?: string;
};
