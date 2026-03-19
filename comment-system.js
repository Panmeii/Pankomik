/* ============================================================
   PANKOMIK — comment-system.js
   Modul komentar reusable untuk: detail komik, reader komik,
   detail novel, reader novel.

   CARA PAKAI:
     import { initComments } from "/comment-system.js";
     initComments({
       containerId : "commentSection",  // id elemen target
       contentSlug : "novel:my-novel",  // slug konten unik
       accentColor : "#8e44ad",         // warna aksen (opsional)
       user        : currentUserObj,    // null jika belum login
     });
   ============================================================ */

import {
  getCommentsForSlug,
  addCommentForSlug,
  deleteComment,
  toggleLike,
  getLikedComments
} from "/supabase.js";

/* ── Escape HTML ──────────────────────────────────────────── */
function escHtml(str) {
  return String(str || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

/* ── CSS satu kali ─────────────────────────────────────────── */
function injectCommentCSS(accent = "#e8522a") {
  if (document.getElementById("pankomik-comment-css")) return;
  const s = document.createElement("style");
  s.id = "pankomik-comment-css";
  s.textContent = `
    /* ── Wrapper ── */
    .pkc-section {
      padding: 16px 14px 24px;
      border-top: 1px solid var(--border, #2a2a36);
    }
    .pkc-title {
      font-size: 15px; font-weight: 800;
      color: var(--text, #eaeaf0);
      margin-bottom: 14px;
      display: flex; align-items: center; gap: 8px;
    }
    .pkc-title span.pkc-count {
      font-size: 12px; font-weight: 600;
      color: var(--text-muted, #888899);
    }

    /* ── Form ── */
    .pkc-form {
      background: var(--bg-card, #18181f);
      border: 1px solid var(--border, #2a2a36);
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 16px;
    }
    .pkc-form textarea {
      width: 100%; border: none; outline: none; resize: none;
      background: transparent;
      color: var(--text, #eaeaf0);
      font-family: 'Nunito', sans-serif;
      font-size: 13px; line-height: 1.6;
      min-height: 72px;
      placeholder-color: var(--text-muted);
    }
    .pkc-form-footer {
      display: flex; justify-content: space-between;
      align-items: center; margin-top: 8px;
      border-top: 1px solid var(--border, #2a2a36);
      padding-top: 8px;
    }
    .pkc-char { font-size: 11px; color: var(--text-muted, #888899); }
    .pkc-submit {
      padding: 7px 18px;
      background: var(--pkc-accent, #e8522a);
      color: #fff;
      border: none; border-radius: 8px;
      font-family: 'Nunito', sans-serif;
      font-size: 13px; font-weight: 800;
      cursor: pointer;
      transition: background .2s, transform .1s;
      display: flex; align-items: center; gap: 5px;
    }
    .pkc-submit:hover   { filter: brightness(1.12); }
    .pkc-submit:active  { transform: scale(0.95); }
    .pkc-submit:disabled { opacity: .55; cursor: not-allowed; }
    .pkc-submit .pkc-spinner {
      display: inline-block; width: 12px; height: 12px;
      border: 2px solid rgba(255,255,255,.4);
      border-top-color: #fff; border-radius: 50%;
      animation: pkc-spin .6s linear infinite;
    }
    @keyframes pkc-spin { to { transform: rotate(360deg); } }

    /* ── Login prompt ── */
    .pkc-login-prompt {
      text-align: center; padding: 14px;
      background: var(--bg-surface, #1f1f28);
      border-radius: 10px; margin-bottom: 16px;
      font-size: 13px;
    }
    .pkc-login-prompt a {
      color: var(--pkc-accent, #e8522a); font-weight: 700;
      text-decoration: none;
    }

    /* ── List ── */
    .pkc-list { display: flex; flex-direction: column; gap: 12px; }

    /* ── Empty ── */
    .pkc-empty {
      text-align: center; padding: 32px 16px;
      color: var(--text-muted, #888899);
      font-size: 13px;
    }
    .pkc-empty .pkc-empty-icon { font-size: 36px; margin-bottom: 8px; }

    /* ── Item ── */
    .pkc-item {
      display: flex; gap: 10px;
      padding: 12px;
      background: var(--bg-card, #18181f);
      border: 1px solid var(--border, #2a2a36);
      border-radius: 12px;
      animation: pkc-fadeIn .25s ease;
    }
    @keyframes pkc-fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .pkc-item.is-reply {
      margin-left: 32px;
      background: var(--bg-surface, #1f1f28);
      border-radius: 10px;
    }
    .pkc-item.removing {
      opacity: 0; transform: translateX(-16px);
      transition: all .25s ease;
    }

    /* ── Avatar ── */
    .pkc-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: var(--pkc-accent, #e8522a);
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 14px; color: #fff;
      flex-shrink: 0; overflow: hidden;
    }
    .pkc-item.is-reply .pkc-avatar { width: 28px; height: 28px; font-size: 11px; }
    .pkc-avatar img {
      width: 100%; height: 100%; object-fit: cover;
    }

    /* ── Body ── */
    .pkc-body { flex: 1; min-width: 0; }
    .pkc-meta {
      display: flex; align-items: center; gap: 6px;
      flex-wrap: wrap; margin-bottom: 5px;
    }
    .pkc-username {
      font-weight: 800; font-size: 13px;
      color: var(--text, #eaeaf0);
    }
    .pkc-level {
      font-size: 10px; font-weight: 700;
      background: var(--pkc-accent, #e8522a);
      color: #fff; padding: 1px 6px;
      border-radius: 99px;
    }
    .pkc-time {
      font-size: 11px; color: var(--text-muted, #888899);
      margin-left: auto;
    }
    .pkc-text {
      font-size: 13px; line-height: 1.6;
      color: var(--text, #eaeaf0);
      margin-bottom: 8px;
      word-break: break-word;
    }

    /* ── Actions ── */
    .pkc-actions {
      display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
    }
    .pkc-btn {
      display: flex; align-items: center; gap: 4px;
      padding: 4px 10px;
      background: transparent;
      border: 1px solid var(--border, #2a2a36);
      border-radius: 99px;
      color: var(--text-muted, #888899);
      font-family: 'Nunito', sans-serif;
      font-size: 12px; font-weight: 700;
      cursor: pointer;
      transition: all .18s;
    }
    .pkc-btn:hover { border-color: var(--pkc-accent, #e8522a); color: var(--pkc-accent, #e8522a); }
    .pkc-btn.liked {
      background: rgba(255,0,80,.08);
      border-color: #ff4060;
      color: #ff4060;
    }
    .pkc-btn.danger:hover { border-color: #e74c3c; color: #e74c3c; }
    .pkc-like-count { font-weight: 800; }
    .pkc-btn-muted {
      font-size: 12px; color: var(--text-muted, #888899);
      display: flex; align-items: center; gap: 4px;
    }

    /* ── Error msg ── */
    .pkc-error {
      font-size: 12px; color: var(--pkc-accent, #e8522a);
      margin-top: 6px; display: none;
    }

    /* ── Reply form ── */
    .pkc-reply-form {
      margin-top: 10px;
      background: var(--bg-surface, #1f1f28);
      border: 1px solid var(--border, #2a2a36);
      border-radius: 10px; padding: 10px;
      display: none;
    }
    .pkc-reply-form textarea {
      width: 100%; background: transparent; border: none; outline: none;
      color: var(--text, #eaeaf0);
      font-family: 'Nunito', sans-serif;
      font-size: 13px; resize: none; min-height: 56px; line-height: 1.6;
    }
    .pkc-reply-footer {
      display: flex; justify-content: space-between;
      align-items: center; margin-top: 6px;
    }
    .pkc-reply-submit {
      padding: 5px 14px;
      background: var(--pkc-accent, #e8522a);
      color: #fff; border: none; border-radius: 7px;
      font-family: 'Nunito', sans-serif;
      font-size: 12px; font-weight: 800;
      cursor: pointer;
      transition: filter .2s, transform .1s;
    }
    .pkc-reply-submit:hover  { filter: brightness(1.12); }
    .pkc-reply-submit:active { transform: scale(0.95); }
    .pkc-reply-submit:disabled { opacity: .55; cursor: not-allowed; }

    /* ── Replies container ── */
    .pkc-replies { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }

    /* ── Loading state ── */
    .pkc-loading {
      display: flex; align-items: center; gap: 10px;
      padding: 20px; color: var(--text-muted, #888899);
      font-size: 13px;
    }
    .pkc-loading .pkc-spinner {
      display: inline-block; width: 18px; height: 18px;
      border: 2px solid rgba(255,255,255,.15);
      border-top-color: var(--pkc-accent, #e8522a);
      border-radius: 50%;
      animation: pkc-spin .7s linear infinite;
    }
  `;
  document.head.appendChild(s);
}

/* ============================================================
   MAIN INIT
   ============================================================ */
export async function initComments({ containerId, contentSlug, accentColor, user }) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const accent = accentColor || "#e8522a";
  injectCommentCSS(accent);

  // Set CSS variable lokal
  container.style.setProperty("--pkc-accent", accent);

  await renderCommentSection(container, contentSlug, user, accent);
}

/* ============================================================
   RENDER SECTION
   ============================================================ */
async function renderCommentSection(container, contentSlug, user, accent) {
  // Loading state
  container.innerHTML = `
    <div class="pkc-section">
      <div class="pkc-loading">
        <div class="pkc-spinner"></div> Memuat komentar...
      </div>
    </div>`;

  let likedSet = new Set();

  try {
    const { comments, error } = await getCommentsForSlug(contentSlug);
    if (error) throw error;

    if (user) {
      try { likedSet = await getLikedComments(user.id); } catch {}
    }

    const safeComments = Array.isArray(comments) ? comments : [];

    container.innerHTML = `
      <div class="pkc-section" style="--pkc-accent:${accent}">
        <div class="pkc-title">
          💬 Komentar
          <span class="pkc-count">(${safeComments.length})</span>
        </div>

        ${user ? `
          <div class="pkc-form" id="pkc-main-form">
            <textarea id="pkc-input" placeholder="Tulis komentar..." maxlength="500"
              oninput="document.getElementById('pkc-char').textContent=this.value.length+'/500'"
              rows="3"></textarea>
            <div class="pkc-form-footer">
              <span class="pkc-char" id="pkc-char">0/500</span>
              <button class="pkc-submit" id="pkc-submit-btn">Kirim 💬</button>
            </div>
            <p class="pkc-error" id="pkc-main-error"></p>
          </div>
        ` : `
          <div class="pkc-login-prompt">
            <a href="/masuk">🔑 Login untuk berkomentar</a>
          </div>
        `}

        <div class="pkc-list" id="pkc-list">
          ${safeComments.length === 0
            ? `<div class="pkc-empty">
                 <div class="pkc-empty-icon">💬</div>
                 Belum ada komentar. Jadilah yang pertama!
               </div>`
            : safeComments.map(c => renderItem(c, false, user, likedSet)).join("")}
        </div>
      </div>`;

    /* Pasang event listener setelah render */
    if (user) {
      bindSubmit(container, contentSlug, user, likedSet, accent);
    }
    bindLikes(container, user, likedSet, contentSlug, accent);
    bindReplies(container, user, likedSet, contentSlug, accent);
    bindDelete(container, user, contentSlug, accent);

  } catch (err) {
    console.error("[CommentSystem] Error:", err);
    container.innerHTML = `
      <div class="pkc-section">
        <div class="pkc-title">💬 Komentar</div>
        <div class="pkc-empty">
          <div class="pkc-empty-icon">😕</div>
          Gagal memuat komentar.
          <br><br>
          <button onclick="location.reload()" style="
            padding:7px 18px;background:${accent};color:#fff;
            border:none;border-radius:8px;cursor:pointer;
            font-family:'Nunito',sans-serif;font-weight:700;font-size:13px;">
            🔄 Coba Lagi
          </button>
        </div>
      </div>`;
  }
}

/* ============================================================
   RENDER ITEM (comment / reply)
   ============================================================ */
function renderItem(c, isReply, user, likedSet) {
  if (!c || typeof c !== "object") return "";
  const profile = c.profiles || {};
  const name    = escHtml(profile.username || "User");
  const avatar  = profile.avatar_url;
  const level   = profile.level || 1;
  const initial = (profile.username || "U")[0].toUpperCase();
  const isLiked = likedSet.has(c.id);
  const isOwner = user?.id === c.user_id;
  const safeId  = String(c.id).replace(/[^a-zA-Z0-9-]/g, "");
  const replies  = Array.isArray(c.replies) ? c.replies : [];

  let time = "–";
  try { time = new Date(c.created_at).toLocaleDateString("id-ID", { day:"numeric", month:"short", year:"numeric" }); } catch {}

  return `
    <div class="pkc-item ${isReply ? "is-reply" : ""}" id="pkc-comment-${safeId}" data-id="${c.id}">
      <div class="pkc-avatar">
        ${avatar
          ? `<img src="${escHtml(avatar)}" alt="${name}" loading="lazy"
               onerror="this.style.display='none';this.parentElement.textContent='${initial}'">`
          : initial}
      </div>
      <div class="pkc-body">
        <div class="pkc-meta">
          <span class="pkc-username">${name}</span>
          <span class="pkc-level">Lv.${level}</span>
          <span class="pkc-time">${time}</span>
        </div>
        <p class="pkc-text">${escHtml(c.content || "")}</p>
        <div class="pkc-actions">
          ${user ? `
            <button class="pkc-btn pkc-like-btn ${isLiked ? "liked" : ""}"
              data-id="${c.id}" data-count="${c.like_count || 0}">
              ❤️ <span class="pkc-like-count">${c.like_count || 0}</span>
            </button>
            ${!isReply ? `<button class="pkc-btn pkc-reply-btn" data-id="${safeId}">💬 Balas</button>` : ""}
          ` : `<span class="pkc-btn-muted">❤️ ${c.like_count || 0}</span>`}
          ${isOwner ? `<button class="pkc-btn danger pkc-delete-btn" data-id="${c.id}">🗑️</button>` : ""}
        </div>

        ${!isReply ? `
          <div class="pkc-reply-form" id="pkc-reply-form-${safeId}" data-parent="${c.id}">
            <textarea placeholder="Tulis balasan..." rows="2" maxlength="300"
              id="pkc-reply-input-${safeId}"
              oninput="document.getElementById('pkc-rchar-${safeId}').textContent=this.value.length+'/300'"></textarea>
            <div class="pkc-reply-footer">
              <span class="pkc-char" id="pkc-rchar-${safeId}">0/300</span>
              <button class="pkc-reply-submit" data-parent="${c.id}" data-input="pkc-reply-input-${safeId}">Kirim</button>
            </div>
            <p class="pkc-error" id="pkc-reply-err-${safeId}"></p>
          </div>
          ${replies.length > 0 ? `
            <div class="pkc-replies">
              ${replies.map(r => renderItem(r, true, user, likedSet)).join("")}
            </div>` : ""}
        ` : ""}
      </div>
    </div>`;
}

/* ============================================================
   BIND EVENTS
   ============================================================ */
let _submitting = false;

function bindSubmit(container, contentSlug, user, likedSet, accent) {
  const btn   = container.querySelector("#pkc-submit-btn");
  const input = container.querySelector("#pkc-input");
  const errEl = container.querySelector("#pkc-main-error");
  if (!btn || !input) return;

  btn.addEventListener("click", async () => {
    if (_submitting) return;
    const text = input.value.trim();
    if (!text) { showErr(errEl, "Komentar tidak boleh kosong!"); return; }
    if (text.length < 2) { showErr(errEl, "Minimal 2 karakter!"); return; }

    _submitting = true;
    btn.disabled = true;
    btn.innerHTML = `<span class="pkc-spinner"></span> Mengirim...`;

    try {
      const { comment, error } = await addCommentForSlug(user.id, contentSlug, text);
      if (error) { showErr(errEl, error.message || "Gagal mengirim."); return; }
      input.value = "";
      const cc = container.querySelector("#pkc-char");
      if (cc) cc.textContent = "0/500";
      // Re-render komentar
      await renderCommentSection(container, contentSlug, user, accent);
    } catch { showErr(errEl, "Terjadi kesalahan."); }
    finally {
      _submitting = false;
      if (btn) { btn.disabled = false; btn.innerHTML = "Kirim 💬"; }
    }
  });
}

function bindLikes(container, user, likedSet, contentSlug, accent) {
  container.addEventListener("click", async e => {
    const btn = e.target.closest(".pkc-like-btn");
    if (!btn) return;
    if (!user) { window.location.href = "/masuk"; return; }
    if (btn.dataset.processing) return;
    btn.dataset.processing = "1";

    const commentId = btn.dataset.id;
    const countEl   = btn.querySelector(".pkc-like-count");

    try {
      const { liked, likeCount, error } = await toggleLike(user.id, commentId);
      if (error) { delete btn.dataset.processing; return; }
      if (countEl && likeCount !== null) countEl.textContent = likeCount;
      btn.classList.toggle("liked", liked);
      if (liked) likedSet.add(commentId); else likedSet.delete(commentId);
      btn.style.transform = "scale(1.3)";
      setTimeout(() => { btn.style.transform = "scale(1)"; btn.style.transition = "transform .18s"; }, 180);
    } finally {
      delete btn.dataset.processing;
    }
  });
}

function bindReplies(container, user, likedSet, contentSlug, accent) {
  // Toggle reply form
  container.addEventListener("click", e => {
    const btn = e.target.closest(".pkc-reply-btn");
    if (!btn) return;
    const id   = btn.dataset.id;
    const form = container.querySelector(`#pkc-reply-form-${id}`);
    if (!form) return;
    const was = form.style.display === "block";
    form.style.display = was ? "none" : "block";
    if (!was) setTimeout(() => form.querySelector("textarea")?.focus(), 60);
  });

  // Submit reply
  container.addEventListener("click", async e => {
    const btn = e.target.closest(".pkc-reply-submit");
    if (!btn) return;
    if (!user) { window.location.href = "/masuk"; return; }
    if (btn.dataset.processing) return;

    const parentId = btn.dataset.parent;
    const inputId  = btn.dataset.input;
    const input    = container.querySelector(`#${inputId}`);
    const errEl    = container.querySelector(`#pkc-reply-err-${parentId.replace(/[^a-zA-Z0-9-]/g, "")}`);
    const text     = input?.value.trim();
    if (!text) { showErr(errEl, "Balasan kosong!"); return; }

    btn.dataset.processing = "1";
    btn.disabled = true;
    btn.innerHTML = `<span class="pkc-spinner"></span>`;

    try {
      const { error } = await addCommentForSlug(user.id, contentSlug, text, parentId);
      if (error) { showErr(errEl, error.message || "Gagal."); return; }
      await renderCommentSection(container, contentSlug, user, accent);
    } catch { showErr(errEl, "Kesalahan."); }
    finally {
      btn.disabled = false;
      btn.textContent = "Kirim";
      delete btn.dataset.processing;
    }
  });
}

function bindDelete(container, user, contentSlug, accent) {
  container.addEventListener("click", async e => {
    const btn = e.target.closest(".pkc-delete-btn");
    if (!btn) return;
    if (!confirm("Yakin hapus komentar ini?")) return;

    const commentId = btn.dataset.id;
    const itemEl    = container.querySelector(`[data-id="${commentId}"]`);

    try {
      const { error } = await deleteComment(commentId, user.id);
      if (error) { alert("Gagal menghapus."); return; }
      if (itemEl) {
        itemEl.classList.add("removing");
        setTimeout(() => {
          itemEl.remove();
          const list = container.querySelector(".pkc-list");
          if (list && !list.querySelector(".pkc-item")) {
            list.innerHTML = `<div class="pkc-empty">
              <div class="pkc-empty-icon">💬</div>
              Belum ada komentar. Jadilah yang pertama!
            </div>`;
          }
          // Update count
          const countEl = container.querySelector(".pkc-count");
          if (countEl) {
            const n = parseInt(countEl.textContent.replace(/\D/g,"")) - 1;
            countEl.textContent = `(${Math.max(0, n)})`;
          }
        }, 260);
      }
    } catch { alert("Gagal menghapus."); }
  });
}

/* ── Helper error display ─────────────────────────────────── */
function showErr(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => { if (el) el.style.display = "none"; }, 4000);
}
