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
const API_SEARCH_BK = "https://www.sankavollerei.com/comic/bacakomik/search/";
const API_SEARCH_KI = "https://www.sankavollerei.com/comic/komikindo/search/";
const API_SEARCH_MK = "https://www.sankavollerei.com/comic/mangakita/search/";
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
  return `https://wsrv.nl/?url=${encodeURIComponent(clean)}&w=${w}&output=webp&q=82&n=-1`;
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

function cleanTitle(str) { return (str || "").replace(/\s+/g, " ").trim(); }

/* ── Format chapter number: "Chapter 123" → "Ch.123" ─────── */
function formatChapterLabel(chTitle, chSlug) {
  const raw = chTitle || chSlug || "";
  const m = raw.match(/(?:chapter|ch\.?)\s*([\d]+(?:[.,][\d]+)?)/i)
    || raw.match(/chapter[_-]?([\d]+(?:[._-][\d]+)?)/i);
  if (!m) return chTitle || "–";
  const num = m[1].replace(/[_-]/g, ".");
  const [main, sub] = num.split(".");
  const padded = parseInt(main) < 100 ? main.padStart(2, "0") : main;
  return sub ? `Ch.${padded}.${sub}` : `Ch.${padded}`;
}

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
    /* ── Skeleton detail ── */
    .detail-skeleton {
      padding:14px; display:flex; gap:14px;
      animation:fadeIn .3s ease;
    }
    .detail-skeleton .sk-cover {
      width:130px; height:185px; border-radius:14px;
      background:var(--bg-surface); flex-shrink:0;
      animation:detShim 1.4s ease infinite;
    }
    .detail-skeleton .sk-lines { flex:1; display:flex; flex-direction:column; gap:10px; padding-top:4px; }
    .detail-skeleton .sk-line  {
      height:13px; border-radius:6px;
      background:linear-gradient(90deg,var(--bg-card) 25%,var(--bg-surface) 50%,var(--bg-card) 75%);
      background-size:200% 100%; animation:detShim 1.4s infinite;
    }
    @keyframes detShim { 0%{background-position:200% 0}100%{background-position:-200% 0} }
    @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }

    /* ════════════════════════════════════════
       DETAIL HERO — Redesain Mewah
       ════════════════════════════════════════ */

    /* Blur backdrop dari cover */
    .dh-backdrop {
      position:relative; overflow:hidden;
      padding-bottom:0;
    }
    .dh-backdrop-img {
      position:absolute; inset:0; z-index:0;
      background-size:cover; background-position:center top;
      filter:blur(28px) saturate(1.2) brightness(0.25);
      transform:scale(1.12);
    }
    .dh-backdrop-overlay {
      position:absolute; inset:0; z-index:1;
      background:linear-gradient(
        180deg,
        rgba(9,9,16,0.3) 0%,
        rgba(9,9,16,0.55) 50%,
        rgba(9,9,16,1) 100%
      );
    }
    .dh-content {
      position:relative; z-index:2;
      display:flex; gap:16px; padding:20px 16px 18px;
      align-items:flex-end;
    }

    /* Cover — lebih besar & dengan glow */
    .dh-cover {
      flex-shrink:0; position:relative;
    }
    .dh-cover img {
      width:130px !important; height:185px !important;
      object-fit:cover; display:block;
      border-radius:14px;
      border:1px solid rgba(255,255,255,0.12);
      box-shadow:
        0 20px 50px rgba(0,0,0,0.8),
        0 0 0 1px rgba(255,255,255,0.08);
      background:var(--bg-surface);
      transition:transform .25s;
    }
    .dh-cover img:hover { transform:scale(1.03); }
    .dh-type-tag {
      position:absolute; top:8px; left:8px;
      background:rgba(232,82,42,0.9);
      color:#fff; font-size:9px; font-weight:900;
      padding:2px 8px; border-radius:6px;
      text-transform:uppercase; letter-spacing:0.5px;
    }

    /* Info column */
    .dh-info { flex:1; min-width:0; }
    .dh-title {
      font-size:18px; font-weight:900; line-height:1.25;
      color:#fff; margin-bottom:5px;
      text-shadow:0 2px 12px rgba(0,0,0,0.5);
      letter-spacing:-0.3px;
    }
    .dh-alt {
      font-size:11px; color:rgba(255,255,255,0.5);
      font-style:italic; margin-bottom:10px; line-height:1.4;
      display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; overflow:hidden;
    }

    /* Score + status row */
    .dh-badges {
      display:flex; align-items:center; gap:6px; flex-wrap:wrap;
      margin-bottom:10px;
    }
    .dh-score {
      display:inline-flex; align-items:center; gap:4px;
      background:rgba(245,166,35,0.18); border:1px solid rgba(245,166,35,0.35);
      color:#f5a623; padding:3px 10px; border-radius:99px;
      font-size:12px; font-weight:900;
    }
    .dh-status {
      padding:3px 10px; border-radius:99px;
      font-size:10px; font-weight:800; white-space:nowrap;
    }
    .dh-status.ongoing   { background:rgba(46,204,113,0.15); border:1px solid rgba(46,204,113,0.3); color:#2ecc71; }
    .dh-status.completed { background:rgba(52,152,219,0.15); border:1px solid rgba(52,152,219,0.3); color:#3498db; }
    .dh-status.hiatus    { background:rgba(231,76,60,0.15);  border:1px solid rgba(231,76,60,0.3);  color:#e74c3c; }

    /* Meta info grid */
    .dh-meta-grid {
      display:grid; grid-template-columns:1fr 1fr;
      gap:5px 10px; margin-bottom:12px;
    }
    .dh-meta-item { display:flex; flex-direction:column; gap:1px; }
    .dh-meta-label { font-size:9px; font-weight:800; color:rgba(255,255,255,0.35); text-transform:uppercase; letter-spacing:0.6px; }
    .dh-meta-value { font-size:11px; font-weight:700; color:rgba(255,255,255,0.85);
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

    /* Genre chips dalam hero */
    .dh-genres {
      display:flex; flex-wrap:wrap; gap:4px; margin-bottom:14px;
    }
    .dh-genre {
      padding:3px 9px; border-radius:99px;
      background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12);
      font-size:10px; font-weight:700; color:rgba(255,255,255,0.7);
      cursor:pointer; transition:all 0.15s;
      -webkit-tap-highlight-color:transparent;
    }
    .dh-genre:hover { background:var(--accent); border-color:var(--accent); color:#fff; }

    /* ── Action Buttons ── */
    .dh-actions { padding:0 16px 14px; display:flex; flex-direction:column; gap:8px; position:relative; z-index:2; }

    /* Baris tombol utama */
    .dh-btn-row { display:flex; gap:8px; }

    .btn-read-latest {
      flex:1; padding:13px 16px;
      background:linear-gradient(135deg, var(--accent), #c73f1c);
      color:#fff; border:none; border-radius:12px;
      font-family:'Nunito',sans-serif; font-size:14px; font-weight:800;
      cursor:pointer; text-decoration:none;
      display:flex; align-items:center; justify-content:center; gap:6px;
      box-shadow:0 4px 20px rgba(232,82,42,0.4);
      transition:all 0.18s;
      -webkit-tap-highlight-color:transparent;
    }
    .btn-read-latest:hover  { background:linear-gradient(135deg,#f05a30,#b03518); transform:translateY(-2px); box-shadow:0 8px 28px rgba(232,82,42,0.5); }
    .btn-read-latest:active { transform:scale(0.97); }

    .btn-read-first {
      padding:13px 16px;
      background:rgba(255,255,255,0.07); border:1.5px solid rgba(255,255,255,0.12);
      color:var(--text); border-radius:12px;
      font-family:'Nunito',sans-serif; font-size:13px; font-weight:700;
      cursor:pointer; text-decoration:none;
      display:flex; align-items:center; justify-content:center; gap:5px;
      transition:all 0.15s;
      -webkit-tap-highlight-color:transparent;
    }
    .btn-read-first:hover { border-color:var(--accent); color:var(--accent); background:rgba(232,82,42,0.07); }

    /* Secondary row */
    .dh-btn-row-2 { display:flex; gap:8px; }
    .btn-bm, .btn-share-d, .btn-lanjut-d {
      flex:1; padding:10px 12px;
      background:rgba(255,255,255,0.05); border:1.5px solid rgba(255,255,255,0.1);
      color:var(--text-muted); border-radius:10px;
      font-family:'Nunito',sans-serif; font-size:12px; font-weight:700;
      cursor:pointer; display:flex; align-items:center; justify-content:center; gap:5px;
      transition:all 0.15s; text-decoration:none;
      -webkit-tap-highlight-color:transparent;
    }
    .btn-bm:hover     { border-color:var(--accent); color:var(--accent); background:rgba(232,82,42,0.08); }
    .btn-bm.active    { background:rgba(232,82,42,0.12); border-color:var(--accent); color:var(--accent); }
    .btn-share-d:hover{ border-color:rgba(255,255,255,0.3); color:var(--text); }
    .btn-lanjut-d     { background:rgba(46,204,113,0.08); border-color:rgba(46,204,113,0.2); color:#2ecc71; }
    .btn-lanjut-d:hover { background:rgba(46,204,113,0.16); }

    /* Kategori picker */
    .dh-kategori {
      display:none; flex-wrap:wrap; gap:6px;
      padding:10px; background:rgba(232,82,42,0.06);
      border:1px solid rgba(232,82,42,0.15); border-radius:10px;
      animation:fadeIn 0.18s ease;
    }
    .dh-kategori.show { display:flex; }
    .kbtn {
      flex:1; padding:7px 10px; border-radius:8px;
      border:1.5px solid var(--border); background:var(--bg-card);
      color:var(--text-muted); font-family:'Nunito',sans-serif;
      font-size:11px; font-weight:700; cursor:pointer; text-align:center;
      transition:all 0.14s;
    }
    .kbtn:hover:not(.active) { border-color:var(--accent); color:var(--accent); }
    .kbtn.active { background:var(--accent); border-color:var(--accent); color:#fff; }

    /* ── Synopsis ── */
    .dh-synopsis {
      padding:0 16px 16px;
    }
    .dh-section-label {
      display:flex; align-items:center; gap:8px;
      font-family:'Bangers',cursive; font-size:17px; letter-spacing:1.2px;
      color:var(--text); margin-bottom:8px;
    }
    .dh-section-label::after {
      content:''; flex:1; height:1px;
      background:linear-gradient(90deg, rgba(232,82,42,0.4) 0%, transparent 100%);
    }
    .dh-synopsis-text {
      font-size:13px; color:var(--text-muted); line-height:1.75;
      max-height:80px; overflow:hidden;
      transition:max-height 0.4s cubic-bezier(.4,0,.2,1);
    }
    .dh-synopsis-text.expanded { max-height:1200px; }
    .dh-synopsis-toggle {
      margin-top:8px; padding:6px 14px;
      background:rgba(255,255,255,0.05); border:1px solid var(--border);
      border-radius:8px; color:var(--text-muted);
      font-family:'Nunito',sans-serif; font-size:12px; font-weight:700;
      cursor:pointer; transition:all 0.15s;
    }
    .dh-synopsis-toggle:hover { background:var(--accent); color:#fff; border-color:var(--accent); }

    /* ── Chapter Section ── */
    .dh-chapters { padding:0 16px 24px; }
    .dh-ch-header {
      display:flex; align-items:center; justify-content:space-between;
      margin-bottom:10px;
    }
    .dh-ch-count {
      display:inline-flex; align-items:center; justify-content:center;
      padding:2px 9px; border-radius:99px;
      background:rgba(232,82,42,0.12); color:var(--accent);
      font-size:10px; font-weight:800; margin-left:7px;
    }
    .dh-ch-sort {
      padding:5px 11px; border-radius:7px;
      border:1px solid var(--border); background:var(--bg-surface);
      color:var(--text-muted); font-size:11px; font-weight:700;
      cursor:pointer; font-family:'Nunito',sans-serif; transition:all 0.14s;
    }
    .dh-ch-sort:hover { border-color:var(--accent); color:var(--accent); }

    /* Chapter search */
    .dh-ch-search {
      width:100%; padding:9px 13px; margin-bottom:8px;
      background:var(--bg-surface); border:1.5px solid var(--border);
      border-radius:10px; color:var(--text);
      font-family:'Nunito',sans-serif; font-size:13px;
      outline:none; box-sizing:border-box; transition:border 0.18s;
    }
    .dh-ch-search:focus { border-color:var(--accent); }

    /* Chapter list container */
    .dh-chapter-list {
      max-height:400px; overflow-y:auto;
      background:var(--bg-card); border-radius:12px;
      border:1px solid var(--border);
      scrollbar-width:thin; scrollbar-color:var(--accent) transparent;
    }

    /* Chapter item */
    .chapter-item {
      display:flex; justify-content:space-between; align-items:center;
      padding:12px 14px; text-decoration:none; color:var(--text);
      border-bottom:1px solid rgba(255,255,255,0.04);
      font-size:13px; font-weight:600;
      border-left:3px solid transparent;
      transition:background 0.13s, color 0.13s, border-color 0.13s, padding-left 0.13s;
      -webkit-tap-highlight-color:transparent;
    }
    .chapter-item:last-child { border-bottom:none; }
    .chapter-item:hover {
      background:rgba(232,82,42,0.06);
      color:var(--accent); border-left-color:var(--accent);
      padding-left:18px;
    }
    .chapter-item.chapter-last-read {
      background:rgba(232,82,42,0.07);
      border-left-color:var(--accent); color:var(--accent);
    }
    .chapter-date { font-size:11px; color:var(--text-dim); font-weight:400; flex-shrink:0; }
    .last-read-badge {
      display:inline-block; margin-left:7px;
      padding:1px 7px; background:var(--accent); color:#fff;
      font-size:9px; font-weight:800; border-radius:99px; vertical-align:middle;
    }

    /* ── Search Result shared styles (untuk detail page) ── */
    .sr-spinner {
      display:inline-block; width:13px; height:13px;
      border:2px solid rgba(255,255,255,0.15);
      border-top-color:var(--accent);
      border-radius:50%; animation:detSpin 0.6s linear infinite;
      flex-shrink:0;
    }
    @keyframes detSpin { to{transform:rotate(360deg)} }
    /* Override style.css search-result agar bisa scroll dan tampil benar */
    .search-result {
      border-radius:16px !important;
      border:1px solid rgba(232,82,42,0.15) !important;
      box-shadow:0 20px 60px rgba(0,0,0,0.7) !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      max-height: 76vh !important;
      scrollbar-width: thin;
      scrollbar-color: rgba(232,82,42,0.3) transparent;
    }
    .search-result::-webkit-scrollbar { width: 3px; }
    .search-result::-webkit-scrollbar-thumb { background:rgba(232,82,42,0.3);border-radius:99px; }
    .sr-header {
      display:flex; align-items:center; justify-content:space-between;
      padding:10px 14px 8px;
      border-bottom:1px solid rgba(255,255,255,0.05);
      background:var(--bg-elevated, #1f1f2a);
      position:sticky; top:0; z-index:10;
    }
    .sr-label { font-size:11px; font-weight:700; color:var(--text-muted); }
    .sr-label strong { color:var(--accent); }
    .sr-close-btn {
      width:24px; height:24px; border-radius:50%;
      background:rgba(255,255,255,0.07); border:none;
      color:var(--text-muted); font-size:11px; cursor:pointer;
      display:flex; align-items:center; justify-content:center;
    }
    .sr-close-btn:hover { background:rgba(232,82,42,0.2); color:var(--accent); }
    .search-item-skel {
      display:flex; gap:10px; padding:10px 14px;
      border-bottom:1px solid rgba(255,255,255,0.04);
    }
    .skel-img {
      width:44px; height:60px; border-radius:8px; flex-shrink:0;
      background:linear-gradient(90deg,var(--bg-card) 25%,var(--bg-surface) 50%,var(--bg-card) 75%);
      background-size:200% 100%; animation:detShim 1.4s infinite;
    }
    .skel-lines { flex:1; display:flex; flex-direction:column; gap:8px; padding-top:4px; }
    .skel-line {
      height:11px; border-radius:5px;
      background:linear-gradient(90deg,var(--bg-card) 25%,var(--bg-surface) 50%,var(--bg-card) 75%);
      background-size:200% 100%; animation:detShim 1.4s infinite;
    }
    /* Override style.css .search-item yang tidak punya si-cover dll */
    .search-result .search-item {
      display:flex !important; gap:12px !important;
      padding:10px 14px !important;
      cursor:pointer; align-items:center !important;
      border-bottom:1px solid rgba(255,255,255,0.04) !important;
      transition:background 0.13s, transform 0.1s;
      animation:siIn 0.2s ease both;
      background:transparent !important;
    }
    @keyframes siIn { from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:translateX(0)} }
    .search-result .search-item:hover { background:rgba(232,82,42,0.06) !important; transform:translateX(3px); }
    .search-result .search-item:last-child { border-bottom:none !important; }
    /* Cover — override style.css img sizing */
    .si-cover {
      position:relative; flex-shrink:0;
      width:44px !important; height:60px !important;
      min-width:44px; min-height:60px;
      border-radius:8px; overflow:hidden !important;
      background:var(--bg-surface);
      border:1px solid rgba(255,255,255,0.06);
      display:block !important;
    }
    /* Override style.css .search-item img rule (width:40px;height:56px) */
    .search-result .search-item img,
    .si-cover img {
      width:44px !important; height:60px !important;
      object-fit:cover !important; display:block !important;
      border-radius:0 !important;
      flex-shrink:0 !important;
    }
    .si-cover-ph {
      width:100%; height:100%;
      display:flex !important; align-items:center; justify-content:center;
      font-size:20px;
    }
    .si-type-badge {
      position:absolute; bottom:2px; left:2px; right:2px;
      background:rgba(0,0,0,0.8); color:#fff;
      font-size:7px; font-weight:800; text-align:center;
      border-radius:3px; padding:1px 2px;
      text-transform:uppercase; letter-spacing:0.3px;
    }
    .si-body { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }
    .si-title {
      font-weight:800 !important; font-size:13px !important; color:var(--text) !important;
      display:-webkit-box !important; -webkit-line-clamp:2 !important;
      -webkit-box-orient:vertical !important; overflow:hidden !important;
      margin:0 !important; white-space:normal !important;
    }
    .si-meta { display:flex; align-items:center; gap:6px; flex-wrap:wrap; }
    .si-rating { font-size:11px; color:var(--accent2) !important; font-weight:700; margin:0; }
    .si-genre {
      font-size:10px; font-weight:700;
      background:rgba(255,255,255,0.07); border-radius:4px;
      padding:1px 6px; color:var(--text-muted);
    }
    .si-arrow { font-size:10px; color:var(--accent); font-weight:800; opacity:0; transition:opacity 0.13s; }
    .search-result .search-item:hover .si-arrow { opacity:1; }
    .sr-empty {
      display:flex; flex-direction:column; align-items:center;
      padding:28px 20px; gap:6px; text-align:center; color:var(--text-muted);
    }
    .sr-empty p { font-size:13px; font-weight:700; margin:0; }
    .sr-empty strong { color:var(--text); }
    .sr-hint { font-size:11px; color:var(--text-dim); }
    .sr-more {
      text-align:center; padding:10px;
      font-size:12px; font-weight:700; color:var(--text-muted);
      border-top:1px solid rgba(255,255,255,0.05);
    }

    /* ── Spinner tombol ── */
    .btn-spinner {
      display:inline-block;width:13px;height:13px;
      border:2px solid rgba(255,255,255,0.3);
      border-top-color:#fff;border-radius:50%;
      animation:detSpin 0.6s linear infinite;vertical-align:middle;
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
    /* ── Fetch semua 3 API paralel, pilih yang chapter-nya TERBANYAK ── */
    const [r1, r2, r3] = await Promise.allSettled([
      fetch(API_DETAIL).then(r => r.json()).catch(() => null),
      fetch(API_DETAIL_2).then(r => r.json()).catch(() => null),
      fetch(API_DETAIL_3).then(r => r.json()).catch(() => null),
    ]);

    const candidates = [];

    const j1 = r1.status === "fulfilled" ? r1.value : null;
    if (j1?.success && j1?.data) {
      const d = normalizeFromKomikindo(j1.data);
      candidates.push({ data: d, source: "komikindo", count: d.chapters.length });
    }
    const j2 = r2.status === "fulfilled" ? r2.value : null;
    if (j2?.success && j2?.details) {
      const d = normalizeFromMangakita(j2.details);
      candidates.push({ data: d, source: "mangakita", count: d.chapters.length });
    }
    const j3 = r3.status === "fulfilled" ? r3.value : null;
    if (j3?.success && j3?.detail) {
      const d = normalizeFromBacakomik(j3.detail);
      candidates.push({ data: d, source: "bacakomik", count: d.chapters.length });
    }

    if (!candidates.length) throw new Error("Semua API gagal");

    /* ── Pilih base data dari source dengan chapter TERBANYAK ── */
    candidates.sort((a, b) => b.count - a.count);
    const best   = candidates[0];
    const source = best.source;
    let komikDataRaw = best.data;

    /* ════════════════════════════════════════════════════════
       MERGE CHAPTER — Pendekatan Baru (tidak ada chapter yang terbuang)
       
       Masalah lama: regex cuma cocok untuk "Chapter 20" tapi bukan
       semua format chapter slug sama, jadi banyak chapter di-skip.
       
       Pendekatan baru:
       1. Ambil nomor chapter dari title ATAU slug pakai regex lebar
       2. Kalau nomor tetap tidak ketemu, pakai title/slug sebagai key
       3. Deduplicate: nomor sama → satu entri (slug dari best source)
       4. Urutkan nomor terbesar di atas, sisanya di bawah
       ════════════════════════════════════════════════════════ */

    /* Helper: ekstrak angka chapter dari string apapun */
    function extractNum(str) {
      if (!str) return null;
      // "Chapter 20", "Ch.20", "chapter-20", "chapter_20", "chigau-...chapter-20"
      const patterns = [
        /(?:chapter|ch)[.\s_-]*([\d]+(?:[._-][\d]+)?)/i,
        /(?:chapter|ch)([\d]+(?:[._][\d]+)?)/i,
        /-([\d]+(?:[._][\d]+)?)(?:[_-]|$)/,
        /^([\d]+(?:[._][\d]+)?)$/,
      ];
      for (const re of patterns) {
        const m = str.match(re);
        if (m) {
          const raw = m[1].replace(/[_-]/g, ".");
          const n = parseFloat(raw);
          if (!isNaN(n)) return n;
        }
      }
      return null;
    }

    // Kumpulkan semua chapter dari semua source
    // Key = nomor chapter (float) jika bisa di-ekstrak, atau string unik jika tidak
    const chMap = new Map();

    // Proses: source LEMAH dulu (overwrite nanti oleh source kuat)
    const srcByStrength = [...candidates].sort((a, b) => a.count - b.count);

    for (const c of srcByStrength) {
      const isBest = c.source === source;
      for (const ch of c.data.chapters) {
        const titleStr = ch.title || "";
        const slugStr  = ch.slug  || "";

        // Coba dapatkan nomor dari title dulu, lalu dari slug
        const num = extractNum(titleStr) ?? extractNum(slugStr);
        const key = num !== null ? num : `str_${titleStr || slugStr}`;

        const existing = chMap.get(key);
        if (!existing) {
          chMap.set(key, {
            title:       titleStr,
            slug:        slugStr,
            releaseTime: ch.releaseTime || ch.date || "",
            _num:        num,
          });
        } else {
          // Best source MENANG untuk slug (kompatibilitas reader)
          // Chapter tetap ada — hanya slug dan title yang diupdate
          chMap.set(key, {
            title:       isBest && titleStr ? titleStr : (existing.title || titleStr),
            slug:        isBest && slugStr  ? slugStr  : (existing.slug  || slugStr),
            releaseTime: (existing.releaseTime || ch.releaseTime || ch.date || ""),
            _num:        num,
          });
        }
      }
    }

    // Fallback: kalau map kosong, pakai best source langsung
    if (chMap.size === 0) {
      best.data.chapters.forEach((ch, i) => {
        chMap.set(i, { ...ch, _num: null });
      });
    }

    // Pisahkan yang punya nomor vs tidak
    const withNum    = Array.from(chMap.values()).filter(c => c._num !== null);
    const withoutNum = Array.from(chMap.values()).filter(c => c._num === null);

    // Urutkan: nomor terbesar (terbaru) di atas
    withNum.sort((a, b) => b._num - a._num);

    const mergedChapters = [...withNum, ...withoutNum];

    console.log(`[Detail] Base: ${source} (${best.count}ch), merged total: ${mergedChapters.length}ch dari ${candidates.map(c=>c.source+'='+c.count).join(', ')}`);

    /* Ganti chapter list dengan hasil merge dari semua source */
    komikDataRaw = {
      ...komikDataRaw,
      chapters:      mergedChapters,
      firstChapter:  mergedChapters.length ? mergedChapters[mergedChapters.length - 1] : null,
      latestChapter: mergedChapters.length ? mergedChapters[0] : null,
    };

    /* Jika cover kosong dari source terpilih, ambil dari source lain */
    if (!komikDataRaw.cover) {
      const withCover = candidates.find(c => c.data.cover);
      if (withCover) komikDataRaw = { ...komikDataRaw, cover: withCover.data.cover };
    }

    komikData = komikDataRaw;
    console.log(`[Detail] Base: ${source} (${best.count}ch), merged: ${mergedChapters.length}ch`);
    /* Simpan source ke sessionStorage agar reader.js tahu API mana yang dipakai */
    sessionStorage.setItem("komikSource", source);
    sessionStorage.setItem("komikSlugKey", slug);
    /* Bug fix: simpan komikSlug yang benar ke sessionStorage sebagai fallback
       untuk reader.js — menggantikan nilai stale dari komik sebelumnya */
    sessionStorage.setItem("komikSlug", slug);
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
   RENDER DETAIL — Redesain Mewah
   ============================================================ */
async function tampilkanDetail(d) {
  const container = document.getElementById("detailKomik");
  if (!container) return;

  const coverHD = proxyImg(d.cover, 300);

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

  /* Detect status class */
  const st = (d.status || "").toLowerCase();
  const statusClass = st.includes("berjalan") || st.includes("ongoing") ? "ongoing"
    : st.includes("selesai") || st.includes("complete") ? "completed"
    : st.includes("hiatus") ? "hiatus" : "ongoing";

  /* Meta rows untuk grid info */
  const metaItems = [
    d.author        && { label: "Penulis",     value: d.author },
    d.illustrator && d.illustrator !== d.author
                     && { label: "Ilustrator",  value: d.illustrator },
    d.type          && { label: "Format",       value: d.type },
    d.theme         && { label: "Tema",         value: d.theme },
    d.votes         && { label: "Pembaca",      value: d.votes },
  ].filter(Boolean);

  const genresHtml = d.genres.map(g => {
    const name  = typeof g === "string" ? g : (g.name  || "");
    const gSlug = typeof g === "string"
      ? g.toLowerCase().replace(/\s+/g, "-")
      : (g.slug || "").replace(/^\/genres?\//,"");
    if (!name) return "";
    return `<span class="dh-genre" onclick="window.location.href='/genre/${encodeURIComponent(gSlug)}'">${escHtml(name)}</span>`;
  }).join("");

  container.innerHTML = `
    <!-- ══ HERO BACKDROP ══ -->
    <div class="dh-backdrop" style="animation:fadeIn .35s ease">
      ${coverHD ? `<div class="dh-backdrop-img" style="background-image:url('${coverHD}')"></div>` : ""}
      <div class="dh-backdrop-overlay"></div>

      <div class="dh-content">
        <!-- Cover -->
        <div class="dh-cover">
          ${coverHD
            ? `<img id="detailCoverImg" src="${coverHD}" alt="${escHtml(d.title)}">`
            : `<div style="width:130px;height:185px;background:var(--bg-surface);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:48px;">📚</div>`}
          ${d.type ? `<span class="dh-type-tag">${escHtml(d.type)}</span>` : ""}
        </div>

        <!-- Info -->
        <div class="dh-info">
          <h2 class="dh-title">${escHtml(d.title)}</h2>
          ${d.altTitle ? `<p class="dh-alt">${escHtml(d.altTitle.split(",")[0].trim())}</p>` : ""}

          <div class="dh-badges">
            <span class="dh-score">⭐ ${escHtml(d.rating)}</span>
            ${d.status ? `<span class="dh-status ${statusClass}">${escHtml(d.status)}</span>` : ""}
          </div>

          ${metaItems.length ? `
            <div class="dh-meta-grid">
              ${metaItems.map(m => `
                <div class="dh-meta-item">
                  <span class="dh-meta-label">${escHtml(m.label)}</span>
                  <span class="dh-meta-value">${escHtml(m.value)}</span>
                </div>`).join("")}
            </div>` : ""}

          ${genresHtml ? `<div class="dh-genres">${genresHtml}</div>` : ""}
        </div>
      </div>
    </div>

    <!-- ══ ACTION BUTTONS ══ -->
    <div class="dh-actions">
      <!-- Row 1: Baca -->
      <div class="dh-btn-row">
        ${d.latestChapter ? `<a href="${readerURL(d.latestChapter.slug, slug)}" class="btn-read-latest">🔥 Baca Chapter Terbaru</a>` : ""}
        ${d.firstChapter  ? `<a href="${readerURL(d.firstChapter.slug, slug)}"  class="btn-read-first">📖 Awal</a>` : ""}
      </div>

      <!-- Row 2: Bookmark · Lanjut · Share -->
      <div class="dh-btn-row-2">
        ${currentUser ? `
          <button class="btn-bm ${isBookmarked ? "active" : ""}" id="btnBookmark" onclick="toggleBookmark()">
            ${isBookmarked ? "🔖 Tersimpan" : "🔖 Simpan"}
          </button>
          ${lastReadData ? `
            <a href="${readerURL(lastReadData.chapter_slug, slug)}" class="btn-lanjut-d">
              ▶️ Lanjut ${escHtml(formatChapterLabel("Chapter " + (lastReadData.chapter_number || "?"), lastReadData.chapter_slug))}
            </a>` : ""}
        ` : `
          <a href="/masuk" class="btn-bm" style="text-decoration:none;text-align:center;">🔑 Login</a>
        `}
        <button class="btn-share-d" onclick="shareKomik('${escHtml(d.title).replace(/'/g,"\\'")}')">🔗 Share</button>
      </div>

      <!-- Kategori picker -->
      ${currentUser && isBookmarked ? `
        <div class="dh-kategori show" id="kategoriPicker">
          <button class="kbtn ${currentKategori==="favorit"     ? "active":""}" onclick="setKategori('favorit',this)">❤️ Favorit</button>
          <button class="kbtn ${currentKategori==="lagi_dibaca" ? "active":""}" onclick="setKategori('lagi_dibaca',this)">📖 Dibaca</button>
          <button class="kbtn ${currentKategori==="tamat"       ? "active":""}" onclick="setKategori('tamat',this)">✅ Tamat</button>
        </div>` : `
        <div class="dh-kategori" id="kategoriPicker">
          <button class="kbtn" onclick="setKategori('favorit',this)">❤️ Favorit</button>
          <button class="kbtn" onclick="setKategori('lagi_dibaca',this)">📖 Dibaca</button>
          <button class="kbtn" onclick="setKategori('tamat',this)">✅ Tamat</button>
        </div>`}
    </div>

    <!-- ══ SINOPSIS ══ -->
    <div class="dh-synopsis">
      <div class="dh-section-label">📖 Sinopsis</div>
      <p class="dh-synopsis-text" id="synopsisText">${escHtml(d.synopsis || "Tidak ada sinopsis.")}</p>
      ${(d.synopsis || "").length > 130 ? `
        <button class="dh-synopsis-toggle" id="synopsisToggle" onclick="toggleSynopsis()">Baca Selengkapnya ▼</button>
      ` : ""}
    </div>

    <!-- ══ CHAPTER LIST ══ -->
    <div class="dh-chapters">
      <div class="dh-ch-header">
        <div class="dh-section-label" style="margin-bottom:0;">
          📚 Chapter
          <span class="dh-ch-count">${d.chapters.length}</span>
        </div>
        ${d.chapters.length > 1 ? `
          <button id="sortChBtn" class="dh-ch-sort" onclick="toggleChapterSort()">↑↓ Terlama dulu</button>
        ` : ""}
      </div>
      ${d.chapters.length > 10 ? `
        <input type="text" class="dh-ch-search" id="chapterSearch"
          placeholder="🔍 Cari chapter..."
          oninput="filterChapters(this.value)">
      ` : ""}
      <div class="dh-chapter-list" id="chapterListEl"></div>
    </div>
  `;

  /* Cover fallback */
  const coverImg = document.getElementById("detailCoverImg");
  if (coverImg && d.cover) {
    let cTried = 0;
    const origCover = d.cover;
    coverImg.onerror = function () {
      cTried++;
      if (cTried === 1) {
        coverImg.src = `https://wsrv.nl/?url=${encodeURIComponent(origCover.split("?")[0])}&w=300`;
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
    const title      = formatChapterLabel(cleanTitle(ch.title), ch.slug);
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
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="btn-spinner"></span>`; }

  try {
    if (isBookmarked) {
      await removeBookmark(currentUser.id, slug);
      isBookmarked = false;
      if (btn) { btn.className = "btn-bm"; btn.textContent = "🔖 Simpan"; }
      const kp = document.getElementById("kategoriPicker");
      if (kp) kp.classList.remove("show");
      showToast("Bookmark dihapus", "info");
    } else {
      await addBookmark(currentUser.id, {
        slug, title: komikData.title, cover: komikData.cover, kategori: currentKategori
      });
      isBookmarked = true;
      if (btn) { btn.className = "btn-bm active"; btn.textContent = "🔖 Tersimpan"; }
      const kp = document.getElementById("kategoriPicker");
      if (kp) kp.classList.add("show");
      showToast("Disimpan ke bookmark! 🔖", "success");
    }
  } catch (err) {
    showToast("Terjadi kesalahan. Coba lagi.", "error");
    console.error(err);
  } finally {
    if (btn) btn.disabled = false;
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
  const text = document.getElementById("synopsisText");
  const btn  = document.getElementById("synopsisToggle");
  if (!text) return;
  const expanded = text.classList.toggle("expanded");
  if (btn) btn.textContent = expanded ? "Sembunyikan ▲" : "Baca Selengkapnya ▼";
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

/* ── Live Search — 3 API ─────────────────────────────────── */
let searchTimeout = null;
let _lastSq = "";

function mergeSearchResults(lists) {
  const map = new Map();
  for (const list of lists) {
    for (const k of (list || [])) {
      const s = k.slug || k.komikSlug || "";
      if (!s) continue;
      if (!map.has(s)) {
        map.set(s, {
          slug:   s,
          title:  k.title  || k.name  || "Untitled",
          image:  k.image  || k.cover || k.thumbnail || "",
          rating: k.rating || k.score || "–",
          type:   k.type   || k.format || "",
        });
      } else {
        const ex = map.get(s);
        if (!ex.image  && (k.image || k.cover)) ex.image  = k.image || k.cover;
        if (!ex.rating && k.rating)             ex.rating = k.rating;
        if (!ex.type   && k.type)               ex.type   = k.type;
      }
    }
  }
  return Array.from(map.values());
}

window.liveSearch = async function () {
  const query     = document.getElementById("searchInput")?.value.trim();
  const resultBox = document.getElementById("searchResult");
  if (!query) {
    if (resultBox) { resultBox.style.display = "none"; resultBox.innerHTML = ""; }
    _lastSq = ""; return;
  }
  if (query === _lastSq) return;
  _lastSq = query;

  clearTimeout(searchTimeout);

  if (resultBox) {
    resultBox.innerHTML = `
      <div class="sr-header">
        <span class="sr-label">Mencari "<strong>${escHtml(query)}</strong>"</span>
        <div class="sr-spinner"></div>
      </div>
      ${Array(3).fill(`
        <div class="search-item-skel">
          <div class="skel-img"></div>
          <div class="skel-lines">
            <div class="skel-line" style="width:72%"></div>
            <div class="skel-line" style="width:40%"></div>
          </div>
        </div>`).join("")}`;
    resultBox.style.display = "block";
  }

  searchTimeout = setTimeout(async () => {
    const enc = encodeURIComponent(query);
    const [r1, r2, r3] = await Promise.allSettled([
      fetch(API_SEARCH_BK + enc).then(r => r.json()).catch(() => null),
      fetch(API_SEARCH_KI + enc).then(r => r.json()).catch(() => null),
      fetch(API_SEARCH_MK + enc).then(r => r.json()).catch(() => null),
    ]);
    const l1 = r1.value?.komikList || r1.value?.data || [];
    const l2 = r2.value?.komikList || r2.value?.data || [];
    const l3 = r3.value?.komikList || r3.value?.data || r3.value?.results || [];
    const merged = mergeSearchResults([l1, l2, l3]);

    if (!resultBox) return;
    if (!merged.length) {
      resultBox.innerHTML = `
        <div class="sr-empty">
          <span style="font-size:28px">🔍</span>
          <p>Tidak ada hasil untuk <strong>"${escHtml(query)}"</strong></p>
          <span class="sr-hint">Coba kata kunci lain</span>
        </div>`;
      resultBox.style.display = "block";
      return;
    }

    resultBox.innerHTML = `
      <div class="sr-header">
        <span class="sr-label"><strong>${merged.length}</strong> hasil untuk "${escHtml(query)}"</span>
        <button class="sr-close-btn" onclick="document.getElementById('searchResult').style.display='none'">✕</button>
      </div>`;

    merged.slice(0, 8).forEach((k, i) => {
      const rawUrl  = (k.image || "").split("?")[0];
      /* Pakai wsrv.nl — sama persis dengan script.js */
      const cover   = rawUrl
        ? `https://wsrv.nl/?url=${encodeURIComponent(rawUrl)}&w=120&output=webp&q=85&n=-1`
        : "";

      const item = document.createElement("div");
      item.className = "search-item";
      item.style.cssText = `
        display:flex !important; gap:12px; padding:10px 14px;
        cursor:pointer; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05);
        transition:background 0.13s; animation:siIn 0.2s ease ${i*40}ms both;
        background:transparent;
      `;

      /* Cover wrapper — inline style agar tidak kena override style.css */
      const coverHtml = cover
        ? `<div style="position:relative;flex-shrink:0;width:44px;height:60px;border-radius:8px;overflow:hidden;background:var(--bg-surface);border:1px solid rgba(255,255,255,0.08);">
             <img src="${cover}" alt="" loading="lazy"
               style="width:44px;height:60px;object-fit:cover;display:block;border-radius:0;"
               onerror="this.parentElement.innerHTML='<div style=width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:20px>📚</div>'">
             ${k.type ? `<span style="position:absolute;bottom:2px;left:2px;right:2px;background:rgba(0,0,0,0.8);color:#fff;font-size:7px;font-weight:800;text-align:center;border-radius:3px;padding:1px 2px;text-transform:uppercase;">${escHtml(k.type)}</span>` : ""}
           </div>`
        : `<div style="flex-shrink:0;width:44px;height:60px;border-radius:8px;background:var(--bg-surface);display:flex;align-items:center;justify-content:center;font-size:20px;border:1px solid rgba(255,255,255,0.08);">📚</div>`;

      item.innerHTML = `
        ${coverHtml}
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;">
          <p style="font-weight:800;font-size:13px;color:var(--text);margin:0;
            display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.35;">
            ${escHtml(k.title)}
          </p>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            ${k.rating ? `<span style="font-size:11px;color:#f5a623;font-weight:700;">⭐ ${escHtml(k.rating)}</span>` : ""}
            ${k.type   ? `<span style="font-size:10px;font-weight:700;background:rgba(255,255,255,0.07);border-radius:4px;padding:1px 6px;color:var(--text-muted);">${escHtml(k.type)}</span>` : ""}
          </div>
          <span style="font-size:10px;color:var(--accent);font-weight:800;opacity:0;transition:opacity 0.13s;" class="si-goto">Lihat Detail →</span>
        </div>`;

      item.addEventListener("mouseenter", () => {
        item.style.background = "rgba(232,82,42,0.06)";
        const g = item.querySelector(".si-goto");
        if (g) g.style.opacity = "1";
      });
      item.addEventListener("mouseleave", () => {
        item.style.background = "transparent";
        const g = item.querySelector(".si-goto");
        if (g) g.style.opacity = "0";
      });
      item.onclick = () => { window.location.href = "/komik/" + k.slug; };
      resultBox.appendChild(item);
    });

    if (merged.length > 8) {
      const more = document.createElement("div");
      more.style.cssText = "text-align:center;padding:10px;font-size:12px;font-weight:700;color:var(--text-muted);border-top:1px solid rgba(255,255,255,0.05);";
      more.textContent = `+${merged.length - 8} hasil lainnya`;
      resultBox.appendChild(more);
    }
    resultBox.style.display = "block";
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

    /* Pasang event delegation setelah render */
    bindCommentEvents(section);

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
  /* PENTING: gunakan c.id asli (UUID) untuk likedSet dan data-id,
     bukan safeId yang bisa memotong karakter UUID */
  const realId   = String(c.id);
  const isLiked  = likedSet.has(realId);
  const isOwner  = currentUser?.id === c.user_id;
  /* safeId hanya untuk id elemen DOM (tidak boleh ada karakter spesial) */
  const safeId   = realId.replace(/[^a-zA-Z0-9-]/g, "");
  const replies  = Array.isArray(c.replies) ? c.replies : [];

  let time = "–";
  try { time = new Date(c.created_at).toLocaleDateString("id-ID", { day:"numeric", month:"short", year:"numeric" }); } catch {}

  return `
    <div class="comment-item ${isReply ? "is-reply" : ""}" id="comment-${safeId}" data-comment-id="${escHtml(realId)}">
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
            <button class="comment-btn like-btn ${isLiked ? "liked" : ""}"
              data-id="${escHtml(realId)}">
              ❤️ <span class="like-count">${c.like_count || 0}</span>
            </button>
            ${!isReply ? `<button class="comment-btn reply-btn" data-id="${safeId}">💬 Balas</button>` : ""}
          ` : `<span class="comment-btn-muted">❤️ ${c.like_count || 0}</span>`}
          ${isOwner ? `<button class="comment-btn danger delete-btn" data-id="${escHtml(realId)}">🗑️</button>` : ""}
        </div>
        ${!isReply ? `
          <div class="reply-form" id="reply-form-${safeId}" style="display:none">
            <textarea placeholder="Balas komentar..." rows="2" id="reply-input-${safeId}" maxlength="300"
              oninput="document.getElementById('reply-char-count-${safeId}').textContent=this.value.length+'/300'"></textarea>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">
              <span id="reply-char-count-${safeId}" style="font-size:11px;color:var(--text-muted);">0/300</span>
              <button class="reply-submit-btn" data-id="${escHtml(realId)}" data-safe="${safeId}"
                id="reply-btn-${safeId}">Kirim Balasan</button>
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

window.toggleReplyForm = function (commentId) {
  /* Legacy fallback — sekarang handled oleh event delegation di bindCommentEvents */
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
    if (error) { console.error("Like error:", error); btn.disabled = false; return; }
    const cs = btn.querySelector(".like-count");
    if (cs && likeCount !== null) cs.textContent = likeCount;
    btn.classList.toggle("liked", liked);
    if (liked) likedSet.add(commentId); else likedSet.delete(commentId);
    btn.style.transform = "scale(1.3)";
    setTimeout(() => { btn.style.transform = "scale(1)"; }, 180);
  } finally { btn.disabled = false; }
};

window.hapusKomentar = async function (commentId) {
  if (!confirm("Yakin hapus komentar ini?")) return;
  try {
    const { error } = await deleteComment(commentId, currentUser.id);
    if (error) { showToast("Gagal menghapus", "error"); return; }
    /* Cari elemen dengan data-comment-id */
    const el = document.querySelector(`[data-comment-id="${commentId}"]`);
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

/* ── Event delegation untuk semua action di comment section ── */
function bindCommentEvents(section) {
  section.addEventListener("click", async e => {
    /* LIKE */
    const likeBtn = e.target.closest(".like-btn");
    if (likeBtn) {
      e.stopPropagation();
      const id = likeBtn.dataset.id;
      if (id) await window.likeKomentar(id, likeBtn);
      return;
    }

    /* REPLY TOGGLE */
    const replyBtn = e.target.closest(".reply-btn");
    if (replyBtn) {
      const safeId = replyBtn.dataset.id;
      const form   = document.getElementById(`reply-form-${safeId}`);
      if (!form) return;
      const wasHidden = form.style.display === "none";
      form.style.display = wasHidden ? "block" : "none";
      if (wasHidden) setTimeout(() => document.getElementById(`reply-input-${safeId}`)?.focus(), 80);
      return;
    }

    /* REPLY SUBMIT */
    const replySubmit = e.target.closest(".reply-submit-btn");
    if (replySubmit) {
      const realId  = replySubmit.dataset.id;   /* UUID asli */
      const safeId  = replySubmit.dataset.safe; /* DOM-safe id */
      await window.submitReply(realId, safeId);
      return;
    }

    /* DELETE */
    const deleteBtn = e.target.closest(".delete-btn");
    if (deleteBtn) {
      const id = deleteBtn.dataset.id;
      if (id) await window.hapusKomentar(id);
      return;
    }
  });
}

window.submitReply = async function (parentId, safeId) {
  if (isSubmitting) return;
  /* safeId untuk ambil elemen DOM, parentId (UUID) untuk Supabase */
  const domId = safeId || parentId.replace(/[^a-zA-Z0-9-]/g, "");
  const input = document.getElementById(`reply-input-${domId}`);
  const text  = input?.value.trim();
  if (!text)        { showCommentError("Balasan kosong!", true, domId); return; }
  if (!currentUser) { window.location.href = "/masuk"; return; }
  isSubmitting = true;
  const btn = document.getElementById(`reply-btn-${domId}`);
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="btn-spinner"></span>`; }
  if (input) input.disabled = true;
  try {
    const { error } = await addComment(currentUser.id, slug, text, parentId);
    if (error) { showCommentError(error.message || "Gagal.", true, domId); return; }
    showToast("Balasan terkirim! 💬", "success");
    await loadComments();
  } catch { showCommentError("Kesalahan.", true, domId); }
  finally {
    isSubmitting = false;
    if (input) input.disabled = false;
    if (btn)   { btn.disabled = false; btn.textContent = "Kirim Balasan"; }
  }
};
