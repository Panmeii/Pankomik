/* ============================================================
   PANKOMIK — reader.js
   API chapter: /comic/komikindo/chapter/{slug}
   JSON: {
     data: {
       title, navigation: { prev, next, allChapterSlug },
       images: [ { id, url } ],
       thumbnail: { url, title },
       komikInfo: { title, description, chapters: [{title,slug}] }
     }
   }
   ============================================================ */

import { getCurrentUser, saveHistory, updateProgress } from "./supabase.js";

/* ── IMAGE PROXY ─────────────────────────────────────────── */
function proxyImg(url, width) {
  if (!url) return "";
  if (url.startsWith("data:") || url.includes("weserv.nl") || url.includes("wsrv.nl") || url.includes("ui-avatars")) return url;
  const clean = url.split("?")[0].replace(/^https?:\/\//, "");
  return "https://images.weserv.nl/?url=" + encodeURIComponent(clean) + "&w=" + (width||800) + "&output=webp&q=85";
}

/* Fallback chain untuk gambar komik (bisa beda domain tiap halaman) */
function createComicImg(originalUrl, altText) {
  const img = document.createElement("img");
  img.alt = altText || "";
  img.style.cssText = "width:100%;display:block;opacity:0;transition:opacity 0.3s;";

  let tried = 0;
  function getProxy(n, u) {
    const clean = u.split("?")[0].replace(/^https?:\/\//, "");
    if (n === 0) return "https://images.weserv.nl/?url=" + encodeURIComponent(clean) + "&w=800&output=webp&q=85";
    if (n === 1) return "https://wsrv.nl/?url="          + encodeURIComponent(u.split("?")[0]) + "&w=800";
    return u; /* direct */
  }

  img.onerror = function () {
    tried++;
    if (tried <= 2) {
      img.src = getProxy(tried, originalUrl);
    } else {
      img.style.display = "none";
      const sib = img.nextElementSibling;
      if (sib) sib.style.display = "flex";
    }
  };
  img.onload = function () { img.style.opacity = "1"; };
  img.src = getProxy(0, originalUrl);
  return img;
}

/* ── BERSIHKAN TEKS API ──────────────────────────────────── */
function cleanText(str) {
  return (str || "").replace(/\s+/g, " ").trim();
}

/* ── URL PARAMS ─────────────────────────────────────────── */
const API_CHAPTER = "https://www.sankavollerei.com/comic/komikindo/chapter/";
const API_DETAIL  = "https://www.sankavollerei.com/comic/komikindo/detail/";

import { getSlug, getKomikSlug, readerURL, komikURL, pushURL } from "./router.js";
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
let allImages   = [];   /* array of {id, url} */

/* ============================================================
   INIT
   ============================================================ */
window.addEventListener("DOMContentLoaded", async () => {
  currentUser = await getCurrentUser();
  initProgressBar();
  applyReadMode();
  await loadChapter();
});

/* ============================================================
   READING PROGRESS BAR
   ============================================================ */
function initProgressBar() {
  const bar = document.getElementById("readingProgressBar");
  if (!bar) return;
  window.addEventListener("scroll", () => {
    if (readMode !== "scroll") return;
    const pct = document.body.scrollHeight - window.innerHeight > 0
      ? (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100 : 0;
    bar.style.width = Math.min(pct, 100) + "%";
    bar.style.background = pct >= 95 ? "linear-gradient(90deg,#27ae60,#2ecc71)" : "linear-gradient(90deg,#e8522a,#f5a623)";
  }, { passive: true });
}

/* ============================================================
   FETCH & RENDER CHAPTER
   ============================================================ */
async function loadChapter() {
  try {
    showLoading();

    const res  = await fetch(API_CHAPTER + currentChapterSlug);
    const json = await res.json();

    if (!json.success || !json.data) throw new Error("Invalid data");

    const d = json.data;

    /* Reset progress bar */
    const bar = document.getElementById("readingProgressBar");
    if (bar) { bar.style.width = "0%"; bar.style.background = "linear-gradient(90deg,#e8522a,#f5a623)"; }

    const title = cleanText(d.title);
    document.title = `${title} — Pankomik`;
    document.getElementById("title").innerText = title;

    /* Navigation — new API returns prev/next as slug strings */
    nextSlug = d.navigation?.next || null;
    prevSlug = d.navigation?.prev || null;

    /* Images — new API: [{id, url}], extract urls */
    allImages   = Array.isArray(d.images) ? d.images : [];
    currentPage = 0;

    /* Komik info */
    komikSlug  = d.navigation?.allChapterSlug || currentChapterSlug.replace(/-chapter-[\d]+.*/i, "");
    komikTitle = cleanText(d.komikInfo?.title || d.thumbnail?.title || title.replace(/\s*chapter\s*[\d.]+.*/i, "").trim());
    komikCover = d.thumbnail?.url || "";

    /* Update browser URL ke pretty URL */
    pushURL(currentChapterSlug, komikSlug, `${title} — Pankomik`);

    updateNavButtons();

    /* Chapter list dari komikInfo (sudah termasuk di response) */
    if (d.komikInfo?.chapters?.length) {
      allChapters = d.komikInfo.chapters;
      renderChapterList();
    } else if (allChapters.length === 0) {
      loadChapterListFromAPI();
    } else {
      renderChapterList();
    }

    /* Render gambar */
    if (readMode === "single") {
      renderSingleMode(allImages);
    } else {
      renderImages(allImages);
    }

    /* Auto-save history */
    if (currentUser && !historyWasSaved) {
      historyWasSaved = true;
      autoSaveHistory();
    }

    /* Preload next */
    if (nextSlug) preloadChapter(nextSlug);

  } catch (err) {
    console.error("Gagal load chapter:", err);
    showError("Gagal memuat chapter. Coba lagi.");
  }
}

function showLoading() {
  document.getElementById("reader").innerHTML = `
    <div class="reader-loading">
      <div class="reader-spinner"></div>
      <p>Memuat chapter...</p>
    </div>`;
}

function showError(msg) {
  document.getElementById("reader").innerHTML = `
    <div class="reader-error">
      <p style="font-size:48px">😕</p>
      <p>${msg}</p>
      <button onclick="location.reload()" class="btn-retry">🔄 Coba Lagi</button>
      <button onclick="goHome()" class="btn-home">🏠 Ke Beranda</button>
    </div>`;
}

function updateNavButtons() {
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  if (prevBtn) { prevBtn.style.display = prevSlug ? "inline-flex" : "none"; prevBtn.disabled = !prevSlug; }
  if (nextBtn) { nextBtn.style.display = nextSlug ? "inline-flex" : "none"; nextBtn.disabled = !nextSlug; }
}

/* ============================================================
   CHAPTER LIST PANEL
   ============================================================ */
async function loadChapterListFromAPI() {
  try {
    const res  = await fetch(API_DETAIL + komikSlug);
    const json = await res.json();
    if (json.success && json.data?.chapters) {
      allChapters = json.data.chapters;
      renderChapterList();
    }
  } catch (err) { console.error("Gagal load chapter list:", err); }
}

function renderChapterList() {
  const panel = document.getElementById("chapterListPanel");
  if (!panel) return;

  const listHtml = allChapters.map(ch => {
    const isActive  = ch.slug === currentChapterSlug;
    const title     = cleanText(ch.title);
    const date      = ch.releaseTime || ch.date || "";
    return `
      <div class="chapter-item-panel ${isActive ? "active" : ""}" onclick="navigateToChapter('${ch.slug}')">
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
  if (!isOpen) setTimeout(() => {
    panel.querySelector(".chapter-item-panel.active")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 120);
};

window.navigateToChapter = function (chapterSlug) {
  if (chapterSlug === currentChapterSlug) { toggleChapterList(); return; }
  currentChapterSlug = chapterSlug;
  historyWasSaved    = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
  loadChapter();
  toggleChapterList();
};

/* ============================================================
   MODE SCROLL — semua gambar vertikal
   ============================================================ */
function renderImages(images) {
  const container  = document.getElementById("reader");
  container.innerHTML = "";

  const savedWidth = parseInt(localStorage.getItem("imgWidth") || "100");
  const widthEl    = document.getElementById("width");
  if (widthEl) widthEl.value = savedWidth;

  /* ── Build all wrappers with skeleton (gives height so observer works) ── */
  images.forEach((imgObj, i) => {
    const url     = (imgObj && imgObj.url) ? imgObj.url : String(imgObj);
    const wrapper = document.createElement("div");
    wrapper.className     = "image-wrapper";
    wrapper.dataset.url   = url;
    wrapper.dataset.idx   = i + 1;
    wrapper.style.cssText = "width:" + savedWidth + "%;margin:0 auto;";

    const skeleton = document.createElement("div");
    skeleton.className    = "image-skeleton";
    skeleton.style.cssText = "aspect-ratio:2/3;width:100%;";
    wrapper.appendChild(skeleton);
    container.appendChild(wrapper);
  });

  /* ── IntersectionObserver — trigger saat wrapper masuk viewport ── */
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const w   = entry.target;
      const url = w.dataset.url;
      const idx = w.dataset.idx;
      if (!url || w.dataset.loaded) return;
      w.dataset.loaded = "1";
      obs.unobserve(w);
      loadImgIntoWrapper(w, url, idx);
    });
  }, { rootMargin: "300px 0px", threshold: 0 });

  container.querySelectorAll(".image-wrapper").forEach(w => observer.observe(w));
}

function loadImgIntoWrapper(wrapper, url, idx) {
  const skeleton = wrapper.querySelector(".image-skeleton");
  const img      = document.createElement("img");
  img.alt        = "Page " + idx;
  img.style.cssText = "width:100%;display:block;";

  let tried = 0;
  function getUrl(n) {
    const clean = url.split("?")[0].replace(/^https?:\/\//, "");
    if (n === 0) return "https://images.weserv.nl/?url=" + encodeURIComponent(clean) + "&w=800&output=webp&q=85";
    if (n === 1) return "https://wsrv.nl/?url=" + encodeURIComponent(url.split("?")[0]) + "&w=800";
    return url;
  }

  img.onload  = function () { if (skeleton) skeleton.style.display = "none"; };
  img.onerror = function () {
    tried++;
    if (tried <= 2) { img.src = getUrl(tried); return; }
    img.style.display = "none";
    if (skeleton) skeleton.style.display = "none";
    const fb = document.createElement("div");
    fb.style.cssText = "display:flex;flex-direction:column;align-items:center;padding:30px;gap:8px;color:#888;min-height:120px;";
    fb.innerHTML = "<p>⚠️ Gagal halaman " + idx + "</p>";
    const btn = document.createElement("button");
    btn.textContent = "🔄 Coba Lagi";
    btn.style.cssText = "padding:7px 16px;background:#e8522a;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;";
    btn.onclick = function () { fb.remove(); loadImgIntoWrapper(wrapper, url, idx); };
    fb.appendChild(btn);
    wrapper.appendChild(fb);
  };

  img.src = getUrl(0);
  wrapper.appendChild(img);
}

window.retryWrapper = function (btn, url) {
  const wrapper = btn.closest(".image-wrapper");
  if (!wrapper) return;
  const fb = wrapper.querySelector(".image-error");
  if (fb) fb.style.display = "none";
  const img = createComicImg(url + "?r=" + Date.now(), "retry");
  img.onload = () => {
    const sk = wrapper.querySelector(".image-skeleton");
    if (sk) sk.style.display = "none";
  };
  wrapper.appendChild(img);
};

/* ============================================================
   MODE SINGLE — satu gambar sekaligus
   ============================================================ */
function renderSingleMode(images) {
  const container = document.getElementById("reader");
  container.innerHTML = `
    <div id="singleViewer" style="display:flex;flex-direction:column;align-items:center;min-height:calc(100vh - 58px);padding:10px 0 100px;">
      <div id="singleImgWrap" style="position:relative;width:100%;max-width:720px;margin:0 auto;background:#0e0e12;min-height:400px;display:flex;align-items:center;justify-content:center;">
        <div class="image-skeleton" id="singleSkeleton" style="position:absolute;inset:0;aspect-ratio:2/3;"></div>
      </div>
    </div>`;
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

  /* Remove old img */
  wrap.querySelectorAll("img").forEach(i => i.remove());
  if (skeleton) skeleton.style.display = "block";

  const url = allImages[index]?.url || allImages[index];
  const img = createComicImg(url, `Page ${index + 1}`);
  img.style.cssText = "width:100%;max-width:720px;display:block;";
  img.onload  = () => { if (skeleton) skeleton.style.display = "none"; };
  img.onerror = () => { if (skeleton) skeleton.style.display = "none"; };
  wrap.appendChild(img);

  syncSingleControls();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function syncSingleControls() {
  const counter  = document.getElementById("pageCounter");
  const prevPage = document.getElementById("prevPageBtn");
  const nextPage = document.getElementById("nextPageBtn");
  if (counter)  counter.textContent = `${currentPage + 1} / ${allImages.length}`;
  if (prevPage) prevPage.disabled   = currentPage === 0 && !prevSlug;
  if (nextPage) nextPage.disabled   = currentPage === allImages.length - 1 && !nextSlug;
}

window.prevPage = () => { if (currentPage > 0) showPage(currentPage - 1); else if (prevSlug) window.prevChapter(); };
window.nextPage = () => { if (currentPage < allImages.length - 1) showPage(currentPage + 1); else if (nextSlug) window.nextChapter(); };
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
  if (singleCtrl) singleCtrl.style.display = readMode === "single" ? "flex"  : "none";
}

window.changeMode = function (val) {
  readMode = val;
  localStorage.setItem("readMode", val);
  applyReadMode();
  if (allImages.length > 0) {
    if (readMode === "single") renderSingleMode(allImages);
    else                       renderImages(allImages);
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
  } catch (_) {
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
    wrap.style.cssText = "position:fixed;bottom:90px;left:50%;transform:translateX(-50%);z-index:3000;pointer-events:none;";
    document.body.appendChild(wrap);
  }
  const t = document.createElement("div");
  const bg = type === "success" ? "#27ae60" : type === "error" ? "#e8522a" : "#333";
  t.style.cssText = `padding:10px 20px;border-radius:99px;font-size:13px;font-weight:700;color:#fff;white-space:nowrap;background:${bg};box-shadow:0 4px 20px rgba(0,0,0,0.4);`;
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

/* ============================================================
   PRELOAD & HISTORY
   ============================================================ */
function preloadChapter(chapterSlug) {
  const link = document.createElement("link");
  link.rel = "prefetch"; link.href = API_CHAPTER + chapterSlug;
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
  if (nextSlug) { currentChapterSlug = nextSlug; historyWasSaved = false; window.scrollTo({top:0,behavior:"smooth"}); loadChapter(); }
};
window.prevChapter = () => {
  if (prevSlug) { currentChapterSlug = prevSlug; historyWasSaved = false; window.scrollTo({top:0,behavior:"smooth"}); loadChapter(); }
};
window.goHome     = () => { window.location.href = "/"; };
window.toggleMenu = function () {
  const m = document.getElementById("menuDropdown");
  if (m) m.style.display = m.style.display === "block" ? "none" : "block";
};

/* ============================================================
   SETTINGS PANEL
   ============================================================ */
window.toggleSettings = function () { document.getElementById("settings").classList.toggle("active"); };

document.addEventListener("click", e => {
  const panel = document.getElementById("settings");
  const btn   = document.querySelector('button[onclick="toggleSettings()"]');
  if (panel?.classList.contains("active") && !panel.contains(e.target) && !btn?.contains(e.target)) {
    panel.classList.remove("active");
  }
  const chapterPanel = document.getElementById("chapterListPanel");
  const chapterBtn   = document.querySelector('button[onclick="toggleChapterList()"]');
  if (chapterPanel?.classList.contains("open") && !chapterPanel.contains(e.target) && !chapterBtn?.contains(e.target)) {
    toggleChapterList();
  }
});

/* ============================================================
   LEBAR GAMBAR
   ============================================================ */
document.getElementById("width")?.addEventListener("input", e => {
  const val = e.target.value;
  document.querySelectorAll(".image-wrapper").forEach(w => { w.style.width = val + "%"; });
  localStorage.setItem("imgWidth", val);
});

/* ============================================================
   AUTO SCROLL
   ============================================================ */
window.toggleAutoScroll = function () {
  const btn = document.getElementById("autoBtn");
  if (autoScrollInterval) {
    clearInterval(autoScrollInterval); autoScrollInterval = null;
    btn.textContent = "▶️ Mulai Auto Scroll"; btn.classList.remove("running"); return;
  }
  const speed = parseInt(document.getElementById("speed").value);
  autoScrollInterval = setInterval(() => {
    window.scrollBy(0, speed);
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 10) {
      clearInterval(autoScrollInterval); autoScrollInterval = null;
      btn.textContent = "▶️ Mulai Auto Scroll"; btn.classList.remove("running");
    }
  }, 30);
  btn.textContent = "⏹️ Stop"; btn.classList.add("running");
};

/* ============================================================
   HEADER AUTO-HIDE
   ============================================================ */
const readerHeader = document.querySelector(".reader-header");
let scrollTimer = null;
window.addEventListener("scroll", () => {
  readerHeader?.classList.add("hide");
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => readerHeader?.classList.remove("hide"), 1500);
}, { passive: true });
document.getElementById("reader")?.addEventListener("click", () => readerHeader?.classList.toggle("hide"));

/* ============================================================
   KEYBOARD
   ============================================================ */
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
