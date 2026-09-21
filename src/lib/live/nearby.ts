import type { Prize } from "@/lib/types";

const UA = "THE-CLAW/1.0 (ASV Labs; https://github.com/ASV-Labs/the-claw)";

type NearbyKind = "eats" | "pubs";

export async function liveNearby(
  kind: NearbyKind,
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<{ items: Prize[]; source: string; placeLabel?: string }> {
  const googleKey = process.env.GOOGLE_PLACES_API_KEY?.trim() || process.env.GOOGLE_MAPS_API_KEY?.trim();
  const placeLabel = await reverseLabel(lat, lng, signal).catch(() => undefined);
  if (googleKey) {
    try {
      const items = await googleNearby(kind, lat, lng, googleKey, signal);
      if (items.length) {
        return { items, source: "Google Places nearby", placeLabel };
      }
    } catch (error) {
      console.warn("[the-claw] Google Places failed", error);
    }
  }
  const items = await overpassNearby(kind, lat, lng, signal);
  return { items, source: "OpenStreetMap nearby", placeLabel };
}

async function googleNearby(
  kind: NearbyKind,
  lat: number,
  lng: number,
  key: string,
  signal?: AbortSignal,
): Promise<Prize[]> {
  const type = kind === "pubs" ? "bar" : "restaurant";
  const url = new URL("https://maps.googleapis.com/maps/api/place/nearbysearch/json");
  url.searchParams.set("location", `${lat},${lng}`);
  url.searchParams.set("radius", "1600");
  url.searchParams.set("type", type);
  url.searchParams.set("key", key);
  const response = await fetch(url, { signal, headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`places ${response.status}`);
  const json = (await response.json()) as {
    results?: Array<{
      place_id: string;
      name: string;
      vicinit?: string;
      vicinity?: string;
      rating?: number;
      price_level?: number;
      types?: string[];
      opening_hours?: { open_now?: boolean };
      photos?: { photo_reference: string }[];
      geometry?: { location?: { lat: number; lng: number } };
    }>;
  };
  return (json.results ?? []).slice(0, 40).map((row) => {
    const price = "£".repeat(Math.min(4, (row.price_level ?? 0) + 1));
    const photo = row.photos?.[0]?.photo_reference
      ? `/api/place-photo?ref=${encodeURIComponent(row.photos[0].photo_reference)}`
      : undefined;
    const open = row.opening_hours?.open_now ? "open now" : "";
    const types = (row.types ?? []).filter((t) => !["point_of_interest", "establishment"].includes(t));
    return {
      id: `gplace-${row.place_id}`,
      name: row.name,
      glyph: kind === "pubs" ? "🍺" : "🍽️",
      group: "here",
      meta: [row.rating ? `${row.rating.toFixed(1)}★` : "", price, open].filter(Boolean).join(" · "),
      image: photo,
      href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(row.name)}&query_place_id=${row.place_id}`,
      facts: [
        `${row.name}. ${kind === "pubs" ? "Bar/pub" : "Restaurant"} near the requester.`,
        row.vicinity ? `Address: ${row.vicinity}.` : "",
        row.rating ? `Google rating ${row.rating}.` : "",
        row.price_level != null ? `Price level ${row.price_level} of 4.` : "",
        types.length ? `Tags: ${types.slice(0, 6).join(", ")}.` : "",
        open ? "Open now." : "Hours unknown.",
        "From Google Places nearby search within about a mile.",
      ]
        .filter(Boolean)
        .join(" "),
    } satisfies Prize;
  });
}

async function overpassNearby(kind: NearbyKind, lat: number, lng: number, signal?: AbortSignal): Promise<Prize[]> {
  const filter =
    kind === "pubs"
      ? '["amenity"~"pub|bar|biergarten"]'
      : '["amenity"~"restaurant|cafe|fast_food|food_court"]';
  const query = `[out:json][timeout:20];(node${filter}(around:1400,${lat},${lng});way${filter}(around:1400,${lat},${lng}););out center 50;`;
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": UA },
    body: `data=${encodeURIComponent(query)}`,
    signal,
  });
  if (!response.ok) throw new Error(`overpass ${response.status}`);
  const json = (await response.json()) as {
    elements?: Array<{
      id: number;
      tags?: Record<string, string>;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
    }>;
  };
  const items: Prize[] = [];
  for (const el of json.elements ?? []) {
    const name = el.tags?.name;
    if (!name) continue;
    const cuisine = el.tags?.cuisine?.replace(/_/g, " ");
    const addr = [el.tags?.["addr:housenumber"], el.tags?.["addr:street"]].filter(Boolean).join(" ");
    items.push({
      id: `osm-${el.id}`,
      name,
      glyph: kind === "pubs" ? "🍺" : "🍽️",
      group: "here",
      meta: [cuisine, el.tags?.["addr:suburb"] || el.tags?.["addr:city"]].filter(Boolean).join(" · "),
      href: `https://www.openstreetmap.org/${el.lat ? "node" : "way"}/${el.id}`,
      facts: [
        `${name}. ${kind === "pubs" ? "Pub/bar" : "Place to eat"} within about a mile of the requester.`,
        cuisine ? `Cuisine: ${cuisine}.` : "",
        addr ? `Address: ${addr}.` : "",
        el.tags?.opening_hours ? `Hours: ${el.tags.opening_hours}.` : "",
        el.tags?.phone ? `Phone: ${el.tags.phone}.` : "",
        el.tags?.wheelchair === "yes" ? "Wheelchair accessible." : "",
        el.tags?.["diet:vegetarian"] === "yes" ? "Vegetarian options tagged." : "",
        "From OpenStreetMap nearby. Google Places key not set, so this is the live nearby catalog.",
      ]
        .filter(Boolean)
        .join(" "),
    });
    if (items.length >= 40) break;
  }
  return items;
}

async function reverseLabel(lat: number, lng: number, signal?: AbortSignal) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": UA },
    signal,
  });
  if (!response.ok) return undefined;
  const json = (await response.json()) as { address?: Record<string, string>; name?: string };
  const a = json.address ?? {};
  return a.neighbourhood || a.suburb || a.quarter || a.city || a.town || a.village || json.name;
}
