export const runtime = "nodejs";

export async function GET(request: Request) {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim() || process.env.GOOGLE_MAPS_API_KEY?.trim();
  const ref = new URL(request.url).searchParams.get("ref");
  if (!key || !ref) return new Response("missing", { status: 400 });
  const url = new URL("https://maps.googleapis.com/maps/api/place/photo");
  url.searchParams.set("maxwidth", "400");
  url.searchParams.set("photo_reference", ref);
  url.searchParams.set("key", key);
  const response = await fetch(url);
  return new Response(response.body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") || "image/jpeg",
      "cache-control": "public, max-age=86400",
    },
  });
}
