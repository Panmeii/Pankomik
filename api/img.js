/**
 * Pankomik — /api/img
 * Vercel Edge-compatible image proxy untuk bypass hotlink protection.
 * Usage: /api/img?url=https://...&ref=https://...&w=300
 */

export const config = { runtime: "edge" };

const ALLOWED_HOSTS = [
  "sakuranovel.id","sakuranovel.com",
  "komikindo.org","komikindo.id",
  "komikcast.me","komikcast.io",
  "komiku.id","komiku.me",
  "manhwaindo.id","manhwaindo.com",
  "mangatale.co","westmanga.info",
  "shinigami.id","kiryuu.id","mgkomik.id",
  "bacakomik.me","novelringan.com",
  "i0.wp.com","i1.wp.com","i2.wp.com","i3.wp.com", // Jetpack CDN
  "lh3.googleusercontent.com","cdn.discordapp.com",
];

const REF_MAP = {
  "sakuranovel":  "https://sakuranovel.id",
  "komikindo":    "https://komikindo.org",
  "komikcast":    "https://komikcast.me",
  "komiku":       "https://komiku.id",
  "manhwaindo":   "https://manhwaindo.id",
  "mangatale":    "https://mangatale.co",
  "westmanga":    "https://westmanga.info",
  "shinigami":    "https://shinigami.id",
  "kiryuu":       "https://kiryuu.id",
  "mgkomik":      "https://mgkomik.id",
  "bacakomik":    "https://bacakomik.me",
  "novelringan":  "https://novelringan.com",
};

function getReferer(host) {
  for (const [k, v] of Object.entries(REF_MAP)) {
    if (host.includes(k)) return v;
  }
  return "";
}

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const rawUrl  = searchParams.get("url") || "";
  const manualRef = searchParams.get("ref") || "";

  if (!rawUrl) {
    return new Response("Missing url param", { status: 400 });
  }

  let targetUrl;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }

  const host = targetUrl.hostname;

  // Security: hanya izinkan domain yang dikenal
  const isAllowed = ALLOWED_HOSTS.some(h => host.endsWith(h) || host === h);
  if (!isAllowed) {
    return new Response("Domain not allowed", { status: 403 });
  }

  const referer = manualRef || getReferer(host) || `https://${host}`;

  try {
    const upstream = await fetch(rawUrl, {
      headers: {
        "Referer":          referer,
        "Origin":           referer,
        "User-Agent":       "Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        "Accept":           "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language":  "id-ID,id;q=0.9,en-US;q=0.8",
        "sec-fetch-dest":   "image",
        "sec-fetch-mode":   "no-cors",
        "sec-fetch-site":   "cross-site",
      },
    });

    if (!upstream.ok) {
      return new Response(`Upstream error: ${upstream.status}`, { status: upstream.status });
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const body = await upstream.arrayBuffer();

    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type":                contentType,
        "Cache-Control":               "public, max-age=86400, s-maxage=604800",
        "Access-Control-Allow-Origin": "*",
        "X-Proxy-By":                  "pankomik",
      },
    });
  } catch (err) {
    return new Response("Fetch failed: " + err.message, { status: 502 });
  }
}
