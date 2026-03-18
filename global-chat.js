/* ============================================================
   PANKOMIK — global-chat.js
   Widget chat floating sticky yang bisa dibuka dari ikon
   di pojok kanan bawah semua halaman.

   Cara pakai — tambahkan di bagian bawah setiap HTML:
   <script type="module" src="/global-chat.js"></script>
   ============================================================ */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://aaqhknkyrnsapvfywdsn.supabase.co";
const SUPABASE_KEY = "sb_publishable_ND-51tP1NF40HRZ3q05N5w_1ZnlPzlL";
const supabase     = createClient(SUPABASE_URL, SUPABASE_KEY);

const ADMIN_EMAILS = ["pankomik@gmail.com", "admin@pankomik.com"];
const MAX_CHARS    = 500;
const EMOJIS       = ["😂","😍","🔥","💯","👏","😭","❤️","😎","💪","🙏","😤","✨","🎉","😱","🤩","💀","😅","🫶","🏆","👑","💛","🫡","🤣","👀","⭐","🎭"];

/* ── STATE ─────────────────────────────────────────────────── */
let currentUser    = null;
let currentProfile = null;
let isAdmin        = false;
let messages       = [];
let isOpen         = false;
let unreadCount    = 0;
let isAtBottom     = true;
let replyingTo     = null;
let realtimeChannel = null;
let presenceTimer  = null;
let emojiOpen      = false;
let ctxTarget      = null;

/* ============================================================
   INJECT CSS
   ============================================================ */
const style = document.createElement("style");
style.textContent = `
  /* ── TOGGLE BUTTON ─────────────────────────────────────── */
  #gc-toggle {
    position: fixed;
    right: 16px;
    bottom: 76px; /* di atas bottom nav */
    z-index: 1200;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: linear-gradient(135deg, #e8522a 0%, #c73f1c 100%);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    box-shadow: 0 4px 18px rgba(232,82,42,0.55), 0 2px 6px rgba(0,0,0,0.4);
    transition: transform 0.2s, box-shadow 0.2s;
    -webkit-tap-highlight-color: transparent;
  }
  #gc-toggle:hover  { transform: scale(1.08); box-shadow: 0 6px 24px rgba(232,82,42,0.7); }
  #gc-toggle:active { transform: scale(0.94); }

  /* Unread badge on toggle */
  #gc-badge {
    position: absolute;
    top: -3px; right: -3px;
    min-width: 18px; height: 18px;
    background: #e74c3c;
    color: #fff;
    font-family: 'Nunito', sans-serif;
    font-size: 10px; font-weight: 800;
    border-radius: 99px;
    padding: 0 4px;
    display: none;
    align-items: center; justify-content: center;
    border: 2px solid #09090f;
    pointer-events: none;
  }
  #gc-badge.show { display: flex; }

  /* Online dot on toggle */
  #gc-online-dot {
    position: absolute;
    bottom: 1px; left: 1px;
    width: 12px; height: 12px;
    background: #27ae60;
    border-radius: 50%;
    border: 2px solid #09090f;
    animation: gcPulse 2s ease infinite;
  }
  @keyframes gcPulse {
    0%,100%{ opacity:1; transform:scale(1); }
    50%    { opacity:.6; transform:scale(.85); }
  }

  /* ── PANEL ─────────────────────────────────────────────── */
  #gc-panel {
    position: fixed;
    right: 16px;
    bottom: 136px; /* di atas tombol toggle */
    z-index: 1199;
    width: 340px;
    max-width: calc(100vw - 32px);
    height: 480px;
    max-height: calc(100vh - 160px);
    background: rgba(10,10,18,0.97);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px;
    display: flex;
    flex-direction: column;
    box-shadow:
      0 24px 60px rgba(0,0,0,0.6),
      0 0 0 1px rgba(232,82,42,0.12),
      inset 0 1px 0 rgba(255,255,255,0.06);
    overflow: hidden;
    transform: scale(0.88) translateY(20px);
    transform-origin: bottom right;
    opacity: 0;
    pointer-events: none;
    transition: transform 0.25s cubic-bezier(.34,1.56,.64,1), opacity 0.2s ease;
  }
  #gc-panel.open {
    transform: scale(1) translateY(0);
    opacity: 1;
    pointer-events: all;
  }

  /* ── PANEL HEADER ──────────────────────────────────────── */
  #gc-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px 10px;
    background: rgba(232,82,42,0.08);
    border-bottom: 1px solid rgba(255,255,255,0.07);
    flex-shrink: 0;
  }
  .gc-header-icon { font-size: 18px; }
  .gc-header-text { flex: 1; }
  .gc-header-title {
    font-family: 'Nunito', sans-serif;
    font-size: 14px; font-weight: 800;
    color: #eaeaf0;
    line-height: 1.2;
  }
  .gc-header-sub {
    font-family: 'Nunito', sans-serif;
    font-size: 11px; font-weight: 700;
    color: #27ae60;
    display: flex; align-items: center; gap: 4px;
  }
  .gc-online-dot-sm {
    width: 6px; height: 6px; border-radius: 50%;
    background: #27ae60;
    animation: gcPulse 2s ease infinite;
  }
  .gc-header-close {
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.1);
    color: #888;
    width: 28px; height: 28px; border-radius: 8px;
    cursor: pointer; font-size: 14px;
    display: flex; align-items: center; justify-content: center;
    transition: background .15s, color .15s;
    flex-shrink: 0;
  }
  .gc-header-close:hover { background: rgba(255,255,255,0.14); color: #eaeaf0; }

  /* ── PINNED BANNER ─────────────────────────────────────── */
  #gc-pinned {
    flex-shrink: 0;
    max-height: 80px;
    overflow: hidden;
  }
  .gc-pinned-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 14px;
    background: linear-gradient(90deg, rgba(245,200,66,0.08), transparent);
    border-bottom: 1px solid rgba(245,200,66,0.1);
    cursor: pointer;
    transition: background .15s;
  }
  .gc-pinned-item:hover { background: rgba(245,200,66,0.12); }
  .gc-pin-icon { font-size: 12px; flex-shrink: 0; }
  .gc-pin-text {
    font-family: 'Nunito', sans-serif;
    font-size: 12px; color: #c8c8d8;
    overflow: hidden; white-space: nowrap; text-overflow: ellipsis; flex: 1;
  }
  .gc-ann-banner {
    display: flex; align-items: flex-start; gap: 8px;
    padding: 7px 14px;
    background: rgba(232,82,42,0.08);
    border-bottom: 1px solid rgba(232,82,42,0.12);
  }
  .gc-ann-icon { font-size: 14px; flex-shrink:0; margin-top: 1px; }
  .gc-ann-body { flex:1; min-width:0; }
  .gc-ann-title {
    font-family: 'Nunito', sans-serif;
    font-size: 12px; font-weight: 800; color: #e8522a;
    overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  }
  .gc-ann-text {
    font-family: 'Nunito', sans-serif;
    font-size: 11px; color: #888; line-height: 1.4;
    overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
  }

  /* ── MESSAGES AREA ─────────────────────────────────────── */
  #gc-msgs {
    flex: 1;
    overflow-y: auto;
    padding: 10px 10px 6px;
    display: flex;
    flex-direction: column;
    gap: 1px;
    scroll-behavior: smooth;
  }
  #gc-msgs::-webkit-scrollbar { width: 3px; }
  #gc-msgs::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }

  /* Date separator */
  .gc-date-sep {
    text-align: center;
    font-family: 'Nunito', sans-serif;
    font-size: 10px; font-weight: 800;
    color: #444;
    letter-spacing: .5px;
    margin: 8px 0 2px;
    display: flex; align-items: center; gap: 8px;
  }
  .gc-date-sep::before, .gc-date-sep::after {
    content: ""; flex: 1; height: 1px; background: rgba(255,255,255,0.05);
  }

  /* Message */
  .gc-msg {
    display: flex;
    gap: 7px;
    align-items: flex-end;
    padding: 2px 2px;
    border-radius: 10px;
    transition: background .12s;
  }
  .gc-msg:hover { background: rgba(255,255,255,0.03); }
  .gc-msg.mine  { flex-direction: row-reverse; }
  .gc-msg.pinned-hl { background: rgba(245,200,66,0.05); border-left: 2px solid rgba(245,200,66,0.25); padding-left: 6px; }

  .gc-avatar {
    width: 28px; height: 28px; border-radius: 50%;
    flex-shrink: 0; overflow: hidden; align-self: flex-end;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Nunito', sans-serif;
    font-size: 11px; font-weight: 800; color: #fff;
  }
  .gc-avatar img { width: 100%; height: 100%; object-fit: cover; }

  .gc-body { max-width: 80%; display: flex; flex-direction: column; }
  .mine .gc-body { align-items: flex-end; }

  .gc-meta {
    font-family: 'Nunito', sans-serif;
    font-size: 10px; color: #555;
    margin-bottom: 2px;
    display: flex; align-items: center; gap: 4px;
  }
  .mine .gc-meta { flex-direction: row-reverse; }
  .gc-name { font-weight: 800; color: #999; }
  .gc-name.admin-nm { color: #e8522a; }
  .gc-admin-badge {
    font-size: 8px; font-weight: 800; letter-spacing: .5px;
    padding: 1px 4px; border-radius: 99px; text-transform: uppercase;
    background: rgba(232,82,42,0.15); color: #e8522a;
    border: 1px solid rgba(232,82,42,0.25);
  }

  .gc-bubble {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 14px 14px 14px 3px;
    padding: 7px 11px;
    font-family: 'Nunito', sans-serif;
    font-size: 13px; line-height: 1.5;
    color: #dde;
    word-break: break-word;
    position: relative;
  }
  .mine .gc-bubble {
    background: rgba(232,82,42,0.18);
    border-color: rgba(232,82,42,0.22);
    border-radius: 14px 14px 3px 14px;
  }
  .gc-bubble.ann-bubble {
    background: rgba(232,82,42,0.08);
    border-color: rgba(232,82,42,0.2);
    border-radius: 12px;
  }

  /* Location link */
  .gc-loc {
    display: inline-flex; align-items: center; gap: 4px;
    color: #3498db; font-size: 11px; text-decoration: none;
    background: rgba(52,152,219,0.1); border: 1px solid rgba(52,152,219,.2);
    border-radius: 7px; padding: 3px 8px; margin-top: 5px;
    transition: background .15s;
  }
  .gc-loc:hover { background: rgba(52,152,219,0.18); }

  /* Reactions */
  .gc-reactions { display: flex; gap: 3px; margin-top: 3px; flex-wrap: wrap; }
  .gc-react-btn {
    display: inline-flex; align-items: center; gap: 3px;
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.09);
    border-radius: 99px; padding: 2px 7px;
    font-size: 11px; cursor: pointer; color: #ccc;
    font-family: 'Nunito', sans-serif; font-weight: 700;
    transition: all .15s;
  }
  .gc-react-btn:hover { background: rgba(255,255,255,0.12); }

  /* Reply preview inside bubble */
  .gc-reply-prev {
    background: rgba(255,255,255,0.06);
    border-left: 2px solid #e8522a;
    border-radius: 6px;
    padding: 4px 8px;
    margin-bottom: 5px;
    font-size: 11px; color: #777; line-height: 1.4;
    overflow: hidden; max-height: 36px;
  }

  /* Loading skeleton */
  #gc-skeleton { padding: 10px; display: flex; flex-direction: column; gap: 8px; }
  .gcs { background: rgba(255,255,255,0.05); border-radius: 8px; animation: gcShim 1.4s ease infinite; }
  @keyframes gcShim { 0%,100%{opacity:.3} 50%{opacity:.7} }

  /* ── SCROLL TO BOTTOM MINI ─────────────────────────────── */
  #gc-scroll-btn {
    position: absolute;
    bottom: 92px; right: 10px;
    width: 32px; height: 32px; border-radius: 50%;
    background: #e8522a; border: none; color: #fff; font-size: 14px;
    cursor: pointer; z-index: 10;
    display: none; align-items: center; justify-content: center;
    box-shadow: 0 2px 10px rgba(232,82,42,0.5);
  }
  #gc-scroll-btn.show { display: flex; }

  /* ── INPUT AREA ────────────────────────────────────────── */
  #gc-input-area {
    flex-shrink: 0;
    border-top: 1px solid rgba(255,255,255,0.07);
    background: rgba(8,8,14,0.9);
    padding: 8px 10px;
    padding-bottom: max(8px, env(safe-area-inset-bottom));
  }

  /* Emoji row */
  #gc-emoji-row {
    display: none;
    gap: 4px; padding: 6px 0 4px;
    overflow-x: auto; scrollbar-width: none;
  }
  #gc-emoji-row.show { display: flex; }
  #gc-emoji-row::-webkit-scrollbar { display: none; }
  .gc-emoji-btn {
    font-size: 18px; cursor: pointer; padding: 3px 5px;
    border-radius: 7px; border: none; background: transparent;
    flex-shrink: 0; transition: background .12s;
  }
  .gc-emoji-btn:hover { background: rgba(255,255,255,0.1); }

  /* Reply indicator */
  #gc-reply-bar {
    display: none;
    align-items: center; gap: 6px;
    padding: 5px 0 3px;
    font-family: 'Nunito', sans-serif;
    font-size: 11px; color: #888;
  }
  #gc-reply-bar.show { display: flex; }
  #gc-reply-cancel {
    background: none; border: none; color: #e8522a;
    cursor: pointer; font-size: 16px; margin-left: auto;
    line-height: 1; padding: 0;
  }

  /* Input row */
  .gc-input-row {
    display: flex;
    gap: 6px;
    align-items: flex-end;
  }
  #gc-input {
    flex: 1;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 12px;
    padding: 8px 12px;
    color: #eaeaf0;
    font-family: 'Nunito', sans-serif;
    font-size: 13px;
    resize: none;
    outline: none;
    min-height: 36px;
    max-height: 100px;
    overflow-y: auto;
    line-height: 1.4;
    transition: border .2s;
  }
  #gc-input:focus { border-color: rgba(232,82,42,0.5); }
  #gc-input::placeholder { color: #555; }

  .gc-action-btn {
    width: 36px; height: 36px; border-radius: 10px;
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.09);
    color: #888; font-size: 16px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: all .15s;
  }
  .gc-action-btn:hover { background: rgba(255,255,255,0.12); color: #ccc; }
  .gc-action-btn.active { background: rgba(232,82,42,0.15); border-color: rgba(232,82,42,.3); color: #e8522a; }

  #gc-send {
    width: 36px; height: 36px; border-radius: 10px;
    background: #e8522a; border: none; color: #fff;
    font-size: 16px; cursor: pointer; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    transition: all .2s;
  }
  #gc-send:hover  { background: #c73f1c; transform: scale(1.05); }
  #gc-send:active { transform: scale(0.93); }
  #gc-send:disabled { background: rgba(255,255,255,0.07); color: #555; cursor: not-allowed; transform: none; }

  /* Login prompt */
  .gc-login-prompt {
    text-align: center; padding: 10px;
    font-family: 'Nunito', sans-serif;
    font-size: 12px; color: #666;
  }
  .gc-login-prompt a { color: #e8522a; font-weight: 800; text-decoration: none; }

  /* Context menu */
  #gc-ctx {
    position: fixed; z-index: 1300;
    background: rgba(18,18,26,0.98); backdrop-filter: blur(16px);
    border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
    padding: 5px 0; box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    min-width: 150px; display: none;
    font-family: 'Nunito', sans-serif;
  }
  #gc-ctx.show { display: block; }
  .gc-ctx-item {
    padding: 9px 14px; font-size: 12px; font-weight: 700;
    cursor: pointer; display: flex; align-items: center; gap: 7px;
    color: #ccc; transition: background .12s;
  }
  .gc-ctx-item:hover { background: rgba(255,255,255,0.07); }
  .gc-ctx-item.danger { color: #e74c3c; }

  /* ── CHAR COUNTER ──────────────────────────────────────── */
  #gc-char {
    font-family: 'Nunito', sans-serif;
    font-size: 10px; color: #444;
    text-align: right; margin-top: 3px;
  }
  #gc-char.warn { color: #e74c3c; }

  /* ── LIGHT MODE ────────────────────────────────────────── */
  body.light #gc-panel {
    background: rgba(245,245,252,0.97);
    border-color: rgba(0,0,0,0.1);
    box-shadow: 0 24px 60px rgba(0,0,0,0.2);
  }
  body.light .gc-bubble { background: #f0f0f8; border-color: rgba(0,0,0,0.08); color: #222; }
  body.light .mine .gc-bubble { background: rgba(232,82,42,0.1); }
  body.light #gc-input { background: #f0f0f8; border-color: rgba(0,0,0,0.12); color: #222; }
  body.light #gc-input::placeholder { color: #aaa; }
  body.light #gc-input-area { background: rgba(240,240,248,0.95); }
  body.light .gc-name { color: #666; }
  body.light .gc-header-title { color: #111; }
  body.light .gc-date-sep { color: #bbb; }
  body.light .gc-date-sep::before,
  body.light .gc-date-sep::after { background: rgba(0,0,0,0.08); }
  body.light .gc-action-btn { background: rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.1); color: #555; }

  /* ── MOBILE ────────────────────────────────────────────── */
  @media (max-width: 480px) {
    #gc-panel {
      right: 8px;
      width: calc(100vw - 16px);
      bottom: 132px;
      height: 420px;
    }
    #gc-toggle { right: 12px; bottom: 72px; }
  }
`;
document.head.appendChild(style);

/* ============================================================
   BUILD DOM
   ============================================================ */
const container = document.createElement("div");
container.id = "gc-root";
container.innerHTML = `
  <!-- Toggle button -->
  <button id="gc-toggle" title="Global Chat">
    <span class="gc-toggle-icon">💬</span>
    <span id="gc-badge"></span>
    <span id="gc-online-dot"></span>
  </button>

  <!-- Panel -->
  <div id="gc-panel">

    <!-- Header -->
    <div id="gc-header">
      <span class="gc-header-icon">💬</span>
      <div class="gc-header-text">
        <div class="gc-header-title">Global Chat</div>
        <div class="gc-header-sub">
          <span class="gc-online-dot-sm"></span>
          <span id="gc-online-label">0 online</span>
        </div>
      </div>
      <button class="gc-header-close" id="gc-close">✕</button>
    </div>

    <!-- Pinned / Announcement banner -->
    <div id="gc-pinned"></div>

    <!-- Messages -->
    <div id="gc-msgs" style="position:relative;">
      <div id="gc-skeleton">
        <div class="gcs" style="height:40px;width:70%;border-radius:12px;"></div>
        <div class="gcs" style="height:32px;width:55%;align-self:flex-end;border-radius:12px;margin-left:auto;"></div>
        <div class="gcs" style="height:48px;width:65%;border-radius:12px;"></div>
        <div class="gcs" style="height:36px;width:50%;align-self:flex-end;border-radius:12px;margin-left:auto;"></div>
      </div>
    </div>

    <!-- Scroll btn (absolute inside msgs) -->
    <button id="gc-scroll-btn">↓</button>

    <!-- Input area -->
    <div id="gc-input-area">
      <!-- Login prompt (belum login) -->
      <div id="gc-login-prompt" style="display:none;" class="gc-login-prompt">
        <a href="/masuk">🔑 Login</a> untuk ikut ngobrol!
      </div>

      <!-- Input (sudah login) -->
      <div id="gc-input-wrap">
        <!-- Emoji row -->
        <div id="gc-emoji-row"></div>

        <!-- Reply bar -->
        <div id="gc-reply-bar">
          <span id="gc-reply-text"></span>
          <button id="gc-reply-cancel">×</button>
        </div>

        <!-- Row -->
        <div class="gc-input-row">
          <textarea id="gc-input" placeholder="Ketik pesan..." rows="1" maxlength="${MAX_CHARS}"></textarea>
          <button class="gc-action-btn" id="gc-emoji-btn" title="Emoji">😄</button>
          <button class="gc-action-btn" id="gc-loc-btn" title="Bagikan halaman ini">📍</button>
          <button id="gc-send" disabled>➤</button>
        </div>
        <div id="gc-char">${MAX_CHARS}</div>
      </div>
    </div>
  </div>

  <!-- Context menu -->
  <div id="gc-ctx">
    <div class="gc-ctx-item" id="gc-ctx-pin">📌 Pin</div>
    <div class="gc-ctx-item" id="gc-ctx-unpin">📍 Cabut Pin</div>
    <div class="gc-ctx-item" id="gc-ctx-reply">↩️ Balas</div>
    <div class="gc-ctx-item danger" id="gc-ctx-del">🗑️ Hapus</div>
  </div>
`;
document.body.appendChild(container);

/* ── ELEMENT REFS ─────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const gcToggle   = $("gc-toggle");
const gcPanel    = $("gc-panel");
const gcClose    = $("gc-close");
const gcMsgs     = $("gc-msgs");
const gcInput    = $("gc-input");
const gcSend     = $("gc-send");
const gcBadge    = $("gc-badge");
const gcScrollBtn= $("gc-scroll-btn");
const gcEmojiRow = $("gc-emoji-row");
const gcEmojiBtn = $("gc-emoji-btn");
const gcLocBtn   = $("gc-loc-btn");
const gcReplyBar = $("gc-reply-bar");
const gcReplyTxt = $("gc-reply-text");
const gcReplyCancel=$("gc-reply-cancel");
const gcCtx      = $("gc-ctx");
const gcChar     = $("gc-char");
const gcCtxPin   = $("gc-ctx-pin");
const gcCtxUnpin = $("gc-ctx-unpin");
const gcCtxReply = $("gc-ctx-reply");
const gcCtxDel   = $("gc-ctx-del");

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
    currentProfile = p;
    isAdmin = ADMIN_EMAILS.includes(currentUser.email) || p?.role === "admin";

    if (p?.is_banned) {
      $("gc-input-wrap").innerHTML = `<div style="text-align:center;padding:8px;color:#e74c3c;font-size:12px;font-family:'Nunito',sans-serif;font-weight:700;">🚫 Kamu dibanned dari chat.</div>`;
    }
  } else {
    $("gc-input-wrap").style.display = "none";
    $("gc-login-prompt").style.display = "block";
  }

  buildEmojiRow();
  await loadMessages();
  loadOnlineCount();
  setInterval(loadOnlineCount, 30000);
  setupRealtime();
  if (currentUser) {
    updatePresence();
    presenceTimer = setInterval(updatePresence, 60000);
  }
  bindEvents();
}

/* ============================================================
   EVENTS
   ============================================================ */
function bindEvents() {
  /* Toggle open/close */
  gcToggle.addEventListener("click", togglePanel);
  gcClose.addEventListener("click",  togglePanel);

  /* Input */
  gcInput.addEventListener("input", onInput);
  gcInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  });

  /* Send */
  gcSend.addEventListener("click", sendMsg);

  /* Emoji toggle */
  gcEmojiBtn.addEventListener("click", () => {
    emojiOpen = !emojiOpen;
    gcEmojiRow.classList.toggle("show", emojiOpen);
    gcEmojiBtn.classList.toggle("active", emojiOpen);
  });

  /* Location */
  gcLocBtn.addEventListener("click", sendLocation);

  /* Reply cancel */
  gcReplyCancel.addEventListener("click", cancelReply);

  /* Scroll */
  gcMsgs.addEventListener("scroll", () => {
    const dist = gcMsgs.scrollHeight - gcMsgs.scrollTop - gcMsgs.clientHeight;
    isAtBottom = dist < 60;
    gcScrollBtn.classList.toggle("show", dist > 150 && !isAtBottom);
    if (isAtBottom) {
      unreadCount = 0;
      const badge = document.getElementById("gc-badge");
      if (badge) badge.classList.remove("show");
    }
  }, { passive: true });
  gcScrollBtn.addEventListener("click", scrollBottom);

  /* Context menu hide */
  document.addEventListener("click", e => {
    if (!gcCtx.contains(e.target)) gcCtx.classList.remove("show");
  });

  /* Context menu actions */
  gcCtxPin.addEventListener("click",   ctxPin);
  gcCtxUnpin.addEventListener("click", ctxUnpin);
  gcCtxReply.addEventListener("click", ctxReply);
  gcCtxDel.addEventListener("click",   ctxDelete);
}

/* ============================================================
   TOGGLE PANEL
   ============================================================ */
function togglePanel() {
  isOpen = !isOpen;
  gcPanel.classList.toggle("open", isOpen);
  /* Perbarui ikon toggle tanpa menghancurkan span badge/dot yang sudah ada */
  const iconSpan = gcToggle.querySelector(".gc-toggle-icon");
  if (iconSpan) iconSpan.textContent = isOpen ? "✕" : "💬";
  if (isOpen) {
    unreadCount = 0;
    /* Re-query karena badge span tidak di-replace */
    const badge = document.getElementById("gc-badge");
    if (badge) badge.classList.remove("show");
    scrollBottom();
    setTimeout(() => gcInput.focus(), 280);
  }
}

/* ============================================================
   ONLINE COUNT
   ============================================================ */
async function loadOnlineCount() {
  const fiveMin = new Date(Date.now() - 5*60*1000).toISOString();
  const { count } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .gte("last_seen", fiveMin);
  const n = count || 0;
  $("gc-online-label").textContent = n + " online";
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
   LOAD MESSAGES
   ============================================================ */
async function loadMessages() {
  /* Hapus skeleton */
  const skel = $("gc-skeleton");
  if (skel) skel.remove();

  const { data, error } = await supabase
    .from("global_chat")
    .select(`
      id, user_id, message, is_pinned, is_announcement,
      ann_title, ann_type, page_url,
      reply_to, reply_preview, reactions, created_at,
      profiles ( username, avatar_url, role )
    `)
    .order("created_at", { ascending: true })
    .limit(80);

  if (error) {
    console.error("[GlobalChat] loadMessages error:", error);
    return;
  }

  messages = data || [];
  renderAll();
  loadPinned();
  scrollBottom();
}

function renderAll() {
  /* Clear all existing messages + date seps */
  gcMsgs.querySelectorAll(".gc-msg, .gc-date-sep").forEach(el => el.remove());

  let lastDate = "";
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
   BUILD MESSAGE ELEMENT
   ============================================================ */
function buildMsg(m) {
  const mine   = !!(currentUser && m.user_id === currentUser.id);
  const name   = m.profiles?.username || "Anonim";
  const isAdm  = m.profiles?.role === "admin";
  const isAnn  = !!m.is_announcement;

  const el = document.createElement("div");
  el.className = "gc-msg" + (mine?" mine":"") + (m.is_pinned?" pinned-hl":"");
  el.id = "gcm-" + m.id;

  /* Context menu on right-click / long press */
  el.addEventListener("contextmenu", e => { e.preventDefault(); showCtx(e, m); });
  let longTimer;
  el.addEventListener("touchstart", () => { longTimer = setTimeout(() => showCtx({ clientX: el.getBoundingClientRect().right - 160, clientY: el.getBoundingClientRect().top }, m), 600); }, { passive:true });
  el.addEventListener("touchend",   () => clearTimeout(longTimer), { passive:true });

  /* Avatar */
  const av = document.createElement("div");
  av.className = "gc-avatar";
  av.style.background = strColor(m.user_id);
  if (m.profiles?.avatar_url) {
    av.innerHTML = `<img src="${m.profiles.avatar_url}" onerror="this.parentElement.textContent='${esc(name[0]).toUpperCase()}'">`;
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
      <span class="gc-name ${isAdm?"admin-nm":""}">${esc(name)}</span>
      ${isAdm ? `<span class="gc-admin-badge">Admin</span>` : ""}
      ${m.is_pinned ? `<span>📌</span>` : ""}
      <span style="margin-left:2px;">${fmtTime(m.created_at)}</span>
    `;
    body.appendChild(meta);
  }

  const bubble = document.createElement("div");

  if (isAnn) {
    bubble.className = "gc-bubble ann-bubble";
    const icons = { info:"ℹ️", warning:"⚠️", success:"✅", update:"🚀" };
    bubble.innerHTML = `
      <div style="display:flex;align-items:center;gap:5px;margin-bottom:3px;">
        <span>${icons[m.ann_type]||"📢"}</span>
        <strong style="font-size:12px;color:#e8522a;">${esc(m.ann_title||"Pengumuman")}</strong>
      </div>
      <div style="font-size:12px;">${fmtText(m.message)}</div>
      <div style="font-size:10px;color:#666;margin-top:3px;">${fmtTime(m.created_at)} · ${esc(name)}</div>
    `;
  } else {
    bubble.className = "gc-bubble" + (mine?" mine-bubble":"");
    let html = "";
    if (m.reply_preview) {
      html += `<div class="gc-reply-prev">↩️ ${esc(m.reply_preview)}</div>`;
    }
    html += fmtText(m.message);
    if (m.page_url) {
      const path = m.page_url.replace(/^https?:\/\/[^/]+/, "") || "/";
      html += `<br><a class="gc-loc" href="${esc(m.page_url)}" target="_blank">📍 ${esc(path)}</a>`;
    }
    bubble.innerHTML = html;
  }

  body.appendChild(bubble);

  /* Reactions */
  const rxs = m.reactions || {};
  if (Object.keys(rxs).length > 0) {
    const rxRow = document.createElement("div");
    rxRow.className = "gc-reactions";
    Object.entries(rxs).forEach(([emoji, cnt]) => {
      const b = document.createElement("button");
      b.className = "gc-react-btn";
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
   PINNED
   ============================================================ */
async function loadPinned() {
  const { data } = await supabase
    .from("global_chat")
    .select("id, message, is_announcement, ann_title, ann_type, profiles(username)")
    .eq("is_pinned", true)
    .order("created_at", { ascending: false })
    .limit(2);

  const box = $("gc-pinned");
  box.innerHTML = "";

  (data||[]).forEach(m => {
    if (m.is_announcement) {
      const icons = { info:"ℹ️", warning:"⚠️", success:"✅", update:"🚀" };
      const el = document.createElement("div");
      el.className = "gc-ann-banner";
      el.innerHTML = `
        <span class="gc-ann-icon">${icons[m.ann_type]||"📢"}</span>
        <div class="gc-ann-body">
          <div class="gc-ann-title">${esc(m.ann_title||"Pengumuman")}</div>
          <div class="gc-ann-text">${esc(m.message||"")}</div>
        </div>
      `;
      box.appendChild(el);
    } else {
      const el = document.createElement("div");
      el.className = "gc-pinned-item";
      el.innerHTML = `
        <span class="gc-pin-icon">📌</span>
        <span class="gc-pin-text">${esc(m.message||"")}</span>
      `;
      el.onclick = () => {
        const target = $("gcm-" + m.id);
        if (target) { target.scrollIntoView({ behavior:"smooth", block:"center" }); }
      };
      box.appendChild(el);
    }
  });
}

/* ============================================================
   REALTIME
   ============================================================ */
function setupRealtime() {
  realtimeChannel = supabase.channel("gc_realtime_v2")
    .on("postgres_changes", { event:"INSERT", schema:"public", table:"global_chat" }, async p => {
      /* Fetch profile untuk pesan baru */
      const { data: prof } = await supabase
        .from("profiles")
        .select("username, avatar_url, role")
        .eq("id", p.new.user_id)
        .single();

      const m = { ...p.new, profiles: prof || null };
      messages.push(m);

      /* Date sep jika perlu — cek tanggal pesan vs separator terakhir */
      const msgDateLabel = dateLabel(m.created_at);
      const todayStr     = todayLabel();
      const displayLabel = (msgDateLabel === todayStr) ? "Hari ini" : msgDateLabel;
      const seps         = gcMsgs.querySelectorAll(".gc-date-sep");
      const lastSepLabel = seps.length > 0 ? seps[seps.length - 1].textContent.trim() : "";
      if (displayLabel !== lastSepLabel) {
        gcMsgs.appendChild(makeDateSep(displayLabel));
      }

      gcMsgs.appendChild(buildMsg(m));

      if (m.is_pinned || m.is_announcement) loadPinned();

      if (isAtBottom && isOpen) {
        scrollBottom();
      } else {
        unreadCount++;
        const badge = document.getElementById("gc-badge");
        if (badge) {
          badge.textContent = unreadCount > 9 ? "9+" : unreadCount;
          badge.classList.add("show");
        }
      }
    })
    .on("postgres_changes", { event:"DELETE", schema:"public", table:"global_chat" }, p => {
      $("gcm-" + p.old.id)?.remove();
      messages = messages.filter(x => x.id !== p.old.id);
    })
    .on("postgres_changes", { event:"UPDATE", schema:"public", table:"global_chat" }, p => {
      loadPinned();
      /* Refresh reactions on existing bubble */
      const el = $("gcm-" + p.new.id);
      if (el) {
        const m = messages.find(x => x.id === p.new.id);
        if (m) { Object.assign(m, p.new); el.replaceWith(buildMsg(m)); }
      }
    })
    .subscribe();
}

/* ============================================================
   SEND
   ============================================================ */
async function sendMsg() {
  if (!currentUser) return;
  const text = gcInput.value.trim();
  if (!text) return;

  gcSend.disabled = true;
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
    console.error("[GlobalChat] sendMsg error:", error);
    alert("Gagal kirim: " + (error.message || JSON.stringify(error)));
  } else {
    gcInput.value = "";
    gcInput.style.height = "auto";
    gcChar.textContent = MAX_CHARS;
    gcChar.classList.remove("warn");
    cancelReply();
  }

  gcSend.disabled  = false;
  gcInput.disabled = false;
  gcInput.focus();
}

async function sendLocation() {
  if (!currentUser) return;
  const url = window.location.href;
  const { error } = await supabase.from("global_chat").insert({
    user_id:  currentUser.id,
    message:  "Sedang di halaman ini 👇",
    page_url: url,
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
    gcInput.value = gcInput.value.slice(0,pos) + emoji + gcInput.value.slice(pos);
    gcInput.focus();
    onInput();
  });
}

/* ============================================================
   INPUT
   ============================================================ */
function onInput() {
  gcInput.style.height = "auto";
  gcInput.style.height = Math.min(gcInput.scrollHeight, 100) + "px";
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
  gcCtxPin.style.display   = isAdmin ? "flex" : "none";
  gcCtxUnpin.style.display = isAdmin ? "flex" : "none";
  gcCtxReply.style.display = currentUser ? "flex" : "none";
  gcCtxDel.style.display   = (mine || isAdmin) ? "flex" : "none";

  /* Check if any item is visible */
  const anyVisible = [gcCtxPin, gcCtxUnpin, gcCtxReply, gcCtxDel].some(el => el.style.display !== "none");
  if (!anyVisible) return;

  const x = Math.min(e.clientX || window.innerWidth - 170, window.innerWidth - 170);
  const y = Math.min(e.clientY || 200, window.innerHeight - 180);
  gcCtx.style.left = x + "px";
  gcCtx.style.top  = y + "px";
  gcCtx.classList.add("show");
}

async function ctxPin() {
  if (!ctxTarget || !isAdmin) return;
  await supabase.from("global_chat").update({ is_pinned: true }).eq("id", ctxTarget.id);
  gcCtx.classList.remove("show");
}
async function ctxUnpin() {
  if (!ctxTarget || !isAdmin) return;
  await supabase.from("global_chat").update({ is_pinned: false }).eq("id", ctxTarget.id);
  gcCtx.classList.remove("show");
}
function ctxReply() {
  if (!ctxTarget) return;
  replyingTo = ctxTarget;
  const name = ctxTarget.profiles?.username || "Anonim";
  const prev = (ctxTarget.message||"").slice(0,50);
  gcReplyTxt.innerHTML = `↩️ <strong style="color:#dde;">${esc(name)}</strong>: "${esc(prev)}"`;
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
   SCROLL
   ============================================================ */
function scrollBottom() {
  gcMsgs.scrollTop = gcMsgs.scrollHeight;
  isAtBottom = true;
  gcScrollBtn.classList.remove("show");
  const badge = document.getElementById("gc-badge");
  if (badge) badge.classList.remove("show");
}

/* ============================================================
   HELPERS
   ============================================================ */
function esc(s) {
  if (!s) return "";
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function fmtText(t) {
  if (!t) return "";
  return esc(t).replace(/\*(.*?)\*/g,"<strong>$1</strong>").replace(/_(.*?)_/g,"<em>$1</em>").replace(/\n/g,"<br>");
}
function fmtTime(d) {
  if (!d) return "";
  const dt = new Date(d);
  const ms = Date.now() - dt.getTime();
  const m  = Math.floor(ms/60000);
  if (m < 1)  return "baru saja";
  if (m < 60) return m + "m";
  const h = Math.floor(m/60);
  if (h < 24) return h + "j";
  return dt.toLocaleDateString("id-ID", { day:"2-digit", month:"short" });
}
function dateLabel(d) {
  return new Date(d).toLocaleDateString("id-ID", { day:"2-digit", month:"long", year:"numeric" });
}
function todayLabel() {
  return dateLabel(new Date());
}
function strColor(str) {
  let h = 0;
  for (let i=0; i<(str||"").length; i++) h = str.charCodeAt(i) + ((h<<5)-h);
  const cols = ["#e8522a","#3498db","#9b59b6","#27ae60","#f39c12","#e74c3c","#1abc9c","#d35400"];
  return cols[Math.abs(h) % cols.length];
}

/* ── BOOT ─────────────────────────────────────────────────── */
init().catch(console.error);
