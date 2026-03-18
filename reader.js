/* ============================================================
   PANKOMIK — reader.js  (Fixed & Enhanced)
   API chapter: /comic/komikindo/chapter/{slug}
   JSON: {
     data: {
       title, navigation: { prev, next, allChapterSlug },
       images: [ { id, url } ],
       thumbnail: { url, title },
       komikInfo: { title, description, chapters: [{title,slug}] }
     }
   }

   PERBAIKAN:
   - Gambar load berurutan dari atas (sequential, bukan IntersectionObserver acak)
   - Tombol Prev/Next chapter di bawah setelah semua gambar
   - Fix bug header hide event listener ganda
   - Fix bug singleControls tampil di mode scroll
   - Fix updateNavButtons tidak disable tombol
   - Kompatibel dengan reader.html yang sudah ada
   ============================================================ */

import { getCurrentUser, saveHistory, updateProgress } from "/supabase.js";
import { getSlug, getKomikSlug, readerURL, komikURL, pushURL } from "/router.js";

/* ── KONSTANTA API ───────────────────────────────────────── */
const API_CHAPTER   = "https://www.sankavollerei.com/comic/komikindo/chapter/";
const API_DETAIL    = "https://www.sankavollerei.com/comic/komikindo/detail/";
const API_CHAPTER_2 = "https://www.sankavollerei.com/comic/mangakita/chapter/";
const API_DETAIL_2  = "https://www.sankavollerei.com/comic/mangakita/detail/";

/* ── SLUG dari URL ───────────────────────────────────────── */
const slug = getSlug();
if (!slug) window.location.href = "/";

/* ── STATE ──────────────────────────────────────────────── */
let autoScrollInterval = null;
let nextSlug           = null;
let prevSlug           = null;
let currentUser        = null;
let historyWasSaved    = false;
let allChapters        = [];
let currentChapterSlug = slug;
let komikSlug          = null;
let komikTitle         = "";
let komikCover         = "";

let readMode    = localStorage.getItem("readMode") || "scroll";
let currentPage = 0;
let allImages   = [];   /* array of { id, url } */

/* ============================================================
   INIT
   ============================================================ */
window.addEventListener("DOMContentLoaded", async () => {
  currentUser = await getCurrentUser();
  initProgressBar();
  applyReadMode();
  await loadChapter();
  initHeaderAutoHide();
  initKeyboard();
});

/* ============================================================
   READING PROGRESS BAR
   ============================================================ */
function initProgressBar() {
  const bar = document.getElementById("readingProgressBar");
  if (!bar) return;
  window.addEventListener("scroll", () => {
    if (readMode !== "scroll") return;
    const scrollable = document.body.scrollHeight - window.innerHeight;
    const pct = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
    bar.style.width = Math.min(pct, 100) + "%";
    bar.style.background = pct >= 95
      ? "linear-gradient(90deg,#27ae60,#2ecc71)"
      : "linear-gradient(90deg,#e8522a,#f5a623)";
  }, { passive: true });
}

/* ============================================================
   HEADER AUTO-HIDE (dipindah ke fungsi tersendiri agar
   tidak dipanggil lebih dari sekali / tidak menumpuk listener)
   ============================================================ */
function initHeaderAutoHide() {
  const header = document.querySelector(".reader-header");
  if (!header) return;

  let scrollTimer = null;
  let lastY       = window.scrollY;

  window.addEventListener("scroll", () => {
    const currentY = window.scrollY;
    /* Sembunyikan saat scroll ke bawah, tampilkan saat ke atas */
    if (currentY > lastY + 10) {
      header.classList.add("hide");
    } else if (currentY < lastY - 10) {
      header.classList.remove("hide");
    }
    lastY = currentY;

    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => header.classList.remove("hide"), 2000);
  }, { passive: true });

  /* Tap pada area gambar untuk toggle header */
  document.getElementById("reader")?.addEventListener("click", () => {
    header.classList.toggle("hide");
  });
}

/* ============================================================
   KEYBOARD SHORTCUTS
   ============================================================ */
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

/* ============================================================
   FETCH & RENDER CHAPTER
   ============================================================ */
async function loadChapter() {
  try {
    showLoading();

    /* Stop auto scroll kalau sedang jalan */
    if (autoScrollInterval) {
      clearInterval(autoScrollInterval);
      autoScrollInterval = null;
      const btn = document.getElementById("autoBtn");
      if (btn) { btn.textContent = "▶️ Mulai Auto Scroll"; btn.classList.remove("running"); }
    }

    /* ── Coba API 1: komikindo ── */
    let d = null;
    let _apiSource = "komikindo";

    try {
      const res = await fetch(API_CHAPTER + currentChapterSlug);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success || !json.data) throw new Error("API 1 invalid");
      d = json.data;
    } catch (err1) {
      console.warn("[Reader] API 1 gagal, coba API 2:", err1.message);

      /* ── Fallback ke API 2: mangakita ── */
      const res2 = await fetch(API_CHAPTER_2 + currentChapterSlug);
      if (!res2.ok) throw new Error(`API 2 HTTP ${res2.status}`);
      const json2 = await res2.json();
      if (!json2.success) throw new Error("API 2 error: " + (json2.message || ""));

      /* Normalize mangakita response ke format komikindo */
      d = {
        title:     json2.title || currentChapterSlug,
        images:    (json2.images || []).map((url, i) => ({ id: i, url })),
        navigation: {
          prev:           json2.navigation?.prev !== "#prev" ? json2.navigation?.prev : null,
          next:           json2.navigation?.next !== "#next" ? json2.navigation?.next : null,
          allChapterSlug: json2.comicSlug || null,
        },
        komikInfo: { title: json2.title?.replace(/\s*chapter\s*[\d.]+.*/i, "").trim() || "" },
        thumbnail: { url: "", title: "" },
      };
      _apiSource = "mangakita";
    }
    console.log("[Reader] Loaded from:", _apiSource);

    /* Reset progress bar */
    const bar = document.getElementById("readingProgressBar");
    if (bar) { bar.style.width = "0%"; bar.style.background = "linear-gradient(90deg,#e8522a,#f5a623)"; }

    const title = cleanText(d.title);
    document.title = `${title} — Pankomik`;
    const titleEl = document.getElementById("title");
    if (titleEl) titleEl.innerText = title;

    /* Navigation slugs */
    nextSlug = d.navigation?.next || null;
    prevSlug = d.navigation?.prev || null;

    /* Images — API: [{id, url}] */
    allImages   = Array.isArray(d.images) ? d.images : [];
    currentPage = 0;

    /* Komik info */
    komikSlug  = d.navigation?.allChapterSlug
      || currentChapterSlug.replace(/-chapter-[\d]+.*/i, "");
    komikTitle = cleanText(
      d.komikInfo?.title
      || d.thumbnail?.title
      || title.replace(/\s*chapter\s*[\d.]+.*/i, "").trim()
    );
    komikCover = d.thumbnail?.url || "";

    /* Update browser URL ke pretty URL */
    pushURL(currentChapterSlug, komikSlug, `${title} — Pankomik`);

    updateNavButtons();

    /* Chapter list */
    if (d.komikInfo?.chapters?.length) {
      allChapters = d.komikInfo.chapters;
      renderChapterList();
    } else if (allChapters.length === 0) {
      loadChapterListFromAPI();
    } else {
      renderChapterList();
    }

    /* Render gambar sesuai mode */
    if (readMode === "single") {
      renderSingleMode(allImages);
    } else {
      renderScrollMode(allImages);
    }

    /* Auto-save history */
    if (currentUser && !historyWasSaved) {
      historyWasSaved = true;
      autoSaveHistory();
    }

    /* Preload chapter berikutnya */
    if (nextSlug) preloadChapter(nextSlug);

  } catch (err) {
    console.error("Gagal load chapter:", err);
    showError("Gagal memuat chapter. Coba lagi.");
  }
}

/* ── Teks pembersih ─────────────────────────────────────── */
function cleanText(str) {
  return (str || "").replace(/\s+/g, " ").trim();
}

/* ── Loading & Error state ──────────────────────────────── */
function showLoading() {
  document.getElementById("reader").innerHTML = `
    <div class="reader-loading">
      <div class="reader-spinner"></div>
      <p style="color:#888;font-size:14px;">Memuat chapter...</p>
    </div>`;
}

function showError(msg) {
  document.getElementById("reader").innerHTML = `
    <div class="reader-error">
      <p style="font-size:48px">😕</p>
      <p style="color:#888;">${msg}</p>
      <button onclick="location.reload()" class="btn-retry">🔄 Coba Lagi</button>
      <button onclick="goHome()" class="btn-home">🏠 Ke Beranda</button>
    </div>`;
}

/* ── Update tombol prev/next di header ─────────────────── */
function updateNavButtons() {
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");

  if (prevBtn) {
    prevBtn.disabled           = !prevSlug;
    prevBtn.style.opacity      = prevSlug ? "1" : "0.3";
    prevBtn.style.pointerEvents = prevSlug ? "auto" : "none";
  }
  if (nextBtn) {
    nextBtn.disabled           = !nextSlug;
    nextBtn.style.opacity      = nextSlug ? "1" : "0.3";
    nextBtn.style.pointerEvents = nextSlug ? "auto" : "none";
  }
}

/* ============================================================
   CHAPTER LIST PANEL
   ============================================================ */
async function loadChapterListFromAPI() {
  if (!komikSlug) return;
  try {
    /* Coba API 1: komikindo */
    let chapters = null;
    try {
      const res  = await fetch(API_DETAIL + komikSlug);
      const json = await res.json();
      if (json.success && json.data?.chapters?.length) {
        chapters = json.data.chapters;
      } else throw new Error("API 1 no chapters");
    } catch (e1) {
      console.warn("[Reader] Chapter list API 1 gagal, coba API 2:", e1.message);
      /* Fallback ke API 2: mangakita */
      const res2  = await fetch(API_DETAIL_2 + komikSlug);
      const json2 = await res2.json();
      if (json2.success && json2.details?.chapters?.length) {
        /* Normalize mangakita chapter slug dari URL ke slug bersih */
        chapters = json2.details.chapters.map(ch => ({
          title:       ch.title || "",
          slug:        (ch.slug || "").replace(/^https?:\/?\/?[^/]+\//, "").replace(/\/$/, ""),
          releaseTime: ch.date  || "",
        }));
      }
    }

    if (chapters?.length) {
      allChapters = chapters;
      renderChapterList();
    }
  } catch (err) { console.error("[Reader] Gagal load chapter list:", err); }
}

function renderChapterList() {
  const panel = document.getElementById("chapterListPanel");
  if (!panel) return;

  const listHtml = allChapters.map(ch => {
    const isActive = ch.slug === currentChapterSlug;
    const title    = cleanText(ch.title);
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

/* ============================================================
   MODE SCROLL — semua gambar vertikal, LOAD BERURUTAN
   Gambar ke-N hanya mulai load setelah gambar ke-(N-1) selesai.
   Ini memastikan gambar tampil dari atas ke bawah secara urut,
   bukan random/acak seperti IntersectionObserver.
   ============================================================ */
function renderScrollMode(images) {
  const container = document.getElementById("reader");
  container.innerHTML = "";

  /* Sembunyikan single-page controls */
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

  /* Buat semua wrapper dulu (dengan skeleton) agar halaman punya tinggi */
  const wrappers = images.map((imgObj, i) => {
    const url     = (imgObj && imgObj.url) ? imgObj.url : String(imgObj);
    const wrapper = document.createElement("div");
    wrapper.className     = "image-wrapper";
    wrapper.style.cssText = `width:${savedWidth}%;margin:0 auto;position:relative;`;

    /* Skeleton placeholder — aspect ratio 2:3 untuk komik vertikal */
    const skeleton = document.createElement("div");
    skeleton.className     = "image-skeleton";
    skeleton.dataset.index = String(i);
    skeleton.style.cssText = "aspect-ratio:2/3;width:100%;";
    wrapper.appendChild(skeleton);

    /* Nomor halaman kecil (opsional, bisa disembunyikan via CSS) */
    const pageNum = document.createElement("div");
    pageNum.style.cssText = `
      position:absolute;bottom:6px;right:8px;
      font-size:11px;font-weight:700;color:rgba(255,255,255,0.35);
      pointer-events:none;z-index:2;`;
    pageNum.textContent = `${i + 1} / ${images.length}`;
    wrapper.appendChild(pageNum);

    container.appendChild(wrapper);
    return { wrapper, url, idx: i + 1 };
  });

  /* Tombol navigasi di bawah */
  appendBottomNav(container);

  /* ── SEQUENTIAL LOADING ─────────────────────────────────
     Load satu per satu dari gambar pertama.
     Gambar berikutnya baru mulai load saat gambar sebelumnya
     sudah onload ATAU onerror (jangan tunggu tanpa batas).
  ─────────────────────────────────────────────────────── */
  let loadIndex = 0;

  function loadNext() {
    if (loadIndex >= wrappers.length) return;
    const { wrapper, url, idx } = wrappers[loadIndex];
    loadIndex++;
    loadImageSequential(wrapper, url, idx, loadNext);
  }

  /* Mulai 3 gambar pertama sekaligus agar terasa cepat,
     sisanya berurutan */
  const INITIAL_CONCURRENT = 3;
  for (let i = 0; i < Math.min(INITIAL_CONCURRENT, wrappers.length); i++) {
    const { wrapper, url, idx } = wrappers[loadIndex];
    loadIndex++;
    loadImageSequential(wrapper, url, idx, loadNext);
  }
}

/* Load satu gambar ke dalam wrapper, panggil onDone setelah selesai */
function loadImageSequential(wrapper, url, idx, onDone) {
  const skeleton = wrapper.querySelector(".image-skeleton");
  let tried = 0;

  function getUrl(n) {
    const clean = url.split("?")[0].replace(/^https?:\/\//, "");
    if (n === 0) return "https://images.weserv.nl/?url=" + encodeURIComponent(clean) + "&w=800&output=webp&q=85";
    if (n === 1) return "https://wsrv.nl/?url=" + encodeURIComponent(url.split("?")[0]) + "&w=800";
    return url; /* direct fallback */
  }

  const img = document.createElement("img");
  img.alt           = "Page " + idx;
  img.decoding      = "async";
  img.style.cssText = "width:100%;display:block;opacity:0;transition:opacity 0.25s ease;";

  img.onload = function () {
    if (skeleton) skeleton.style.display = "none";
    img.style.opacity = "1";
    onDone(); /* lanjut ke gambar berikutnya */
  };

  img.onerror = function () {
    tried++;
    if (tried <= 2) {
      img.src = getUrl(tried);
      return;
    }
    /* Semua proxy gagal — tampilkan fallback */
    if (skeleton) skeleton.style.display = "none";
    img.remove();

    const fb = document.createElement("div");
    fb.style.cssText = `
      display:flex;flex-direction:column;align-items:center;
      justify-content:center;padding:40px 20px;gap:10px;
      background:#151519;min-height:120px;border:1px dashed #333;`;
    fb.innerHTML = `
      <p style="color:#888;font-size:14px;">⚠️ Halaman ${idx} gagal dimuat</p>`;
    const retryBtn = document.createElement("button");
    retryBtn.textContent = "🔄 Coba Lagi";
    retryBtn.style.cssText = `
      padding:7px 18px;background:#e8522a;color:#fff;border:none;
      border-radius:8px;cursor:pointer;font-weight:700;font-size:13px;
      font-family:'Nunito',sans-serif;transition:background 0.2s;`;
    retryBtn.onmouseenter = () => retryBtn.style.background = "#c73f1c";
    retryBtn.onmouseleave = () => retryBtn.style.background = "#e8522a";
    retryBtn.onclick = function () {
      fb.remove();
      tried = 0;
      img.src = "";
      wrapper.appendChild(img);
      img.src = getUrl(0);
    };
    fb.appendChild(retryBtn);
    wrapper.appendChild(fb);

    onDone(); /* tetap lanjut meskipun error */
  };

  img.src = getUrl(0);
  wrapper.appendChild(img);
}

/* ============================================================
   TOMBOL NAVIGASI DI BAWAH KOMIK (hanya mode scroll)
   ============================================================ */
function appendBottomNav(container) {
  const nav = document.createElement("div");
  nav.id = "bottomChapterNav";
  nav.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 40px 16px 60px;
    border-top: 1px solid rgba(255,255,255,0.07);
    margin-top: 10px;
  `;

  /* Judul chapter selesai */
  const chapterTitle = document.getElementById("title")?.innerText || "Chapter";
  nav.innerHTML = `
    <div style="text-align:center;margin-bottom:8px;">
      <div style="font-size:32px;margin-bottom:8px;">🎉</div>
      <p style="font-size:14px;font-weight:700;color:#eaeaf0;margin:0 0 4px;">Selesai membaca</p>
      <p style="font-size:12px;color:#888;margin:0;">${chapterTitle}</p>
    </div>

    <div style="display:flex;gap:10px;width:100%;max-width:400px;justify-content:center;flex-wrap:wrap;">
      <!-- Tombol Prev Chapter -->
      <button
        id="bottomPrevBtn"
        onclick="window.prevChapter()"
        style="
          flex:1;min-width:120px;max-width:180px;
          padding:13px 10px;
          background:rgba(255,255,255,0.06);
          border:1px solid rgba(255,255,255,0.12);
          border-radius:12px;
          color:#eaeaf0;
          font-family:'Nunito',sans-serif;
          font-size:13px;
          font-weight:800;
          cursor:pointer;
          display:flex;align-items:center;justify-content:center;gap:6px;
          transition:all 0.2s;
        "
        onmouseenter="if(!this.disabled)this.style.background='rgba(255,255,255,0.12)'"
        onmouseleave="if(!this.disabled)this.style.background='rgba(255,255,255,0.06)'"
        ${!prevSlug ? "disabled style='flex:1;min-width:120px;max-width:180px;padding:13px 10px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);border-radius:12px;color:#444;font-family:Nunito,sans-serif;font-size:13px;font-weight:800;cursor:not-allowed;display:flex;align-items:center;justify-content:center;gap:6px;'" : ""}
      >
        ← Prev
      </button>

      <!-- Tombol kembali ke halaman detail -->
      <button
        onclick="window.location.href=komikSlugGlobal ? '/komik/'+komikSlugGlobal : '/'"
        style="
          padding:13px 16px;
          background:rgba(232,82,42,0.1);
          border:1px solid rgba(232,82,42,0.25);
          border-radius:12px;
          color:#e8522a;
          font-family:'Nunito',sans-serif;
          font-size:13px;
          font-weight:800;
          cursor:pointer;
          display:flex;align-items:center;gap:6px;
          transition:all 0.2s;
          white-space:nowrap;
        "
        onmouseenter="this.style.background='rgba(232,82,42,0.18)'"
        onmouseleave="this.style.background='rgba(232,82,42,0.1)'"
      >
        📚 Detail
      </button>

      <!-- Tombol Next Chapter -->
      <button
        id="bottomNextBtn"
        onclick="window.nextChapter()"
        style="
          flex:1;min-width:120px;max-width:180px;
          padding:13px 10px;
          background:${nextSlug ? "#e8522a" : "rgba(255,255,255,0.03)"};
          border:1px solid ${nextSlug ? "#e8522a" : "rgba(255,255,255,0.05)"};
          border-radius:12px;
          color:${nextSlug ? "#fff" : "#444"};
          font-family:'Nunito',sans-serif;
          font-size:13px;
          font-weight:800;
          cursor:${nextSlug ? "pointer" : "not-allowed"};
          display:flex;align-items:center;justify-content:center;gap:6px;
          transition:all 0.2s;
        "
        ${!nextSlug ? "disabled" : ""}
        onmouseenter="if(!this.disabled){this.style.background='#c73f1c';this.style.borderColor='#c73f1c';}"
        onmouseleave="if(!this.disabled){this.style.background='#e8522a';this.style.borderColor='#e8522a';}"
      >
        Next →
      </button>
    </div>

    <!-- Info chapter sebelah & sesudah -->
    <div style="display:flex;gap:8px;font-size:11px;color:#555;flex-wrap:wrap;justify-content:center;text-align:center;max-width:400px;">
      ${prevSlug ? `<span>← ${prevSlug.replace(/-/g," ")}</span>` : `<span style="opacity:0.4;">Tidak ada chapter sebelumnya</span>`}
      <span style="color:#333;">|</span>
      ${nextSlug ? `<span>${nextSlug.replace(/-/g," ")} →</span>` : `<span style="opacity:0.4;">Tidak ada chapter berikutnya</span>`}
    </div>
  `;

  container.appendChild(nav);
}

/* Expose komikSlug ke global agar dipakai tombol Detail di appendBottomNav */
Object.defineProperty(window, "komikSlugGlobal", {
  get: () => komikSlug
});

/* ============================================================
   MODE SINGLE — satu gambar sekaligus
   ============================================================ */
function renderSingleMode(images) {
  const container = document.getElementById("reader");
  container.innerHTML = `
    <div id="singleViewer" style="
      display:flex;flex-direction:column;align-items:center;
      min-height:calc(100vh - 58px);padding:10px 0 100px;">
      <div id="singleImgWrap" style="
        position:relative;width:100%;max-width:720px;margin:0 auto;
        background:#0e0e12;min-height:400px;
        display:flex;align-items:center;justify-content:center;">
        <div class="image-skeleton" id="singleSkeleton"
             style="position:absolute;inset:0;aspect-ratio:2/3;"></div>
      </div>
    </div>`;

  /* Tampilkan single controls */
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

  /* Hapus gambar lama */
  wrap.querySelectorAll("img").forEach(i => i.remove());
  if (skeleton) skeleton.style.display = "block";

  const imgObj = allImages[index];
  const url    = (imgObj && imgObj.url) ? imgObj.url : String(imgObj);

  const img = document.createElement("img");
  img.alt           = `Page ${index + 1}`;
  img.style.cssText = "width:100%;max-width:720px;display:block;opacity:0;transition:opacity 0.25s;";

  let tried = 0;
  function getUrl(n) {
    const clean = url.split("?")[0].replace(/^https?:\/\//, "");
    if (n === 0) return "https://images.weserv.nl/?url=" + encodeURIComponent(clean) + "&w=800&output=webp&q=85";
    if (n === 1) return "https://wsrv.nl/?url=" + encodeURIComponent(url.split("?")[0]) + "&w=800";
    return url;
  }

  img.onerror = function () {
    tried++;
    if (tried <= 2) { img.src = getUrl(tried); return; }
    if (skeleton) skeleton.style.display = "none";
    img.style.display = "none";
  };
  img.onload = function () {
    if (skeleton) skeleton.style.display = "none";
    img.style.opacity = "1";
  };
  img.src = getUrl(0);
  wrap.appendChild(img);

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
  if (currentPage > 0)       showPage(currentPage - 1);
  else if (prevSlug)         window.prevChapter();
};
window.nextPage = () => {
  if (currentPage < allImages.length - 1) showPage(currentPage + 1);
  else if (nextSlug)                      window.nextChapter();
};
window.showPage = showPage;

/* ============================================================
   APPLY MODE
   ============================================================ */
function applyReadMode() {
  const select     = document.getElementById("mode");
  const scrollOpts = document.getElementById("scrollSettings");
  const singleOpts = document.getElementById("singleSettings");
  const singleCtrl = document.getElementById("singleControls");

  if (select)     select.value             = readMode;
  if (scrollOpts) scrollOpts.style.display = readMode === "scroll" ? "block" : "none";
  if (singleOpts) singleOpts.style.display = readMode === "single" ? "block" : "none";
  /* Single controls hanya tampil setelah gambar dirender di mode single */
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

/* ============================================================
   SHARE
   ============================================================ */
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
      position:fixed;bottom:90px;left:50%;transform:translateX(-50%);
      z-index:3000;pointer-events:none;`;
    document.body.appendChild(wrap);
  }
  const t  = document.createElement("div");
  const bg = type === "success" ? "#27ae60" : type === "error" ? "#e8522a" : "#333";
  t.style.cssText = `
    padding:10px 20px;border-radius:99px;font-size:13px;font-weight:700;
    color:#fff;white-space:nowrap;background:${bg};
    box-shadow:0 4px 20px rgba(0,0,0,0.4);
    animation:toastIn 0.25s ease;`;
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

/* ============================================================
   PRELOAD & HISTORY
   ============================================================ */
function preloadChapter(chSlug) {
  const link = document.createElement("link");
  link.rel = "prefetch"; link.href = API_CHAPTER + chSlug;
  document.head.appendChild(link);
}

async function autoSaveHistory() {
  const match         = currentChapterSlug.match(/chapter-(\d+)/i);
  const chapterNumber = match ? match[1] : "?";
  await saveHistory(
    currentUser.id,
    { slug: komikSlug, title: komikTitle, cover: komikCover },
    { slug: currentChapterSlug, number: chapterNumber }
  );
  await updateProgress(
    currentUser.id,
    { slug: komikSlug, title: komikTitle, lastChapterSlug: currentChapterSlug },
    0
  );
}

/* ============================================================
   NAVIGASI CHAPTER
   ============================================================ */
window.nextChapter = () => {
  if (!nextSlug) return;
  currentChapterSlug = nextSlug;
  historyWasSaved    = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
  loadChapter();
};
window.prevChapter = () => {
  if (!prevSlug) return;
  currentChapterSlug = prevSlug;
  historyWasSaved    = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
  loadChapter();
};
window.goHome = () => {
  window.location.href = "/";
};

/* ============================================================
   SETTINGS PANEL
   ============================================================ */
window.toggleSettings = function () {
  document.getElementById("settings")?.classList.toggle("active");
};

/* Tutup settings saat klik di luar */
document.addEventListener("click", e => {
  const panel = document.getElementById("settings");
  const btn   = document.querySelector('button[onclick="toggleSettings()"]');
  if (panel?.classList.contains("active")
      && !panel.contains(e.target)
      && !btn?.contains(e.target)) {
    panel.classList.remove("active");
  }
});

/* ============================================================
   DROPDOWN MENU (auth)
   ============================================================ */
window.toggleMenu = function () {
  const m = document.getElementById("menuDropdown");
  if (!m) return;
  m.style.display = m.style.display === "block" ? "none" : "block";
};

/* ============================================================
   LEBAR GAMBAR (mode scroll)
   ============================================================ */
document.getElementById("width")?.addEventListener("input", e => {
  const val = e.target.value;
  document.querySelectorAll(".image-wrapper").forEach(w => {
    w.style.width = val + "%";
  });
  localStorage.setItem("imgWidth", val);
});

/* ============================================================
   AUTO SCROLL
   ============================================================ */
window.toggleAutoScroll = function () {
  const btn = document.getElementById("autoBtn");
  if (autoScrollInterval) {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
    if (btn) { btn.textContent = "▶️ Mulai Auto Scroll"; btn.classList.remove("running"); }
    return;
  }
  const speed = parseInt(document.getElementById("speed")?.value || "3");
  autoScrollInterval = setInterval(() => {
    window.scrollBy(0, speed);
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 10) {
      clearInterval(autoScrollInterval);
      autoScrollInterval = null;
      if (btn) { btn.textContent = "▶️ Mulai Auto Scroll"; btn.classList.remove("running"); }
    }
  }, 30);
  if (btn) { btn.textContent = "⏹️ Stop"; btn.classList.add("running"); }
};
