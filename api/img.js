/**
 * Pankomik — /api/img
 * Proxy gambar dengan multi-strategy bypass Cloudflare Bot Protection.
 *
 * Strategy untuk sakuranovel.id (WordPress + Cloudflare):
 *  1. Deteksi /wp-content/ → redirect ke i0.wp.com (WordPress Jetpack CDN)
 *     i0.wp.com adalah CDN resmi WordPress.com yang whitelist di semua host
 *     → tidak kena Cloudflare hotlink protection sama sekali
 *  2. Non-WP → fetch langsung dengan header bypass
 *  3. Cloudflare blok (403/503/HTML) → redirect ke wsrv.nl
 *  4. Semua gagal → redirect ke weserv.nl
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

const USER_AGENTS = [
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
];

function getReferer(host) {
  for (const [k, v] of Object.entries(REF_MAP)) {
    if (host.includes(k)) return v;
  }
  return "https://" + host;
}

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function toWpCdnUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.pathname.includes("/wp-content/")) {
      const clean = rawUrl.split("?")[0];
      const withoutProto = clean.replace(/^https?:\/\//, "");
      return "https://i0.wp.com/" + withoutProto + "?w=400&ssl=1&quality=85";
    }
  } catch (e) {}
  return null;
}

function wsrvUrl(rawUrl, referer) {
  const clean = rawUrl.split("?")[0];
  return "https://wsrv.nl/?url=" + encodeURIComponent(clean) + "&w=400&output=webp&q=85&n=-1&ref=" + encodeURIComponent(referer);
}

function weservUrl(rawUrl) {
  const clean = rawUrl.split("?")[0].replace(/^https?:\/\//, "");
  return "https://images.weserv.nl/?url=" + encodeURIComponent(clean) + "&w=400&output=webp&q=80";
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  const rawUrl = (req.query && req.query.url || "").trim();
  if (!rawUrl) { res.status(400).send("Missing url param"); return; }

  let targetUrl;
  try { targetUrl = new URL(rawUrl); }
  catch (e) { res.status(400).send("Invalid url"); return; }

  const host = targetUrl.hostname;
  const isAllowed = ALLOWED_HOSTS.some(function(h) { return host === h || host.endsWith("." + h); });
  if (!isAllowed) { res.status(403).send("Domain not allowed: " + host); return; }

  const referer = getReferer(host);

  /* ── Strategy 1: WordPress Jetpack CDN untuk /wp-content/ ── */
  const wpUrl = toWpCdnUrl(rawUrl);
  if (wpUrl) {
    console.log("[api/img] WP site → i0.wp.com:", host);
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800");
    res.redirect(302, wpUrl);
    return;
  }

  /* ── Strategy 2: Fetch langsung dengan header bypass ────── */
  try {
    const https = require("https");
    const http  = require("http");

    const options = {
      headers: {
        "Referer":          referer,
        "Origin":           referer,
        "Host":             host,
        "User-Agent":       randomUA(),
        "Accept":           "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language":  "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding":  "gzip, deflate, br",
        "sec-fetch-dest":   "image",
        "sec-fetch-mode":   "no-cors",
        "sec-fetch-site":   "same-site",
        "Cache-Control":    "no-cache",
        "Connection":       "keep-alive",
      },
    };

    function fetchWithRedirect(url, hops) {
      if (hops > 6) return Promise.reject(new Error("Too many redirects"));
      return new Promise(function(resolve, reject) {
        var lib = url.startsWith("https") ? https : http;
        var r = lib.get(url, options, function(upstream) {
          if ([301, 302, 303, 307, 308].includes(upstream.statusCode)) {
            var loc = upstream.headers["location"];
            if (!loc) return reject(new Error("Redirect without location"));
            var next = loc.startsWith("http") ? loc : new URL(loc, url).href;
            upstream.resume();
            resolve(fetchWithRedirect(next, hops + 1));
          } else {
            resolve(upstream);
          }
        });
        r.on("error", reject);
        r.setTimeout(7000, function() { r.destroy(); reject(new Error("Timeout")); });
      });
    }

    var upstream = await fetchWithRedirect(rawUrl, 0);
    var status   = upstream.statusCode || 200;
    var ct       = upstream.headers["content-type"] || "";

    if (status === 403 || status === 503 || status === 429 || ct.includes("text/html")) {
      upstream.resume();
      console.warn("[api/img] Blocked (" + status + ") → wsrv.nl:", host);
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.redirect(302, wsrvUrl(rawUrl, referer));
      return;
    }

    if (status >= 400) {
      upstream.resume();
      console.warn("[api/img] Error " + status + " → weserv.nl:", host);
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.redirect(302, weservUrl(rawUrl));
      return;
    }

    res.setHeader("Content-Type", ct || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=604800");
    res.setHeader("X-Proxy-By", "pankomik-direct");
    upstream.pipe(res);

  } catch (err) {
    console.error("[api/img] Error:", err.message, "→ wsrv.nl");
    try {
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.redirect(302, wsrvUrl(rawUrl, referer));
    } catch (e2) {
      res.status(502).send("Proxy error: " + err.message);
    }
  }
};
