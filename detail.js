/* ============================================================
   PANKOMIK — detail.js  (Fase 2)
   Fitur baru:
   ✅ Tombol Bookmark + pilih kategori (Favorit/Lagi Dibaca/Tamat)
   ✅ Tombol "Lanjut Baca" dari riwayat terakhir user
   ✅ Highlight chapter terakhir yang dibaca di daftar chapter
   ============================================================ */

/* ---- IMPORT SUPABASE ------------------------------------- */
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
} from "./supabase.js";

/* ---- BACA SLUG DARI URL ---------------------------------- */
const params = new URLSearchParams(window.location.search);
const slug   = params.get("slug");

if (!slug) window.location.href = "index.html";

const apiDetail = `https://www.sankavollerei.com/comic/bacakomik/detail/${slug}`;

/* ---- STATE GLOBAL ---------------------------------------- */
let currentUser     = null;
let isBookmarked    = false;
let currentKategori = "favorit";
let komikData       = null;

/* ============================================================
   INIT
   ============================================================ */
window.onload = async function () {
  if (localStorage.getItem("theme") === "light") {
    document.body.classList.add("light");
  }
  currentUser = await getCurrentUser();
  await getDetail();
};

/* ============================================================
   FETCH DETAIL
   ============================================================ */
async function getDetail() {
  try {
    const res  = await fetch(apiDetail);
    const data = await res.json();
    komikData  = data.detail;
    document.title = `${komikData.title} — Pankomik`;
    await tampilkanDetail(komikData);
    await loadComments(); /* muat komentar setelah detail tampil */
  } catch (err) {
    console.error("Error detail:", err);
    document.getElementById("detailKomik").innerHTML = `
      <div style="padding:40px;text-align:center;color:var(--text-muted)">
        <p style="font-size:32px">😕</p>
        <p>Gagal memuat. Cek koneksimu.</p>
        <button onclick="location.reload()" style="margin-top:12px;padding:8px 18px;
          background:var(--accent);color:#fff;border:none;border-radius:8px;cursor:pointer;">
          Coba Lagi
        </button>
      </div>`;
  }
}

/* ============================================================
   RENDER DETAIL
   ============================================================ */
async function tampilkanDetail(d) {
  const container = document.getElementById("detailKomik");
  const coverHD   = d.cover.split("?")[0];

  /* Ambil status bookmark & riwayat baca kalau sudah login */
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

  container.innerHTML = `
    <div class="detail-header">
      <img src="${coverHD}" alt="${d.title}">
      <div class="detail-info">
        <h2>${d.title}</h2>
        <p>⭐ <span>${d.rating}</span></p>
        <p>Status: <span>${d.status}</span></p>
        <p>Tipe: <span>${d.type}</span></p>
        <p>Author: <span>${d.author}</span></p>
        <div class="genres">
          ${d.genres.map(g => `<span class="genre" onclick="window.location.href='genre.html?genre=${encodeURIComponent(g.slug || g.title.toLowerCase().replace(/\s+/g,'-'))}';" style="cursor:pointer;">${g.title}</span>`).join("")}
        </div>

        <!-- Tombol aksi (hanya kalau sudah login) -->
        <div class="detail-actions">
          ${currentUser ? `
            <button
              class="btn-bookmark ${isBookmarked ? "active" : ""}"
              id="btnBookmark"
              onclick="toggleBookmark()"
            >${isBookmarked ? "🔖 Tersimpan" : "🔖 Simpan"}</button>

            <!-- Kategori picker, tampil saat komik sudah di-bookmark -->
            <div class="kategori-picker" id="kategoriPicker"
              style="display:${isBookmarked ? "flex" : "none"}">
              <button class="kbtn ${currentKategori==="favorit"     ? "active":""}" onclick="setKategori('favorit',this)">❤️ Favorit</button>
              <button class="kbtn ${currentKategori==="lagi_dibaca" ? "active":""}" onclick="setKategori('lagi_dibaca',this)">📖 Lagi Dibaca</button>
              <button class="kbtn ${currentKategori==="tamat"       ? "active":""}" onclick="setKategori('tamat',this)">✅ Tamat</button>
            </div>

            ${lastRead ? `
              <a href="reader.html?slug=${lastRead.chapter_slug}" class="btn-lanjut">
                ▶️ Lanjut Ch.${lastRead.chapter_number || "?"}
              </a>
            ` : ""}
          ` : `
            <a href="auth.html" class="btn-lanjut" style="text-decoration:none;text-align:center;">
              🔑 Login untuk Bookmark
            </a>
          `}
        </div>
      </div>
    </div>

    <div class="synopsis" id="synopsisBox">
      <h3>Sinopsis</h3>
      <p>${d.synopsis}</p>
      <button onclick="toggleSynopsis()">Baca Selengkapnya ▼</button>
    </div>

    <div class="chapter-section">
      <h3>Daftar Chapter
        <span style="font-weight:400;font-size:12px;color:var(--text-muted)">
          (${d.chapters.length})
        </span>
      </h3>
      <div class="chapter-list">
        ${d.chapters.map(ch => {
          const match      = ch.slug.match(/chapter-(\d+)/i);
          const nomor      = match ? match[1] : "?";
          const isLastRead = lastRead?.chapter_slug === ch.slug;
          return `
            <a href="reader.html?slug=${ch.slug}"
               class="chapter-item ${isLastRead ? "chapter-last-read" : ""}">
              <span>
                Chapter ${nomor}
                ${isLastRead ? `<span class="last-read-badge">Terakhir Dibaca</span>` : ""}
              </span>
              <span class="chapter-date">${ch.date}</span>
            </a>`;
        }).join("")}
      </div>
    </div>
  `;
}

/* ============================================================
   TOGGLE BOOKMARK
   ============================================================ */
window.toggleBookmark = async function () {
  if (!currentUser) { window.location.href = "auth.html"; return; }

  const btn = document.getElementById("btnBookmark");
  btn.disabled = true;
  btn.textContent = "⏳";

  if (isBookmarked) {
    await removeBookmark(currentUser.id, slug);
    isBookmarked = false;
    btn.className   = "btn-bookmark";
    btn.textContent = "🔖 Simpan";
    document.getElementById("kategoriPicker").style.display = "none";
    showToast("Bookmark dihapus", "info");
  } else {
    await addBookmark(currentUser.id, {
      slug,
      title:    komikData.title,
      cover:    komikData.cover.split("?")[0],
      kategori: currentKategori
    });
    isBookmarked = true;
    btn.className   = "btn-bookmark active";
    btn.textContent = "🔖 Tersimpan";
    document.getElementById("kategoriPicker").style.display = "flex";
    showToast("Disimpan ke bookmark! 🔖", "success");
  }
  btn.disabled = false;
};

/* ============================================================
   SET KATEGORI BOOKMARK
   ============================================================ */
window.setKategori = async function (kategori, btnEl) {
  if (!currentUser || !isBookmarked) return;
  currentKategori = kategori;

  await addBookmark(currentUser.id, {
    slug,
    title:    komikData.title,
    cover:    komikData.cover.split("?")[0],
    kategori
  });

  document.querySelectorAll(".kbtn").forEach(b => b.classList.remove("active"));
  btnEl.classList.add("active");
};

/* ============================================================
   TOGGLE SINOPSIS
   ============================================================ */
window.toggleSynopsis = function () {
  const box = document.getElementById("synopsisBox");
  const btn = box.querySelector("button");
  box.classList.toggle("active");
  btn.textContent = box.classList.contains("active") ? "Sembunyikan ▲" : "Baca Selengkapnya ▼";
};

/* ============================================================
   DARK MODE & NAV
   ============================================================ */
window.toggleDarkMode = function () {
  document.body.classList.toggle("light");
  localStorage.setItem("theme", document.body.classList.contains("light") ? "light" : "dark");
};
window.goHome = () => { window.location.href = "index.html"; };
/* toggleMenu ditangani auth-header.js */

/* ---- TOAST UTILITY --------------------------------------- */
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

/* ---- LIVE SEARCH ----------------------------------------- */
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
        item.innerHTML = `<img src="${k.cover.split("?")[0]}" loading="lazy"><div><p>${k.title}</p><p>⭐ ${k.rating}</p></div>`;
        item.onclick = () => window.location.href = `detail.html?slug=${k.slug}`;
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

async function loadComments() {
  const section = document.getElementById("commentSection");
  if (!section) return;

  const { comments } = await getComments(slug);
  if (currentUser) {
    likedSet = await getLikedComments(currentUser.id);
  }

  section.innerHTML = `
    <div class="comment-section">
      <h3 class="comment-title">💬 Komentar <span style="font-size:12px;font-weight:400;color:var(--text-muted)">(${comments.length})</span></h3>

      ${currentUser ? `
        <div class="comment-form">
          <textarea id="commentInput" placeholder="Tulis komentar..." rows="3"></textarea>
          <button onclick="submitKomentar()">Kirim</button>
        </div>
      ` : `
        <div class="comment-login-prompt">
          <a href="auth.html">🔑 Login untuk berkomentar</a>
        </div>
      `}

      <div id="commentList">
        ${comments.length === 0
          ? `<div class="comment-empty">Belum ada komentar. Jadilah yang pertama! 🎉</div>`
          : comments.map(c => renderComment(c)).join("")
        }
      </div>
    </div>
  `;
}

function renderComment(c, isReply = false) {
  const name   = c.profiles?.username || "User";
  const avatar = c.profiles?.avatar_url;
  const level  = c.profiles?.level || 1;
  const isLiked = likedSet.has(c.id);
  const isOwner = currentUser?.id === c.user_id;
  const time   = new Date(c.created_at).toLocaleDateString("id-ID", { day:"numeric", month:"short", year:"numeric" });

  const replies = (c.replies || []).map(r => renderComment(r, true)).join("");

  return `
    <div class="comment-item ${isReply ? "is-reply" : ""}" id="comment-${c.id}">
      <div class="comment-avatar">
        ${avatar
          ? `<img src="${avatar}" alt="${name}">`
          : `<div class="comment-avatar-fallback">${name[0].toUpperCase()}</div>`
        }
      </div>
      <div class="comment-body">
        <div class="comment-meta">
          <span class="comment-username">${name}</span>
          <span class="comment-level">Lv.${level}</span>
          <span class="comment-time">${time}</span>
        </div>
        <p class="comment-text">${escapeHtml(c.content)}</p>
        <div class="comment-actions">
          ${currentUser ? `
            <button class="comment-btn ${isLiked ? "liked" : ""}" onclick="likeKomentar('${c.id}', this)">
              ❤️ ${c.like_count || 0}
            </button>
            ${!isReply ? `<button class="comment-btn" onclick="toggleReplyForm('${c.id}')">💬 Balas</button>` : ""}
          ` : `<span class="comment-btn-muted">❤️ ${c.like_count || 0}</span>`}
          ${isOwner ? `<button class="comment-btn danger" onclick="hapusKomentar('${c.id}')">🗑️</button>` : ""}
        </div>
        ${!isReply ? `
          <div class="reply-form" id="reply-form-${c.id}" style="display:none">
            <textarea placeholder="Balas komentar..." rows="2" id="reply-input-${c.id}"></textarea>
            <button onclick="submitReply('${c.id}')">Kirim Balasan</button>
          </div>
          ${replies ? `<div class="replies-list">${replies}</div>` : ""}
        ` : ""}
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

window.submitKomentar = async function () {
  const input = document.getElementById("commentInput");
  const text  = input?.value.trim();
  if (!text || !currentUser) return;

  const btn = document.querySelector(".comment-form button");
  input.disabled = true;
  if (btn) { btn.disabled = true; btn.textContent = "Mengirim..."; }

  const { comment, error } = await addComment(currentUser.id, slug, text);
  if (!error && comment) {
    input.value = "";
    await loadComments();
  } else {
    if (input) input.disabled = false;
    if (btn) { btn.disabled = false; btn.textContent = "Kirim"; }
  }
};

window.submitReply = async function (parentId) {
  const input = document.getElementById(`reply-input-${parentId}`);
  const text  = input?.value.trim();
  if (!text || !currentUser) return;

  input.disabled = true;
  const { error } = await addComment(currentUser.id, slug, text, parentId);
  if (!error) await loadComments();
  else if (input) input.disabled = false;
};

window.toggleReplyForm = function (commentId) {
  const form = document.getElementById(`reply-form-${commentId}`);
  if (form) form.style.display = form.style.display === "none" ? "block" : "none";
};

window.likeKomentar = async function (commentId, btn) {
  if (!currentUser) { window.location.href = "auth.html"; return; }
  const { liked } = await toggleLike(currentUser.id, commentId);
  const countMatch = btn.textContent.match(/\d+/);
  let count = countMatch ? parseInt(countMatch[0]) : 0;
  count = liked ? count + 1 : Math.max(0, count - 1);
  btn.textContent = `❤️ ${count}`;
  btn.classList.toggle("liked", liked);
  if (liked) likedSet.add(commentId); else likedSet.delete(commentId);
};

window.hapusKomentar = async function (commentId) {
  if (!confirm("Hapus komentar ini?")) return;
  await deleteComment(commentId);
  await loadComments();
};
