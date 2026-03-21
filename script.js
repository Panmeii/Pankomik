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
const API_REKOM       = "https://www.sankavollerei.com/comic/bacakomik/recomen";
const API_GENRES      = "https://www.sankavollerei.com/comic/komikindo/genres";
/* ── Search: 3 sumber ── */
const API_SEARCH_BK   = "https://www.sankavollerei.com/comic/bacakomik/search/";
const API_SEARCH_KI   = "https://www.sankavollerei.com/comic/komikindo/search/";
const API_SEARCH_MK   = "https://www.sankavollerei.com/comic/mangakita/search/";

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
  "komikindo":  "https://komikindo.org",
  "komikcast":  "https://komikcast.me",
  "komiku":     "https://komiku.id",
  "manhwaindo": "https://manhwaindo.id",
  "bacakomik":  "https://bacakomik.me",
  "mangatale":  "https://mangatale.co",
  "westmanga":  "https://westmanga.info",
  "shinigami":  "https://shinigami.id",
  "sakuranovel":"https://sakuranovel.id",
  "novelringan":"https://novelringan.com",
  "mangakita":  "https://mangakita.me",
  "bacakomik.my":"https://bacakomik.my",
  "i0.wp.com":  "https://mangakita.me",
  "i1.wp.com":  "https://mangakita.me",
  "i2.wp.com":  "https://mangakita.me",
  "i3.wp.com":  "https://mangakita.me",
  "kiryuu":     "https://kiryuu.id",
  "mgkomik":    "https://mgkomik.id",
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
 * imgFallback — chain: wsrv+ref → wsrv tanpa ref → direct URL → placeholder
 */
function imgFallback(img, originalUrl) {
  if (!originalUrl || img.dataset.fallbackSet) return;
  img.dataset.fallbackSet = "1";
  const clean = originalUrl.split("?")[0];
  let step = 0;

  function tryNext() {
    step++;
    img.onerror = null;
    switch (step) {
      case 1: img.onerror = tryNext; img.src = buildWsrv(clean, 300, false); break;
      case 2: img.onerror = tryNext; img.src = clean; break;
      default: showImgPlaceholder(img);
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

/* ── Merge dua list latest, deduplicate by slug.
   Jika slug sama, ambil yang chapter number-nya LEBIH BESAR
   agar update terbaru selalu menang meski dari API berbeda. ── */
function mergeLatestLists(list1, list2) {
  const map = new Map();

  const getLatestChNum = (komik) => {
    const ch = (komik.chapters && komik.chapters[0]) || {};
    return extractChapterNum(ch.title || "") || extractChapterNum(ch.slug || "");
  };

  for (const k of [...list1, ...list2]) {
    if (!k.slug) continue;
    if (!map.has(k.slug)) {
      map.set(k.slug, k);
    } else {
      /* Sudah ada entri untuk slug ini — bandingkan chapter number */
      const existing = map.get(k.slug);
      const numExist = getLatestChNum(existing);
      const numNew   = getLatestChNum(k);
      /* Ganti dengan yang chapter-nya lebih tinggi */
      if (numNew > numExist) {
        map.set(k.slug, {
          ...existing,         /* pertahankan cover/type dari entri lama jika baru kosong */
          image: k.image || existing.image,
          chapters: k.chapters,
          _src: k._src,
        });
      }
    }
  }
  return Array.from(map.values());
}

/* ── ANIMASI MASUK ──────────────────────────────────────── */
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

    card.onclick = () => { window.location.href = komikURL(komik.slug); };
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

  /* Fetch kedua API paralel */
  const [res1, res2] = await Promise.allSettled([
    fetch(`${API_LATEST}/${latestPage}`).then(r => r.json()).catch(() => null),
    fetch(API_LATEST_MK).then(r => r.json()).catch(() => null),
  ]);

  const data1 = res1.status === "fulfilled" ? res1.value : null;
  const data2 = res2.status === "fulfilled" ? res2.value : null;

  /* List dari komikindo */
  const list1 = (data1?.komikList || data1?.data || data1?.comics || []);

  /* List dari mangakita: pakai latestReleases */
  const list2mk = (data2?.latestReleases || []).map(normalizeMKLatest);

  /* Merge: komikindo dulu, mangakita tambal yang tidak ada */
  const merged = mergeLatestLists(list1, list2mk);

  if (!merged.length) {
    container.innerHTML = `<p style="grid-column:1/-1;padding:20px;color:var(--text-muted);text-align:center;font-size:13px;">😕 Gagal memuat konten terbaru.</p>`;
    return;
  }

  container.innerHTML = "";
  renderLatest(merged, container);

  /* hasNextPage: true kalau komikindo masih ada halaman berikutnya */
  hasNextPage = data1?.pagination?.hasNextPage ?? data1?.hasNextPage ?? (list1.length >= 10);
  updateLoadMoreUI();
  setupInfiniteScroll();
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

    card.innerHTML = `
      <div class="badge ${type}">${komik.type || "Manhwa"}</div>
      ${cover
        ? `<img src="${cover}" alt="${escHtml(title)}" loading="lazy" style="background:var(--bg-surface);">`
        : `<div class="card-gen-wrap" data-title="${escHtml(title)}" data-type="${escHtml(type)}"></div>`}
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
      if (ph) ph.parentNode.replaceChild(makeGeneratedCover(title, type, 155), ph);
    }

    card.onclick = () => { window.location.href = komikURL(komik.slug); };
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
    const list = data.komikList || data.data || data.comics || [];

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

    card.onclick = () => { window.location.href = komikURL(komik.slug); };
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
   LIVE SEARCH — 3 API: bacakomik + komikindo + mangakita
   ============================================================ */
let searchDebounce = null;
let lastQuery      = "";

/* Merge hasil search dari 3 API, deduplicate by slug */
function mergeSearchResults(lists) {
  const map = new Map();
  for (const list of lists) {
    for (const k of (list || [])) {
      const slug = k.slug || k.komikSlug || "";
      if (!slug) continue;
      if (!map.has(slug)) {
        /* Normalisasi field berbeda antar API */
        map.set(slug, {
          slug,
          title:  k.title  || k.name  || "Untitled",
          image:  k.image  || k.cover || k.thumbnail || "",
          rating: k.rating || k.score || "–",
          type:   k.type   || k.format || "",
        });
      } else {
        /* Lengkapi field kosong dari duplikat */
        const ex = map.get(slug);
        if (!ex.image  && (k.image  || k.cover))      ex.image  = k.image  || k.cover;
        if (!ex.rating && k.rating)                    ex.rating = k.rating;
        if (!ex.type   && k.type)                      ex.type   = k.type;
      }
    }
  }
  return Array.from(map.values());
}

window.liveSearch = async function () {
  const input     = document.getElementById("searchInput");
  const resultBox = document.getElementById("searchResult");
  if (!input || !resultBox) return;

  const query = input.value.trim();
  if (!query) {
    resultBox.style.display = "none";
    resultBox.innerHTML = "";
    lastQuery = "";
    return;
  }
  if (query === lastQuery) return;
  lastQuery = query;

  clearTimeout(searchDebounce);

  /* Loading state dengan skeleton cards */
  resultBox.innerHTML = `
    <div class="sr-header">
      <span class="sr-label">Mencari "<strong>${escHtml(query)}</strong>"</span>
      <div class="sr-spinner"></div>
    </div>
    ${Array(3).fill(`
      <div class="search-item-skel">
        <div class="skel-img"></div>
        <div class="skel-lines">
          <div class="skel-line" style="width:75%"></div>
          <div class="skel-line" style="width:45%"></div>
        </div>
      </div>`).join("")}`;
  resultBox.style.display = "block";

  searchDebounce = setTimeout(async () => {
    const enc = encodeURIComponent(query);
    const [r1, r2, r3] = await Promise.allSettled([
      fetch(API_SEARCH_BK + enc).then(r => r.json()).catch(() => null),
      fetch(API_SEARCH_KI + enc).then(r => r.json()).catch(() => null),
      fetch(API_SEARCH_MK + enc).then(r => r.json()).catch(() => null),
    ]);

    const list1 = (r1.value?.komikList || r1.value?.data  || []);
    const list2 = (r2.value?.komikList || r2.value?.data  || []);
    const list3 = (r3.value?.komikList || r3.value?.data  || r3.value?.results || []);

    const merged = mergeSearchResults([list1, list2, list3]);
    renderSearch(merged, query);
  }, 350);
};

function renderSearch(list, query) {
  const resultBox = document.getElementById("searchResult");
  if (!resultBox) return;

  if (!list?.length) {
    resultBox.innerHTML = `
      <div class="sr-empty">
        <span style="font-size:28px;">🔍</span>
        <p>Tidak ada hasil untuk <strong>"${escHtml(query)}"</strong></p>
        <span class="sr-hint">Coba kata kunci lain</span>
      </div>`;
    resultBox.style.display = "block";
    return;
  }

  const total = list.length;
  resultBox.innerHTML = `
    <div class="sr-header">
      <span class="sr-label"><strong>${total}</strong> hasil untuk "${escHtml(query)}"</span>
      <button class="sr-close-btn" onclick="document.getElementById('searchResult').style.display='none'">✕</button>
    </div>`;

  list.slice(0, 8).forEach((komik, i) => {
    if (!komik?.slug) return;
    const origUrl = (komik.image || "").split("?")[0];
    const cover   = origUrl ? proxyImg(origUrl, 100) : "";
    const hl      = highlightText(komik.title || "Untitled", query);
    const type    = komik.type || "";
    const rating  = komik.rating || "";
    const item    = document.createElement("div");
    item.className = "search-item";
    item.style.animationDelay = `${i * 40}ms`;

    item.innerHTML = `
      <div class="si-cover">
        ${cover
          ? `<img src="${cover}" alt="" loading="lazy">`
          : `<div class="si-cover-ph">📚</div>`}
        ${type ? `<span class="si-type-badge">${escHtml(type)}</span>` : ""}
      </div>
      <div class="si-body">
        <p class="si-title">${hl}</p>
        <div class="si-meta">
          ${rating ? `<span class="si-rating">⭐ ${escHtml(rating)}</span>` : ""}
          ${type   ? `<span class="si-genre">${escHtml(type)}</span>`   : ""}
        </div>
        <span class="si-arrow">Lihat Detail →</span>
      </div>`;

    if (cover && origUrl) {
      const img = item.querySelector("img");
      if (img) imgFallback(img, origUrl);
    }

    item.onclick = () => { window.location.href = komikURL(komik.slug); };
    resultBox.appendChild(item);
  });

  if (total > 8) {
    const more = document.createElement("div");
    more.className = "sr-more";
    more.innerHTML = `+${total - 8} hasil lainnya`;
    resultBox.appendChild(more);
  }

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
    .btn-spinner, .search-spinner, .sr-spinner {
      display:inline-block;
      width:13px;height:13px;
      border:2px solid rgba(255,255,255,0.2);
      border-top-color:var(--accent);
      border-radius:50%;
      animation:pkSpin 0.6s linear infinite;
      vertical-align:middle;
      flex-shrink:0;
    }
    @keyframes pkSpin { to{transform:rotate(360deg)} }

    /* Fallback image placeholder */
    .card-img-fallback {
      width:100%;height:175px;
      background:var(--bg-surface);
      display:flex;align-items:center;justify-content:center;
      font-size:32px;color:var(--text-muted);
    }
    #backToTop {
      z-index:1100;
      bottom:calc(70px + env(safe-area-inset-bottom));
    }
    .card .card-title {
      display:-webkit-box;
      -webkit-line-clamp:2;
      -webkit-box-orient:vertical;
      overflow:hidden;
      white-space:normal !important;
    }

    /* ══════════════════════════════════
       SEARCH RESULT — Redesain Premium
       ══════════════════════════════════ */
    .search-result {
      max-height: 76vh !important;
      border-radius: 16px !important;
      border: 1px solid rgba(232,82,42,0.15) !important;
      box-shadow: 0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) !important;
      backdrop-filter: blur(24px) saturate(1.4) !important;
      -webkit-backdrop-filter: blur(24px) saturate(1.4) !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      scrollbar-width: thin;
      scrollbar-color: rgba(232,82,42,0.3) transparent;
    }
    .search-result::-webkit-scrollbar { width: 3px; }
    .search-result::-webkit-scrollbar-thumb { background: rgba(232,82,42,0.3); border-radius: 99px; }

    /* Header baris */
    .sr-header {
      display:flex; align-items:center; justify-content:space-between;
      padding:10px 14px 8px;
      border-bottom:1px solid rgba(255,255,255,0.05);
      background: var(--bg-elevated, #1f1f2a);
      flex-shrink:0;
      position:sticky; top:0; z-index:10;
    }
    .sr-label {
      font-size:11px; font-weight:700;
      color:var(--text-muted); letter-spacing:0.2px;
    }
    .sr-label strong { color:var(--accent); }
    .sr-close-btn {
      width:24px;height:24px;border-radius:50%;
      background:rgba(255,255,255,0.07); border:none;
      color:var(--text-muted); font-size:11px; cursor:pointer;
      display:flex;align-items:center;justify-content:center;
      transition:all 0.15s;
    }
    .sr-close-btn:hover { background:rgba(232,82,42,0.2); color:var(--accent); }

    /* Skeleton loading cards */
    .search-item-skel {
      display:flex; gap:10px; padding:10px 14px;
      border-bottom:1px solid rgba(255,255,255,0.04);
    }
    .skel-img {
      width:44px;height:60px;border-radius:8px;flex-shrink:0;
      background:linear-gradient(90deg,var(--bg-card) 25%,var(--bg-surface) 50%,var(--bg-card) 75%);
      background-size:200% 100%;animation:pkShimmer 1.4s infinite;
    }
    .skel-lines { flex:1;display:flex;flex-direction:column;gap:8px;padding-top:4px; }
    .skel-line {
      height:11px;border-radius:5px;
      background:linear-gradient(90deg,var(--bg-card) 25%,var(--bg-surface) 50%,var(--bg-card) 75%);
      background-size:200% 100%;animation:pkShimmer 1.4s infinite;
    }
    @keyframes pkShimmer { 0%{background-position:200% 0}100%{background-position:-200% 0} }

    /* Search Item — redesain */
    .search-item {
      display:flex !important; gap:12px; padding:10px 14px !important;
      cursor:pointer; align-items:center !important;
      border-bottom:1px solid rgba(255,255,255,0.04) !important;
      transition:background 0.14s, transform 0.1s;
      animation:siSlideIn 0.2s ease both;
      position:relative;
      background:transparent !important;
    }
    @keyframes siSlideIn { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
    .search-item:hover { background:rgba(232,82,42,0.06) !important; transform:translateX(3px); }
    .search-item:active { transform:scale(0.98); }
    .search-item:last-of-type { border-bottom:none !important; }

    /* Cover container — override style.css .search-item img sizing */
    .si-cover {
      position:relative; flex-shrink:0;
      width:44px !important; height:60px !important;
      min-width:44px; min-height:60px;
      border-radius:8px; overflow:hidden !important;
      background:var(--bg-surface);
      border:1px solid rgba(255,255,255,0.06);
      display:block !important;
    }
    /* style.css sets .search-item img to width:40px;height:56px — override it */
    .search-item img,
    .si-cover img {
      width:44px !important; height:60px !important;
      object-fit:cover !important; display:block !important;
      border-radius:0 !important;
      flex-shrink:0 !important;
    }
    .si-cover-ph {
      width:100%;height:100%;display:flex;align-items:center;justify-content:center;
      font-size:20px;
    }
    .si-type-badge {
      position:absolute; bottom:2px; left:2px; right:2px;
      background:rgba(0,0,0,0.75); color:#fff;
      font-size:7px; font-weight:800; text-align:center;
      border-radius:3px; padding:1px 2px;
      text-transform:uppercase; letter-spacing:0.3px;
      line-height:1.4;
    }

    /* Body */
    .si-body { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }
    .si-title {
      font-weight:800; font-size:13px; color:var(--text);
      display:-webkit-box; -webkit-line-clamp:2;
      -webkit-box-orient:vertical; overflow:hidden;
      line-height:1.35;
    }
    .si-meta { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
    .si-rating {
      font-size:11px; color:var(--accent2); font-weight:700;
    }
    .si-genre {
      font-size:10px; font-weight:700;
      background:rgba(255,255,255,0.07); border-radius:4px;
      padding:1px 6px; color:var(--text-muted);
    }
    .si-arrow {
      font-size:10px; color:var(--accent); font-weight:800;
      opacity:0; transition:opacity 0.14s;
    }
    .search-item:hover .si-arrow { opacity:1; }

    /* Empty state */
    .sr-empty {
      display:flex; flex-direction:column; align-items:center;
      padding:28px 20px; gap:6px; text-align:center;
      color:var(--text-muted);
    }
    .sr-empty p { font-size:13px; font-weight:700; }
    .sr-empty strong { color:var(--text); }
    .sr-hint { font-size:11px; color:var(--text-dim); }

    /* Footer "+N lainnya" */
    .sr-more {
      text-align:center; padding:10px;
      font-size:12px; font-weight:700; color:var(--text-muted);
      border-top:1px solid rgba(255,255,255,0.05);
      background:rgba(255,255,255,0.02);
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
