/**
 * Pankomik — /api/img
 * Proxy gambar dengan multi-strategy bypass Cloudflare Bot Protection.
 *
 * Strategy (server-side):
 *  1. Fetch langsung dengan header Cloudflare-bypass lengkap
 *  2. Jika gagal (403/503/challenge) → redirect ke wsrv.nl (CDN whitelist)
 *  3. Jika wsrv.nl juga gagal → redirect ke images.weserv.nl
 *
 * Deploy: simpan sebagai api/img.js di root repo Vercel.
 * Usage : /api/img?url=https://sakuranovel.id/wp-content/...
 */

const ALLOWED_HOSTS = [
  "sakuranovel.id", "sakuranovel.com",
  "komikindo.org", "komikindo.id",
  "komikcast.me", "komikcast.io",
  "komiku.id", "komiku.me",
  "manhwaindo.id", "manhwaindo.com",
  "mangatale.co", "westmanga.info",
  "shinigami.id", "kiryuu.id", "mgkomik.id",
  "bacakomik.me", "novelringan.com",
  "i0.wp.com", "i1.wp.com", "i2.wp.com", "i3.wp.com",
  "lh3.googleusercontent.com", "cdn.discordapp.com",
  "cdn.myanimelist.net", "cdn.noitatnemucod.net",
  "s4.anilist.co", "media.kitsu.io",
];

const REF_MAP = {
  "sakuranovel": "https://sakuranovel.id",
  "komikindo":   "https://komikindo.org",
  "komikcast":   "https://komikcast.me",
  "komiku":      "https://komiku.id",
  "manhwaindo":  "https://manhwaindo.id",
  "mangatale":   "https://mangatale.co",
  "westmanga":   "https://westmanga.info",
  "shinigami":   "https://shinigami.id",
  "kiryuu":      "https://kiryuu.id",
  "mgkomik":     "https://mgkomik.id",
  "bacakomik":   "https://bacakomik.me",
  "novelringan": "https://novelringan.com",
};

/* Rotate UA agar tidak mudah di-fingerprint */
const USER_AGENTS = [
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 12; SAMSUNG SM-A536B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36",
];

function getReferer(host) {
  for (const [k, v] of Object.entries(REF_MAP)) {
    if (host.includes(k)) return v;
  }
  return `https://${host}`;
}

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/* Buat URL wsrv.nl dengan referer yang tepat */
function wsrvUrl(rawUrl, referer) {
  const clean = rawUrl.split("?")[0];
  return (
    "https://wsrv.nl/?url=" +
    encodeURIComponent(clean) +
    "&w=400&output=webp&q=85&n=-1" +
    "&ref=" + encodeURIComponent(referer)
  );
}

/* Buat URL weserv.nl fallback */
function weservUrl(rawUrl) {
  const clean = rawUrl.split("?")[0].replace(/^https?:\/\//, "");
  return (
    "https://images.weserv.nl/?url=" +
    encodeURIComponent(clean) +
    "&w=400&output=webp&q=80"
  );
}

module.exports = async function handler(req, res) {
  /* CORS */
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const rawUrl = (req.query?.url || "").trim();
  if (!rawUrl) { res.status(400).send("Missing url param"); return; }

  let targetUrl;
  try { targetUrl = new URL(rawUrl); }
  catch { res.status(400).send("Invalid url"); return; }

  const host = targetUrl.hostname;
  const isAllowed = ALLOWED_HOSTS.some(h => host === h || host.endsWith("." + h));
  if (!isAllowed) { res.status(403).send("Domain not allowed: " + host); return; }

  const referer = getReferer(host);

  /* ── Strategi 1: Fetch langsung dengan header bypass ────── */
  try {
    const https = require("https");
    const http  = require("http");

    const makeOptions = () => ({
      headers: {
        "Referer":                  referer,
        "Origin":                   referer,
        "Host":                     host,
        "User-Agent":               randomUA(),
        "Accept":                   "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language":          "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding":          "gzip, deflate, br",
        "sec-ch-ua":                '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        "sec-ch-ua-mobile":         "?1",
        "sec-ch-ua-platform":       '"Android"',
        "sec-fetch-dest":           "image",
        "sec-fetch-mode":           "no-cors",
        "sec-fetch-site":           "same-site",
        "Cache-Control":            "no-cache",
        "Pragma":                   "no-cache",
        "DNT":                      "1",
        "Connection":               "keep-alive",
      },
    });

    async function fetchWithRedirect(url, hops) {
      if (hops > 6) throw new Error("Too many redirects");
      return new Promise((resolve, reject) => {
        const lib = url.startsWith("https") ? https : http;
        const r = lib.get(url, makeOptions(), (upstream) => {
          if ([301, 302, 303, 307, 308].includes(upstream.statusCode)) {
            const loc = upstream.headers["location"];
            if (!loc) return reject(new Error("Redirect without location"));
            const next = loc.startsWith("http") ? loc : new URL(loc, url).href;
            upstream.resume();
            resolve(fetchWithRedirect(next, hops + 1));
          } else {
            resolve(upstream);
          }
        });
        r.on("error", reject);
        r.setTimeout(7000, () => { r.destroy(); reject(new Error("Timeout")); });
      });
    }

    const upstream = await fetchWithRedirect(rawUrl, 0);
    const status   = upstream.statusCode || 200;

    /* Cloudflare challenge / blok → coba strategi 2 (wsrv.nl redirect) */
    if (status === 403 || status === 503 || status === 429 || status === 401) {
      console.warn(`[api/img] Direct blocked (${status}), redirecting to wsrv.nl:`, host);
      upstream.resume(); /* drain response */
      /* Server-side redirect ke wsrv.nl — CDN ini punya IP whitelist */
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.redirect(302, wsrvUrl(rawUrl, referer));
      return;
    }

    if (status >= 400) {
      /* Error lain → coba weserv.nl */
      upstream.resume();
      console.warn(`[api/img] Direct error (${status}), redirecting to weserv.nl:`, host);
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.redirect(302, weservUrl(rawUrl));
      return;
    }

    const ct = upstream.headers["content-type"] || "image/jpeg";
    /* Pastikan ini benar-benar gambar, bukan HTML challenge page */
    if (ct.includes("text/html")) {
      upstream.resume();
      console.warn("[api/img] Got HTML (Cloudflare challenge), redirecting to wsrv.nl:", host);
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.redirect(302, wsrvUrl(rawUrl, referer));
      return;
    }

    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800");
    res.setHeader("X-Proxy-By", "pankomik-direct");
    upstream.pipe(res);

  } catch (err) {
    console.error("[api/img] Fetch error:", err.message, "→ fallback wsrv.nl");
    /* Network error → redirect ke wsrv.nl */
    try {
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.redirect(302, wsrvUrl(rawUrl, referer));
    } catch (e2) {
      res.status(502).send("Proxy error: " + err.message);
    }
  }
};
