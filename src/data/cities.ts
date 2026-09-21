import type { CityId } from "@/lib/types";

export const CITIES: { id: CityId; label: string; glyph: string }[] = [
  { id: "london", label: "London", glyph: "🇬🇧" },
  { id: "new-york", label: "New York", glyph: "🗽" },
  { id: "tokyo", label: "Tokyo", glyph: "🗼" },
  { id: "los-angeles", label: "Los Angeles", glyph: "🌴" },
];

export const CITY_STORAGE_KEY = "the-claw-city";
