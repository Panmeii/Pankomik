/* ============================================================
   PANKOMIK — reader.js  (Enhanced v2 — HD + Performance)

   PENINGKATAN:
   - Gambar HD: direct URL tanpa proxy (paling jernih)
   - Fallback cerdas: wsrv.nl q=100 (lossless) → original
   - Concurrent loading: 5 gambar pertama langsung, sisanya sequential
   - fetchpriority="high" untuk gambar atas
   - Native lazy loading untuk gambar bawah
   - decode() API untuk render non-blocking
   - Progress loading indicator per gambar
   - Smooth fade-in dengan blur transition
   - max-width: 800px (lebih lebar, lebih detail terlihat)
   ============================================================ */

import { getCurrentUser, saveHistory, updateProgress } from "/supabase.js";
import { getSlug, getKomikSlug, readerURL, komikURL, pushURL } from "/router.js";

/* ── KONSTANTA API ───────────────────────────────────────── */
const API_CHAPTER   = "https://www.sankavollerei.com/comic/komikindo/chapter/";
const API_DETAIL    = "https://www.sankavollerei.com/comic/komikindo/detail/";
const API_CHAPTER_2 = "https://www.sankavollerei.com/comic/mangakita/chapter/";
const API_DETAIL_2  = "https://www.sankavollerei.com/comic/mangakita/detail/";
const API_CHAPTER_3 = "https://www.sankavollerei.com/comic/bacakomik/chapter/";
const API_DETAIL_3  = "https://www.sankavollerei.com/comic/bacakomik/detail/";
const API_CHAPTER_4 = "https://www.sankavollerei.com/comic/komikstation/chapter/";
const API_DETAIL_4  = "https://www.sankavollerei.com/comic/komikstation/manga/";

/* ── SLUG dari URL ───────────────────────────────────────── */
const slug = getSlug();
if (!slug) window.location.href = "/";

/* ── STATE ──────────────────────────────────────────────── */
let autoScrollInterval = null;
let nextSlug           = null;
let prevSlug           = null;
let currentApiSource   = sessionStorage.getItem("komikSource") || "komikindo";
let currentUser        = null;
let historyWasSaved    = false;
let allChapters        = [];
let currentChapterSlug = slug;
let komikSlug          = null;
let komikTitle         = "";
let komikCover         = "";

let readMode    = localStorage.getItem("readMode") || "scroll";
let currentPage = 0;
let allImages   = [];

/* ── Ekstrak nomor chapter ──────────────────────────────── */
function _extractNum(str) {
  if (!str) return null;
  let m = str.match(/(?:chapter|ch\.?)\s*([\d]+(?:[.,][\d]+)?)/i);
  if (m) return parseFloat(m[1].replace(",", "."));
  m = str.match(/chapter[_-]([\d]+(?:[._-][\d]+)?)/i);
  if (m) return parseFloat(m[1].replace(/[_-]/, "."));
  m = str.match(/([\d]+[._-][\d]+)$/);
  if (m) return parseFloat(m[1].replace(/[_-]/, "."));
  return null;
}

/* ══════════════════════════════════════════════════════════
   IMAGE URL STRATEGY — HD Priority
   Urutan:
   0 = URL langsung tanpa query params (PALING JERNIH — original resolution)
   1 = wsrv.nl lossless, tanpa resize, no compression
   2 = wsrv.nl q=95, webp
   3 = URL asli dengan query params
   4 = cors proxy fallback terakhir
══════════════════════════════════════════════════════════ */
function getImageUrl(rawUrl, attempt) {
  if (!rawUrl) return "";
  const clean  = rawUrl.split("?")[0];   /* hapus query params → URL bersih */
  const enc    = encodeURIComponent(clean);

  switch (attempt) {
    case 0: return clean;                /* DIRECT — paling jernih */
    case 1: return `https://wsrv.nl/?url=${enc}&n=-1`;          /* no compression, no resize */
    case 2: return `https://wsrv.nl/?url=${enc}&output=webp&q=95&n=-1`; /* webp fallback */
    case 3: return rawUrl;               /* original dengan query params */
    case 4: return `https://images.weserv.nl/?url=${enc}&n=-1`; /* mirror wsrv */
    default: return clean;
  }
}

/* ══════════════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════════════ */
window.addEventListener("DOMContentLoaded", async () => {
  const _storedKomikSlug = sessionStorage.getItem("komikSlug") || "";
  if (_storedKomikSlug && slug && !slug.startsWith(_storedKomikSlug.slice(0, 8))) {
    sessionStorage.removeItem("komikSlug");
  }

  currentUser = await getCurrentUser();
  initProgressBar();
  applyReadMode();
  await loadChapter();
  initHeaderAutoHide();
  initKeyboard();
});

/* ══════════════════════════════════════════════════════════
   READING PROGRESS BAR
══════════════════════════════════════════════════════════ */
function initProgressBar() {
  const bar = document.getElementById("readingProgressBar");
  if (!bar) return;
  window.addEventListener("scroll", () => {
    if (readMode !== "scroll") return;
    const scrollable = document.body.scrollHeight - window.innerHeight;
    const pct = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
    bar.style.width = Math.min(pct, 100) + "%";
    if (pct >= 95) {
      bar.style.background = "linear-gradient(90deg,#27ae60,#2ecc71,#27ae60)";
    } else {
      bar.style.background = "linear-gradient(90deg,#e8522a,#f5a623,#ff6b6b,#e8522a)";
    }
  }, { passive: true });
}

function initHeaderAutoHide() { /* handled by inline script in HTML */ }

/* ══════════════════════════════════════════════════════════
   KEYBOARD
══════════════════════════════════════════════════════════ */
function initKeyboard() {
  document.addEventListener("keydown", e => {
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if (readMode === "single") {
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") window.nextPage();
      if (e.key === "ArrowLeft"  || e.key === "a" || e.key === "A") window.prevPage();
    } else {
      if ((e.key === "ArrowRight" || e.key === "d" || e.key === "D") && nextSlug) window.nextChapter();
      if ((e.key === "ArrowLeft"  || e.key === "a" || e.key === "A") && prevSlug) window.prevChapter();
    }
    if (e.key === "l" || e.key === "L") window.toggleChapterList();
    if (e.key === "s" || e.key === "S") window.shareKomik();
  });
}

/* ══════════════════════════════════════════════════════════
   FETCH & RENDER CHAPTER
══════════════════════════════════════════════════════════ */
function _normalizeChapter(json, source) {
  let prev, next, comicSlug;
  if (source === "komikstation") {
    prev      = json.prevSlug || null;
    next      = json.nextSlug || null;
    comicSlug = json.comicSlug || null;
  } else {
    const nav = json.navigation || {};
    prev      = (nav.prev && nav.prev !== "#prev" && nav.prev !== null) ? nav.prev : null;
    next      = (nav.next && nav.next !== "#next" && nav.next !== null) ? nav.next : null;
    comicSlug = json.comicSlug || null;
  }
  return {
    title:  json.title || "",
    images: (json.images || []).map((url, i) => ({ id: i, url: String(url) })),
    navigation: { prev, next, allChapterSlug: comicSlug },
    komikInfo: { title: (json.title || "").replace(/\s*chapter\s*[\d.]+.*/i, "").trim() },
    thumbnail: { url: "", title: "" },
    _source: source,
  };
}

async function loadChapter() {
  try {
    showLoading();

    if (autoScrollInterval) {
      clearInterval(autoScrollInterval);
      autoScrollInterval = null;
      const btn = document.getElementById("autoBtn");
      if (btn) { btn.textContent = "▶️ Auto Scroll"; btn.classList.remove("running"); }
    }

    const _srcHint = sessionStorage.getItem("komikSrcHint") || "";
    let d = null;
    let _apiSource = currentApiSource;

    const _APIs = {
      komikindo:    { fetch: (s) => fetch(API_CHAPTER   + s).then(r => r.json()) },
      mangakita:    { fetch: (s) => fetch(API_CHAPTER_2 + s).then(r => r.json()) },
      bacakomik:    { fetch: (s) => fetch(API_CHAPTER_3 + s).then(r => r.json()) },
      komikstation: { fetch: (s) => fetch(API_CHAPTER_4 + s).then(r => r.json()) },
    };

    const _allSources = ["komikindo", "komikstation", "mangakita", "bacakomik"];
    const _ordered = [_srcHint, currentApiSource, ..._allSources]
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i);

    for (const key of _ordered) {
      if (!_APIs[key]) continue;
      try {
        const json = await _APIs[key].fetch(currentChapterSlug);
        if (key === "komikindo") {
          if (!json.success || !json.data) throw new Error("no data");
          d = json.data;
        } else {
          if (!json.success || !json.images?.length) throw new Error("no images");
          d = _normalizeChapter(json, key);
        }
        _apiSource = key;
        break;
      } catch(e) {
        console.warn(`[Reader] ${key} gagal:`, e.message);
      }
    }
    if (!d) throw new Error("Semua API gagal");
    console.log(`[Reader] loaded=${_apiSource} chapter=${currentChapterSlug}`);
    currentApiSource = _apiSource;
    sessionStorage.setItem("komikSource", _apiSource);

    const bar = document.getElementById("readingProgressBar");
    if (bar) { bar.style.width = "0%"; }

    const title = cleanText(d.title);
    document.title = `${title} — Pankomik`;
    const titleEl = document.getElementById("title");
    if (titleEl) {
      const chMatch = title.match(/chapter\s*([\d]+(?:[.,][\d]+)?)/i);
      const chNum   = chMatch ? chMatch[1].replace(",", ".") : null;
      titleEl.innerText = chNum ? `Ch.${chNum}` : title;
    }

    nextSlug  = d.navigation?.next || null;
    prevSlug  = d.navigation?.prev || null;
    allImages = Array.isArray(d.images) ? d.images : [];
    currentPage = 0;

    console.log(`[Reader] images=${allImages.length} source=${_apiSource}`);

    if (allImages.length === 0) {
      document.getElementById("reader").innerHTML = `
        <div style="text-align:center;padding:80px 20px;color:#888;">
          <p style="font-size:40px;margin-bottom:12px;">📭</p>
          <p style="font-size:14px;margin-bottom:6px;">Gambar chapter tidak ditemukan</p>
          <p style="font-size:12px;color:#555;margin-bottom:20px;">Source: ${_apiSource}</p>
          <button onclick="location.reload()" style="
            padding:11px 24px;background:linear-gradient(135deg,#e8522a,#c73f1c);color:#fff;
            border:none;border-radius:12px;cursor:pointer;font-family:'Nunito',sans-serif;
            font-size:13px;font-weight:800;box-shadow:0 4px 16px rgba(232,82,42,0.3);">
            🔄 Coba Lagi
          </button>
        </div>`;
      return;
    }

    /* Komik info & slug extraction */
    const _komikFromSlug = currentChapterSlug
      .replace(/-chapter-[\d]+(?:[.-][\d]+)?.*$/i, "")
      .replace(/-ch-[\d]+(?:[.-][\d]+)?.*$/i, "")
      .replace(/-(ch|ep|eps)[\d]+.*$/i, "")
      .trim();
    const _komikFromSession = sessionStorage.getItem("komikSlug") || "";
    const _komikFromUrl = new URLSearchParams(window.location.search).get("komik") || "";
    komikSlug = d.navigation?.allChapterSlug
      || _komikFromUrl
      || (_komikFromSlug !== currentChapterSlug ? _komikFromSlug : "")
      || _komikFromSession
      || currentChapterSlug;
    if (komikSlug) sessionStorage.setItem("komikSlug", komikSlug);
    komikTitle = cleanText(
      d.komikInfo?.title
      || d.thumbnail?.title
      || title.replace(/\s*chapter\s*[\d.]+.*/i, "").trim()
    );
    komikCover = d.thumbnail?.url || "";

    pushURL(currentChapterSlug, komikSlug, `${title} — Pankomik`);
    updateNavButtons();

    if (d.komikInfo?.chapters?.length && allChapters.length === 0) {
      allChapters = d.komikInfo.chapters;
      renderChapterList();
      updateNavButtons();
    }
    loadChapterListFromAPI();

    if (readMode === "single") {
      renderSingleMode(allImages);
    } else {
      renderScrollMode(allImages);
    }

    window.dispatchEvent(new CustomEvent("readerChapterLoaded", {
      detail: { slug: currentChapterSlug, komikSlug }
    }));

    if (currentUser && !historyWasSaved) {
      historyWasSaved = true;
      const _saveChSlug  = currentChapterSlug;
      const _saveKSlug   = komikSlug;
      const _saveKTitle  = komikTitle;
      const _saveKCover  = komikCover;
      autoSaveHistory(_saveChSlug, _saveKSlug, _saveKTitle, _saveKCover);
    }

    if (nextSlug) preloadChapter(nextSlug);

  } catch (err) {
    console.error("Gagal load chapter:", err);
    const container = document.getElementById("reader");
    if (container) container.innerHTML = `
      <div class="reader-error">
        <p style="font-size:52px">😕</p>
        <p style="color:#ccc;font-size:14px;margin-bottom:4px;">Gagal memuat chapter</p>
        <p style="color:#555;font-size:12px;margin-bottom:16px;">${err?.message || "Unknown error"}</p>
        <button onclick="location.reload()" class="btn-retry">🔄 Coba Lagi</button>
        <button onclick="goHome()" class="btn-home">🏠 Beranda</button>
      </div>`;
  }
}

function cleanText(str) {
  return (str || "").replace(/\s+/g, " ").trim();
}

function showLoading() {
  document.getElementById("reader").innerHTML = `
    <div class="reader-loading">
      <div class="reader-spinner"></div>
      <div class="reader-loading-text">Memuat chapter...</div>
    </div>`;
}

function updateNavButtons() {
  const nav = getNavFromChapterList(currentChapterSlug);
  const effectivePrev = prevSlug || nav.prev || null;
  const effectiveNext = nextSlug || nav.next || null;

  if (!prevSlug && nav.prev) prevSlug = nav.prev;
  if (!nextSlug && nav.next) nextSlug = nav.next;

  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  if (prevBtn) { prevBtn.disabled = !effectivePrev; prevBtn.style.opacity = effectivePrev ? "1" : "0.2"; }
  if (nextBtn) { nextBtn.disabled = !effectiveNext; nextBtn.style.opacity = effectiveNext ? "1" : "0.2"; }

  const fbnPrev = document.getElementById("fbnPrev");
  const fbnNext = document.getElementById("fbnNext");
  const fbnInfo = document.getElementById("fbnInfo");

  if (fbnPrev) fbnPrev.disabled = !effectivePrev;
  if (fbnNext) fbnNext.disabled = !effectiveNext;

  if (fbnInfo) {
    const titleEl = document.getElementById("title");
    const chTitle = titleEl?.innerText || "";
    const m = chTitle.match(/chapter\s*([\d.]+)/i);
    fbnInfo.textContent = m ? `Ch.${m[1]}` : chTitle.slice(0, 12) || "—";
  }
}

/* ══════════════════════════════════════════════════════════
   CHAPTER LIST
══════════════════════════════════════════════════════════ */
async function loadChapterListFromAPI() {
  if (!komikSlug) return;
  try {
    const srcHintStored = sessionStorage.getItem("komikSrcHint") || "";
    const srcSlugStored = sessionStorage.getItem("komikSrcSlug") || "";
    const useSingleSrc  = srcHintStored && (srcSlugStored === komikSlug || currentApiSource === srcHintStored);

    const [r1, r2, r3, r4] = await Promise.allSettled([
      fetch(API_DETAIL   + komikSlug).then(r => r.json()).catch(() => null),
      fetch(API_DETAIL_2 + komikSlug).then(r => r.json()).catch(() => null),
      fetch(API_DETAIL_3 + komikSlug).then(r => r.json()).catch(() => null),
      fetch(API_DETAIL_4 + komikSlug).then(r => r.json()).catch(() => null),
    ]);

    const j1 = r1.status === "fulfilled" ? r1.value : null;
    const j2 = r2.status === "fulfilled" ? r2.value : null;
    const j3 = r3.status === "fulfilled" ? r3.value : null;
    const j4 = r4.status === "fulfilled" ? r4.value : null;

    const srcChapters = {
      komikindo:    (j1?.success && j1?.data?.chapters?.length) ? j1.data.chapters : [],
      mangakita:    (j2?.success && j2?.details?.chapters?.length)
        ? j2.details.chapters.map(ch => ({ title: ch.title||"", slug: (ch.slug||"").replace(/^https?:\/?\/?[^/]+\//, "").replace(/\/$/, ""), releaseTime: ch.date||"" }))
        : [],
      bacakomik:    (j3?.success && j3?.detail?.chapters?.length)
        ? j3.detail.chapters.map(ch => ({ title: ch.title||ch.slug||"", slug: ch.slug||"", releaseTime: ch.date||"" }))
        : [],
      komikstation: (j4?.success && j4?.chapters?.length)
        ? j4.chapters.map(ch => ({ title: ch.title||"", slug: ch.slug||"", releaseTime: ch.date||"" }))
        : [],
    };

    let chapters;
    if (useSingleSrc) {
      const singleSrc = srcHintStored || currentApiSource;
      chapters = (srcChapters[singleSrc] || []).slice().sort((a, b) => {
        const na = _extractNum(a.title) ?? _extractNum(a.slug) ?? 0;
        const nb = _extractNum(b.title) ?? _extractNum(b.slug) ?? 0;
        return nb - na;
      });
    } else {
      const chMap = new Map();
      const _allSources = ["komikindo", "mangakita", "bacakomik", "komikstation"].filter(s => s !== currentApiSource);
      const processOrder = [..._allSources, currentApiSource];

      for (const srcKey of processOrder) {
        const isBest = srcKey === currentApiSource;
        for (const ch of (srcChapters[srcKey] || [])) {
          const num = _extractNum(ch.title) ?? _extractNum(ch.slug);
          if (num === null || isNaN(num)) continue;
          const existing = chMap.get(num);
          chMap.set(num, {
            title:       (isBest && ch.title) ? ch.title : (existing?.title || ch.title || ""),
            slug:        (isBest && ch.slug)  ? ch.slug  : (existing?.slug  || ch.slug  || ""),
            releaseTime: ch.releaseTime || existing?.releaseTime || "",
            _num: num,
          });
        }
      }
      chapters = Array.from(chMap.values()).sort((a, b) => b._num - a._num);
    }
    if (!chapters.length) {
      const fallback = srcChapters[currentApiSource] || srcChapters.komikstation || srcChapters.komikindo || [];
      chapters = fallback;
    }

    if (chapters.length) {
      allChapters = chapters;
      renderChapterList();
      updateNavButtons();
      const oldNav = document.getElementById("bottomChapterNav");
      if (oldNav) oldNav.remove();
      const readerEl = document.getElementById("reader");
      if (readerEl) appendBottomNav(readerEl);
    }
  } catch (err) { console.error("[Reader] Gagal load chapter list:", err); }
}

function renderChapterList() {
  const panel = document.getElementById("chapterListPanel");
  if (!panel) return;

  const listHtml = allChapters.map(ch => {
    const isActive = ch.slug === currentChapterSlug;
    const rawTitle = cleanText(ch.title || ch.slug || "");
    const title    = formatChapterTitle(rawTitle, ch.slug);
    const date     = ch.releaseTime || ch.date || "";
    return `
      <div class="chapter-item-panel ${isActive ? "active" : ""}"
           onclick="navigateToChapter('${ch.slug}')">
        <span class="chapter-num">${title}</span>
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="chapter-date">${date}</span>
          ${isActive ? '<span class="current-badge">📖</span>' : ""}
        </div>
      </div>`;
  }).join("");

  panel.innerHTML = `
    <div class="chapter-list-header">
      <h3>📚 Daftar Chapter</h3>
      <button onclick="toggleChapterList()" class="close-btn">✕</button>
    </div>
    <div class="chapter-list-content">${listHtml}</div>`;
}

function formatChapterTitle(title, slug) {
  if (!title) return slug || "–";
  const isSlugLike = title.includes("-") && !title.includes(" ");
  const src = isSlugLike ? slug || title : title;
  const m = src.match(/(?:chapter|ch\.?)[_\s-]*([\d]+(?:[._-][\d]+)?)/i)
         || src.match(/([\d]+(?:\.\d+)?)$/);
  if (!m) return title;
  const num = m[1].replace(/[_-]/g, ".");
  const [main, sub] = num.split(".");
  const padded = parseInt(main) < 100 ? main.padStart(2, "0") : main;
  return sub ? `Ch.${padded}.${sub}` : `Ch.${padded}`;
}

window.toggleChapterList = function () {
  const panel   = document.getElementById("chapterListPanel");
  const overlay = document.getElementById("chapterListOverlay");
  if (!panel || !overlay) return;
  const isOpen = panel.classList.contains("open");
  panel.classList.toggle("open");
  overlay.style.display = isOpen ? "none" : "block";
  if (!isOpen) {
    setTimeout(() => {
      panel.querySelector(".chapter-item-panel.active")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  }
};

window.navigateToChapter = function (chSlug) {
  if (chSlug === currentChapterSlug) { toggleChapterList(); return; }
  currentChapterSlug = chSlug;
  historyWasSaved    = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
  loadChapter();
  toggleChapterList();
};

/* ══════════════════════════════════════════════════════════
   MODE SCROLL — HD + FAST LOADING
   - 5 gambar pertama: concurrent + fetchpriority high
   - Sisanya: sequential agar tidak flooding bandwidth
   - decode() API: render non-blocking
   - Smooth blur-to-sharp reveal
══════════════════════════════════════════════════════════ */
function renderScrollMode(images) {
  const container = document.getElementById("reader");
  container.innerHTML = "";

  const singleCtrl = document.getElementById("singleControls");
  if (singleCtrl) singleCtrl.style.display = "none";

  if (!images || images.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:#888;">
        <p style="font-size:32px;">📭</p>
        <p>Tidak ada gambar di chapter ini.</p>
      </div>`;
    appendBottomNav(container);
    return;
  }

  const savedWidth = parseInt(localStorage.getItem("imgWidth") || "100");
  const widthEl    = document.getElementById("width");
  if (widthEl) widthEl.value = savedWidth;

  /* Buat semua wrapper + skeleton sekaligus */
  const wrappers = images.map((imgObj, i) => {
    const url     = (imgObj && imgObj.url) ? imgObj.url : String(imgObj);
    const wrapper = document.createElement("div");
    wrapper.className     = "image-wrapper";
    wrapper.style.cssText = `width:${savedWidth}%;margin:0 auto;position:relative;`;

    const skeleton = document.createElement("div");
    skeleton.className     = "image-skeleton";
    skeleton.dataset.index = String(i);
    /* Tinggi skeleton: 3:4 ratio untuk komik portrait */
    skeleton.style.cssText = "aspect-ratio:3/4;width:100%;";
    wrapper.appendChild(skeleton);

    /* Badge nomor halaman */
    const badge = document.createElement("div");
    badge.className     = "page-num-badge";
    badge.textContent   = `${i + 1} / ${images.length}`;
    wrapper.appendChild(badge);

    container.appendChild(wrapper);
    return { wrapper, url, idx: i + 1 };
  });

  appendBottomNav(container);

  /* ── LOADING STRATEGY ──────────────────────────────────
     INITIAL_CONCURRENT gambar pertama: langsung semua (viewport area)
     Sisanya: satu per satu setelah yang sebelumnya selesai
     Ini optimal untuk bandwidth + perceived speed
  ─────────────────────────────────────────────────────── */
  const INITIAL_CONCURRENT = 5;
  let loadIndex = 0;

  function loadNext() {
    if (loadIndex >= wrappers.length) return;
    const item = wrappers[loadIndex++];
    loadImageHD(item.wrapper, item.url, item.idx, loadNext, loadIndex <= INITIAL_CONCURRENT);
  }

  /* Fire initial concurrent batch */
  const initialBatch = Math.min(INITIAL_CONCURRENT, wrappers.length);
  for (let i = 0; i < initialBatch; i++) {
    const item = wrappers[loadIndex++];
    /* Gambar 1-2: high priority, sisanya normal */
    loadImageHD(item.wrapper, item.url, item.idx, loadNext, true, item.idx <= 2);
  }
}

/* ── Load satu gambar dengan strategi HD ────────────────── */
function loadImageHD(wrapper, rawUrl, idx, onDone, isEager = false, isHighPriority = false) {
  const skeleton = wrapper.querySelector(".image-skeleton");
  let tried = 0;
  const MAX_TRIES = 4;

  const img = document.createElement("img");
  img.alt      = `Halaman ${idx}`;
  img.decoding = "async";

  /* Native lazy loading: eager untuk gambar atas */
  img.loading  = isEager ? "eager" : "lazy";

  /* fetchpriority untuk browser modern */
  if (isHighPriority && "fetchPriority" in img) {
    img.fetchPriority = "high";
  }

  img.style.cssText = `
    width:100%;
    max-width:800px;
    display:block;
    margin:0 auto;
    opacity:0;
    filter:blur(6px);
    transition:opacity 0.3s ease, filter 0.4s ease;
    will-change:opacity,filter;
  `;

  img.onload = async function () {
    /* decode() agar paint tidak blocking main thread */
    try { await img.decode(); } catch (_) {}
    if (skeleton) skeleton.style.display = "none";
    img.style.opacity = "1";
    img.style.filter  = "none";
    onDone();
  };

  img.onerror = function () {
    tried++;
    if (tried < MAX_TRIES) {
      img.src = getImageUrl(rawUrl, tried);
      return;
    }
    /* Semua gagal */
    if (skeleton) skeleton.style.display = "none";
    img.remove();

    const fb = document.createElement("div");
    fb.className = "image-error";
    fb.innerHTML = `<p>⚠️ Halaman ${idx} gagal dimuat</p>`;
    const retryBtn = document.createElement("button");
    retryBtn.textContent = "🔄 Coba Lagi";
    retryBtn.onclick = function () {
      fb.remove();
      tried = 0;
      wrapper.appendChild(img);
      img.src = getImageUrl(rawUrl, 0);
    };
    fb.appendChild(retryBtn);
    wrapper.appendChild(fb);
    onDone();
  };

  /* Start dengan URL langsung (paling HD) */
  img.src = getImageUrl(rawUrl, 0);
  wrapper.appendChild(img);
}

/* ══════════════════════════════════════════════════════════
   BOTTOM NAV setelah semua halaman
══════════════════════════════════════════════════════════ */
function appendBottomNav(container) {
  const nav = document.createElement("div");
  nav.id = "bottomChapterNav";
  nav.style.cssText = `
    display:flex; flex-direction:column; align-items:center;
    gap:14px; padding:44px 16px 70px;
    border-top:1px solid rgba(255,255,255,0.06); margin-top:12px;
  `;

  const chapterTitle = document.getElementById("title")?.innerText || "Chapter";

  nav.innerHTML = `
    <div style="text-align:center;margin-bottom:4px;">
      <div style="font-size:36px;margin-bottom:10px;animation:pulse 1.8s ease infinite;">🎉</div>
      <p style="font-size:15px;font-weight:900;color:#eaeaf0;margin:0 0 5px;font-family:'Syne',sans-serif;">Selesai membaca</p>
      <p style="font-size:12px;color:#666;margin:0;">${chapterTitle}</p>
    </div>

    <div style="display:flex;gap:10px;width:100%;max-width:420px;justify-content:center;flex-wrap:wrap;">
      <button
        id="bottomPrevBtn"
        onclick="window.prevChapter()"
        style="flex:1;min-width:110px;max-width:170px;padding:13px 10px;
          background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);
          border-radius:14px;color:${prevSlug?"#eaeaf0":"#333"};
          font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;
          cursor:${prevSlug?"pointer":"not-allowed"};
          display:flex;align-items:center;justify-content:center;gap:6px;
          transition:all 0.2s;"
        ${!prevSlug ? "disabled" : ""}
        onmouseenter="if(!this.disabled)this.style.background='rgba(255,255,255,0.1)'"
        onmouseleave="if(!this.disabled)this.style.background='rgba(255,255,255,0.05)'"
      >← Prev</button>

      <button
        onclick="window.location.href=window.komikSlugGlobal ? '/komik/'+window.komikSlugGlobal : '/'"
        style="padding:13px 16px;background:rgba(232,82,42,0.1);
          border:1px solid rgba(232,82,42,0.25);border-radius:14px;color:#e8522a;
          font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;
          cursor:pointer;display:flex;align-items:center;gap:6px;
          transition:all 0.2s;white-space:nowrap;"
        onmouseenter="this.style.background='rgba(232,82,42,0.18)'"
        onmouseleave="this.style.background='rgba(232,82,42,0.1)'"
      >📚 Detail</button>

      <button
        id="bottomNextBtn"
        onclick="window.nextChapter()"
        style="flex:1;min-width:110px;max-width:170px;padding:13px 10px;
          background:${nextSlug?"linear-gradient(135deg,#e8522a,#c73f1c)":"rgba(255,255,255,0.03)"};
          border:1px solid ${nextSlug?"transparent":"rgba(255,255,255,0.05)"};
          border-radius:14px;color:${nextSlug?"#fff":"#333"};
          font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;
          cursor:${nextSlug?"pointer":"not-allowed"};
          display:flex;align-items:center;justify-content:center;gap:6px;
          transition:all 0.2s;
          ${nextSlug?"box-shadow:0 4px 18px rgba(232,82,42,0.3);":""}"
        ${!nextSlug ? "disabled" : ""}
        onmouseenter="if(!this.disabled){this.style.boxShadow='0 6px 26px rgba(232,82,42,0.5)';this.style.transform='translateY(-1px)';}"
        onmouseleave="if(!this.disabled){this.style.boxShadow='0 4px 18px rgba(232,82,42,0.3)';this.style.transform='translateY(0)';}"
      >Next →</button>
    </div>

    <div style="display:flex;gap:10px;font-size:11px;color:#444;flex-wrap:wrap;justify-content:center;text-align:center;max-width:400px;">
      ${prevSlug
        ? `<span style="color:#666;">← ${prevSlug.replace(/-/g," ")}</span>`
        : `<span style="opacity:0.3;">Tidak ada chapter sebelumnya</span>`}
      <span style="color:#2a2a36;">|</span>
      ${nextSlug
        ? `<span style="color:#666;">${nextSlug.replace(/-/g," ")} →</span>`
        : `<span style="opacity:0.3;">Tidak ada chapter berikutnya</span>`}
    </div>`;

  container.appendChild(nav);
}

Object.defineProperty(window, "komikSlugGlobal", { get: () => komikSlug });

/* ══════════════════════════════════════════════════════════
   MODE SINGLE — HD per halaman
══════════════════════════════════════════════════════════ */
function renderSingleMode(images) {
  const container = document.getElementById("reader");
  container.innerHTML = `
    <div id="singleViewer" style="
      display:flex;flex-direction:column;align-items:center;
      min-height:calc(100vh - 58px);padding:10px 0 110px;">
      <div id="singleImgWrap" style="
        position:relative;width:100%;max-width:800px;margin:0 auto;
        background:#0a0a14;min-height:400px;
        display:flex;align-items:center;justify-content:center;">
        <div class="image-skeleton" id="singleSkeleton"
             style="position:absolute;inset:0;aspect-ratio:3/4;"></div>
      </div>
    </div>`;

  const singleCtrl = document.getElementById("singleControls");
  if (singleCtrl) singleCtrl.style.display = "flex";

  showPage(0);
  syncSingleControls();
}

function showPage(index) {
  if (!allImages.length) return;
  index       = Math.max(0, Math.min(allImages.length - 1, index));
  currentPage = index;

  const wrap     = document.getElementById("singleImgWrap");
  const skeleton = document.getElementById("singleSkeleton");
  if (!wrap) return;

  wrap.querySelectorAll("img").forEach(i => i.remove());
  if (skeleton) skeleton.style.display = "block";

  const imgObj = allImages[index];
  const rawUrl = (imgObj && imgObj.url) ? imgObj.url : String(imgObj);

  const img = document.createElement("img");
  img.alt           = `Halaman ${index + 1}`;
  img.decoding      = "async";
  img.loading       = "eager";
  if ("fetchPriority" in img) img.fetchPriority = "high";
  img.style.cssText = `
    width:100%;max-width:800px;display:block;margin:0 auto;
    opacity:0;filter:blur(8px);
    transition:opacity 0.35s ease, filter 0.4s ease;
  `;

  let tried = 0;

  img.onerror = function () {
    tried++;
    if (tried < 4) { img.src = getImageUrl(rawUrl, tried); return; }
    if (skeleton) skeleton.style.display = "none";
    img.style.display = "none";
  };

  img.onload = async function () {
    try { await img.decode(); } catch (_) {}
    if (skeleton) skeleton.style.display = "none";
    img.style.opacity = "1";
    img.style.filter  = "none";
  };

  img.src = getImageUrl(rawUrl, 0);
  wrap.appendChild(img);

  /* Preload gambar sebelumnya dan sesudahnya */
  [index - 1, index + 1].forEach(pi => {
    if (pi >= 0 && pi < allImages.length) {
      const preload = new Image();
      const obj     = allImages[pi];
      preload.src   = getImageUrl((obj && obj.url) ? obj.url : String(obj), 0);
    }
  });

  syncSingleControls();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function syncSingleControls() {
  const counter  = document.getElementById("pageCounter");
  const prevPage = document.getElementById("prevPageBtn");
  const nextPage = document.getElementById("nextPageBtn");
  if (counter)  counter.textContent = `${currentPage + 1} / ${allImages.length}`;
  if (prevPage) prevPage.disabled   = (currentPage === 0 && !prevSlug);
  if (nextPage) nextPage.disabled   = (currentPage === allImages.length - 1 && !nextSlug);
}

window.prevPage = () => {
  if (currentPage > 0) showPage(currentPage - 1);
  else if (prevSlug)   window.prevChapter();
};
window.nextPage = () => {
  if (currentPage < allImages.length - 1) showPage(currentPage + 1);
  else if (nextSlug)                      window.nextChapter();
};
window.showPage = showPage;

/* ══════════════════════════════════════════════════════════
   APPLY MODE
══════════════════════════════════════════════════════════ */
function applyReadMode() {
  const select     = document.getElementById("mode");
  const scrollOpts = document.getElementById("scrollSettings");
  const singleOpts = document.getElementById("singleSettings");
  const singleCtrl = document.getElementById("singleControls");

  if (select)     select.value             = readMode;
  if (scrollOpts) scrollOpts.style.display = readMode === "scroll" ? "block" : "none";
  if (singleOpts) singleOpts.style.display = readMode === "single" ? "block" : "none";
  if (singleCtrl) singleCtrl.style.display = "none";
}

window.changeMode = function (val) {
  readMode = val;
  localStorage.setItem("readMode", val);
  applyReadMode();
  if (allImages.length > 0) {
    if (readMode === "single") renderSingleMode(allImages);
    else                       renderScrollMode(allImages);
  }
};

/* ══════════════════════════════════════════════════════════
   SHARE
══════════════════════════════════════════════════════════ */
window.shareKomik = async function () {
  const url   = window.location.href;
  const title = komikTitle || document.getElementById("title")?.innerText || "Baca Komik";
  if (navigator.share) {
    try { await navigator.share({ title, url }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  try {
    await navigator.clipboard.writeText(url);
    showToastReader("🔗 Link disalin!", "success");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = url; ta.style.cssText = "position:fixed;left:-9999px;";
    document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    showToastReader("🔗 Link disalin!", "success");
  }
};

function showToastReader(msg, type = "info") {
  let wrap = document.getElementById("readerToastWrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "readerToastWrap";
    wrap.style.cssText = `
      position:fixed;bottom:100px;left:50%;transform:translateX(-50%);
      z-index:3000;pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:6px;`;
    document.body.appendChild(wrap);
  }
  const t  = document.createElement("div");
  const bg = type === "success" ? "#27ae60" : type === "error" ? "#e8522a" : "rgba(18,18,28,0.95)";
  t.style.cssText = `
    padding:10px 22px;border-radius:999px;font-size:13px;font-weight:800;
    color:#fff;white-space:nowrap;background:${bg};
    border:1px solid rgba(255,255,255,0.1);
    box-shadow:0 6px 24px rgba(0,0,0,0.4);
    animation:toastIn 0.25s cubic-bezier(0.34,1.56,0.64,1);`;
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => { t.style.transition = "opacity 0.3s"; t.style.opacity = "0"; setTimeout(() => t.remove(), 300); }, 2500);
}

/* ══════════════════════════════════════════════════════════
   PRELOAD & HISTORY
══════════════════════════════════════════════════════════ */
function preloadChapter(chSlug) {
  /* Preload API response */
  const link = document.createElement("link");
  link.rel = "prefetch"; link.href = API_CHAPTER + chSlug;
  document.head.appendChild(link);
}

async function autoSaveHistory(chSlug, kSlug, kTitle, kCover) {
  const _chSlug = chSlug || currentChapterSlug;
  const _kSlug  = kSlug  || komikSlug;
  const _kTitle = kTitle || komikTitle;
  const _kCover = kCover || komikCover;

  const match = _chSlug.match(/chapter[_-]?([\d]+(?:[._-][\d]+)?)/i);
  const chapterNumber = match ? match[1].replace(/[_-]/g, ".") : "?";

  if (!_kSlug || _kSlug === _chSlug) {
    console.warn("[History] komikSlug tidak valid, skip save:", _kSlug);
    return;
  }

  try {
    await saveHistory(
      currentUser.id,
      { slug: _kSlug, title: _kTitle, cover: _kCover },
      { slug: _chSlug, number: chapterNumber }
    );
    await updateProgress(
      currentUser.id,
      { slug: _kSlug, title: _kTitle, lastChapterSlug: _chSlug },
      0
    );
    console.log("[History] Tersimpan:", _kSlug, "→", _chSlug);
  } catch (err) {
    console.error("[History] Gagal simpan:", err);
    historyWasSaved = false;
  }
}

/* ══════════════════════════════════════════════════════════
   NAVIGASI CHAPTER
══════════════════════════════════════════════════════════ */
function _extractChNum(slug) {
  if (!slug) return "";
  const m = slug.match(/chapter[_-]?([\d]+(?:[_.-][\d]+)?)/i);
  if (!m) return "";
  return m[1].replace(/[_-]/g, ".");
}

function getNavFromChapterList(currentSlug) {
  if (!allChapters || !allChapters.length) return { prev: null, next: null };
  let idx = allChapters.findIndex(ch => ch.slug === currentSlug);
  if (idx < 0) {
    const curNum = _extractChNum(currentSlug);
    if (curNum) idx = allChapters.findIndex(ch => _extractChNum(ch.slug) === curNum);
  }
  if (idx < 0) return { prev: null, next: null };
  const next = idx > 0                        ? allChapters[idx - 1]?.slug : null;
  const prev = idx < allChapters.length - 1  ? allChapters[idx + 1]?.slug : null;
  return { prev, next };
}

window.nextChapter = () => {
  const nav = getNavFromChapterList(currentChapterSlug);
  const target = nav.next || nextSlug;
  if (!target) return;
  currentChapterSlug = target;
  historyWasSaved    = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
  loadChapter();
};
window.prevChapter = () => {
  const nav = getNavFromChapterList(currentChapterSlug);
  const target = nav.prev || prevSlug;
  if (!target) return;
  currentChapterSlug = target;
  historyWasSaved    = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
  loadChapter();
};
window.goHome = () => { window.location.href = "/"; };

/* ══════════════════════════════════════════════════════════
   SETTINGS PANEL
══════════════════════════════════════════════════════════ */
window.toggleSettings = function () {
  document.getElementById("settings")?.classList.toggle("active");
};

document.addEventListener("click", e => {
  const panel = document.getElementById("settings");
  const btn   = document.querySelector('button[onclick="toggleSettings()"]');
  if (panel?.classList.contains("active")
      && !panel.contains(e.target)
      && !btn?.contains(e.target)) {
    panel.classList.remove("active");
  }
});

/* ══════════════════════════════════════════════════════════
   DROPDOWN MENU
══════════════════════════════════════════════════════════ */
window.toggleMenu = function () {
  const m = document.getElementById("menuDropdown");
  if (!m) return;
  m.style.display = m.style.display === "block" ? "none" : "block";
};

/* ══════════════════════════════════════════════════════════
   LEBAR GAMBAR
══════════════════════════════════════════════════════════ */
document.getElementById("width")?.addEventListener("input", e => {
  const val = e.target.value;
  document.querySelectorAll(".image-wrapper").forEach(w => { w.style.width = val + "%"; });
  localStorage.setItem("imgWidth", val);
});

/* ══════════════════════════════════════════════════════════
   AUTO SCROLL — smooth
══════════════════════════════════════════════════════════ */
window.toggleAutoScroll = function () {
  const btn = document.getElementById("autoBtn");
  if (autoScrollInterval) {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
    if (btn) { btn.textContent = "▶️ Auto Scroll"; btn.classList.remove("running"); }
    return;
  }
  const speed = parseInt(document.getElementById("speed")?.value || "3");
  autoScrollInterval = setInterval(() => {
    window.scrollBy({ top: speed, behavior: "instant" });
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 10) {
      clearInterval(autoScrollInterval);
      autoScrollInterval = null;
      if (btn) { btn.textContent = "▶️ Auto Scroll"; btn.classList.remove("running"); }
    }
  }, 30);
  if (btn) { btn.textContent = "⏹️ Stop"; btn.classList.add("running"); }
};

/* ══════════════════════════════════════════════════════════
   TAP TO TOGGLE NAVIGASI
══════════════════════════════════════════════════════════ */
document.addEventListener("click", e => {
  if (typeof window._navShow !== "function") return;

  const UI_IDS = [
    "readerHeader", "floatingBottomNav", "settings",
    "chapterListPanel", "chapterListOverlay", "menuDropdown",
    "singleControls", "bottomChapterNav", "readerCommentSection",
    "readerToastWrap", "tapHint"
  ];

  for (const id of UI_IDS) {
    const el = document.getElementById(id);
    if (el && el.contains(e.target)) return;
  }

  if (window._navVisible()) {
    window._navHide();
  } else {
    window._navShow();
  }
}, { capture: false });
