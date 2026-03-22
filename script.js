/* ============================================================
   PANKOMIK — script.js  (Enhanced)
   Halaman utama: Top Komik, Update Terbaru, Rekomendasi, Genre

   PERUBAHAN:
   - Image proxy konsisten (weserv → wsrv fallback → direct)
   - Kartu komik punya transisi & animasi masuk (fade-in bertahap)
   - Live search: debounce 350ms, highlight query, loading state
   - Genre chips: animasi masuk bertahap
   - Load-more: intersection observer (infinite scroll halus)
   - Toast lebih informatif
   - Tidak ada lebih dari satu window.onload — pakai DOMContentLoaded
   ============================================================ */

/* ── API ENDPOINTS ──────────────────────────────────────── */
const API_TOP         = "https://www.sankavollerei.com/comic/bacakomik/top";
const API_LATEST      = "https://www.sankavollerei.com/comic/komikindo/latest";
const API_LATEST_MK   = "https://www.sankavollerei.com/comic/mangakita/home";
const API_LATEST_KS   = "https://www.sankavollerei.com/comic/komikstation/home"; /* komikstation */
const API_REKOM       = "https://www.sankavollerei.com/comic/bacakomik/recomen";
const API_SEARCH      = "https://www.sankavollerei.com/comic/bacakomik/search/";
const API_GENRES      = "https://www.sankavollerei.com/comic/komikindo/genres";

/* ── URL BUILDERS ───────────────────────────────────────── */
function komikURL(slug)               { return `/komik/${slug}`; }
function readerURL(chSlug, komikSlug) { return komikSlug ? `/komik/${komikSlug}/${chSlug}` : `/baca/${chSlug}`; }

/* ── IMAGE PROXY ────────────────────────────────────────── */
/**
 * Proxy chain: wsrv.nl (paling stabil) → imageproxy → direct
 * weserv.nl dihapus karena sering rate-limit & blokir.
 */

/* ── Domain → Referer map untuk bypass hotlink protection ── */
const DOMAIN_REF_MAP = {
  "komikindo":   "https://komikindo.org",
  "komikcast":   "https://komikcast.me",
  "komiku":      "https://komiku.id",
  "manhwaindo":  "https://manhwaindo.id",
  "bacakomik":   "https://bacakomik.me",
  "mangatale":   "https://mangatale.co",
  "westmanga":   "https://westmanga.info",
  "shinigami":   "https://shinigami.id",
  "sakuranovel": "https://sakuranovel.id",
  "novelringan": "https://novelringan.com",
  "mangakita":   "https://mangakita.me",
  "bacakomik.my":"https://bacakomik.my",
  "i0.wp.com":   "https://mangakita.me",
  "i1.wp.com":   "https://mangakita.me",
  "i2.wp.com":   "https://mangakita.me",
  "i3.wp.com":   "https://mangakita.me",
  "kiryuu":      "https://kiryuu.id",
  "mgkomik":     "https://mgkomik.id",
  /* ── KomikStation CDN ── */
  "komikstation":"https://komikstation.com",
  "cdn.komikstation":"https://komikstation.com",
  "asset.komikstation":"https://komikstation.com",
  "img.komikstation":  "https://komikstation.com",
};

function getReferer(url) {
  if (!url) return "";
  try {
    const host = new URL(url.startsWith("http") ? url : "https://" + url).hostname;
    for (const [key, ref] of Object.entries(DOMAIN_REF_MAP)) {
      if (host.includes(key)) return ref;
    }
    return "https://" + host; // fallback: domain itu sendiri
  } catch { return ""; }
}

function buildWsrv(rawUrl, w, withRef) {
  const clean = rawUrl.split("?")[0];
  let q = `https://wsrv.nl/?url=${encodeURIComponent(clean)}&w=${w}&output=webp&q=85&n=-1`;
  if (withRef) {
    const ref = getReferer(clean);
    if (ref) q += `&ref=${encodeURIComponent(ref)}`;
  }
  return q;
}

function proxyImg(url, w = 300) {
  if (!url) return "";
  if (url.startsWith("data:") || url.includes("wsrv.nl") || url.includes("weserv.nl")) return url;
  if (url.includes("proxy.sankavolereii.my.id")) return url;
  /* KomikStation: langsung pakai proxy.sankavolereii.my.id — lebih reliable dari wsrv */
  const cleanUrl = url.split("?")[0];
  if (cleanUrl.includes("komikstation")) {
    return "https://proxy.sankavolereii.my.id/" + cleanUrl;
  }
  return buildWsrv(url, w, true);
}

function safeCover(komik, w = 300) {
  const raw = komik?.image || komik?.cover || komik?.thumbnail || "";
  /* Skip SVG placeholder kosong yang dikembalikan beberapa API */
  if (!raw || raw.startsWith("data:image/svg") || raw.startsWith("data:image/gif")) return "";
  return proxyImg(raw.split("?")[0], w);
}

/* Generated cover berwarna berdasarkan hash judul */
function _hashColor(str) {
  const colors = [
    ["#e8522a","#ffd0c0"],["#8e44ad","#e8daef"],["#2980b9","#d6eaf8"],
    ["#27ae60","#d5f5e3"],["#e67e22","#fdebd0"],["#c0392b","#fadbd8"],
    ["#16a085","#d1f2eb"],["#2c3e50","#d5d8dc"],["#6c3483","#e8daef"],
    ["#1a5276","#d6eaf8"],["#784212","#fdebd0"],["#0e6655","#d1f2eb"],
  ];
  let h = 0;
  for (let i = 0; i < (str||"").length; i++) h = ((h<<5)-h) + str.charCodeAt(i);
  return colors[Math.abs(h) % colors.length];
}

function makeGeneratedCover(title, type, height) {
  const c = _hashColor(title);
  const words = (title||"Komik").trim().split(/\s+/);
  const initials = words.slice(0,2).map(w => (w[0]||"").toUpperCase()).join("");
  const short = words.slice(0,3).join(" ").slice(0,16);
  const emoji = {manhwa:"🇰🇷",manhua:"🇨🇳",manga:"🇯🇵"}[(type||"").toLowerCase()] || "📚";
  const d = document.createElement("div");
  d.style.cssText = [
    `width:100%`,`height:${height||155}px`,
    `background:linear-gradient(145deg,${c[0]},${c[0]}cc)`,
    `display:flex`,`flex-direction:column`,`align-items:center`,`justify-content:center`,
    `gap:4px`,`border-radius:inherit`,`flex-shrink:0`,`overflow:hidden`,
  ].join(";");
  d.innerHTML =
    `<span style="font-size:22px;line-height:1;">${emoji}</span>` +
    `<span style="font-size:18px;font-weight:900;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,.5);letter-spacing:1px;">${escHtml(initials)}</span>` +
    `<span style="font-size:8px;font-weight:700;color:rgba(255,255,255,.85);text-align:center;padding:0 4px;line-height:1.3;max-width:90%;">${escHtml(short)}</span>`;
  return d;
}

/**
 * imgFallback — chain berdasarkan domain:
 *
 * KomikStation (initial = proxy.sankavolereii):
 *   step 1: wsrv tanpa ref
 *   step 2: direct URL
 *   step 3: placeholder
 *
 * Domain lain (initial = wsrv+ref):
 *   step 1: wsrv tanpa ref
 *   step 2: proxy.sankavolereii.my.id
 *   step 3: direct URL
 *   step 4: placeholder
 */
function imgFallback(img, originalUrl) {
  if (!originalUrl || img.dataset.fallbackSet) return;
  img.dataset.fallbackSet = "1";
  const clean = originalUrl.split("?")[0];
  const isKS  = clean.includes("komikstation");
  let step = 0;

  function tryNext() {
    step++;
    img.onerror = null;
    if (isKS) {
      /* KomikStation: sankavolereii sudah dicoba di initial → wsrv → direct → placeholder */
      switch (step) {
        case 1: img.onerror = tryNext; img.src = buildWsrv(clean, 300, false); break;
        case 2: img.onerror = tryNext; img.src = clean; break;
        default: showImgPlaceholder(img);
      }
    } else {
      /* Domain lain: wsrv+ref sudah dicoba di initial */
      switch (step) {
        case 1: img.onerror = tryNext; img.src = buildWsrv(clean, 300, false); break;
        case 2: img.onerror = tryNext; img.src = "https://proxy.sankavolereii.my.id/" + clean; break;
        case 3: img.onerror = tryNext; img.src = clean; break;
        default: showImgPlaceholder(img);
      }
    }
  }

  img.onerror = tryNext;
}

function showImgPlaceholder(img) {
  img.onerror = null;
  const h  = img.offsetHeight || 155;
  const ph = document.createElement("div");
  ph.style.cssText = `width:100%;height:${h}px;background:var(--bg-surface);display:flex;align-items:center;justify-content:center;font-size:32px;color:var(--text-muted);border-radius:inherit;flex-shrink:0;`;
  ph.textContent = "📚";
  if (img.parentNode) img.parentNode.replaceChild(ph, img);
}


/* ── Normalize mangakita latestReleases item → format komikindo ── */
function normalizeMKLatest(k) {
  /* latestReleases: {title, slug, image, chapters:[{title,slug,time}]} */
  const chapters = (k.chapters || []).map(ch => ({
    title: ch.title || "",
    slug:  ch.slug  || "",
    date:  ch.time  || "",
  }));
  return {
    title:    k.title || "Untitled",
    slug:     k.slug  || "",
    image:    k.image || k.banner || "",
    type:     k.type  || "Manga",
    rating:   k.rating || "",
    chapters: chapters,
    _src:     "mangakita",
  };
}

/* ── Normalize komikstation latestUpdates item ── */
function normalizeKSLatest(k) {
  /* latestUpdates: {title, slug, imageSrc, chapters:[{slug,title,timeAgo}]} */
  const chapters = (k.chapters || []).map(ch => ({
    title: ch.title || "",
    slug:  ch.slug  || "",
    date:  ch.timeAgo || "",
  }));
  /* imageSrc bisa jadi SVG placeholder — skip kalau SVG */
  const rawImg = k.imageSrc || "";
  const image  = rawImg.startsWith("data:image/svg") ? "" : rawImg;
  return {
    title:    k.title || "Untitled",
    slug:     k.slug  || "",
    image,
    type:     k.type  || "Manga",
    rating:   k.rating || "",
    chapters,
    _src:     "komikstation",
  };
}

/* ── Ekstrak angka chapter dari title/slug ───────────────── */
function extractChapterNum(str) {
  if (!str) return -1;
  /* Coba dari title: "Chapter 123", "Ch.45", "Chapter 12.5" */
  const m = str.match(/(?:chapter|ch\.?)\s*([\d]+(?:[.,][\d]+)?)/i)
    || str.match(/([\d]+(?:[.,][\d]+)?)$/);
  return m ? parseFloat(m[1].replace(",", ".")) : -1;
}

/* ── Format chapter number jadi "Ch.01", "Ch.123", "Ch.12.5" ── */
function formatChapterLabel(chTitle, chSlug) {
  /* Coba ekstrak angka dari title dulu, lalu dari slug */
  const raw = chTitle || chSlug || "";
  const m = raw.match(/(?:chapter|ch\.?)\s*([\d]+(?:[.,][\d]+)?)/i)
    || raw.match(/chapter[_-]?([\d]+(?:[._-][\d]+)?)/i);
  if (!m) return chTitle || "–";          /* Tidak ada angka, tampilkan apa adanya */
  const num = m[1].replace(/[_-]/g, ".");
  /* Pad angka utama ke minimal 2 digit jika <= 99 */
  const [main, sub] = num.split(".");
  const padded = parseInt(main) < 100 ? main.padStart(2, "0") : main;
  return sub ? `Ch.${padded}.${sub}` : `Ch.${padded}`;
}

/* ── parseUpdateScore — konversi string tanggal/waktu ke angka untuk dibandingkan ──
   Makin besar angkanya = makin baru updatenya.
   Mendukung format:
   - Relatif: "2 hours ago", "3 hari lalu", "kemarin", "just now", "baru saja"
   - Absolut: "2024-01-15", "15 Jan 2024", "Jan 15, 2024"
   - Fallback: chapter number (kalau tidak ada tanggal)
── */
function parseUpdateScore(dateStr, chapterNum) {
  const now = Date.now();
  const s   = (dateStr || "").toLowerCase().trim();

  if (!s) return chapterNum ?? -1;

  /* ── Relatif: "X unit ago" / "X unit lalu" ── */
  const relMatch = s.match(/(\d+)\s*(second|menit|minute|jam|hour|hari|day|minggu|week|bulan|month|tahun|year)/i);
  if (relMatch) {
    const n    = parseInt(relMatch[1]);
    const unit = relMatch[2].toLowerCase();
    const msMap = {
      second:1000, menit:60000, minute:60000,
      jam:3600000, hour:3600000,
      hari:86400000, day:86400000,
      minggu:604800000, week:604800000,
      bulan:2592000000, month:2592000000,
      tahun:31536000000, year:31536000000,
    };
    const ms = msMap[unit] || 86400000;
    return now - (n * ms); /* timestamp perkiraan */
  }

  /* ── "just now" / "baru saja" / "kemarin" / "yesterday" ── */
  if (/just now|baru saja|barusan/.test(s)) return now;
  if (/kemarin|yesterday/.test(s))          return now - 86400000;
  if (/hari ini|today/.test(s))             return now - 3600000;

  /* ── Absolut: coba parse sebagai Date ── */
  const parsed = Date.parse(dateStr);
  if (!isNaN(parsed)) return parsed;

  /* ── Fallback: gunakan chapter number ── */
  return chapterNum ?? -1;
}

/* ── mergeAllFlat — gabung semua list dari semua API sekaligus ──────────
   - Deduplicate by slug (primary) DAN title normalize (secondary)
   - Kalau slug sama dari >1 API → ambil yang UPDATE-nya PALING BARU
   - Kalau title sama tapi slug berbeda (KomikStation vs lain) → merge juga
   - Cover: kalau pemenang tidak punya cover → tambal dari entri lain
   - _src: ikut pemenang
── */

/* Normalize title untuk dedup: lowercase, hapus karakter non-alfanumerik, trim */
function normalizeTitle(t) {
  return (t || "").toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")   /* hapus tanda baca */
    .replace(/\s+/g, " ")           /* collapse spasi */
    .trim()
    .slice(0, 60);                  /* max 60 char untuk keamanan */
}

function mergeAllFlat(allItems) {
  const slugMap  = new Map(); /* slug → best entry */
  const titleMap = new Map(); /* normalizedTitle → slug di slugMap */

  for (const k of allItems) {
    if (!k.slug) continue;

    const ch      = (k.chapters && k.chapters[0]) || {};
    const chStr   = ch.title || ch.slug || k.chapter || k.ch || "";
    const dateStr = ch.date  || ch.time || ch.timeAgo || k.date || k.time || "";
    const chNum   = extractChapterNum(chStr);
    const score   = parseUpdateScore(dateStr, chNum);
    const normT   = normalizeTitle(k.title);

    /* ── Cek apakah sudah ada entry dengan title yang sama (tapi mungkin slug beda) ── */
    const existingSlugByTitle = normT ? titleMap.get(normT) : null;
    const canonSlug = existingSlugByTitle || k.slug;

    if (!slugMap.has(canonSlug)) {
      /* Entry baru */
      slugMap.set(canonSlug, { ...k, slug: canonSlug, _score: score, _origSlug: k.slug });
      if (normT) titleMap.set(normT, canonSlug);
    } else {
      const ex = slugMap.get(canonSlug);

      /* Cover terbaik: pilih yang bukan SVG/GIF placeholder */
      const isCoverOk = (url) => url && !url.startsWith("data:image/svg") && !url.startsWith("data:image/gif");
      const coverNew  = k.image   || k.cover || "";
      const coverEx   = ex.image  || ex.cover || "";
      const bestCover = isCoverOk(coverNew) ? coverNew : (isCoverOk(coverEx) ? coverEx : "");

      if (score > (ex._score ?? -Infinity)) {
        /* Entry baru lebih fresh — menang, pertahankan cover terbaik */
        slugMap.set(canonSlug, {
          ...k,
          slug:       canonSlug,
          _score:     score,
          _origSlug:  k.slug,
          image:      bestCover,
        });
      } else {
        /* Entry lama lebih fresh — tapi tambal cover kalau kosong */
        if (!isCoverOk(coverEx) && isCoverOk(coverNew)) {
          slugMap.set(canonSlug, { ...ex, image: bestCover });
        }
      }
    }
  }

  return Array.from(slugMap.values()).map(({ _score, _origSlug, ...rest }) => rest);
}

/* Alias untuk kompatibilitas */
function mergeLatestLists(a, b) { return mergeAllFlat([...a, ...b]); }
function mergeNonKS(a, b)       { return mergeAllFlat([...a, ...b]); }

/* ── Cache hasil cek KomikStation (slug → "ks" | "original") ──
   Agar tidak re-fetch tiap kali user hover/klik kartu yang sama ── */
const _ksCheckCache = new Map();

/**
 * Cek apakah komik dengan slug ini ada di KomikStation.
 * Return: "komikstation" kalau ada, atau src aslinya kalau tidak ada.
 * Hasil di-cache agar hanya fetch 1x per slug per sesi.
 */
async function resolveSource(slug, originalSrc) {
  /* Kalau sudah pernah dicek → pakai cache */
  if (_ksCheckCache.has(slug)) return _ksCheckCache.get(slug);

  /* Kalau source aslinya sudah KS → tidak perlu cek lagi */
  if (originalSrc === "komikstation") {
    _ksCheckCache.set(slug, "komikstation");
    return "komikstation";
  }

  try {
    const res = await fetch(
      `https://www.sankavollerei.com/comic/komikstation/manga/${slug}`,
      { signal: AbortSignal.timeout(4000) } /* timeout 4 detik */
    );
    const json = await res.json();
    /* KomikStation punya data kalau: success=true DAN punya chapters */
    const hasData = json?.success && Array.isArray(json?.chapters) && json.chapters.length > 0;
    const resolved = hasData ? "komikstation" : (originalSrc || "komikindo");
    _ksCheckCache.set(slug, resolved);
    console.log(`[KS-Check] ${slug} → ${resolved} (ks=${hasData})`);
    return resolved;
  } catch (e) {
    /* Timeout / error → fallback ke source asli */
    _ksCheckCache.set(slug, originalSrc || "komikindo");
    return originalSrc || "komikindo";
  }
}
/** Tambahkan style animasi fade-in ke sebuah elemen */
function animateIn(el, delay = 0) {
  el.style.opacity = "0";
  el.style.transform = "translateY(12px)";
  el.style.transition = `opacity 0.35s ${delay}ms ease, transform 0.35s ${delay}ms ease`;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
  }));
}

/* ── PAGINATION STATE ───────────────────────────────────── */
let latestPage    = 1;
let hasNextPage   = false;
let isLoadingMore = false;
let ioObserver    = null; /* IntersectionObserver untuk infinite scroll sentinel */

/* ============================================================
   TOP KOMIK
   ============================================================ */
async function getTopKomik() {
  const container = document.getElementById("topKomik");
  if (!container) return;

  /* Skeleton */
  container.innerHTML = Array(6).fill(`<div class="card skeleton skeleton-card"></div>`).join("");

  try {
    const res  = await fetch(API_TOP);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    container.innerHTML = "";
    renderTopKomik(data.komikList || [], container);
  } catch (err) {
    console.error("[Top] Gagal:", err);
    container.innerHTML = `
      <div style="padding:20px 14px;color:var(--text-muted);font-size:13px;display:flex;flex-direction:column;gap:8px;">
        <p>😕 Gagal memuat Top Komik</p>
        <button onclick="getTopKomik()" style="align-self:flex-start;padding:6px 14px;background:var(--accent);color:#fff;border:none;border-radius:7px;cursor:pointer;font-family:'Nunito',sans-serif;font-size:12px;font-weight:700;">Coba Lagi</button>
      </div>`;
  }
}

function renderTopKomik(list, container) {
  list.slice(0, 10).forEach((komik, i) => {
    if (!komik?.slug) return;
    const rawImg  = komik.image || komik.cover || "";
    const isSvg   = !rawImg || rawImg.startsWith("data:image/svg") || rawImg.startsWith("data:image/gif");
    const origUrl = isSvg ? "" : rawImg.split("?")[0];
    const cover   = origUrl ? proxyImg(origUrl, 260) : "";
    const card    = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <div class="rank">#${i + 1}</div>
      ${cover
        ? `<img src="${cover}" alt="${escHtml(komik.title || "")}" loading="${i < 3 ? "eager" : "lazy"}" style="background:var(--bg-surface);">`
        : `<div class="card-generated-cover" data-title="${escHtml(komik.title||"")}" data-type="${escHtml(komik.type||"")}"></div>`}
      <div class="info">
        <p class="card-title">${escHtml(komik.title || "Untitled")}</p>
        <p>⭐ ${komik.rating || "–"}</p>
      </div>`;

    if (cover && origUrl) {
      const img = card.querySelector("img");
      if (img) imgFallback(img, origUrl);
    } else if (!cover) {
      const ph = card.querySelector(".card-generated-cover");
      if (ph) ph.parentNode.replaceChild(makeGeneratedCover(komik.title, komik.type, 175), ph);
    }

    card.onclick = async () => {
      card.style.opacity = "0.7";
      card.style.pointerEvents = "none";
      const resolvedSrc = await resolveSource(komik.slug, "bacakomik");
      sessionStorage.setItem("komikSrcHint", resolvedSrc);
      sessionStorage.setItem("komikSrcSlug", komik.slug);
      window.location.href = komikURL(komik.slug);
    };
    container.appendChild(card);
    animateIn(card, i * 40);
  });
}

/* ============================================================
   LATEST UPDATE
   ============================================================ */
async function getKomikLatest() {
  const container = document.getElementById("komikLatest");
  if (!container) return;

  latestPage  = 1;
  hasNextPage = false;
  container.innerHTML = Array(4).fill(`<div class="grid-card skeleton skeleton-grid"></div>`).join("");

  /* Fetch 3 API paralel */
  const [res1, res2, res3] = await Promise.allSettled([
    fetch(`${API_LATEST}/${latestPage}`).then(r => r.json()).catch(() => null),
    fetch(API_LATEST_MK).then(r => r.json()).catch(() => null),
    fetch(API_LATEST_KS).then(r => r.json()).catch(() => null),
  ]);

  const data1 = res1.status === "fulfilled" ? res1.value : null;
  const data2 = res2.status === "fulfilled" ? res2.value : null;
  const data3 = res3.status === "fulfilled" ? res3.value : null;

  /* List dari komikindo */
  const list1 = (data1?.komikList || data1?.data || data1?.comics || [])
    .map(k => ({ ...k, _src: k._src || "komikindo" }));

  /* List dari mangakita */
  const list2mk = (data2?.latestReleases || []).map(normalizeMKLatest);

  /* List dari komikstation — pakai latestUpdates */
  const list3ks = (data3?.latestUpdates || []).map(normalizeKSLatest);

  /* ── Merge semua 3 API secara flat — deduplicate by slug.
     Kalau slug sama dari beberapa API → ambil yang UPDATE-nya paling baru
     (berdasarkan tanggal/waktu chapter terbaru).
     Cover: kalau yang menang tidak punya cover → tambal dari sumber lain.
  ── */
  const merged = mergeAllFlat([...list1, ...list2mk, ...list3ks]);

  /* Urutkan hasil merge dari yang paling baru updatenya */
  merged.sort((a, b) => {
    const getScore = k => {
      const ch  = (k.chapters && k.chapters[0]) || {};
      const dat = ch.date || ch.time || ch.timeAgo || k.date || k.time || "";
      const chStr = ch.title || ch.slug || "";
      return parseUpdateScore(dat, extractChapterNum(chStr));
    };
    return getScore(b) - getScore(a); /* descending: terbaru di atas */
  });

  console.log(`[Latest] KI=${list1.length} MK=${list2mk.length} KS=${list3ks.length} → merged=${merged.length} (sorted by date)`);

  if (!merged.length) {
    container.innerHTML = `<p style="grid-column:1/-1;padding:20px;color:var(--text-muted);text-align:center;font-size:13px;">😕 Gagal memuat konten terbaru.</p>`;
    return;
  }

  container.innerHTML = "";
  renderLatest(merged, container);

  /* ── Patch cover untuk KomikStation-only entries (imageSrc = SVG placeholder) ──
     Fetch /manga/{slug} secara batch paralel, max 6 sekaligus agar tidak spam.
     Setelah dapat cover asli, update img element yang sudah dirender. */
  const noCoverKS = merged.filter(k =>
    k._src === "komikstation" &&
    (!k.image || k.image.startsWith("data:image/svg") || k.image.startsWith("data:image/gif"))
  );
  if (noCoverKS.length > 0) {
    patchKSCovers(noCoverKS, container);
  }

  /* hasNextPage: true kalau komikindo masih ada halaman berikutnya */
  hasNextPage = data1?.pagination?.hasNextPage ?? data1?.hasNextPage ?? (list1.length >= 10);
  updateLoadMoreUI();
  setupInfiniteScroll();
}

/**
 * patchKSCovers — fetch cover asli dari /manga/{slug} untuk KomikStation entries
 * yang tidak punya cover (imageSrc = SVG placeholder dari /home endpoint).
 * Dijalankan background setelah kartu sudah dirender dengan generated cover.
 *
 * @param {Array}  entries   - komik KomikStation tanpa cover
 * @param {Element} container - DOM container tempat kartu dirender
 */
async function patchKSCovers(entries, container) {
  const BASE_KS_DETAIL = "https://www.sankavollerei.com/comic/komikstation/manga";
  const BATCH = 6; /* max paralel fetch */

  for (let i = 0; i < entries.length; i += BATCH) {
    const batch = entries.slice(i, i + BATCH);
    const results = await Promise.allSettled(
      batch.map(k =>
        fetch(`${BASE_KS_DETAIL}/${k.slug}`, { signal: AbortSignal.timeout(5000) })
          .then(r => r.json())
          .catch(() => null)
      )
    );

    results.forEach((res, idx) => {
      if (res.status !== "fulfilled" || !res.value) return;
      const d = res.value;
      /* Response: { success, imageSrc, title, ... } atau { data: { imageSrc, ... } } */
      const rawCover = d.imageSrc || d.image || d.cover || d.data?.imageSrc || d.data?.image || "";
      if (!rawCover || rawCover.startsWith("data:image/svg")) return;

      const slug = batch[idx].slug;
      const proxied = "https://proxy.sankavolereii.my.id/" + rawCover.split("?")[0];

      /* Cari kartu di DOM berdasarkan slug — kartu menyimpan slug di onclick atau data attr */
      const allCards = container.querySelectorAll(".grid-card");
      allCards.forEach(card => {
        /* Cek apakah kartu ini untuk slug yang tepat */
        const onclickStr = card.getAttribute("onclick") || card.querySelector("[data-slug]")?.dataset?.slug || "";
        /* Cara lebih reliable: cek title di card-info */
        const titleEl = card.querySelector(".title");
        if (!titleEl) return;

        /* Cari berdasarkan dataset slug yang kita set saat render */
        if (card.dataset.slug !== slug) return;

        /* Temukan img atau generated cover di kartu ini */
        const existingImg = card.querySelector("img");
        const genCover    = card.querySelector(".card-gen-cover-el");

        if (genCover) {
          /* Ganti generated cover dengan img asli.
             Tidak perlu inline style — .grid-card img di style.css sudah handle
             aspect-ratio:3/4, object-fit:cover, width:100% */
          const img = document.createElement("img");
          img.src = proxied;
          img.alt = titleEl.textContent || "";
          img.loading = "lazy";
          img.onerror = () => { img.onerror = null; /* biarkan generated cover tetap */ };
          genCover.parentNode.replaceChild(img, genCover);
        } else if (existingImg && !existingImg.src.includes("proxy.sankavolereii")) {
          existingImg.src = proxied;
        }
      });
    });
  }
}

/* ── Render & append kartu latest ── */
function renderLatest(list, container) {
  const baseDelay = container.children.length * 20;
  list.forEach((komik, i) => {
    if (!komik?.slug) return;

    const rawImg2  = komik.image || komik.cover || "";
    const isSvg2   = !rawImg2 || rawImg2.startsWith("data:image/svg") || rawImg2.startsWith("data:image/gif");
    const origUrl  = isSvg2 ? "" : rawImg2.split("?")[0];
    const cover    = origUrl ? proxyImg(origUrl, 260) : "";
    const type     = (komik.type || "manhwa").toLowerCase();
    const title    = komik.title || "Untitled";

    const latestCh = (komik.chapters && komik.chapters[0]) || {};
    const chTitle  = latestCh.title || komik.chapter || komik.ch || "";
    const chDate   = latestCh.date  || komik.date || komik.time || "";
    const chSlug   = latestCh.slug  || komik.slug;

    /* Format label chapter: "Chapter 123" → "Ch.123", pad 2 digit */
    const chLabel  = formatChapterLabel(chTitle, chSlug);

    const card = document.createElement("div");
    card.className = "grid-card";
    card.dataset.slug = komik.slug; /* untuk patchKSCovers */

    card.innerHTML = `
      <div class="badge ${type}">${komik.type || "Manhwa"}</div>
      ${cover
        ? `<img src="${cover}" alt="${escHtml(title)}" loading="lazy" style="background:var(--bg-surface);">`
        : `<div class="card-gen-wrap card-gen-cover-el" data-title="${escHtml(title)}" data-type="${escHtml(type)}"></div>`}
      <div class="grid-info">
        <p class="title">${escHtml(title)}</p>
        <div class="grid-meta">
          <div class="grid-ch-row">
            <span class="grid-chapter" title="${escHtml(chTitle)}">📖 ${escHtml(chLabel)}</span>
            ${chSlug ? `<a class="grid-ch-link" href="${readerURL(chSlug, komik.slug)}" onclick="event.stopPropagation()">Baca ▶</a>` : ""}
          </div>
          <span class="grid-date">🕐 ${escHtml(chDate) || "–"}</span>
        </div>
      </div>`;

    if (cover && origUrl) {
      const img = card.querySelector("img");
      if (img) imgFallback(img, origUrl);
    } else if (!cover) {
      const ph = card.querySelector(".card-gen-wrap");
      if (ph) {
        const gen = makeGeneratedCover(title, type, 155);
        gen.classList.add("card-gen-cover-el"); /* marker untuk patchKSCovers */
        gen.dataset.slug = komik.slug;
        ph.parentNode.replaceChild(gen, ph);
      }
    }

    card.onclick = async () => {
      /* Tampilkan mini loading di kartu agar user tahu sedang diproses */
      card.style.opacity = "0.7";
      card.style.pointerEvents = "none";

      /* Cek KomikStation on-demand:
         - Kalau ada di KS → pakai source KS (chapter lebih lengkap)
         - Kalau tidak ada → pakai source asli dari merge result
         Hasil di-cache agar tidak re-fetch kalau kartu diklik ulang */
      const originalSrc = komik._src || "komikindo";
      const resolvedSrc = await resolveSource(komik.slug, originalSrc);

      sessionStorage.setItem("komikSrcHint", resolvedSrc);
      sessionStorage.setItem("komikSrcSlug", komik.slug);
      window.location.href = komikURL(komik.slug);
    };
    container.appendChild(card);
    animateIn(card, baseDelay + i * 30);
  });
}

/* ============================================================
   LOAD MORE
   ============================================================ */
window.loadMore = async function () {
  if (isLoadingMore || !hasNextPage) return;
  isLoadingMore = true;

  const spinner  = document.getElementById("loadMoreSpinner");
  const btn      = document.getElementById("loadMoreBtn");

  if (btn)     { btn.disabled = true; btn.innerHTML = `<span class="btn-spinner"></span> Memuat...`; }
  if (spinner) spinner.style.display = "grid";

  latestPage++;

  try {
    const res  = await fetch(`${API_LATEST}/${latestPage}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const list = (data.komikList || data.data || data.comics || [])
      .map(k => ({ ...k, _src: k._src || "komikindo" }));

    renderLatest(list, document.getElementById("komikLatest"));

    hasNextPage = data.pagination?.hasNextPage ?? data.hasNextPage ?? (list.length >= 10);
    updateLoadMoreUI();
  } catch (err) {
    console.error("[LoadMore] Gagal:", err);
    latestPage--;
    if (btn) {
      btn.innerHTML   = "⚠️ Gagal — Tap untuk coba lagi";
      btn.style.color = "var(--accent)";
    }
    showToast("Gagal memuat lebih banyak. Coba lagi.", "error");
  } finally {
    isLoadingMore = false;
    if (btn)     { btn.disabled = false; }
    if (spinner) spinner.style.display = "none";
  }
};

function updateLoadMoreUI() {
  const wrap     = document.getElementById("loadMoreWrap");
  const btn      = document.getElementById("loadMoreBtn");
  const pageInfo = document.getElementById("pageInfo");
  if (!wrap) return;

  if (pageInfo) pageInfo.textContent = `Halaman ${latestPage}`;
  wrap.style.display = "flex";

  if (hasNextPage) {
    if (btn) {
      btn.disabled      = false;
      btn.innerHTML     = "Muat Lebih Banyak ↓";
      btn.style.color   = "";
      btn.style.opacity = "1";
    }
  } else {
    if (btn) {
      btn.disabled      = true;
      btn.innerHTML     = "✅ Semua Sudah Dimuat";
      btn.style.opacity = "0.55";
    }
    /* Hapus observer kalau sudah habis */
    ioObserver?.disconnect();
  }
}

/* Infinite scroll pakai IntersectionObserver — lebih hemat dari scroll event */
function setupInfiniteScroll() {
  ioObserver?.disconnect();

  /* Sentinel = tombol load-more, saat terlihat → auto load */
  const sentinel = document.getElementById("loadMoreBtn");
  if (!sentinel) return;

  ioObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && hasNextPage && !isLoadingMore) {
      window.loadMore();
    }
  }, { rootMargin: "200px" });

  ioObserver.observe(sentinel);
}

/* ============================================================
   REKOMENDASI
   ============================================================ */
async function getKomikRekomen() {
  try {
    const res  = await fetch(API_REKOM);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderRekomen(data.komikList || []);
  } catch (err) {
    console.error("[Rekom] Gagal:", err);
    const container = document.getElementById("komikRekomen");
    if (container) container.innerHTML = `<p style="padding:14px;color:var(--text-muted);font-size:13px;">Gagal memuat rekomendasi.</p>`;
  }
}

function renderRekomen(list) {
  const container = document.getElementById("komikRekomen");
  if (!container) return;

  list.forEach((komik, i) => {
    if (!komik?.slug) return;
    const rawImg3  = komik.image || komik.cover || "";
    const isSvg3   = !rawImg3 || rawImg3.startsWith("data:image/svg") || rawImg3.startsWith("data:image/gif");
    const origUrl  = isSvg3 ? "" : rawImg3.split("?")[0];
    const cover    = origUrl ? proxyImg(origUrl, 160) : "";
    const card    = document.createElement("div");
    card.className = "rekom-card";

    card.innerHTML = `
      ${cover
        ? `<img src="${cover}" alt="${escHtml(komik.title || "")}" loading="lazy" style="background:var(--bg-surface);width:80px;height:110px;object-fit:cover;flex-shrink:0;">`
        : `<div class="rekom-gen-wrap" data-title="${escHtml(komik.title||"")}" data-type="${escHtml(komik.type||"")}"></div>`}
      <div class="rekom-info">
        <p class="title">${escHtml(komik.title || "Untitled")}</p>
        <p>⭐ ${komik.rating || "–"}</p>
        <p>🎭 ${escHtml(komik.genre || "")}</p>
      </div>`;

    if (cover && origUrl) {
      const img = card.querySelector("img");
      if (img) imgFallback(img, origUrl);
    } else if (!cover) {
      const ph = card.querySelector(".rekom-gen-wrap");
      if (ph) {
        const gc = makeGeneratedCover(komik.title, komik.type, 110);
        gc.style.width = "80px"; gc.style.flexShrink = "0";
        ph.parentNode.replaceChild(gc, ph);
      }
    }

    card.onclick = async () => {
      card.style.opacity = "0.7";
      card.style.pointerEvents = "none";
      const resolvedSrc = await resolveSource(komik.slug, "bacakomik");
      sessionStorage.setItem("komikSrcHint", resolvedSrc);
      sessionStorage.setItem("komikSrcSlug", komik.slug);
      window.location.href = komikURL(komik.slug);
    };
    container.appendChild(card);
    animateIn(card, i * 45);
  });
}

/* ============================================================
   GENRE CHIPS
   ============================================================ */
async function getGenreChips() {
  const container = document.getElementById("genreChipsIndex");
  if (!container) return;

  try {
    const res  = await fetch(API_GENRES);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const TYPOS = new Set(["actio", "traged"]);
    const seen  = new Set();

    const genres = (data.genres || [])
      .filter(g => {
        const val  = (g.value || g.slug || "").toLowerCase();
        const name = (g.name  || g.title || "");
        if (!val || !name || name.length < 3) return false;
        if (TYPOS.has(val)) return false;
        if (seen.has(val))  return false;
        seen.add(val);
        return true;
      })
      .sort((a, b) => (a.name || a.title || "").localeCompare(b.name || b.title || "", "id"));

    const POPULAR = new Set([
      "action","romance","fantasy","comedy","drama","adventure",
      "horror","thriller","shounen","isekai","supernatural",
      "school-life","martial-arts","mystery","sports","psychological"
    ]);

    const sorted = [
      ...genres.filter(g => POPULAR.has(g.value || g.slug)),
      ...genres.filter(g => !POPULAR.has(g.value || g.slug)),
    ];

    container.innerHTML = sorted.slice(0, 16).map(g => {
      const s = g.value || g.slug;
      const n = g.name  || g.title;
      return `<button class="genre-chip-index" onclick="window.location.href='/genre/${encodeURIComponent(s)}'">${escHtml(n)}</button>`;
    }).join("") + `
      <button class="genre-chip-index" style="border-color:var(--accent);color:var(--accent);font-weight:800;"
        onclick="window.location.href='/genre/'">Semua →</button>`;

    /* Animasi masuk bertahap */
    container.querySelectorAll(".genre-chip-index").forEach((el, i) => animateIn(el, i * 25));

  } catch (err) {
    console.error("[Genre] Gagal:", err);
    if (container) container.innerHTML = "";
  }
}

/* ============================================================
   LIVE SEARCH
   ============================================================ */
let searchDebounce = null;
let lastQuery      = "";

window.liveSearch = async function () {
  const input     = document.getElementById("searchInput");
  const resultBox = document.getElementById("searchResult");
  if (!input || !resultBox) return;

  const query = input.value.trim();
  if (!query) { resultBox.style.display = "none"; lastQuery = ""; return; }
  if (query === lastQuery) return;
  lastQuery = query;

  clearTimeout(searchDebounce);

  /* Loading placeholder */
  resultBox.innerHTML = `<div style="padding:12px 14px;color:var(--text-muted);font-size:13px;display:flex;align-items:center;gap:8px;"><div class="search-spinner"></div> Mencari...</div>`;
  resultBox.style.display = "block";

  searchDebounce = setTimeout(async () => {
    try {
      const res  = await fetch(API_SEARCH + encodeURIComponent(query));
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      renderSearch(data.komikList || [], query);
    } catch (err) {
      console.error("[Search] Gagal:", err);
      resultBox.innerHTML = `<div style="padding:12px;color:var(--text-muted);font-size:13px;">😕 Pencarian gagal. Coba lagi.</div>`;
    }
  }, 350);
};

function renderSearch(list, query) {
  const resultBox = document.getElementById("searchResult");
  if (!resultBox) return;

  if (!list?.length) {
    resultBox.innerHTML = `<div style="padding:12px 14px;color:var(--text-muted);font-size:13px;">Tidak ada hasil untuk "<strong>${escHtml(query)}</strong>"</div>`;
    resultBox.style.display = "block";
    return;
  }

  resultBox.innerHTML = "";
  list.slice(0, 6).forEach(komik => {
    if (!komik?.slug) return;
    const origUrl = (komik.image || komik.cover || "").split("?")[0];
    const cover   = origUrl ? proxyImg(origUrl, 80) : "";
    const item    = document.createElement("div");
    item.className = "search-item";

    /* Highlight kata kunci dalam judul */
    const hl = highlightText(komik.title || "Untitled", query);

    item.innerHTML = `
      ${cover
        ? `<img src="${cover}" alt="" loading="lazy" style="background:var(--bg-surface);">`
        : `<div style="width:44px;height:60px;background:var(--bg-surface);border-radius:5px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px;">📚</div>`}
      <div>
        <p>${hl}</p>
        <p style="color:var(--accent2);">⭐ ${komik.rating || "–"} &nbsp;·&nbsp; ${escHtml(komik.type || "")}</p>
      </div>`;

    if (cover && origUrl) {
      const img = item.querySelector("img");
      if (img) imgFallback(img, origUrl);
    }

    item.onclick = () => { window.location.href = komikURL(komik.slug); };
    resultBox.appendChild(item);
  });

  resultBox.style.display = "block";
}

/** Highlight teks yang cocok dengan query */
function highlightText(text, query) {
  if (!query) return escHtml(text);
  const safe   = escHtml(text);
  const safeQ  = escHtml(query).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return safe.replace(new RegExp(`(${safeQ})`, "gi"), `<mark style="background:rgba(232,82,42,0.25);color:var(--text);border-radius:2px;padding:0 2px;">$1</mark>`);
}

/* Tutup search result saat klik di luar */
document.addEventListener("click", e => {
  const input = document.getElementById("searchInput");
  const box   = document.getElementById("searchResult");
  if (box && input && !input.contains(e.target) && !box.contains(e.target)) {
    box.style.display = "none";
  }
});

/* ============================================================
   UI HELPERS
   ============================================================ */
window.goHome = function () { window.location.href = "/"; };

window.toggleDarkMode = function () {
  document.body.classList.toggle("light");
  localStorage.setItem("theme", document.body.classList.contains("light") ? "light" : "dark");
  const btn = document.querySelector('button[onclick="toggleDarkMode()"]');
  if (btn) btn.textContent = document.body.classList.contains("light") ? "🌙" : "☀️";
};

window.toggleMenu = function () {
  const m = document.getElementById("menuDropdown");
  if (!m) return;
  m.style.display = m.style.display === "block" ? "none" : "block";
};

/* Toast */
window.showToast = function (msg, type = "info") {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className   = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
};

/* HTML escape */
function escHtml(str) {
  return String(str || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

/* ============================================================
   INJECT CSS TAMBAHAN (spinner, card-img-fallback, dll)
   ============================================================ */
(function injectExtraStyles() {
  const id = "pkScriptExtraStyle";
  if (document.getElementById(id)) return;
  const s = document.createElement("style");
  s.id = id;
  s.textContent = `
    /* Spinner kecil di dalam tombol/search */
    .btn-spinner, .search-spinner {
      display:inline-block;
      width:13px;height:13px;
      border:2px solid rgba(255,255,255,0.3);
      border-top-color:currentColor;
      border-radius:50%;
      animation:pkSpin 0.6s linear infinite;
      vertical-align:middle;
      flex-shrink:0;
    }
    .search-spinner { border-top-color:var(--text-muted); }
    @keyframes pkSpin { to{transform:rotate(360deg)} }

    /* Fallback image placeholder */
    .card-img-fallback {
      width:100%;height:175px;
      background:var(--bg-surface);
      display:flex;align-items:center;justify-content:center;
      font-size:32px;color:var(--text-muted);
    }

    /* Back to top — tambah z-index agar tidak tertutup bottom nav */
    #backToTop {
      z-index:1100;
      bottom:calc(70px + env(safe-area-inset-bottom));
    }

    /* Card title truncate */
    .card .card-title {
      display:-webkit-box;
      -webkit-line-clamp:2;
      -webkit-box-orient:vertical;
      overflow:hidden;
      white-space:normal !important;
    }
  `;
  document.head.appendChild(s);
})();

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  /* Terapkan tema */
  if (localStorage.getItem("theme") === "light") {
    document.body.classList.add("light");
  }

  /* Fetch semua konten */
  getTopKomik();
  getKomikLatest();
  getKomikRekomen();
  getGenreChips();

  /* Back to top */
  const btn = document.getElementById("backToTop");
  if (btn) {
    window.addEventListener("scroll", () => {
      btn.classList.toggle("visible", window.scrollY > 400);
    }, { passive: true });
  }
});
