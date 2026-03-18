/* ============================================================
   PANKOMIK — detail.js
   API: https://www.sankavollerei.com/comic/komikindo/detail/{slug}
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

/* ── IMAGE PROXY ─────────────────────────────────────────── */
function proxyImg(url, width) {
  if (!url) return "";
  if (url.startsWith("data:") || url.includes("wsrv.nl") || url.includes("ui-avatars")) return url;
  const clean = url.split("?")[0];
  return "https://images.weserv.nl/?url=" + encodeURIComponent(clean.replace(/^https?:\/\//,"")) + "&w=" + (width||300) + "&output=webp&q=82";
}

/* ── BERSIHKAN JUDUL (API sering punya whitespace/newline) ── */
function cleanTitle(str) {
  return (str || "").replace(/\s+/g, " ").trim();
}

/* ── SLUG dari URL (pretty URL atau query param) ──────────── */
import { getKomikSlug, readerURL, komikURL } from "/router.js";
const slug = getKomikSlug();
if (!slug) window.location.href = "/";

const API_DETAIL = `https://www.sankavollerei.com/comic/komikindo/detail/${slug}`;

/* ── STATE ─────────────────────────────────────────────────── */
let currentUser     = null;
let isBookmarked    = false;
let currentKategori = "favorit";
let komikData       = null;

/* ============================================================
   INIT
   ============================================================ */
window.onload = async function () {
  if (localStorage.getItem("theme") === "light") document.body.classList.add("light");
  currentUser = await getCurrentUser();
  await getDetail();
};

/* ============================================================
   FETCH DETAIL
   ============================================================ */
async function getDetail() {
  try {
    const res  = await fetch(API_DETAIL);
    const json = await res.json();

    if (!json.success || !json.data) throw new Error("API error");

    /* Normalise data ke format yang dipakai render */
    const raw = json.data;
    komikData = {
      title:       cleanTitle(raw.title),
      cover:       raw.image || "",
      rating:      raw.rating || "–",
      votes:       raw.votes  || "",
      status:      raw.detail?.status      || "–",
      type:        raw.detail?.type        || "–",
      author:      raw.detail?.author      || "–",
      illustrator: raw.detail?.illustrator || "",
      theme:       raw.detail?.theme       || "",
      altTitle:    raw.detail?.alternativeTitle || "",
      synopsis:    raw.description || "",
      genres:      raw.genres  || [],
      chapters:    raw.chapters || [],
      firstChapter:  raw.firstChapter  || null,
      latestChapter: raw.latestChapter || null,
      allChapterSlug: raw.allChapterSlug || slug,
    };

    document.title = `${komikData.title} — Pankomik`;
    await tampilkanDetail(komikData);
    await loadComments();
  } catch (err) {
    console.error("Error detail:", err);
    document.getElementById("detailKomik").innerHTML = `
      <div style="padding:40px;text-align:center;color:var(--text-muted)">
        <p style="font-size:32px">😕</p>
        <p>Gagal memuat. Cek koneksimu.</p>
        <button onclick="location.reload()" style="margin-top:12px;padding:8px 18px;
          background:var(--accent);color:#fff;border:none;border-radius:8px;cursor:pointer;
          font-family:'Nunito',sans-serif;font-weight:700;">Coba Lagi</button>
      </div>`;
  }
}

/* ============================================================
   RENDER DETAIL
   ============================================================ */
async function tampilkanDetail(d) {
  const container = document.getElementById("detailKomik");
  const coverHD   = proxyImg(d.cover, 280);

  let bookmarkStatus = { isBookmarked: false, kategori: null };
  let lastRead       = null;

  if (currentUser) {
    [bookmarkStatus, lastRead] = await Promise.all([
      checkBookmark(currentUser.id, slug),
      getLastRead(currentUser.id, slug)
    ]);
    isBookmarked    = bookmarkStatus.isBookmarked;
    currentKategori = bookmarkStatus.kategori || "favorit";
  }

  /* Susun baris info */
  const infoRows = [
    d.status      ? `<p>📌 Status: <span>${d.status}</span></p>`      : "",
    d.type        ? `<p>📦 Tipe: <span>${d.type}</span></p>`           : "",
    d.author      ? `<p>✍️ Author: <span>${d.author}</span></p>`       : "",
    d.illustrator && d.illustrator !== d.author
                  ? `<p>🎨 Illustrator: <span>${d.illustrator}</span></p>` : "",
    d.theme       ? `<p>🎭 Theme: <span>${d.theme}</span></p>`         : "",
    d.votes       ? `<p>🗳️ Votes: <span>${d.votes}</span></p>`         : "",
  ].filter(Boolean).join("");

  container.innerHTML = `
    <!-- ── Hero cover + info ── -->
    <div class="detail-header">
      <div class="detail-cover-wrap">
        ${coverHD
          ? `<img src="${coverHD}" alt="${d.title}" onerror="this.src='${proxyImg(d.cover,280).replace(/weserv/,'wsrv')}';">`
          : `<div style="width:120px;height:170px;background:var(--bg-surface);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:36px;">📚</div>`
        }
      </div>
      <div class="detail-info">
        <h2>${d.title}</h2>
        ${d.altTitle ? `<p style="font-size:11px;color:var(--text-muted);font-style:italic;margin-bottom:6px;line-height:1.4;">${d.altTitle.split(",")[0].trim()}</p>` : ""}

        <!-- Rating badge -->
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
          <span style="background:rgba(245,166,35,0.15);border:1px solid rgba(245,166,35,0.3);
            color:#f5a623;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:800;">
            ⭐ ${d.rating}
          </span>
          ${d.status ? `<span class="detail-status-badge ${d.status.toLowerCase().includes('berjalan') ? 'ongoing' : 'completed'}">${d.status}</span>` : ""}
        </div>

        ${infoRows}

        <!-- Genre chips -->
        <div class="genres">
          ${d.genres.map(g => {
            const gSlug = g.slug.replace(/^\/genres\//, "").replace(/^\/genre\//, "");
            return `<span class="genre" onclick="window.location.href='/genre/'+encodeURIComponent(gSlug)" style="cursor:pointer;">${g.name}</span>`;
          }).join("")}
        </div>

        <!-- Aksi -->
        <div class="detail-actions">
          ${currentUser ? `
            <button class="btn-bookmark ${isBookmarked ? "active" : ""}" id="btnBookmark" onclick="toggleBookmark()">
              ${isBookmarked ? "🔖 Tersimpan" : "🔖 Simpan"}
            </button>
            <div class="kategori-picker" id="kategoriPicker" style="display:${isBookmarked ? "flex" : "none"}">
              <button class="kbtn ${currentKategori==="favorit"     ? "active":""}" onclick="setKategori('favorit',this)">❤️ Favorit</button>
              <button class="kbtn ${currentKategori==="lagi_dibaca" ? "active":""}" onclick="setKategori('lagi_dibaca',this)">📖 Lagi Dibaca</button>
              <button class="kbtn ${currentKategori==="tamat"       ? "active":""}" onclick="setKategori('tamat',this)">✅ Tamat</button>
            </div>
            ${lastRead ? `
              <a href="${readerURL(lastRead.chapter_slug, slug)}" class="btn-lanjut">
                ▶️ Lanjut Ch.${lastRead.chapter_number || "?"}
              </a>` : ""}
          ` : `
            <a href="/masuk" class="btn-lanjut" style="text-decoration:none;text-align:center;">🔑 Login untuk Bookmark</a>
          `}
          <button class="btn-share-detail" onclick="shareKomik('${d.title.replace(/'/g,"\\'")}')">🔗 Bagikan</button>
        </div>
      </div>
    </div>

    <!-- ── Quick start buttons ── -->
    ${(d.firstChapter || d.latestChapter) ? `
    <div style="display:flex;gap:8px;padding:0 14px 10px;">
      ${d.firstChapter ? `
        <a href="${readerURL(d.firstChapter.slug, slug)}" class="btn-start">
          📖 Baca Awal
        </a>` : ""}
      ${d.latestChapter ? `
        <a href="${readerURL(d.latestChapter.slug, slug)}" class="btn-start primary">
          🔥 Chapter Terbaru
        </a>` : ""}
    </div>` : ""}

    <!-- ── Sinopsis ── -->
    <div class="synopsis" id="synopsisBox">
      <h3>Sinopsis</h3>
      <p>${d.synopsis || "Tidak ada sinopsis."}</p>
      <button onclick="toggleSynopsis()">Baca Selengkapnya ▼</button>
    </div>

    <!-- ── Daftar Chapter ── -->
    <div class="chapter-section">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <h3 style="margin:0;">Daftar Chapter
          <span style="font-weight:400;font-size:12px;color:var(--text-muted)">(${d.chapters.length})</span>
        </h3>
        ${d.chapters.length > 1 ? `
          <button id="sortChBtn" onclick="toggleChapterSort()" style="
            padding:4px 10px;border-radius:6px;border:1px solid var(--border);
            background:var(--bg-surface);color:var(--text-muted);
            font-size:11px;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;">
            ↑↓ Terlama dulu
          </button>` : ""}
      </div>
      <div class="chapter-list" id="chapterListEl"></div>
    </div>
  `;

  /* Inject style baru */
  injectDetailStyles();
  renderChapterList(d.chapters, lastRead);
}

/* ── Render chapter list (sortable) ─────────────────────────── */
let chaptersSortAsc = false;

function renderChapterList(chapters, lastRead) {
  const el = document.getElementById("chapterListEl");
  if (!el) return;

  const ordered = chaptersSortAsc ? [...chapters].reverse() : [...chapters];

  el.innerHTML = ordered.map(ch => {
    const title      = cleanTitle(ch.title);
    const date       = ch.releaseTime || ch.date || "";
    const isLastRead = lastRead?.chapter_slug === ch.slug;
    return `
      <a href="${readerURL(ch.slug, slug)}"
         class="chapter-item ${isLastRead ? "chapter-last-read" : ""}">
        <span>
          ${title}
          ${isLastRead ? `<span class="last-read-badge">Terakhir Dibaca</span>` : ""}
        </span>
        <span class="chapter-date">${date}</span>
      </a>`;
  }).join("");
}

window.toggleChapterSort = function () {
  chaptersSortAsc = !chaptersSortAsc;
  const btn = document.getElementById("sortChBtn");
  if (btn) btn.textContent = chaptersSortAsc ? "↑↓ Terbaru dulu" : "↑↓ Terlama dulu";
  if (komikData) renderChapterList(komikData.chapters, null);
};

/* ── Style inject ────────────────────────────────────────────── */
function injectDetailStyles() {
  if (document.getElementById("detailExtraStyle")) return;
  const s = document.createElement("style");
  s.id = "detailExtraStyle";
  s.textContent = `
    .detail-cover-wrap img {
      width:120px;height:170px;object-fit:cover;
      border-radius:10px;flex-shrink:0;
      box-shadow:0 6px 20px rgba(0,0,0,0.5);
    }
    .detail-status-badge {
      padding:3px 9px;border-radius:99px;font-size:10px;font-weight:800;
    }
    .detail-status-badge.ongoing  { background:rgba(39,174,96,0.15);border:1px solid rgba(39,174,96,0.3);color:#27ae60; }
    .detail-status-badge.completed { background:rgba(52,152,219,0.15);border:1px solid rgba(52,152,219,0.3);color:#3498db; }
    .btn-start {
      flex:1;padding:10px 0;border-radius:10px;border:1.5px solid var(--border);
      background:var(--bg-surface);color:var(--text);font-family:'Nunito',sans-serif;
      font-size:13px;font-weight:800;cursor:pointer;text-align:center;
      text-decoration:none;display:flex;align-items:center;justify-content:center;gap:5px;
      transition:background 0.2s,border-color 0.2s,color 0.2s;
    }
    .btn-start:hover { background:var(--bg-card);border-color:var(--accent); }
    .btn-start.primary { background:var(--accent);border-color:var(--accent);color:#fff; }
    .btn-start.primary:hover { background:#c73f1c; }
    .chapter-last-read { background:rgba(232,82,42,0.08) !important; color:var(--accent); }
    .last-read-badge {
      display:inline-block;padding:1px 7px;border-radius:99px;font-size:10px;
      background:var(--accent);color:#fff;font-weight:800;margin-left:6px;
    }
  `;
  document.head.appendChild(s);
}

/* ============================================================
   TOGGLE BOOKMARK
   ============================================================ */
window.toggleBookmark = async function () {
  if (!currentUser) { window.location.href = "/masuk"; return; }
  const btn = document.getElementById("btnBookmark");
  btn.disabled = true; btn.textContent = "⏳";

  if (isBookmarked) {
    await removeBookmark(currentUser.id, slug);
    isBookmarked = false;
    btn.className = "btn-bookmark"; btn.textContent = "🔖 Simpan";
    document.getElementById("kategoriPicker").style.display = "none";
    showToast("Bookmark dihapus", "info");
  } else {
    await addBookmark(currentUser.id, {
      slug, title: komikData.title, cover: komikData.cover, kategori: currentKategori
    });
    isBookmarked = true;
    btn.className = "btn-bookmark active"; btn.textContent = "🔖 Tersimpan";
    document.getElementById("kategoriPicker").style.display = "flex";
    showToast("Disimpan ke bookmark! 🔖", "success");
  }
  btn.disabled = false;
};

window.setKategori = async function (kategori, btnEl) {
  if (!currentUser || !isBookmarked) return;
  currentKategori = kategori;
  await addBookmark(currentUser.id, {
    slug, title: komikData.title, cover: komikData.cover, kategori
  });
  document.querySelectorAll(".kbtn").forEach(b => b.classList.remove("active"));
  btnEl.classList.add("active");
};

/* ============================================================
   SHARE
   ============================================================ */
window.shareKomik = async function (title) {
  const url  = window.location.href;
  if (navigator.share) {
    try { await navigator.share({ title, url }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast("🔗 Link disalin!", "success");
  } catch (_) {
    const ta = document.createElement("textarea");
    ta.value = url; ta.style.cssText = "position:fixed;left:-9999px;";
    document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    showToast("🔗 Link disalin!", "success");
  }
};

window.toggleSynopsis = function () {
  const box = document.getElementById("synopsisBox");
  const btn = box.querySelector("button");
  box.classList.toggle("active");
  btn.textContent = box.classList.contains("active") ? "Sembunyikan ▲" : "Baca Selengkapnya ▼";
};

window.toggleDarkMode = function () {
  document.body.classList.toggle("light");
  localStorage.setItem("theme", document.body.classList.contains("light") ? "light" : "dark");
};
window.goHome = () => { window.location.href = "/"; };

/* ── TOAST ───────────────────────────────────────────────────── */
function showToast(msg, type = "info") {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

/* ── LIVE SEARCH ─────────────────────────────────────────────── */
let searchTimeout = null;
window.liveSearch = async function () {
  const query     = document.getElementById("searchInput").value.trim();
  const resultBox = document.getElementById("searchResult");
  if (!query) { resultBox.style.display = "none"; return; }
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    try {
      const res  = await fetch(`https://www.sankavollerei.com/comic/bacakomik/search/${encodeURIComponent(query)}`);
      const data = await res.json();
      const list = data.komikList;
      resultBox.innerHTML = "";
      if (!list?.length) { resultBox.style.display = "none"; return; }
      list.slice(0, 5).forEach(k => {
        const item = document.createElement("div");
        item.className = "search-item";
        item.innerHTML = `<img src="${proxyImg(k.cover,80)}" loading="lazy"><div><p>${k.title}</p><p>⭐ ${k.rating}</p></div>`;
        item.onclick = () => window.location.href = '/komik/'+k.slug;
        resultBox.appendChild(item);
      });
      resultBox.style.display = "block";
    } catch (err) { console.error(err); }
  }, 400);
};
document.addEventListener("click", e => {
  const s = document.getElementById("searchInput");
  const r = document.getElementById("searchResult");
  if (r && !s?.contains(e.target) && !r.contains(e.target)) r.style.display = "none";
});

/* ============================================================
   KOMENTAR
   ============================================================ */
let likedSet = new Set();
let isSubmitting = false;

async function loadComments() {
  const section = document.getElementById("commentSection");
  if (!section) return;

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
        <button onclick="loadComments()" style="margin-top:10px;padding:6px 12px;
          background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer;">Coba Lagi</button>
      </div>
    </div>`;
  }
}

function renderComment(c, isReply = false) {
  if (!c || typeof c !== "object") return "";
  const profile = c.profiles || {};
  const name    = escapeHtml(profile.username || "User");
  const avatar  = profile.avatar_url;
  const level   = profile.level || 1;
  const isLiked = likedSet.has(c.id);
  const isOwner = currentUser?.id === c.user_id;
  const safeId  = String(c.id).replace(/[^a-zA-Z0-9-]/g, "");
  const replies = Array.isArray(c.replies) ? c.replies : [];

  let time = "–";
  try { time = new Date(c.created_at).toLocaleDateString("id-ID", { day:"numeric", month:"short", year:"numeric" }); } catch {}

  return `
    <div class="comment-item ${isReply ? "is-reply" : ""}" id="comment-${safeId}">
      <div class="comment-avatar">
        ${avatar
          ? `<img src="${avatar}" alt="${name}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">`
          : `<div class="comment-avatar-fallback">${name[0]?.toUpperCase()||"U"}</div>`}
      </div>
      <div class="comment-body">
        <div class="comment-meta">
          <span class="comment-username">${name}</span>
          <span class="comment-level">Lv.${level}</span>
          <span class="comment-time">${time}</span>
        </div>
        <p class="comment-text">${escapeHtml(c.content || "")}</p>
        <div class="comment-actions">
          ${currentUser ? `
            <button class="comment-btn ${isLiked ? "liked" : ""}" onclick="likeKomentar('${safeId}',this)">
              ❤️ <span class="like-count">${c.like_count||0}</span>
            </button>
            ${!isReply ? `<button class="comment-btn" onclick="toggleReplyForm('${safeId}')">💬 Balas</button>` : ""}
          ` : `<span class="comment-btn-muted">❤️ ${c.like_count||0}</span>`}
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
          ${replies.length > 0 ? `<div class="replies-list">${replies.map(r=>renderComment(r,true)).join("")}</div>` : ""}
        ` : ""}
      </div>
    </div>`;
}

window.sanitizeInput = function (str) {
  if (typeof str !== "string") return "";
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,"")
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,"")
            .replace(/javascript:/gi,"");
};

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
            .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

function showCommentError(msg, isReply=false, id="") {
  const el = isReply ? document.getElementById(`reply-error-${id}`) : document.getElementById("commentError");
  if (el) { el.textContent = msg; el.style.display = "block"; setTimeout(()=>el.style.display="none",5000); }
}

window.submitKomentar = async function () {
  if (isSubmitting) return;
  const input = document.getElementById("commentInput");
  const text  = input?.value.trim();
  if (!text) { showCommentError("Komentar tidak boleh kosong!"); return; }
  if (text.length < 2) { showCommentError("Minimal 2 karakter!"); return; }
  if (text.length > 500) { showCommentError("Maksimal 500 karakter!"); return; }
  if (!currentUser) { window.location.href = "/masuk"; return; }

  isSubmitting = true;
  const btn = document.getElementById("submitCommentBtn");
  if (btn) { btn.disabled=true; btn.textContent="Mengirim..."; }
  input.disabled = true;

  try {
    const { comment, error } = await addComment(currentUser.id, slug, text);
    if (error) { showCommentError(error.message||"Gagal mengirim."); return; }
    if (comment) {
      input.value = ""; input.disabled=false; isSubmitting=false;
      if (btn) { btn.disabled=false; btn.textContent="Kirim"; }
      const cc = document.getElementById("charCount");
      if (cc) cc.textContent = "0/500";
      showToast("Komentar terkirim! 🎉","success");
      await loadComments();
    }
  } catch { showCommentError("Terjadi kesalahan."); }
  finally { isSubmitting=false; input.disabled=false; if(btn){btn.disabled=false;btn.textContent="Kirim";} }
};

window.submitReply = async function (parentId) {
  if (isSubmitting) return;
  const input = document.getElementById(`reply-input-${parentId}`);
  const text  = input?.value.trim();
  if (!text) { showCommentError("Balasan kosong!",true,parentId); return; }
  if (!currentUser) { window.location.href="/masuk"; return; }
  isSubmitting = true;
  const btn = document.getElementById(`reply-btn-${parentId}`);
  if (btn) { btn.disabled=true; btn.textContent="Mengirim..."; }
  input.disabled = true;
  try {
    const { error } = await addComment(currentUser.id, slug, text, parentId);
    if (error) { showCommentError(error.message||"Gagal.",true,parentId); return; }
    showToast("Balasan terkirim! 💬","success");
    isSubmitting=false; input.disabled=false;
    if(btn){btn.disabled=false;btn.textContent="Kirim Balasan";}
    await loadComments();
  } catch { showCommentError("Kesalahan.",true,parentId); }
  finally { isSubmitting=false; if(btn)btn.disabled=false; }
};

window.toggleReplyForm = function (commentId) {
  const form = document.getElementById(`reply-form-${commentId}`);
  if (!form) return;
  const isVisible = form.style.display !== "none";
  form.style.display = isVisible ? "none" : "block";
  if (!isVisible) setTimeout(() => document.getElementById(`reply-input-${commentId}`)?.focus(), 100);
};

window.likeKomentar = async function (commentId, btn) {
  if (!currentUser) { window.location.href="/masuk"; return; }
  if (btn.disabled) return;
  btn.disabled = true;
  try {
    const { liked, likeCount, error } = await toggleLike(currentUser.id, commentId);
    if (error) { btn.disabled=false; return; }
    const cs = btn.querySelector(".like-count");
    if (cs && likeCount !== null) cs.textContent = likeCount;
    btn.classList.toggle("liked", liked);
    if (liked) likedSet.add(commentId); else likedSet.delete(commentId);
    btn.style.transform="scale(1.2)"; setTimeout(()=>btn.style.transform="scale(1)",200);
  } finally { btn.disabled=false; }
};

window.hapusKomentar = async function (commentId) {
  if (!confirm("Yakin hapus komentar ini?")) return;
  try {
    const { error } = await deleteComment(commentId, currentUser.id);
    if (error) { showToast("Gagal menghapus","error"); return; }
    const el = document.getElementById(`comment-${commentId}`);
    if (el) {
      el.style.transition = "all 0.3s"; el.style.opacity="0"; el.style.transform="translateX(-20px)";
      setTimeout(()=>{ el.remove(); if(!document.querySelectorAll(".comment-item").length) loadComments(); },300);
    }
    showToast("Komentar dihapus","info");
  } catch { showToast("Gagal menghapus","error"); }
};
