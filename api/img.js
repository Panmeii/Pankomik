/**
 * Pankomik — /api/img
 * Node.js Serverless Function untuk proxy gambar bypass hotlink.
 * Deploy: simpan sebagai api/img.js di root repo Vercel.
 * Usage: /api/img?url=https://sakuranovel.id/wp-content/...
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

function getReferer(host) {
  for (const [k, v] of Object.entries(REF_MAP)) {
    if (host.includes(k)) return v;
  }
  return `https://${host}`;
}

module.exports = async function handler(req, res) {
  // CORS preflight
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  const rawUrl = req.query?.url || "";
  if (!rawUrl) {
    res.status(400).send("Missing url param");
    return;
  }

  let targetUrl;
  try {
    targetUrl = new URL(rawUrl);
  } catch {
    res.status(400).send("Invalid url");
    return;
  }

  const host = targetUrl.hostname;
  const isAllowed = ALLOWED_HOSTS.some(h => host === h || host.endsWith("." + h));
  if (!isAllowed) {
    res.status(403).send("Domain not allowed: " + host);
    return;
  }

  const referer = getReferer(host);

  try {
    const https = require("https");
    const http  = require("http");
    const lib   = rawUrl.startsWith("https") ? https : http;

    const options = {
      headers: {
        "Referer":         referer,
        "Origin":          referer,
        "User-Agent":      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
        "Accept":          "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "sec-fetch-dest":  "image",
        "sec-fetch-mode":  "no-cors",
        "sec-fetch-site":  "same-site",
        "Cache-Control":   "no-cache",
        "Pragma":          "no-cache",
      },
    };

    // Follow redirects manually (up to 5)
    async function fetchWithRedirect(url, hops) {
      if (hops > 5) throw new Error("Too many redirects");
      return new Promise((resolve, reject) => {
        const lib2 = url.startsWith("https") ? https : http;
        const r = lib2.get(url, options, (upstream) => {
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
        r.setTimeout(8000, () => { r.destroy(); reject(new Error("Timeout")); });
      });
    }

    const upstream = await fetchWithRedirect(rawUrl, 0);

    if (upstream.statusCode && upstream.statusCode >= 400) {
      res.status(upstream.statusCode).send("Upstream error: " + upstream.statusCode);
      return;
    }

    const ct = upstream.headers["content-type"] || "image/jpeg";
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800");
    res.setHeader("X-Proxy-By", "pankomik");

    upstream.pipe(res);
  } catch (err) {
    console.error("[api/img] error:", err.message);
    res.status(502).send("Proxy error: " + err.message);
  }
};
