/* ============================================================
   PANKOMIK — detail.js  (Enhanced)
   API: https://www.sankavollerei.com/comic/komikindo/detail/{slug}

   PERUBAHAN:
   - Image proxy konsisten + fallback chain
   - Skeleton loading state saat fetch detail
   - Render error lebih ramah
   - Live search pake proxyImg yg benar
   - Chapter list search/filter
   - Share via Web Share API + clipboard fallback
   - Animasi masuk elemen
   - escapeHtml aman untuk XSS
   - Semua window.onload → DOMContentLoaded
   ============================================================ */

import {
  getCurrentUser,
  checkBookmark,
  addBookmark,
  removeBookmark,
  getLastRead,
  getComments,
  addComment,
  deleteComment,
  toggleLike,
  getLikedComments
} from "/supabase.js";

import { getKomikSlug, readerURL } from "/router.js";

/* ── API ───────────────────────────────────────────────── */
const API_SEARCH = "https://www.sankavollerei.com/comic/bacakomik/search/";
const slug       = getKomikSlug();
if (!slug) window.location.href = "/";
const API_DETAIL   = `https://www.sankavollerei.com/comic/komikindo/detail/${slug}`;
const API_DETAIL_2 = `https://www.sankavollerei.com/comic/mangakita/detail/${slug}`;
const API_DETAIL_3 = `https://www.sankavollerei.com/comic/bacakomik/detail/${slug}`;

/* ── IMAGE PROXY ────────────────────────────────────────── */
function proxyImg(url, w = 300) {
  if (!url) return "";
  if (url.startsWith("data:") || url.includes("weserv.nl") || url.includes("wsrv.nl")) return url;
  const clean = url.split("?")[0];
  return `https://images.weserv.nl/?url=${encodeURIComponent(clean.replace(/^https?:\/\//, ""))}&w=${w}&output=webp&q=82`;
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

function cleanTitle(str) { return (str || "").replace(/\s+/g, " ").trim(); }

/* ── STATE ──────────────────────────────────────────────── */
let currentUser     = null;
let isBookmarked    = false;
let currentKategori = "favorit";
let komikData       = null;
let chaptersSortAsc = false;
let lastReadData    = null;

/* ── INJECT EXTRA STYLES ────────────────────────────────── */
function injectStyles() {
  if (document.getElementById("dExtraStyle")) return;
  const s = document.createElement("style");
  s.id = "dExtraStyle";
  s.textContent = `
    /* Skeleton detail */
    .detail-skeleton {
      padding:14px;
      display:flex;gap:14px;
      animation:fadeIn .3s ease;
    }
    .detail-skeleton .sk-cover {
      width:120px;height:170px;border-radius:10px;
      background:var(--bg-surface);flex-shrink:0;
    }
    .detail-skeleton .sk-lines { flex:1;display:flex;flex-direction:column;gap:10px;padding-top:4px; }
    .detail-skeleton .sk-line  {
      height:14px;border-radius:6px;
      background:linear-gradient(90deg,var(--bg-card) 25%,var(--bg-surface) 50%,var(--bg-card) 75%);
      background-size:200% 100%;animation:shimmer 1.4s infinite;
    }

    /* Animasi masuk */
    @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }

    /* Cover img */
    .detail-cover-wrap img {
      width:120px;height:170px;object-fit:cover;
      border-radius:10px;flex-shrink:0;
      box-shadow:0 6px 24px rgba(0,0,0,0.55);
      transition:transform .2s;
    }
    .detail-cover-wrap img:hover { transform:scale(1.03); }

    /* Status badges */
    .detail-status-badge {
      padding:3px 9px;border-radius:99px;font-size:10px;font-weight:800;
      white-space:nowrap;
    }
    .detail-status-badge.ongoing {
      background:rgba(39,174,96,0.15);border:1px solid rgba(39,174,96,0.3);color:#27ae60;
    }
    .detail-status-badge.completed {
      background:rgba(52,152,219,0.15);border:1px solid rgba(52,152,219,0.3);color:#3498db;
    }

    /* Quick-start buttons */
    .btn-start {
      flex:1;padding:10px 0;border-radius:10px;border:1.5px solid var(--border);
      background:var(--bg-surface);color:var(--text);font-family:'Nunito',sans-serif;
      font-size:13px;font-weight:800;cursor:pointer;text-align:center;
      text-decoration:none;display:flex;align-items:center;justify-content:center;gap:5px;
      transition:background .2s,border-color .2s,color .2s,transform .1s;
    }
    .btn-start:hover  { background:var(--bg-card);border-color:var(--accent); }
    .btn-start:active { transform:scale(0.97); }
    .btn-start.primary { background:var(--accent);border-color:var(--accent);color:#fff; }
    .btn-start.primary:hover { background:#c73f1c; }

    /* Last-read highlight */
    .chapter-last-read { background:rgba(232,82,42,0.08) !important;color:var(--accent); }
    .last-read-badge {
      display:inline-block;padding:1px 7px;border-radius:99px;font-size:9px;
      background:var(--accent);color:#fff;font-weight:800;margin-left:6px;
      vertical-align:middle;
    }

    /* Chapter search input */
    .chapter-search {
      width:100%;padding:8px 12px;margin-bottom:8px;
      background:var(--bg-surface);border:1px solid var(--border);
      border-radius:8px;color:var(--text);font-family:'Nunito',sans-serif;
      font-size:13px;outline:none;box-sizing:border-box;
      transition:border .2s;
    }
    .chapter-search:focus { border-color:var(--accent); }

    /* Chapter count badge */
    .ch-count-badge {
      display:inline-flex;align-items:center;justify-content:center;
      padding:2px 8px;border-radius:99px;font-size:10px;font-weight:800;
      background:rgba(232,82,42,0.12);color:var(--accent);margin-left:6px;
    }
  `;
  document.head.appendChild(s);
}

/* ── INIT ───────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", async () => {
  injectStyles();
  if (localStorage.getItem("theme") === "light") document.body.classList.add("light");

  showDetailSkeleton();
  currentUser = await getCurrentUser();
  await getDetail();
});

function showDetailSkeleton() {
  const container = document.getElementById("detailKomik");
  if (!container) return;
  container.innerHTML = `
    <div class="detail-skeleton">
      <div class="sk-cover skeleton"></div>
      <div class="sk-lines">
        <div class="sk-line" style="width:80%"></div>
        <div class="sk-line" style="width:55%"></div>
        <div class="sk-line" style="width:70%"></div>
        <div class="sk-line" style="width:45%"></div>
        <div class="sk-line" style="width:60%"></div>
      </div>
    </div>`;
}

/* ============================================================
   FETCH DETAIL
   ============================================================ */
/* Normalize data dari API komikindo ke format internal */
function normalizeFromKomikindo(raw) {
  return {
    title:          cleanTitle(raw.title),
    cover:          raw.image || "",
    rating:         raw.rating || "–",
    votes:          raw.votes  || "",
    status:         raw.detail?.status            || "–",
    type:           raw.detail?.type              || "–",
    author:         raw.detail?.author            || "–",
    illustrator:    raw.detail?.illustrator       || "",
    theme:          raw.detail?.theme             || "",
    altTitle:       raw.detail?.alternativeTitle  || "",
    synopsis:       raw.description || "",
    genres:         raw.genres   || [],
    chapters:       raw.chapters || [],
    firstChapter:   raw.firstChapter   || null,
    latestChapter:  raw.latestChapter  || null,
    allChapterSlug: raw.allChapterSlug || slug,
  };
}

/* Normalize data dari API mangakita ke format internal */
function normalizeFromMangakita(det) {
  /* chapters dari mangakita: [{title, slug, date}]
     slug berisi URL penuh misal "https:/mangakita.me/one-piece-chapter-1176..."
     Ekstrak slug chapter dari URL */
  const chapters = (det.chapters || []).map(ch => {
    const urlSlug = (ch.slug || "").replace(/^https?:\/?\/?[^/]+\//, "").replace(/\/$/, "");
    return {
      title:       ch.title || "",
      slug:        urlSlug  || ch.slug || "",
      releaseTime: ch.date  || "",
    };
  });

  const info = det.info || {};
  return {
    title:          cleanTitle(det.title),
    cover:          det.image || "",
    rating:         det.rating || "–",
    votes:          "",
    status:         info.status      || "–",
    type:           info.type        || "–",
    author:         info.author      || "–",
    illustrator:    info.artist      || "",
    theme:          "",
    altTitle:       det.alternative  || "",
    synopsis:       det.synopsis     || "",
    /* Mangakita genres: ["Action","Adventure"] → [{name, slug}] */
    genres:         (det.genres || []).map(g =>
      typeof g === "string"
        ? { name: g, slug: g.toLowerCase().replace(/\s+/g, "-") }
        : g
    ),
    chapters:       chapters,
    firstChapter:   chapters.length ? chapters[chapters.length - 1] : null,
    latestChapter:  chapters.length ? chapters[0] : null,
    allChapterSlug: slug,
    _source:        "mangakita",
  };
}


/* Normalize data dari API bacakomik ke format internal */
function normalizeFromBacakomik(det) {
  /* bacakomik genres: [{title, slug}] — sudah format object, tinggal map */
  const genres = (det.genres || []).map(g => ({
    name: g.title || g.name || "",
    slug: g.slug  || (g.title || "").toLowerCase().replace(/\s+/g, "-"),
  }));

  const chapters = (det.chapters || []).map(ch => ({
    title:       ch.title || "",
    slug:        ch.slug  || "",
    releaseTime: ch.date  || "",
  }));

  return {
    title:          cleanTitle(det.title),
    cover:          det.cover  || "",
    rating:         det.rating || "–",
    votes:          det.reader || "",
    status:         det.status || "–",
    type:           det.type   || "–",
    author:         det.author || "–",
    illustrator:    det.artist || "",
    theme:          "",
    altTitle:       det.otherTitle || "",
    synopsis:       det.synopsis  || "",
    genres:         genres,
    chapters:       chapters,
    firstChapter:   chapters.length ? chapters[chapters.length - 1] : null,
    latestChapter:  chapters.length ? chapters[0] : null,
    allChapterSlug: slug,
    _source:        "bacakomik",
  };
}

async function getDetail() {
  const container = document.getElementById("detailKomik");
  try {
    /* ── Coba API 1: komikindo ── */
    let komikDataRaw = null;
    let source = "komikindo";

    try {
      const res  = await fetch(API_DETAIL);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success || !json.data) throw new Error("API 1 error");
      komikDataRaw = normalizeFromKomikindo(json.data);
    } catch (err1) {
      console.warn("[Detail] API 1 gagal, coba API 2:", err1.message);
      try {
        /* ── Fallback ke API 2: mangakita ── */
        const res2  = await fetch(API_DETAIL_2);
        if (!res2.ok) throw new Error(`API 2 HTTP ${res2.status}`);
        const json2 = await res2.json();
        if (!json2.success || !json2.details) throw new Error("API 2 error");
        komikDataRaw = normalizeFromMangakita(json2.details);
        source = "mangakita";
      } catch (err2) {
        console.warn("[Detail] API 2 gagal, coba API 3:", err2.message);
        /* ── Fallback ke API 3: bacakomik ── */
        const res3  = await fetch(API_DETAIL_3);
        if (!res3.ok) throw new Error(`API 3 HTTP ${res3.status}`);
        const json3 = await res3.json();
        if (!json3.success || !json3.detail) throw new Error("API 3 error");
        komikDataRaw = normalizeFromBacakomik(json3.detail);
        source = "bacakomik";
      }
    }

    komikData = komikDataRaw;
    console.log(`[Detail] Loaded from: ${source}`);
    document.title = `${komikData.title} — Pankomik`;
    await tampilkanDetail(komikData);
    await loadComments();

  } catch (err) {
    console.error("[Detail] Semua API gagal:", err);
    if (container) container.innerHTML = `
      <div style="padding:40px 20px;text-align:center;color:var(--text-muted);">
        <p style="font-size:36px;margin-bottom:10px;">😕</p>
        <p style="font-size:14px;margin-bottom:16px;">Gagal memuat. Periksa koneksimu.</p>
        <button onclick="location.reload()" style="
          padding:10px 22px;background:var(--accent);color:#fff;border:none;
          border-radius:9px;cursor:pointer;font-family:'Nunito',sans-serif;
          font-size:13px;font-weight:800;transition:background .2s;"
          onmouseover="this.style.background='#c73f1c'"
          onmouseout="this.style.background='var(--accent)'">
          🔄 Coba Lagi
        </button>
      </div>`;
  }
}

/* ============================================================
   RENDER DETAIL
   ============================================================ */
async function tampilkanDetail(d) {
  const container = document.getElementById("detailKomik");
  if (!container) return;

  const coverHD = proxyImg(d.cover, 280);

  let bookmarkStatus = { isBookmarked: false, kategori: null };
  lastReadData = null;

  if (currentUser) {
    [bookmarkStatus, lastReadData] = await Promise.all([
      checkBookmark(currentUser.id, slug),
      getLastRead(currentUser.id, slug)
    ]);
    isBookmarked    = bookmarkStatus.isBookmarked;
    currentKategori = bookmarkStatus.kategori || "favorit";
  }

  const infoRows = [
    d.status  ? `<p>📌 Status: <span>${escHtml(d.status)}</span></p>` : "",
    d.type    ? `<p>📦 Tipe: <span>${escHtml(d.type)}</span></p>` : "",
    d.author  ? `<p>✍️ Author: <span>${escHtml(d.author)}</span></p>` : "",
    (d.illustrator && d.illustrator !== d.author)
              ? `<p>🎨 Illustrator: <span>${escHtml(d.illustrator)}</span></p>` : "",
    d.theme   ? `<p>🎭 Theme: <span>${escHtml(d.theme)}</span></p>` : "",
    d.votes   ? `<p>🗳️ Votes: <span>${escHtml(d.votes)}</span></p>` : "",
  ].filter(Boolean).join("");

  container.innerHTML = `
    <!-- ── Hero ── -->
    <div class="detail-header" style="animation:fadeIn .35s ease">
      <div class="detail-cover-wrap">
        ${coverHD
          ? `<img id="detailCoverImg" src="${coverHD}" alt="${escHtml(d.title)}">`
          : `<div style="width:120px;height:170px;background:var(--bg-surface);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:40px;">📚</div>`}
      </div>
      <div class="detail-info">
        <h2>${escHtml(d.title)}</h2>
        ${d.altTitle ? `<p style="font-size:11px;color:var(--text-muted);font-style:italic;margin-bottom:6px;line-height:1.4;">${escHtml(d.altTitle.split(",")[0].trim())}</p>` : ""}

        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap;">
          <span style="background:rgba(245,166,35,0.15);border:1px solid rgba(245,166,35,0.3);
            color:#f5a623;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:800;">
            ⭐ ${escHtml(d.rating)}
          </span>
          ${d.status ? `<span class="detail-status-badge ${d.status.toLowerCase().includes("berjalan") || d.status.toLowerCase().includes("ongoing") ? "ongoing" : "completed"}">${escHtml(d.status)}</span>` : ""}
        </div>

        ${infoRows}

        <div class="genres">
          ${d.genres.map(g => {
            const name  = typeof g === "string" ? g : (g.name  || "");
            const gSlug = typeof g === "string"
              ? g.toLowerCase().replace(/\s+/g, "-")
              : (g.slug || "").replace(/^\/genres?\//,"");
            if (!name) return "";
            return `<span class="genre" onclick="window.location.href='/genre/${encodeURIComponent(gSlug)}'" style="cursor:pointer;">${escHtml(name)}</span>`;
          }).join("")}
        </div>

        <div class="detail-actions">
          ${currentUser ? `
            <button class="btn-bookmark ${isBookmarked ? "active" : ""}" id="btnBookmark" onclick="toggleBookmark()">
              ${isBookmarked ? "🔖 Tersimpan" : "🔖 Simpan"}
            </button>
            <div class="kategori-picker" id="kategoriPicker" style="display:${isBookmarked ? "flex" : "none"}">
              <button class="kbtn ${currentKategori==="favorit"     ? "active":""}" onclick="setKategori('favorit',this)">❤️ Favorit</button>
              <button class="kbtn ${currentKategori==="lagi_dibaca" ? "active":""}" onclick="setKategori('lagi_dibaca',this)">📖 Dibaca</button>
              <button class="kbtn ${currentKategori==="tamat"       ? "active":""}" onclick="setKategori('tamat',this)">✅ Tamat</button>
            </div>
            ${lastReadData ? `
              <a href="${readerURL(lastReadData.chapter_slug, slug)}" class="btn-lanjut">
                ▶️ Lanjut Ch.${escHtml(lastReadData.chapter_number || "?")}
              </a>` : ""}
          ` : `
            <a href="/masuk" class="btn-lanjut" style="text-decoration:none;text-align:center;">🔑 Login untuk Bookmark</a>
          `}
          <button class="btn-share-detail" onclick="shareKomik('${escHtml(d.title).replace(/'/g,"\\'")}')">🔗 Bagikan</button>
        </div>
      </div>
    </div>

    <!-- ── Quick start buttons ── -->
    ${(d.firstChapter || d.latestChapter) ? `
    <div style="display:flex;gap:8px;padding:0 14px 10px;">
      ${d.firstChapter ? `<a href="${readerURL(d.firstChapter.slug, slug)}" class="btn-start">📖 Baca Awal</a>` : ""}
      ${d.latestChapter ? `<a href="${readerURL(d.latestChapter.slug, slug)}" class="btn-start primary">🔥 Chapter Terbaru</a>` : ""}
    </div>` : ""}

    <!-- ── Sinopsis ── -->
    <div class="synopsis" id="synopsisBox">
      <h3>Sinopsis</h3>
      <p>${escHtml(d.synopsis || "Tidak ada sinopsis.")}</p>
      ${(d.synopsis || "").length > 120 ? `<button onclick="toggleSynopsis()">Baca Selengkapnya ▼</button>` : ""}
    </div>

    <!-- ── Daftar Chapter ── -->
    <div class="chapter-section">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <h3 style="margin:0;">Daftar Chapter<span class="ch-count-badge">${d.chapters.length}</span></h3>
        ${d.chapters.length > 1 ? `
          <button id="sortChBtn" onclick="toggleChapterSort()" style="
            padding:4px 10px;border-radius:6px;border:1px solid var(--border);
            background:var(--bg-surface);color:var(--text-muted);
            font-size:11px;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;
            transition:background .15s;">
            ↑↓ Terlama dulu
          </button>` : ""}
      </div>
      ${d.chapters.length > 10 ? `
        <input type="text" class="chapter-search" id="chapterSearch"
          placeholder="Cari chapter..."
          oninput="filterChapters(this.value)">
      ` : ""}
      <div class="chapter-list" id="chapterListEl"></div>
    </div>
  `;

  /* Pasang fallback pada cover img */
  const coverImg = document.getElementById("detailCoverImg");
  if (coverImg && d.cover) {
    let cTried = 0;
    const origCover = d.cover;
    coverImg.onerror = function () {
      cTried++;
      if (cTried === 1) {
        coverImg.src = `https://wsrv.nl/?url=${encodeURIComponent(origCover.split("?")[0])}&w=280`;
      } else if (cTried === 2) {
        coverImg.src = origCover.split("?")[0];
      } else {
        coverImg.style.display = "none";
      }
    };
  }

  renderChapterList(d.chapters, lastReadData);
}

/* ── Render chapter list ─────────────────────────────────── */
function renderChapterList(chapters, lastRead, filterQuery = "") {
  const el = document.getElementById("chapterListEl");
  if (!el) return;

  let ordered = chaptersSortAsc ? [...chapters].reverse() : [...chapters];

  if (filterQuery) {
    const q = filterQuery.toLowerCase();
    ordered  = ordered.filter(ch => (ch.title || "").toLowerCase().includes(q));
  }

  if (!ordered.length) {
    el.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;">Tidak ada chapter yang cocok.</div>`;
    return;
  }

  el.innerHTML = ordered.map(ch => {
    const title      = cleanTitle(ch.title);
    const date       = ch.releaseTime || ch.date || "";
    const isLastRead = lastRead?.chapter_slug === ch.slug;
    return `
      <a href="${readerURL(ch.slug, slug)}"
         class="chapter-item ${isLastRead ? "chapter-last-read" : ""}">
        <span>
          ${escHtml(title)}
          ${isLastRead ? `<span class="last-read-badge">Terakhir Dibaca</span>` : ""}
        </span>
        <span class="chapter-date">${escHtml(date)}</span>
      </a>`;
  }).join("");
}

window.filterChapters = function (q) {
  if (komikData) renderChapterList(komikData.chapters, lastReadData, q);
};

window.toggleChapterSort = function () {
  chaptersSortAsc = !chaptersSortAsc;
  const btn = document.getElementById("sortChBtn");
  if (btn) btn.textContent = chaptersSortAsc ? "↑↓ Terbaru dulu" : "↑↓ Terlama dulu";
  if (komikData) renderChapterList(komikData.chapters, lastReadData,
    document.getElementById("chapterSearch")?.value || "");
};

/* ============================================================
   BOOKMARK
   ============================================================ */
window.toggleBookmark = async function () {
  if (!currentUser) { window.location.href = "/masuk"; return; }
  const btn = document.getElementById("btnBookmark");
  btn.disabled = true; btn.innerHTML = `<span class="btn-spinner"></span>`;

  try {
    if (isBookmarked) {
      await removeBookmark(currentUser.id, slug);
      isBookmarked = false;
      btn.className   = "btn-bookmark";
      btn.textContent = "🔖 Simpan";
      document.getElementById("kategoriPicker").style.display = "none";
      showToast("Bookmark dihapus", "info");
    } else {
      await addBookmark(currentUser.id, {
        slug, title: komikData.title, cover: komikData.cover, kategori: currentKategori
      });
      isBookmarked = true;
      btn.className   = "btn-bookmark active";
      btn.textContent = "🔖 Tersimpan";
      document.getElementById("kategoriPicker").style.display = "flex";
      showToast("Disimpan ke bookmark! 🔖", "success");
    }
  } catch (err) {
    showToast("Terjadi kesalahan. Coba lagi.", "error");
    console.error(err);
  } finally {
    btn.disabled = false;
  }
};

window.setKategori = async function (kategori, btnEl) {
  if (!currentUser || !isBookmarked) return;
  currentKategori = kategori;
  await addBookmark(currentUser.id, {
    slug, title: komikData.title, cover: komikData.cover, kategori
  });
  document.querySelectorAll(".kbtn").forEach(b => b.classList.remove("active"));
  btnEl.classList.add("active");
  showToast(`Kategori: ${kategori.replace("_"," ")} ✅`, "success");
};

/* ============================================================
   SHARE
   ============================================================ */
window.shareKomik = async function (title) {
  const url = window.location.href;
  if (navigator.share) {
    try { await navigator.share({ title, url }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast("🔗 Link disalin!", "success");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = url; ta.style.cssText = "position:fixed;left:-9999px;";
    document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    showToast("🔗 Link disalin!", "success");
  }
};

window.toggleSynopsis = function () {
  const box = document.getElementById("synopsisBox");
  const btn = box?.querySelector("button");
  if (!box) return;
  box.classList.toggle("active");
  if (btn) btn.textContent = box.classList.contains("active") ? "Sembunyikan ▲" : "Baca Selengkapnya ▼";
};

/* ============================================================
   UI HELPERS
   ============================================================ */
window.toggleDarkMode = function () {
  document.body.classList.toggle("light");
  localStorage.setItem("theme", document.body.classList.contains("light") ? "light" : "dark");
};
window.goHome = () => { window.location.href = "/"; };
window.toggleMenu = function () {
  const m = document.getElementById("menuDropdown");
  if (!m) return;
  m.style.display = m.style.display === "block" ? "none" : "block";
};

function showToast(msg, type = "info") {
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
}

/* ── CSS spinner untuk tombol ── */
(function () {
  if (document.getElementById("dSpinnerStyle")) return;
  const s = document.createElement("style");
  s.id = "dSpinnerStyle";
  s.textContent = `
    .btn-spinner{display:inline-block;width:13px;height:13px;border:2px solid rgba(255,255,255,0.4);
      border-top-color:#fff;border-radius:50%;animation:dSpin .6s linear infinite;vertical-align:middle;}
    @keyframes dSpin{to{transform:rotate(360deg)}}
  `;
  document.head.appendChild(s);
})();

/* ── Live Search ─────────────────────────────────────────── */
let searchTimeout = null;
window.liveSearch = async function () {
  const query     = document.getElementById("searchInput")?.value.trim();
  const resultBox = document.getElementById("searchResult");
  if (!query) { if (resultBox) resultBox.style.display = "none"; return; }
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    try {
      const res  = await fetch(API_SEARCH + encodeURIComponent(query));
      const data = await res.json();
      const list = data.komikList || [];
      if (!resultBox) return;
      resultBox.innerHTML = "";
      if (!list.length) { resultBox.style.display = "none"; return; }
      list.slice(0, 6).forEach(k => {
        const item = document.createElement("div");
        item.className = "search-item";
        item.innerHTML = `
          ${k.cover || k.image ? `<img src="${proxyImg(k.cover || k.image, 80)}" loading="lazy">` : `<div style="width:44px;height:60px;background:var(--bg-surface);border-radius:5px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">📚</div>`}
          <div><p>${escHtml(k.title)}</p><p>⭐ ${k.rating || "–"}</p></div>`;
        item.onclick = () => { window.location.href = "/komik/" + k.slug; };
        resultBox.appendChild(item);
      });
      resultBox.style.display = "block";
    } catch (err) { console.error(err); }
  }, 380);
};

document.addEventListener("click", e => {
  const s = document.getElementById("searchInput");
  const r = document.getElementById("searchResult");
  if (r && s && !s.contains(e.target) && !r.contains(e.target)) r.style.display = "none";
});

/* ============================================================
   KOMENTAR
   ============================================================ */
let likedSet     = new Set();
let isSubmitting = false;

async function loadComments() {
  const section = document.getElementById("commentSection");
  if (!section) return;

  /* Skeleton komentar */
  section.innerHTML = `<div style="padding:20px 14px;display:flex;gap:10px;align-items:center;color:var(--text-muted);font-size:13px;"><div class="btn-spinner" style="border-top-color:var(--text-muted);"></div> Memuat komentar...</div>`;

  try {
    const { comments, error } = await getComments(slug);
    if (error) throw error;

    if (currentUser) {
      try { likedSet = await getLikedComments(currentUser.id); } catch { likedSet = new Set(); }
    }

    const safeComments = Array.isArray(comments) ? comments : [];

    section.innerHTML = `
      <div class="comment-section">
        <h3 class="comment-title">💬 Komentar
          <span style="font-size:12px;font-weight:400;color:var(--text-muted)">(${safeComments.length})</span>
        </h3>
        ${currentUser ? `
          <div class="comment-form">
            <textarea id="commentInput" placeholder="Tulis komentar..." rows="3" maxlength="500"
              oninput="document.getElementById('charCount').textContent=this.value.length+'/500'"></textarea>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
              <span id="charCount" style="font-size:11px;color:var(--text-muted);">0/500</span>
              <button onclick="submitKomentar()" id="submitCommentBtn">Kirim</button>
            </div>
            <p id="commentError" style="color:var(--accent);font-size:12px;margin-top:6px;display:none;"></p>
          </div>` : `
          <div class="comment-login-prompt">
            <a href="/masuk">🔑 Login untuk berkomentar</a>
          </div>`}
        <div id="commentList">
          ${safeComments.length === 0
            ? `<div class="comment-empty">Belum ada komentar. Jadilah yang pertama! 🎉</div>`
            : safeComments.map(c => renderComment(c)).join("")}
        </div>
      </div>`;
  } catch (err) {
    console.error("loadComments error:", err);
    section.innerHTML = `<div class="comment-section">
      <h3 class="comment-title">💬 Komentar</h3>
      <div class="comment-empty">
        <p>😕 Gagal memuat komentar</p>
        <button onclick="loadComments()" style="margin-top:10px;padding:6px 14px;
          background:var(--accent);color:#fff;border:none;border-radius:7px;cursor:pointer;
          font-family:'Nunito',sans-serif;font-weight:700;font-size:12px;">Coba Lagi</button>
      </div>
    </div>`;
  }
}

function renderComment(c, isReply = false) {
  if (!c || typeof c !== "object") return "";
  const profile  = c.profiles || {};
  const name     = escHtml(profile.username || "User");
  const avatar   = profile.avatar_url;
  const level    = profile.level || 1;
  const isLiked  = likedSet.has(c.id);
  const isOwner  = currentUser?.id === c.user_id;
  const safeId   = String(c.id).replace(/[^a-zA-Z0-9-]/g, "");
  const replies  = Array.isArray(c.replies) ? c.replies : [];

  let time = "–";
  try { time = new Date(c.created_at).toLocaleDateString("id-ID", { day:"numeric", month:"short", year:"numeric" }); } catch {}

  return `
    <div class="comment-item ${isReply ? "is-reply" : ""}" id="comment-${safeId}">
      <div class="comment-avatar">
        ${avatar
          ? `<img src="${avatar}" alt="${name}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
             <div class="comment-avatar-fallback" style="display:none;">${(profile.username||"U")[0].toUpperCase()}</div>`
          : `<div class="comment-avatar-fallback">${(profile.username||"U")[0].toUpperCase()}</div>`}
      </div>
      <div class="comment-body">
        <div class="comment-meta">
          <span class="comment-username">${name}</span>
          <span class="comment-level">Lv.${level}</span>
          <span class="comment-time">${time}</span>
        </div>
        <p class="comment-text">${escHtml(c.content || "")}</p>
        <div class="comment-actions">
          ${currentUser ? `
            <button class="comment-btn ${isLiked ? "liked" : ""}" onclick="likeKomentar('${safeId}',this)">
              ❤️ <span class="like-count">${c.like_count || 0}</span>
            </button>
            ${!isReply ? `<button class="comment-btn" onclick="toggleReplyForm('${safeId}')">💬 Balas</button>` : ""}
          ` : `<span class="comment-btn-muted">❤️ ${c.like_count || 0}</span>`}
          ${isOwner ? `<button class="comment-btn danger" onclick="hapusKomentar('${safeId}')">🗑️</button>` : ""}
        </div>
        ${!isReply ? `
          <div class="reply-form" id="reply-form-${safeId}" style="display:none">
            <textarea placeholder="Balas komentar..." rows="2" id="reply-input-${safeId}" maxlength="300"
              oninput="document.getElementById('reply-char-count-${safeId}').textContent=this.value.length+'/300'"></textarea>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
              <span id="reply-char-count-${safeId}" style="font-size:11px;color:var(--text-muted);">0/300</span>
              <button onclick="submitReply('${safeId}')" id="reply-btn-${safeId}">Kirim Balasan</button>
            </div>
            <p id="reply-error-${safeId}" style="color:var(--accent);font-size:12px;display:none;"></p>
          </div>
          ${replies.length > 0 ? `<div class="replies-list">${replies.map(r => renderComment(r, true)).join("")}</div>` : ""}
        ` : ""}
      </div>
    </div>`;
}

function showCommentError(msg, isReply = false, id = "") {
  const el = isReply ? document.getElementById(`reply-error-${id}`) : document.getElementById("commentError");
  if (el) { el.textContent = msg; el.style.display = "block"; setTimeout(() => el.style.display = "none", 5000); }
}

window.submitKomentar = async function () {
  if (isSubmitting) return;
  const input = document.getElementById("commentInput");
  const text  = input?.value.trim();
  if (!text)           { showCommentError("Komentar tidak boleh kosong!"); return; }
  if (text.length < 2) { showCommentError("Minimal 2 karakter!"); return; }
  if (!currentUser)    { window.location.href = "/masuk"; return; }

  isSubmitting = true;
  const btn = document.getElementById("submitCommentBtn");
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="btn-spinner"></span> Mengirim...`; }
  if (input) input.disabled = true;

  try {
    const { comment, error } = await addComment(currentUser.id, slug, text);
    if (error) { showCommentError(error.message || "Gagal mengirim."); return; }
    if (comment) {
      if (input) { input.value = ""; input.disabled = false; }
      isSubmitting = false;
      if (btn) { btn.disabled = false; btn.textContent = "Kirim"; }
      const cc = document.getElementById("charCount");
      if (cc) cc.textContent = "0/500";
      showToast("Komentar terkirim! 🎉", "success");
      await loadComments();
    }
  } catch { showCommentError("Terjadi kesalahan."); }
  finally {
    isSubmitting = false;
    if (input) input.disabled = false;
    if (btn)   { btn.disabled = false; btn.textContent = "Kirim"; }
  }
};

window.submitReply = async function (parentId) {
  if (isSubmitting) return;
  const input = document.getElementById(`reply-input-${parentId}`);
  const text  = input?.value.trim();
  if (!text)        { showCommentError("Balasan kosong!", true, parentId); return; }
  if (!currentUser) { window.location.href = "/masuk"; return; }
  isSubmitting = true;
  const btn = document.getElementById(`reply-btn-${parentId}`);
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="btn-spinner"></span>`; }
  if (input) input.disabled = true;
  try {
    const { error } = await addComment(currentUser.id, slug, text, parentId);
    if (error) { showCommentError(error.message || "Gagal.", true, parentId); return; }
    showToast("Balasan terkirim! 💬", "success");
    await loadComments();
  } catch { showCommentError("Kesalahan.", true, parentId); }
  finally {
    isSubmitting = false;
    if (input) input.disabled = false;
    if (btn)   { btn.disabled = false; btn.textContent = "Kirim Balasan"; }
  }
};

window.toggleReplyForm = function (commentId) {
  const form = document.getElementById(`reply-form-${commentId}`);
  if (!form) return;
  const wasHidden = form.style.display === "none";
  form.style.display = wasHidden ? "block" : "none";
  if (wasHidden) setTimeout(() => document.getElementById(`reply-input-${commentId}`)?.focus(), 80);
};

window.likeKomentar = async function (commentId, btn) {
  if (!currentUser) { window.location.href = "/masuk"; return; }
  if (btn.disabled) return;
  btn.disabled = true;
  try {
    const { liked, likeCount, error } = await toggleLike(currentUser.id, commentId);
    if (error) { btn.disabled = false; return; }
    const cs = btn.querySelector(".like-count");
    if (cs && likeCount !== null) cs.textContent = likeCount;
    btn.classList.toggle("liked", liked);
    if (liked) likedSet.add(commentId); else likedSet.delete(commentId);
    btn.style.transform = "scale(1.25)";
    setTimeout(() => btn.style.transform = "scale(1)", 180);
  } finally { btn.disabled = false; }
};

window.hapusKomentar = async function (commentId) {
  if (!confirm("Yakin hapus komentar ini?")) return;
  try {
    const { error } = await deleteComment(commentId, currentUser.id);
    if (error) { showToast("Gagal menghapus", "error"); return; }
    const el = document.getElementById(`comment-${commentId}`);
    if (el) {
      el.style.transition = "all 0.3s";
      el.style.opacity    = "0";
      el.style.transform  = "translateX(-20px)";
      setTimeout(() => {
        el.remove();
        if (!document.querySelectorAll(".comment-item").length) loadComments();
      }, 300);
    }
    showToast("Komentar dihapus", "info");
  } catch { showToast("Gagal menghapus", "error"); }
};
