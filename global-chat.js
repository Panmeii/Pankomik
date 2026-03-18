/* ============================================================
   PANKOMIK — global-chat.js  (rewrite bersih)
   ============================================================ */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://aaqhknkyrnsapvfywdsn.supabase.co";
const SUPABASE_KEY = "sb_publishable_ND-51tP1NF40HRZ3q05N5w_1ZnlPzlL";
const supabase     = createClient(SUPABASE_URL, SUPABASE_KEY);

const ADMIN_EMAILS = ["pankomik@gmail.com", "admin@pankomik.com"];
const MAX_CHARS    = 500;
const EMOJIS = ["😂","😍","🔥","💯","👏","😭","❤️","😎","💪","🙏","😤","✨","🎉","😱","🤩","💀","😅","🫶","🏆","👑","💛","🫡","🤣","👀","⭐","🎭"];

/* ── STATE ─────────────────────────────────────────────────── */
let currentUser     = null;
let isAdmin         = false;
let messages        = [];
let isOpen          = false;
let unreadCount     = 0;
let isAtBottom      = true;
let replyingTo      = null;
let realtimeChannel = null;
let emojiOpen       = false;
let ctxTarget       = null;

/* ============================================================
   CSS
   ============================================================ */
const style = document.createElement("style");
style.textContent = `
  /* ── TOGGLE BUTTON ───────────────────────────────────────── */
  #gc-toggle {
    position: fixed;
    right: 16px;
    bottom: 76px;
    z-index: 9100;
    width: 52px; height: 52px;
    border-radius: 50%;
    background: linear-gradient(135deg,#e8522a,#c73f1c);
    border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px;
    box-shadow: 0 4px 18px rgba(232,82,42,.55),0 2px 6px rgba(0,0,0,.4);
    transition: transform .2s, box-shadow .2s;
    -webkit-tap-highlight-color: transparent;
  }
  #gc-toggle:active { transform: scale(.92); }
  .gc-toggle-icon { pointer-events: none; line-height: 1; }

  /* Badge */
  #gc-badge {
    position: absolute; top: -3px; right: -3px;
    min-width: 18px; height: 18px;
    background: #e74c3c; color: #fff;
    font-family: 'Nunito', sans-serif;
    font-size: 10px; font-weight: 800;
    border-radius: 99px; padding: 0 4px;
    display: none; align-items: center; justify-content: center;
    border: 2px solid #09090f; pointer-events: none;
  }
  #gc-badge.show { display: flex; }

  /* Online dot */
  #gc-online-dot {
    position: absolute; bottom: 1px; left: 1px;
    width: 12px; height: 12px;
    background: #27ae60; border-radius: 50%;
    border: 2px solid #09090f;
    animation: gcPulse 2s ease infinite;
  }
  @keyframes gcPulse {
    0%,100%{ opacity:1; transform:scale(1); }
    50%    { opacity:.6; transform:scale(.85); }
  }

  /* ── PANEL FULLSCREEN ────────────────────────────────────── */
  #gc-panel {
    position: fixed;
    inset: 0;
    z-index: 9099;
    background: #0d0d15;
    display: flex; flex-direction: column;
    transform: translateY(100%);
    opacity: 0;
    pointer-events: none;
    transition: transform .3s cubic-bezier(.4,0,.2,1), opacity .25s ease;
  }
  #gc-panel.open {
    transform: translateY(0);
    opacity: 1;
    pointer-events: all;
  }

  /* ── HEADER ──────────────────────────────────────────────── */
  #gc-header {
    display: flex; align-items: center; gap: 10px;
    padding: 14px 16px;
    padding-top: max(14px, env(safe-area-inset-top));
    background: rgba(232,82,42,.07);
    border-bottom: 1px solid rgba(255,255,255,.07);
    flex-shrink: 0;
  }
  .gc-hdr-icon { font-size: 20px; }
  .gc-hdr-text { flex: 1; }
  .gc-hdr-title {
    font-family: 'Nunito', sans-serif;
    font-size: 15px; font-weight: 800; color: #eaeaf0; line-height: 1.2;
  }
  .gc-hdr-sub {
    font-family: 'Nunito', sans-serif;
    font-size: 11px; font-weight: 700; color: #27ae60;
    display: flex; align-items: center; gap: 4px;
  }
  .gc-hdr-dot { width:6px;height:6px;border-radius:50%;background:#27ae60;animation:gcPulse 2s ease infinite; }
  #gc-close {
    background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.1);
    color: #aaa; width: 32px; height: 32px; border-radius: 10px;
    cursor: pointer; font-size: 16px;
    display: flex; align-items: center; justify-content: center;
    transition: background .15s; flex-shrink: 0;
  }
  #gc-close:hover { background: rgba(255,255,255,.14); color: #eaeaf0; }

  /* ── PINNED ──────────────────────────────────────────────── */
  #gc-pinned { flex-shrink:0; max-height:72px; overflow:hidden; }
  .gc-pin-item {
    display: flex; align-items: center; gap: 8px;
    padding: 7px 16px;
    background: linear-gradient(90deg,rgba(245,200,66,.07),transparent);
    border-bottom: 1px solid rgba(245,200,66,.1);
    cursor: pointer;
  }
  .gc-pin-text {
    font-family:'Nunito',sans-serif; font-size:12px; color:#c8c8d8;
    overflow:hidden; white-space:nowrap; text-overflow:ellipsis; flex:1;
  }
  .gc-ann-wrap {
    display:flex; align-items:flex-start; gap:8px;
    padding: 7px 16px;
    background: rgba(232,82,42,.07);
    border-bottom: 1px solid rgba(232,82,42,.12);
  }
  .gc-ann-title { font-family:'Nunito',sans-serif;font-size:12px;font-weight:800;color:#e8522a; }
  .gc-ann-body  { font-family:'Nunito',sans-serif;font-size:11px;color:#888;line-height:1.4; }

  /* ── MESSAGES ────────────────────────────────────────────── */
  #gc-msgs {
    flex: 1; overflow-y: auto;
    padding: 12px 14px 8px;
    display: flex; flex-direction: column; gap: 2px;
    scroll-behavior: smooth;
  }
  #gc-msgs::-webkit-scrollbar { width: 4px; }
  #gc-msgs::-webkit-scrollbar-thumb { background:rgba(255,255,255,.1);border-radius:99px; }

  /* Date separator */
  .gc-date-sep {
    text-align:center; font-family:'Nunito',sans-serif;
    font-size:10px; font-weight:800; color:#444;
    letter-spacing:.5px; margin:8px 0 4px;
    display:flex; align-items:center; gap:8px;
  }
  .gc-date-sep::before,.gc-date-sep::after {
    content:""; flex:1; height:1px; background:rgba(255,255,255,.05);
  }

  /* Message row */
  .gc-msg {
    display:flex; gap:8px; align-items:flex-end;
    padding: 3px 2px; border-radius:10px;
    transition: background .12s;
  }
  .gc-msg:hover { background:rgba(255,255,255,.03); }
  .gc-msg.mine  { flex-direction:row-reverse; }
  .gc-msg.pin-hl{ background:rgba(245,200,66,.05); border-left:2px solid rgba(245,200,66,.25); padding-left:6px; }

  /* Avatar */
  .gc-av {
    width:32px; height:32px; border-radius:50%; flex-shrink:0;
    overflow:hidden; align-self:flex-end;
    display:flex; align-items:center; justify-content:center;
    font-family:'Nunito',sans-serif; font-size:12px; font-weight:800; color:#fff;
  }
  .gc-av img { width:100%;height:100%;object-fit:cover; }

  /* Body */
  .gc-body { max-width:72%; display:flex; flex-direction:column; }
  .mine .gc-body { align-items:flex-end; }

  /* Meta */
  .gc-meta {
    font-family:'Nunito',sans-serif; font-size:11px; color:#555;
    margin-bottom:3px; display:flex; align-items:center; gap:4px;
  }
  .mine .gc-meta { flex-direction:row-reverse; }
  .gc-name { font-weight:800; color:#999; }
  .gc-name.adm { color:#e8522a; }
  .gc-adm-badge {
    font-size:9px; font-weight:800; letter-spacing:.5px;
    padding:1px 5px; border-radius:99px; text-transform:uppercase;
    background:rgba(232,82,42,.15); color:#e8522a;
    border:1px solid rgba(232,82,42,.25);
  }

  /* Bubble */
  .gc-bubble {
    background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.07);
    border-radius:14px 14px 14px 3px;
    padding:9px 13px;
    font-family:'Nunito',sans-serif; font-size:14px; line-height:1.55;
    color:#dde; word-break:break-word; position:relative;
  }
  .mine .gc-bubble {
    background:rgba(232,82,42,.18); border-color:rgba(232,82,42,.22);
    border-radius:14px 14px 3px 14px;
  }
  .gc-bubble.ann {
    background:rgba(232,82,42,.08); border-color:rgba(232,82,42,.2);
    border-radius:12px;
  }

  /* Location link */
  .gc-loc {
    display:inline-flex; align-items:center; gap:4px;
    color:#3498db; font-size:11px; text-decoration:none;
    background:rgba(52,152,219,.1); border:1px solid rgba(52,152,219,.2);
    border-radius:7px; padding:3px 8px; margin-top:5px; transition:background .15s;
  }

  /* Reply preview */
  .gc-reply-prev {
    background:rgba(255,255,255,.06); border-left:2px solid #e8522a;
    border-radius:6px; padding:4px 8px; margin-bottom:5px;
    font-size:11px; color:#777; line-height:1.4;
    overflow:hidden; max-height:36px;
  }

  /* Reactions */
  .gc-reacts { display:flex; gap:3px; margin-top:3px; flex-wrap:wrap; }
  .gc-react {
    display:inline-flex; align-items:center; gap:3px;
    background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.09);
    border-radius:99px; padding:2px 7px;
    font-size:11px; cursor:pointer; color:#ccc;
    font-family:'Nunito',sans-serif; font-weight:700;
    transition:all .15s;
  }
  .gc-react:hover { background:rgba(255,255,255,.12); }

  /* Skeleton */
  #gc-skeleton { padding:12px; display:flex; flex-direction:column; gap:10px; }
  .gcs {
    background:rgba(255,255,255,.05); border-radius:10px;
    animation:gcShim 1.4s ease infinite;
  }
  @keyframes gcShim { 0%,100%{opacity:.3} 50%{opacity:.7} }

  /* Error state */
  #gc-load-error {
    display:none; flex-direction:column; align-items:center;
    justify-content:center; flex:1; gap:10px; color:#888;
    font-family:'Nunito',sans-serif; text-align:center; padding:20px;
  }
  #gc-load-error button {
    padding:9px 20px; background:#e8522a; color:#fff; border:none;
    border-radius:8px; cursor:pointer; font-weight:700;
    font-family:'Nunito',sans-serif; font-size:13px;
  }

  /* ── SCROLL BTN ──────────────────────────────────────────── */
  #gc-scroll-btn {
    position: fixed; bottom: 110px; right: 16px;
    width:40px; height:40px; border-radius:50%;
    background:#e8522a; border:none; color:#fff; font-size:18px;
    cursor:pointer; z-index:9110;
    display:none; align-items:center; justify-content:center;
    box-shadow:0 2px 14px rgba(232,82,42,.5);
  }
  #gc-scroll-btn.show { display:flex; }

  /* ── INPUT AREA ──────────────────────────────────────────── */
  #gc-input-area {
    flex-shrink: 0;
    border-top: 1px solid rgba(255,255,255,.07);
    background: #0a0a12;
    padding: 10px 14px;
    /* Safe area untuk iPhone & Android Chrome bottom bar */
    padding-bottom: max(14px, calc(env(safe-area-inset-bottom) + 8px));
  }

  /* Emoji row */
  #gc-emoji-row {
    display:none; gap:4px; padding:6px 0 4px;
    overflow-x:auto; scrollbar-width:none;
  }
  #gc-emoji-row.show { display:flex; }
  #gc-emoji-row::-webkit-scrollbar { display:none; }
  .gc-emoji-btn {
    font-size:20px; cursor:pointer; padding:3px 5px;
    border-radius:7px; border:none; background:transparent;
    flex-shrink:0; transition:background .12s;
  }
  .gc-emoji-btn:hover { background:rgba(255,255,255,.1); }

  /* Reply bar */
  #gc-reply-bar {
    display:none; align-items:center; gap:6px;
    padding:5px 0 3px;
    font-family:'Nunito',sans-serif; font-size:11px; color:#888;
  }
  #gc-reply-bar.show { display:flex; }
  #gc-reply-cancel {
    background:none; border:none; color:#e8522a;
    cursor:pointer; font-size:18px; margin-left:auto; line-height:1;
  }

  /* Input row */
  .gc-row {
    display:flex; gap:8px; align-items:flex-end;
  }
  #gc-input {
    flex:1;
    background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.09);
    border-radius:14px; padding:10px 14px;
    color:#eaeaf0; font-family:'Nunito',sans-serif; font-size:14px;
    resize:none; outline:none;
    min-height:42px; max-height:120px;
    overflow-y:auto; line-height:1.4;
    transition:border .2s;
  }
  #gc-input:focus { border-color:rgba(232,82,42,.5); }
  #gc-input::placeholder { color:#444; }

  .gc-act {
    width:42px; height:42px; border-radius:12px;
    background:rgba(255,255,255,.07); border:1px solid rgba(255,255,255,.09);
    color:#888; font-size:18px; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    flex-shrink:0; transition:all .15s;
  }
  .gc-act:hover { background:rgba(255,255,255,.12); color:#ccc; }
  .gc-act.on { background:rgba(232,82,42,.15); border-color:rgba(232,82,42,.3); color:#e8522a; }

  #gc-send {
    width:42px; height:42px; border-radius:12px;
    background:#e8522a; border:none; color:#fff;
    font-size:18px; cursor:pointer; flex-shrink:0;
    display:flex; align-items:center; justify-content:center;
    transition:all .2s;
  }
  #gc-send:hover  { background:#c73f1c; }
  #gc-send:active { transform:scale(.93); }
  #gc-send:disabled { background:rgba(255,255,255,.07); color:#444; cursor:not-allowed; transform:none; }

  #gc-char {
    font-family:'Nunito',sans-serif; font-size:10px;
    color:#444; text-align:right; margin-top:4px;
  }
  #gc-char.warn { color:#e74c3c; }

  /* Login prompt */
  .gc-login-prompt {
    text-align:center; padding:12px;
    font-family:'Nunito',sans-serif; font-size:13px; color:#666;
  }
  .gc-login-prompt a { color:#e8522a; font-weight:800; text-decoration:none; }

  /* Context menu */
  #gc-ctx {
    position:fixed; z-index:9200;
    background:rgba(18,18,26,.98); backdrop-filter:blur(16px);
    border:1px solid rgba(255,255,255,.1); border-radius:12px;
    padding:5px 0; box-shadow:0 8px 32px rgba(0,0,0,.6);
    min-width:150px; display:none;
    font-family:'Nunito',sans-serif;
  }
  #gc-ctx.show { display:block; }
  .gc-ctx-item {
    padding:10px 16px; font-size:13px; font-weight:700;
    cursor:pointer; display:flex; align-items:center; gap:8px;
    color:#ccc; transition:background .12s;
  }
  .gc-ctx-item:hover { background:rgba(255,255,255,.07); }
  .gc-ctx-item.del { color:#e74c3c; }

  /* Light mode */
  body.light #gc-panel { background:#f5f5fc; }
  body.light #gc-input-area { background:#eeeef8; }
  body.light .gc-bubble { background:#e8e8f4; border-color:rgba(0,0,0,.07); color:#222; }
  body.light .mine .gc-bubble { background:rgba(232,82,42,.12); }
  body.light #gc-input { background:#e8e8f4; border-color:rgba(0,0,0,.1); color:#222; }
  body.light #gc-input::placeholder { color:#aaa; }
  body.light .gc-name { color:#555; }
  body.light .gc-hdr-title { color:#111; }
  body.light .gc-date-sep { color:#bbb; }
`;
document.head.appendChild(style);

/* ============================================================
   DOM
   ============================================================ */
const root = document.createElement("div");
root.id = "gc-root";
root.innerHTML = `
  <button id="gc-toggle" title="Chat">
    <span class="gc-toggle-icon">💬</span>
    <span id="gc-badge"></span>
    <span id="gc-online-dot"></span>
  </button>

  <div id="gc-panel">
    <!-- Header -->
    <div id="gc-header">
      <span class="gc-hdr-icon">💬</span>
      <div class="gc-hdr-text">
        <div class="gc-hdr-title">Global Chat</div>
        <div class="gc-hdr-sub">
          <span class="gc-hdr-dot"></span>
          <span id="gc-online-label">0 online</span>
        </div>
      </div>
      <button id="gc-close" title="Tutup">✕</button>
    </div>

    <!-- Pinned / Announcement -->
    <div id="gc-pinned"></div>

    <!-- Messages -->
    <div id="gc-msgs">
      <div id="gc-skeleton">
        <div class="gcs" style="height:44px;width:65%;border-radius:14px;"></div>
        <div class="gcs" style="height:34px;width:50%;align-self:flex-end;border-radius:14px;margin-left:auto;"></div>
        <div class="gcs" style="height:52px;width:70%;border-radius:14px;"></div>
        <div class="gcs" style="height:38px;width:55%;align-self:flex-end;border-radius:14px;margin-left:auto;"></div>
        <div class="gcs" style="height:44px;width:60%;border-radius:14px;"></div>
      </div>
      <div id="gc-load-error">
        <div style="font-size:40px;">⚠️</div>
        <p>Gagal memuat pesan</p>
        <button onclick="window.__gcReload()">Coba Lagi</button>
      </div>
    </div>

    <!-- Input area -->
    <div id="gc-input-area">
      <div id="gc-login-prompt" style="display:none;" class="gc-login-prompt">
        <a href="/masuk">🔑 Login</a> untuk ikut ngobrol!
      </div>
      <div id="gc-input-wrap">
        <div id="gc-emoji-row"></div>
        <div id="gc-reply-bar">
          <span id="gc-reply-text"></span>
          <button id="gc-reply-cancel">×</button>
        </div>
        <div class="gc-row">
          <textarea id="gc-input" placeholder="Ketik pesan..." rows="1" maxlength="${MAX_CHARS}"></textarea>
          <button class="gc-act" id="gc-emoji-btn" title="Emoji">😄</button>
          <button class="gc-act" id="gc-loc-btn" title="Lokasi">📍</button>
          <button id="gc-send" disabled>➤</button>
        </div>
        <div id="gc-char">${MAX_CHARS}</div>
      </div>
    </div>
  </div>

  <!-- Scroll to bottom -->
  <button id="gc-scroll-btn">↓</button>

  <!-- Context menu -->
  <div id="gc-ctx">
    <div class="gc-ctx-item" id="gc-ctx-pin">📌 Pin</div>
    <div class="gc-ctx-item" id="gc-ctx-unpin">📍 Cabut Pin</div>
    <div class="gc-ctx-item" id="gc-ctx-reply">↩️ Balas</div>
    <div class="gc-ctx-item del" id="gc-ctx-del">🗑️ Hapus</div>
  </div>
`;
document.body.appendChild(root);

/* ── REFS ─────────────────────────────────────────────────── */
const $         = id => document.getElementById(id);
const gcToggle  = $("gc-toggle");
const gcPanel   = $("gc-panel");
const gcClose   = $("gc-close");
const gcMsgs    = $("gc-msgs");
const gcInput   = $("gc-input");
const gcSend    = $("gc-send");
const gcScrollBtn=$("gc-scroll-btn");
const gcEmojiRow= $("gc-emoji-row");
const gcEmojiBtn= $("gc-emoji-btn");
const gcLocBtn  = $("gc-loc-btn");
const gcReplyBar= $("gc-reply-bar");
const gcReplyTxt= $("gc-reply-text");
const gcReplyCancel=$("gc-reply-cancel");
const gcCtx     = $("gc-ctx");
const gcChar    = $("gc-char");
const gcCtxPin  = $("gc-ctx-pin");
const gcCtxUnpin= $("gc-ctx-unpin");
const gcCtxReply= $("gc-ctx-reply");
const gcCtxDel  = $("gc-ctx-del");

/* ============================================================
   HELPERS
   ============================================================ */
function esc(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function fmtText(t) {
  if (!t) return "";
  return esc(t)
    .replace(/\*(.*?)\*/g,"<strong>$1</strong>")
    .replace(/_(.*?)_/g,"<em>$1</em>")
    .replace(/\n/g,"<br>");
}
function fmtTime(d) {
  if (!d) return "";
  const dt = new Date(d);
  const ms = Date.now() - dt.getTime();
  const m  = Math.floor(ms / 60000);
  if (m < 1)  return "baru saja";
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "j";
  return dt.toLocaleDateString("id-ID",{day:"2-digit",month:"short"});
}
function dateLabel(d) {
  return new Date(d).toLocaleDateString("id-ID",{day:"2-digit",month:"long",year:"numeric"});
}
function todayLabel() { return dateLabel(new Date()); }
function strColor(s) {
  let h = 0;
  for (let i = 0; i < (s||"").length; i++) h = s.charCodeAt(i) + ((h<<5)-h);
  const c = ["#e8522a","#3498db","#9b59b6","#27ae60","#f39c12","#e74c3c","#1abc9c","#d35400"];
  return c[Math.abs(h) % c.length];
}
function getBadge()     { return document.getElementById("gc-badge"); }
function showBadge(n)   { const b = getBadge(); if(!b) return; b.textContent = n > 9 ? "9+" : n; b.classList.add("show"); }
function hideBadge()    { const b = getBadge(); if(b) b.classList.remove("show"); }

/* ============================================================
   TOGGLE PANEL
   ============================================================ */
function togglePanel() {
  isOpen = !isOpen;
  gcPanel.classList.toggle("open", isOpen);
  /* Hanya update teks ikon — TIDAK replace innerHTML */
  const icon = gcToggle.querySelector(".gc-toggle-icon");
  if (icon) icon.textContent = isOpen ? "✕" : "💬";
  if (isOpen) {
    unreadCount = 0;
    hideBadge();
    scrollBottom();
    setTimeout(() => gcInput.focus(), 300);
  }
}

/* ============================================================
   SCROLL
   ============================================================ */
function scrollBottom() {
  gcMsgs.scrollTop = gcMsgs.scrollHeight;
  isAtBottom = true;
  gcScrollBtn.classList.remove("show");
  hideBadge();
}

/* ============================================================
   BUILD MESSAGE
   ============================================================ */
function buildMsg(m) {
  const mine  = !!(currentUser && m.user_id === currentUser.id);
  const name  = m.profiles?.username || "Anonim";
  const isAdm = m.profiles?.role === "admin";
  const isAnn = !!m.is_announcement;

  const el = document.createElement("div");
  el.className = "gc-msg" + (mine?" mine":"") + (m.is_pinned?" pin-hl":"");
  el.id = "gcm-" + m.id;

  /* Context menu */
  el.addEventListener("contextmenu", e => { e.preventDefault(); showCtx(e, m); });
  let longTimer;
  el.addEventListener("touchstart", () => {
    longTimer = setTimeout(() => {
      const r = el.getBoundingClientRect();
      showCtx({ clientX: r.right - 160, clientY: r.top }, m);
    }, 600);
  }, { passive: true });
  el.addEventListener("touchend", () => clearTimeout(longTimer), { passive: true });

  /* Avatar */
  const av = document.createElement("div");
  av.className = "gc-av";
  av.style.background = strColor(m.user_id);
  if (m.profiles?.avatar_url) {
    av.innerHTML = `<img src="${esc(m.profiles.avatar_url)}" onerror="this.parentElement.textContent='${esc(name[0]).toUpperCase()}'">`;
  } else {
    av.textContent = name[0].toUpperCase();
  }

  /* Body */
  const body = document.createElement("div");
  body.className = "gc-body";

  if (!isAnn) {
    const meta = document.createElement("div");
    meta.className = "gc-meta";
    meta.innerHTML = `
      <span class="gc-name${isAdm?" adm":""}">${esc(name)}</span>
      ${isAdm ? `<span class="gc-adm-badge">Admin</span>` : ""}
      ${m.is_pinned ? `<span>📌</span>` : ""}
      <span>${fmtTime(m.created_at)}</span>`;
    body.appendChild(meta);
  }

  const bubble = document.createElement("div");
  if (isAnn) {
    bubble.className = "gc-bubble ann";
    const icons = { info:"ℹ️", warning:"⚠️", success:"✅", update:"🚀" };
    bubble.innerHTML = `
      <div style="display:flex;align-items:center;gap:5px;margin-bottom:4px;">
        <span>${icons[m.ann_type]||"📢"}</span>
        <strong style="font-size:13px;color:#e8522a;">${esc(m.ann_title||"Pengumuman")}</strong>
      </div>
      <div>${fmtText(m.message)}</div>
      <div style="font-size:10px;color:#666;margin-top:4px;">${fmtTime(m.created_at)} · ${esc(name)}</div>`;
  } else {
    bubble.className = "gc-bubble" + (mine ? " mine" : "");
    let html = "";
    if (m.reply_preview) {
      html += `<div class="gc-reply-prev">↩️ ${esc(m.reply_preview)}</div>`;
    }
    html += fmtText(m.message);
    if (m.page_url) {
      const path = m.page_url.replace(/^https?:\/\/[^/]+/,"") || "/";
      html += `<br><a class="gc-loc" href="${esc(m.page_url)}" target="_blank">📍 ${esc(path)}</a>`;
    }
    bubble.innerHTML = html;
  }
  body.appendChild(bubble);

  /* Reactions */
  const rxs = m.reactions || {};
  if (Object.keys(rxs).length > 0) {
    const rxRow = document.createElement("div");
    rxRow.className = "gc-reacts";
    Object.entries(rxs).forEach(([emoji, cnt]) => {
      const b = document.createElement("button");
      b.className = "gc-react";
      b.innerHTML = `${emoji} ${cnt}`;
      b.onclick = () => addReaction(m.id, emoji);
      rxRow.appendChild(b);
    });
    body.appendChild(rxRow);
  }

  el.appendChild(av);
  el.appendChild(body);
  return el;
}

function makeDateSep(label) {
  const d = document.createElement("div");
  d.className = "gc-date-sep";
  d.textContent = label;
  return d;
}

/* ============================================================
   RENDER ALL
   ============================================================ */
function renderAll() {
  gcMsgs.querySelectorAll(".gc-msg,.gc-date-sep").forEach(e => e.remove());
  let lastDate  = "";
  const todayStr = todayLabel();
  messages.forEach(m => {
    const d = dateLabel(m.created_at);
    if (d !== lastDate) {
      lastDate = d;
      gcMsgs.appendChild(makeDateSep(d === todayStr ? "Hari ini" : d));
    }
    gcMsgs.appendChild(buildMsg(m));
  });
}

/* ============================================================
   LOAD MESSAGES — dengan fallback jika join gagal
   ============================================================ */
async function loadMessages() {
  const skel = $("gc-skeleton");
  const errEl = $("gc-load-error");

  /* Coba dulu dengan join profiles */
  let { data, error } = await supabase
    .from("global_chat")
    .select(`id, user_id, message, is_pinned, is_announcement,
             ann_title, ann_type, page_url,
             reply_to, reply_preview, reactions, created_at,
             profiles ( username, avatar_url, role )`)
    .order("created_at", { ascending: true })
    .limit(80);

  /* Kalau join gagal (RLS / relasi belum dibuat), fallback tanpa join */
  if (error) {
    console.warn("[GC] join profiles gagal, coba fallback:", error.message);
    const fallback = await supabase
      .from("global_chat")
      .select("id, user_id, message, is_pinned, is_announcement, ann_title, ann_type, page_url, reply_to, reply_preview, reactions, created_at")
      .order("created_at", { ascending: true })
      .limit(80);
    data  = fallback.data;
    error = fallback.error;
  }

  if (skel) skel.remove();

  if (error) {
    console.error("[GC] loadMessages final error:", error);
    if (errEl) errEl.style.display = "flex";
    return;
  }

  if (errEl) errEl.style.display = "none";
  messages = data || [];
  renderAll();
  loadPinned();
  scrollBottom();
}

/* Reload handler untuk tombol "Coba Lagi" */
window.__gcReload = () => loadMessages();

/* ============================================================
   LOAD PINNED
   ============================================================ */
async function loadPinned() {
  const box = $("gc-pinned");
  if (!box) return;
  const { data } = await supabase
    .from("global_chat")
    .select("id, message, is_announcement, ann_title, ann_type")
    .eq("is_pinned", true)
    .order("created_at", { ascending: false })
    .limit(2);

  box.innerHTML = "";
  (data || []).forEach(m => {
    if (m.is_announcement) {
      const icons = { info:"ℹ️", warning:"⚠️", success:"✅", update:"🚀" };
      box.innerHTML += `
        <div class="gc-ann-wrap">
          <span style="font-size:14px;">${icons[m.ann_type]||"📢"}</span>
          <div>
            <div class="gc-ann-title">${esc(m.ann_title||"Pengumuman")}</div>
            <div class="gc-ann-body">${esc(m.message||"")}</div>
          </div>
        </div>`;
    } else {
      const el = document.createElement("div");
      el.className = "gc-pin-item";
      el.innerHTML = `<span>📌</span><span class="gc-pin-text">${esc(m.message||"")}</span>`;
      el.onclick = () => {
        const target = $("gcm-"+m.id);
        if (target) target.scrollIntoView({ behavior:"smooth", block:"center" });
      };
      box.appendChild(el);
    }
  });
}

/* ============================================================
   ONLINE COUNT
   ============================================================ */
async function loadOnlineCount() {
  const fiveMin = new Date(Date.now() - 5*60*1000).toISOString();
  const { count } = await supabase
    .from("profiles")
    .select("*", { count:"exact", head:true })
    .gte("last_seen", fiveMin);
  const el = $("gc-online-label");
  if (el) el.textContent = (count || 0) + " online";
}

/* ============================================================
   PRESENCE
   ============================================================ */
async function updatePresence() {
  if (!currentUser) return;
  await supabase.from("profiles")
    .update({ last_seen: new Date().toISOString() })
    .eq("id", currentUser.id);
}

/* ============================================================
   REALTIME
   ============================================================ */
function setupRealtime() {
  realtimeChannel = supabase
    .channel("gc_realtime_v3")
    .on("postgres_changes", { event:"INSERT", schema:"public", table:"global_chat" }, async p => {
      /* Fetch profile untuk pesan baru */
      const { data: prof } = await supabase
        .from("profiles")
        .select("username, avatar_url, role")
        .eq("id", p.new.user_id)
        .single();

      const m = { ...p.new, profiles: prof || null };
      messages.push(m);

      /* Date separator — logika bersih */
      const msgDate   = dateLabel(m.created_at);
      const todayStr  = todayLabel();
      const dispLabel = msgDate === todayStr ? "Hari ini" : msgDate;
      const seps      = gcMsgs.querySelectorAll(".gc-date-sep");
      const lastLabel = seps.length ? seps[seps.length-1].textContent.trim() : "";
      if (dispLabel !== lastLabel) {
        gcMsgs.appendChild(makeDateSep(dispLabel));
      }

      gcMsgs.appendChild(buildMsg(m));
      if (m.is_pinned || m.is_announcement) loadPinned();

      if (isAtBottom && isOpen) {
        scrollBottom();
      } else {
        unreadCount++;
        showBadge(unreadCount);
      }
    })
    .on("postgres_changes", { event:"DELETE", schema:"public", table:"global_chat" }, p => {
      $("gcm-"+p.old.id)?.remove();
      messages = messages.filter(x => x.id !== p.old.id);
    })
    .on("postgres_changes", { event:"UPDATE", schema:"public", table:"global_chat" }, p => {
      loadPinned();
      const el = $("gcm-"+p.new.id);
      if (el) {
        const m = messages.find(x => x.id === p.new.id);
        if (m) { Object.assign(m, p.new); el.replaceWith(buildMsg(m)); }
      }
    })
    .subscribe(status => {
      console.log("[GC] realtime status:", status);
    });
}

/* ============================================================
   SEND
   ============================================================ */
async function sendMsg() {
  if (!currentUser) return;
  const text = gcInput.value.trim();
  if (!text) return;

  gcSend.disabled  = true;
  gcInput.disabled = true;

  const payload = {
    user_id:         currentUser.id,
    message:         text,
    is_pinned:       false,
    is_announcement: false,
    page_url:        null,
  };
  if (replyingTo) {
    payload.reply_to      = replyingTo.id;
    payload.reply_preview = (replyingTo.message || "").slice(0, 60);
  }

  const { error } = await supabase.from("global_chat").insert(payload);

  if (error) {
    console.error("[GC] sendMsg error:", error);
    alert("Gagal kirim: " + (error.message || JSON.stringify(error)));
  } else {
    gcInput.value         = "";
    gcInput.style.height  = "auto";
    gcChar.textContent    = MAX_CHARS;
    gcChar.classList.remove("warn");
    cancelReply();
  }

  gcSend.disabled  = false;
  gcInput.disabled = false;
  gcInput.focus();
}

async function sendLocation() {
  if (!currentUser) return;
  const { error } = await supabase.from("global_chat").insert({
    user_id:  currentUser.id,
    message:  "Sedang di halaman ini 👇",
    page_url: window.location.href,
  });
  if (error) alert("Gagal kirim lokasi: " + error.message);
}

/* ============================================================
   EMOJI
   ============================================================ */
function buildEmojiRow() {
  gcEmojiRow.innerHTML = EMOJIS.map(e =>
    `<button class="gc-emoji-btn" data-emoji="${e}">${e}</button>`
  ).join("");
  gcEmojiRow.addEventListener("click", e => {
    const emoji = e.target.dataset.emoji;
    if (!emoji) return;
    const pos = gcInput.selectionStart || gcInput.value.length;
    gcInput.value = gcInput.value.slice(0, pos) + emoji + gcInput.value.slice(pos);
    gcInput.focus();
    onInput();
  });
}

/* ============================================================
   INPUT
   ============================================================ */
function onInput() {
  gcInput.style.height = "auto";
  gcInput.style.height = Math.min(gcInput.scrollHeight, 120) + "px";
  const left = MAX_CHARS - gcInput.value.length;
  gcChar.textContent = left;
  gcChar.classList.toggle("warn", left < 50);
  gcSend.disabled = gcInput.value.trim().length === 0;
}

/* ============================================================
   CONTEXT MENU
   ============================================================ */
function showCtx(e, m) {
  ctxTarget = m;
  const mine = currentUser && m.user_id === currentUser.id;
  gcCtxPin.style.display   = isAdmin   ? "flex" : "none";
  gcCtxUnpin.style.display = isAdmin   ? "flex" : "none";
  gcCtxReply.style.display = currentUser ? "flex" : "none";
  gcCtxDel.style.display   = (mine || isAdmin) ? "flex" : "none";

  const any = [gcCtxPin,gcCtxUnpin,gcCtxReply,gcCtxDel].some(el => el.style.display !== "none");
  if (!any) return;

  const x = Math.min(e.clientX || window.innerWidth-170, window.innerWidth-170);
  const y = Math.min(e.clientY || 200, window.innerHeight-160);
  gcCtx.style.left = x + "px";
  gcCtx.style.top  = y + "px";
  gcCtx.classList.add("show");
}
async function ctxPin()    { if (!ctxTarget||!isAdmin) return; await supabase.from("global_chat").update({is_pinned:true}).eq("id",ctxTarget.id);  gcCtx.classList.remove("show"); }
async function ctxUnpin()  { if (!ctxTarget||!isAdmin) return; await supabase.from("global_chat").update({is_pinned:false}).eq("id",ctxTarget.id); gcCtx.classList.remove("show"); }
function ctxReply() {
  if (!ctxTarget) return;
  replyingTo = ctxTarget;
  const name = ctxTarget.profiles?.username || "Anonim";
  gcReplyTxt.innerHTML = `↩️ <strong style="color:#dde;">${esc(name)}</strong>: "${esc((ctxTarget.message||"").slice(0,50))}"`;
  gcReplyBar.classList.add("show");
  gcCtx.classList.remove("show");
  gcInput.focus();
}
async function ctxDelete() {
  if (!ctxTarget) return;
  if (!confirm("Hapus pesan ini?")) return;
  await supabase.from("global_chat").delete().eq("id", ctxTarget.id);
  gcCtx.classList.remove("show");
}
function cancelReply() {
  replyingTo = null;
  gcReplyBar.classList.remove("show");
  gcReplyTxt.innerHTML = "";
}

/* ============================================================
   REACTIONS
   ============================================================ */
async function addReaction(msgId, emoji) {
  const m = messages.find(x => x.id === msgId);
  if (!m) return;
  const reactions = { ...(m.reactions||{}) };
  reactions[emoji] = (reactions[emoji]||0) + 1;
  await supabase.from("global_chat").update({ reactions }).eq("id", msgId);
}

/* ============================================================
   EVENTS
   ============================================================ */
function bindEvents() {
  gcToggle.addEventListener("click", togglePanel);
  gcClose.addEventListener("click",  togglePanel);

  gcInput.addEventListener("input", onInput);
  gcInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  });
  gcSend.addEventListener("click", sendMsg);

  gcEmojiBtn.addEventListener("click", () => {
    emojiOpen = !emojiOpen;
    gcEmojiRow.classList.toggle("show", emojiOpen);
    gcEmojiBtn.classList.toggle("on", emojiOpen);
  });
  gcLocBtn.addEventListener("click", sendLocation);
  gcReplyCancel.addEventListener("click", cancelReply);

  gcMsgs.addEventListener("scroll", () => {
    const dist = gcMsgs.scrollHeight - gcMsgs.scrollTop - gcMsgs.clientHeight;
    isAtBottom = dist < 80;
    gcScrollBtn.classList.toggle("show", dist > 200 && !isAtBottom);
    if (isAtBottom) { unreadCount = 0; hideBadge(); }
  }, { passive: true });

  gcScrollBtn.addEventListener("click", scrollBottom);

  document.addEventListener("click", e => {
    if (!gcCtx.contains(e.target)) gcCtx.classList.remove("show");
  });

  gcCtxPin.addEventListener("click",   ctxPin);
  gcCtxUnpin.addEventListener("click", ctxUnpin);
  gcCtxReply.addEventListener("click", ctxReply);
  gcCtxDel.addEventListener("click",   ctxDelete);
}

/* ============================================================
   INIT
   ============================================================ */
async function init() {
  /* Auth */
  const { data: { session } } = await supabase.auth.getSession();
  currentUser = session?.user || null;

  if (currentUser) {
    const { data: p } = await supabase
      .from("profiles")
      .select("username, avatar_url, role, is_banned")
      .eq("id", currentUser.id)
      .single();

    isAdmin = ADMIN_EMAILS.includes(currentUser.email) || p?.role === "admin";

    if (p?.is_banned) {
      $("gc-input-wrap").innerHTML = `
        <p style="text-align:center;padding:10px;color:#e74c3c;font-size:13px;
           font-family:'Nunito',sans-serif;font-weight:700;">🚫 Kamu dibanned dari chat.</p>`;
    }
  } else {
    $("gc-input-wrap").style.display = "none";
    $("gc-login-prompt").style.display = "block";
  }

  buildEmojiRow();
  bindEvents();

  await loadMessages();
  loadOnlineCount();
  setInterval(loadOnlineCount, 30000);
  setupRealtime();

  if (currentUser) {
    updatePresence();
    setInterval(updatePresence, 60000);
  }
}

init().catch(err => console.error("[GC] init error:", err));
