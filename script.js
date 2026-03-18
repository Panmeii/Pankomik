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
const API_TOP       = "https://www.sankavollerei.com/comic/bacakomik/top";
const API_LATEST    = "https://www.sankavollerei.com/comic/komikindo/latest";
const API_LATEST_MK = "https://www.sankavollerei.com/comic/mangakita/home"; /* mangakita latest */
const API_REKOM     = "https://www.sankavollerei.com/comic/bacakomik/recomen";
const API_SEARCH    = "https://www.sankavollerei.com/comic/bacakomik/search/";
const API_GENRES    = "https://www.sankavollerei.com/comic/komikindo/genres";

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

/* ── Merge dua list latest, deduplicate by slug ── */
function mergeLatestLists(list1, list2) {
  const seen = new Set();
  const merged = [];
  for (const k of [...list1, ...list2]) {
    if (!k.slug || seen.has(k.slug)) continue;
    seen.add(k.slug);
    merged.push(k);
  }
  return merged;
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
            <span class="grid-chapter" title="${escHtml(chTitle)}">📖 ${escHtml(chTitle) || "–"}</span>
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
