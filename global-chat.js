/* ============================================================
   PANKOMIK — global-chat.js  (Redesign v3)

   PERUBAHAN:
   - Redesain visual total: dark editorial + glassmorphism
   - Badge level user di setiap pesan (🌱 Lv.1 → 👑 Lv.20+)
   - Fetch total_chapters_read & level dari profiles
   - Avatar ring warna berdasarkan level
   - Header lebih prestige dengan gradient
   - Bubble pesan lebih halus & readable
   - Typing indicator animasi dot
   - Input area polished dengan efek glass
   - Badge counter animasi pop
   - Context menu lebih premium
   ============================================================ */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://aaqhknkyrnsapvfywdsn.supabase.co";
const SUPABASE_KEY = "sb_publishable_ND-51tP1NF40HRZ3q05N5w_1ZnlPzlL";
const supabase     = createClient(SUPABASE_URL, SUPABASE_KEY);

const ADMIN_EMAILS  = ["pankomik@gmail.com", "rian.samuji@gmail.com"];
const MAX_CHARS     = 500;
const SEND_COOLDOWN = 2500;
const EMOJIS = ["😂","😍","🔥","💯","👏","😭","❤️","😎","💪","🙏","😤","✨","🎉","😱","🤩","💀","😅","🫶","🏆","👑","💛","🫡","🤣","👀","⭐","🎭"];

/* ── BADGE LEVEL SYSTEM ────────────────────────────────── */
function getLevelInfo(level) {
  if (level >= 20) return { icon: "👑", label: "Legenda",      color: "#f5a623", glow: "rgba(245,166,35,0.4)",  ring: "#f5a623" };
  if (level >= 10) return { icon: "⭐", label: "Otaku Sejati", color: "#a78bfa", glow: "rgba(167,139,250,0.35)", ring: "#a78bfa" };
  if (level >= 5)  return { icon: "🔥", label: "Pembaca Aktif",color: "#34d399", glow: "rgba(52,211,153,0.35)",  ring: "#34d399" };
  if (level >= 2)  return { icon: "📚", label: "Pecinta Komik",color: "#60a5fa", glow: "rgba(96,165,250,0.3)",   ring: "#60a5fa" };
  return            { icon: "🌱", label: "Pemula",             color: "#9ca3af", glow: "rgba(156,163,175,0.25)", ring: "#6b7280" };
}

/* ── STATE ─────────────────────────────────────────────── */
let currentUser     = null;
let myProfile       = null;
let isAdmin         = false;
let messages        = [];
let isOpen          = false;
let unreadCount     = 0;
let isAtBottom      = true;
let replyingTo      = null;
let realtimeChannel = null;
let emojiOpen       = false;
let ctxTarget       = null;
let lastSentAt      = 0;
let typingTimer     = null;
let typingUsers     = new Map();

/* ============================================================
   CSS — Full Redesign
   ============================================================ */
const style = document.createElement("style");
style.textContent = `
  /* ── TOGGLE BUTTON ─────────────────────────────────── */
  #gc-toggle {
    position: fixed;
    right: 18px;
    bottom: calc(80px + env(safe-area-inset-bottom));
    z-index: 9100;
    width: 54px; height: 54px;
    border-radius: 50%;
    background: linear-gradient(145deg, #f05a30, #c73f1c);
    border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px;
    box-shadow:
      0 4px 24px rgba(232,82,42,.55),
      0 2px 8px rgba(0,0,0,.4),
      inset 0 1px 0 rgba(255,255,255,.18);
    transition: transform .35s cubic-bezier(.34,1.56,.64,1), opacity .3s ease, box-shadow .2s;
    -webkit-tap-highlight-color: transparent;
    will-change: transform, opacity;
  }
  #gc-toggle:hover  { transform: scale(1.1); box-shadow: 0 8px 32px rgba(232,82,42,.7); }
  #gc-toggle:active { transform: scale(.88); }
  .gc-toggle-icon { pointer-events:none; line-height:1; display:block; }

  /* Unread badge */
  #gc-badge {
    position: absolute; top: -5px; right: -5px;
    min-width: 20px; height: 20px;
    background: linear-gradient(135deg, #e74c3c, #c0392b);
    color: #fff;
    font-family: 'Nunito', sans-serif;
    font-size: 10px; font-weight: 900;
    border-radius: 99px; padding: 0 5px;
    display: none; align-items: center; justify-content: center;
    border: 2px solid #09090f;
    pointer-events: none;
    animation: gcBadgePop .35s cubic-bezier(.34,1.56,.64,1);
    box-shadow: 0 2px 8px rgba(231,76,60,.5);
  }
  #gc-badge.show { display: flex; }
  @keyframes gcBadgePop { from { transform: scale(0) rotate(-20deg); } to { transform: scale(1) rotate(0deg); } }

  /* Online dot */
  #gc-online-dot {
    position: absolute; bottom: 3px; left: 3px;
    width: 11px; height: 11px;
    background: #2ecc71; border-radius: 50%;
    border: 2px solid #09090f;
  }
  #gc-online-dot::after {
    content: ''; position: absolute; inset: -2px;
    border-radius: 50%; background: rgba(46,204,113,0.4);
    animation: gcRipple 2.5s ease-out infinite;
  }
  @keyframes gcRipple {
    0%   { transform: scale(1); opacity: 0.7; }
    100% { transform: scale(2.4); opacity: 0; }
  }

  /* ── PANEL ─────────────────────────────────────────── */
  #gc-panel {
    position: fixed;
    inset: 0;
    z-index: 9099;
    background: #09090f;
    display: flex; flex-direction: column;
    transform: translateY(100%);
    opacity: 0;
    pointer-events: none;
    transition: transform .42s cubic-bezier(.32,.72,0,1), opacity .35s ease;
    will-change: transform, opacity;
  }
  #gc-panel.open {
    transform: translateY(0);
    opacity: 1;
    pointer-events: all;
  }

  /* ── HEADER ─────────────────────────────────────────── */
  #gc-header {
    display: flex; align-items: center; gap: 12px;
    padding: 0 16px;
    padding-top: env(safe-area-inset-top);
    min-height: calc(60px + env(safe-area-inset-top));
    background: linear-gradient(135deg, #0f0f1a 0%, #16101e 50%, #0f1420 100%);
    border-bottom: 1px solid rgba(232,82,42,.15);
    flex-shrink: 0;
    box-shadow: 0 4px 24px rgba(0,0,0,.5);
    position: relative;
    overflow: hidden;
  }
  /* Subtle accent strip */
  #gc-header::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, transparent, #e8522a, #f5a623, #e8522a, transparent);
    opacity: 0.7;
  }

  .gc-hdr-icon {
    width: 40px; height: 40px; border-radius: 12px;
    background: rgba(232,82,42,.12);
    border: 1px solid rgba(232,82,42,.22);
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; flex-shrink: 0;
    box-shadow: 0 0 16px rgba(232,82,42,.15);
  }
  .gc-hdr-text { flex: 1; min-width: 0; }
  .gc-hdr-title {
    font-family: 'Nunito', sans-serif;
    font-size: 15px; font-weight: 900;
    color: #f0f0f8; line-height: 1.2;
    letter-spacing: 0.2px;
  }
  .gc-hdr-sub {
    font-family: 'Nunito', sans-serif;
    font-size: 11px; font-weight: 700;
    color: #2ecc71;
    display: flex; align-items: center; gap: 5px;
    margin-top: 2px;
  }
  .gc-hdr-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #2ecc71;
    box-shadow: 0 0 6px #2ecc71;
    flex-shrink: 0;
    animation: gcDotPulse 2.5s ease infinite;
  }
  @keyframes gcDotPulse {
    0%,100% { opacity: 1; }
    50%      { opacity: 0.4; }
  }

  #gc-close {
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.08);
    color: #555; width: 36px; height: 36px; border-radius: 50%;
    cursor: pointer; font-size: 14px; font-weight: 900;
    display: flex; align-items: center; justify-content: center;
    transition: all .2s cubic-bezier(.34,1.56,.64,1); flex-shrink: 0;
    letter-spacing: -1px;
  }
  #gc-close:hover  { background: rgba(232,82,42,.18); border-color: rgba(232,82,42,.35); color: #e8522a; transform: scale(1.1) rotate(90deg); }
  #gc-close:active { transform: scale(.88); }

  /* ── PINNED ─────────────────────────────────────────── */
  #gc-pinned { flex-shrink: 0; overflow: hidden; }
  .gc-pin-item {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 16px;
    background: linear-gradient(90deg, rgba(245,200,66,.06), transparent);
    border-bottom: 1px solid rgba(245,200,66,.07);
    cursor: pointer;
  }
  .gc-pin-text {
    font-family: 'Nunito', sans-serif; font-size: 12px;
    color: #b0b0c8; overflow: hidden;
    white-space: nowrap; text-overflow: ellipsis; flex: 1;
  }
  .gc-ann-wrap {
    display: flex; align-items: flex-start; gap: 8px;
    padding: 9px 16px;
    background: linear-gradient(90deg, rgba(232,82,42,.07), transparent);
    border-bottom: 1px solid rgba(232,82,42,.1);
  }
  .gc-ann-title { font-family: 'Nunito', sans-serif; font-size: 12px; font-weight: 800; color: #e8522a; }
  .gc-ann-body  { font-family: 'Nunito', sans-serif; font-size: 11px; color: #555; line-height: 1.4; }

  /* ── TYPING INDICATOR ──────────────────────────────── */
  #gc-typing {
    flex-shrink: 0;
    padding: 5px 16px;
    font-family: 'Nunito', sans-serif; font-size: 11px;
    color: #454560;
    min-height: 22px;
    display: flex; align-items: center; gap: 7px;
  }
  .gc-typing-dots {
    display: flex; gap: 3px; align-items: center;
  }
  .gc-typing-dots span {
    width: 4px; height: 4px; border-radius: 50%;
    background: #454575;
    animation: gcDotBounce 1.2s ease infinite;
  }
  .gc-typing-dots span:nth-child(2) { animation-delay: 0.18s; }
  .gc-typing-dots span:nth-child(3) { animation-delay: 0.36s; }
  @keyframes gcDotBounce {
    0%,60%,100% { transform: translateY(0); opacity: 0.4; }
    30%          { transform: translateY(-4px); opacity: 1; }
  }

  /* ── MESSAGES ───────────────────────────────────────── */
  #gc-msgs {
    flex: 1; overflow-y: auto; overflow-x: hidden;
    padding: 10px 12px 6px;
    display: flex; flex-direction: column; gap: 0;
    overscroll-behavior: contain;
    background: #09090f;
  }
  #gc-msgs::-webkit-scrollbar { width: 3px; }
  #gc-msgs::-webkit-scrollbar-thumb { background: rgba(255,255,255,.07); border-radius: 99px; }

  .gc-date-sep {
    text-align: center;
    font-family: 'Nunito', sans-serif;
    font-size: 10px; font-weight: 800;
    color: #2a2a40;
    letter-spacing: 1.2px; margin: 18px 0 13px;
    display: flex; align-items: center; gap: 10px;
    text-transform: uppercase;
  }
  .gc-date-sep::before, .gc-date-sep::after {
    content: ""; flex: 1; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.05), transparent);
  }

  /* ── MESSAGE ROW ────────────────────────────────────── */
  .gc-msg {
    display: flex; gap: 9px; align-items: flex-end;
    padding: 1px 0;
  }
  .gc-msg.mine { flex-direction: row-reverse; }
  .gc-msg.pin-hl {
    background: rgba(245,200,66,.03);
    border-left: 2px solid rgba(245,200,66,.15);
    padding-left: 6px; border-radius: 0 6px 6px 0;
  }
  .gc-msg.new-sender { margin-top: 12px; }

  /* ── AVATAR ─────────────────────────────────────────── */
  .gc-av {
    width: 32px; height: 32px; border-radius: 50%;
    flex-shrink: 0; align-self: flex-end; margin-bottom: 2px;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Nunito', sans-serif; font-size: 12px;
    font-weight: 900; color: #fff;
    transition: opacity .2s;
    position: relative;
    overflow: visible !important;
  }
  .gc-av-inner {
    width: 32px; height: 32px; border-radius: 50%;
    overflow: hidden; display: flex; align-items: center;
    justify-content: center; font-size: 12px; font-weight: 900;
    color: #fff; position: relative; z-index: 1;
    border: 2px solid rgba(255,255,255,.08);
  }
  .gc-av-inner img { width: 100%; height: 100%; object-fit: cover; }
  /* Level ring around avatar */
  .gc-av-ring {
    position: absolute; inset: -2px; border-radius: 50%;
    border: 2px solid transparent;
    z-index: 0;
  }
  .gc-av.hidden { opacity: 0; pointer-events: none; }

  /* ── BODY ───────────────────────────────────────────── */
  .gc-body { max-width: 78%; display: flex; flex-direction: column; min-width: 0; }
  .mine .gc-body { align-items: flex-end; }

  /* ── META (name + badge) ────────────────────────────── */
  .gc-meta {
    font-family: 'Nunito', sans-serif; font-size: 10.5px;
    color: #404058;
    margin-bottom: 3px;
    display: flex; align-items: center; gap: 5px;
    padding: 0 3px; flex-wrap: nowrap;
  }
  .mine .gc-meta { flex-direction: row-reverse; }
  .gc-meta.hidden { display: none; }

  .gc-name { font-weight: 800; color: #6060a0; font-size: 11px; }
  .gc-name.adm { color: #e8522a; }

  /* Admin badge */
  .gc-adm-badge {
    font-size: 8px; font-weight: 900; letter-spacing: .6px;
    padding: 1px 6px; border-radius: 99px; text-transform: uppercase;
    background: rgba(232,82,42,.14); color: #e8522a;
    border: 1px solid rgba(232,82,42,.25);
    white-space: nowrap;
  }

  /* ★ USER LEVEL BADGE ─────────────────────────────── */
  .gc-lvl-badge {
    display: inline-flex; align-items: center; gap: 2px;
    font-size: 8.5px; font-weight: 900;
    padding: 1px 6px 1px 4px;
    border-radius: 99px;
    border: 1px solid transparent;
    white-space: nowrap;
    letter-spacing: 0.2px;
    line-height: 1.6;
    flex-shrink: 0;
  }
  .gc-lvl-badge .lvl-icon { font-size: 9px; line-height: 1; }

  /* ── BUBBLE ─────────────────────────────────────────── */
  .gc-bubble {
    background: linear-gradient(135deg, #141422, #111120);
    border: 1px solid rgba(255,255,255,.055);
    border-radius: 4px 16px 16px 16px;
    padding: 9px 13px;
    font-family: 'Nunito', sans-serif; font-size: 14px;
    line-height: 1.55; color: #c8c8e8;
    word-break: break-word;
    animation: gcMsgIn .2s cubic-bezier(.4,0,.2,1);
    box-shadow: 0 2px 8px rgba(0,0,0,.25);
    position: relative;
  }
  @keyframes gcMsgIn {
    from { opacity: 0; transform: translateY(7px) scale(.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .gc-bubble.cont { border-radius: 4px 16px 16px 4px; }
  .mine .gc-bubble {
    background: linear-gradient(135deg, rgba(232,82,42,.22), rgba(180,50,16,.18));
    border-color: rgba(232,82,42,.2);
    border-radius: 16px 4px 16px 16px;
    color: #f0d4cc;
    box-shadow: 0 2px 12px rgba(232,82,42,.12);
  }
  .mine .gc-bubble.cont { border-radius: 16px 4px 4px 16px; }
  .gc-bubble.ann {
    background: linear-gradient(135deg, rgba(232,82,42,.08), rgba(245,166,35,.04));
    border-color: rgba(232,82,42,.18);
    border-radius: 12px;
  }
  .gc-bubble.optimistic { opacity: .6; }

  .gc-ts {
    font-size: 10px; color: rgba(255,255,255,.18);
    float: right; margin-left: 10px; margin-top: 4px;
    line-height: 1; white-space: nowrap;
  }
  .mine .gc-ts { color: rgba(255,190,160,.3); }

  .gc-loc {
    display: inline-flex; align-items: center; gap: 4px;
    color: #5ba3e0; font-size: 11px; text-decoration: none;
    background: rgba(52,152,219,.1); border: 1px solid rgba(52,152,219,.18);
    border-radius: 7px; padding: 3px 9px; margin-top: 5px;
    transition: background .15s;
  }

  .gc-reply-prev {
    background: rgba(255,255,255,.04);
    border-left: 2px solid rgba(232,82,42,.5);
    border-radius: 0 5px 5px 0;
    padding: 4px 9px; margin-bottom: 6px;
    font-size: 11px; color: #555;
    line-height: 1.4; overflow: hidden; max-height: 36px;
  }

  /* Reactions */
  .gc-reacts { display: flex; gap: 3px; margin-top: 5px; flex-wrap: wrap; }
  .gc-react {
    display: inline-flex; align-items: center; gap: 3px;
    background: rgba(255,255,255,.05);
    border: 1px solid rgba(255,255,255,.08);
    border-radius: 99px; padding: 2px 8px;
    font-size: 12px; cursor: pointer; color: #aaa;
    font-family: 'Nunito', sans-serif; font-weight: 700;
    transition: all .15s;
  }
  .gc-react:hover { background: rgba(255,255,255,.12); transform: scale(1.05); }

  /* Skeleton */
  #gc-skeleton { padding: 16px 12px; display: flex; flex-direction: column; gap: 16px; }
  .gcs {
    background: rgba(255,255,255,.035);
    border-radius: 12px;
    animation: gcShim 1.8s ease infinite;
  }
  @keyframes gcShim { 0%,100% { opacity: .2; } 50% { opacity: .5; } }

  /* Error state */
  #gc-load-error {
    display: none; flex-direction: column; align-items: center;
    justify-content: center; flex: 1; gap: 12px;
    color: #555; font-family: 'Nunito', sans-serif;
    text-align: center; padding: 24px;
  }
  #gc-load-error button {
    padding: 10px 22px; background: #e8522a; color: #fff;
    border: none; border-radius: 10px; cursor: pointer;
    font-weight: 800; font-family: 'Nunito', sans-serif;
    font-size: 13px; transition: background .2s;
    box-shadow: 0 4px 14px rgba(232,82,42,.35);
  }
  #gc-load-error button:hover { background: #c73f1c; }

  /* Scroll btn */
  #gc-scroll-btn {
    position: fixed;
    bottom: calc(102px + env(safe-area-inset-bottom));
    right: 16px;
    width: 36px; height: 36px; border-radius: 50%;
    background: linear-gradient(145deg, #e8522a, #c73f1c);
    border: none; color: #fff; font-size: 14px;
    cursor: pointer; z-index: 9110;
    display: none; align-items: center; justify-content: center;
    box-shadow: 0 4px 16px rgba(232,82,42,.45);
    transition: transform .2s;
    font-weight: 900;
  }
  #gc-scroll-btn.show { display: flex; }
  #gc-scroll-btn:hover { transform: scale(1.12); }

  /* ── INPUT AREA ─────────────────────────────────────── */
  #gc-input-area {
    flex-shrink: 0;
    border-top: 1px solid rgba(255,255,255,.055);
    background: linear-gradient(180deg, #0e0e18, #0b0b14);
    padding: 8px 12px;
    padding-bottom: max(12px, calc(env(safe-area-inset-bottom) + 8px));
    box-shadow: 0 -8px 32px rgba(0,0,0,.4);
  }

  /* Send error toast */
  #gc-send-error {
    font-family: 'Nunito', sans-serif; font-size: 12px;
    color: #e74c3c; padding: 0 4px 6px;
    display: none; font-weight: 700;
    animation: gcMsgIn .2s ease;
  }
  #gc-send-error.show { display: block; }

  /* Emoji row */
  #gc-emoji-row {
    display: none; gap: 3px; padding: 5px 0 4px;
    overflow-x: auto; scrollbar-width: none;
  }
  #gc-emoji-row.show { display: flex; }
  #gc-emoji-row::-webkit-scrollbar { display: none; }
  .gc-emoji-btn {
    font-size: 21px; cursor: pointer; padding: 4px 5px;
    border-radius: 8px; border: none; background: transparent;
    flex-shrink: 0; transition: background .1s, transform .1s;
  }
  .gc-emoji-btn:hover { background: rgba(255,255,255,.07); transform: scale(1.2); }

  /* Reply bar */
  #gc-reply-bar {
    display: none; align-items: center; gap: 8px;
    padding: 6px 8px; margin-bottom: 6px;
    font-family: 'Nunito', sans-serif; font-size: 12px; color: #555;
    background: rgba(232,82,42,.06);
    border: 1px solid rgba(232,82,42,.12);
    border-radius: 8px;
  }
  #gc-reply-bar.show { display: flex; }
  #gc-reply-cancel {
    background: none; border: none; color: #e8522a;
    cursor: pointer; font-size: 16px; margin-left: auto;
    line-height: 1; width: 22px; height: 22px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 50%; transition: background .15s;
  }
  #gc-reply-cancel:hover { background: rgba(232,82,42,.15); }

  .gc-row { display: flex; gap: 7px; align-items: flex-end; }

  #gc-input {
    flex: 1;
    background: rgba(255,255,255,.05);
    border: 1.5px solid rgba(255,255,255,.08);
    border-radius: 18px; padding: 10px 16px;
    color: #e8e8f8; font-family: 'Nunito', sans-serif; font-size: 14px;
    resize: none; outline: none;
    min-height: 44px; max-height: 120px;
    overflow-y: auto; line-height: 1.45;
    transition: border .2s, background .2s, box-shadow .2s;
    scrollbar-width: thin;
  }
  #gc-input:focus {
    border-color: rgba(232,82,42,.5);
    background: rgba(255,255,255,.075);
    box-shadow: 0 0 0 3px rgba(232,82,42,.1);
  }
  #gc-input::placeholder { color: #2a2a3a; }

  .gc-act {
    width: 44px; height: 44px; border-radius: 12px;
    background: rgba(255,255,255,.05);
    border: 1.5px solid rgba(255,255,255,.07);
    color: #4a4a6a; font-size: 18px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    transition: all .18s cubic-bezier(.34,1.56,.64,1);
  }
  .gc-act:hover  { background: rgba(255,255,255,.1); color: #9090c0; transform: scale(1.05); }
  .gc-act:active { transform: scale(.88); }
  .gc-act.on     { background: rgba(232,82,42,.15); border-color: rgba(232,82,42,.3); color: #e8522a; }

  #gc-send {
    width: 44px; height: 44px; border-radius: 50%;
    background: linear-gradient(145deg, #f05a30, #c73f1c);
    border: none; color: #fff; font-size: 17px;
    cursor: pointer; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    transition: all .2s cubic-bezier(.34,1.56,.64,1);
    box-shadow: 0 4px 16px rgba(232,82,42,.45);
    font-weight: 900;
  }
  #gc-send:hover    { transform: scale(1.12); box-shadow: 0 6px 24px rgba(232,82,42,.6); }
  #gc-send:active   { transform: scale(.88); }
  #gc-send:disabled { background: rgba(255,255,255,.05); color: #222; cursor: not-allowed; transform: none; box-shadow: none; }

  #gc-char {
    font-family: 'Nunito', sans-serif; font-size: 10px;
    color: #1e1e2e; text-align: right;
    margin-top: 3px; transition: color .2s;
  }
  #gc-char.warn { color: #c0392b; }

  .gc-login-prompt {
    text-align: center; padding: 16px;
    font-family: 'Nunito', sans-serif; font-size: 13px; color: #444;
  }
  .gc-login-prompt a { color: #e8522a; font-weight: 800; text-decoration: none; }

  /* ── CONTEXT MENU ────────────────────────────────────── */
  #gc-ctx {
    position: fixed; z-index: 9200;
    background: rgba(14,14,22,.97);
    backdrop-filter: blur(24px);
    border: 1px solid rgba(255,255,255,.07);
    border-radius: 14px; padding: 5px 0;
    box-shadow: 0 16px 48px rgba(0,0,0,.75);
    min-width: 155px; display: none;
    font-family: 'Nunito', sans-serif;
    animation: gcCtxIn .15s ease;
  }
  @keyframes gcCtxIn { from { opacity:0; transform: scale(.92) translateY(-4px); } to { opacity:1; transform: scale(1) translateY(0); } }
  #gc-ctx.show { display: block; }
  .gc-ctx-item {
    padding: 11px 16px; font-size: 13px; font-weight: 700;
    cursor: pointer; display: flex; align-items: center; gap: 9px;
    color: #a0a0c0; transition: background .1s, padding-left .1s;
  }
  .gc-ctx-item:hover  { background: rgba(255,255,255,.06); padding-left: 20px; }
  .gc-ctx-item:active { background: rgba(255,255,255,.1); }
  .gc-ctx-item.del    { color: #e74c3c; }

  /* ── LIGHT MODE ──────────────────────────────────────── */
  body.light #gc-panel        { background: #f4f4fc; }
  body.light #gc-header       { background: linear-gradient(135deg, #ebebf8, #e4e4f0); border-color: rgba(0,0,0,.06); }
  body.light #gc-header::before { opacity: 0.35; }
  body.light #gc-input-area   { background: #ebebf8; border-top-color: rgba(0,0,0,.07); }
  body.light #gc-msgs         { background: #f4f4fc; }
  body.light .gc-bubble       { background: #e4e4f4; border-color: rgba(0,0,0,.06); color: #1a1a2a; }
  body.light .mine .gc-bubble { background: rgba(232,82,42,.12); border-color: rgba(232,82,42,.2); color: #5a1a08; }
  body.light #gc-input        { background: rgba(0,0,0,.04); border-color: rgba(0,0,0,.09); color: #1a1a2a; }
  body.light #gc-input::placeholder { color: #ccc; }
  body.light .gc-name         { color: #8888a0; }
  body.light .gc-hdr-title    { color: #111; }
  body.light .gc-date-sep     { color: #ccc; }
  body.light .gc-ts           { color: rgba(0,0,0,.22); }
  body.light .gcs             { background: rgba(0,0,0,.06); }
  body.light #gc-typing       { color: #aaa; }
  body.light #gc-ctx          { background: rgba(255,255,255,.97); border-color: rgba(0,0,0,.1); }
  body.light .gc-ctx-item     { color: #333; }
  body.light .gc-ctx-item:hover { background: rgba(0,0,0,.04); }
`;
document.head.appendChild(style);

/* ============================================================
   DOM
   ============================================================ */
const root = document.createElement("div");
root.id = "gc-root";
root.innerHTML = `
  <button id="gc-toggle" title="Chat (Ctrl+K)">
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
      <button id="gc-close" title="Tutup (Esc)">✕</button>
    </div>

    <!-- Pinned / Announcement -->
    <div id="gc-pinned"></div>

    <!-- Typing indicator -->
    <div id="gc-typing"></div>

    <!-- Messages -->
    <div id="gc-msgs">
      <div id="gc-skeleton">
        <div style="display:flex;gap:9px;align-items:flex-end;">
          <div class="gcs" style="width:32px;height:32px;border-radius:50%;flex-shrink:0;"></div>
          <div class="gcs" style="height:52px;width:62%;border-radius:4px 16px 16px 16px;"></div>
        </div>
        <div style="display:flex;gap:9px;align-items:flex-end;flex-direction:row-reverse;">
          <div class="gcs" style="height:38px;width:50%;border-radius:16px 4px 16px 16px;"></div>
        </div>
        <div style="display:flex;gap:9px;align-items:flex-end;">
          <div class="gcs" style="width:32px;height:32px;border-radius:50%;flex-shrink:0;"></div>
          <div class="gcs" style="height:64px;width:70%;border-radius:4px 16px 16px 16px;"></div>
        </div>
        <div style="display:flex;gap:9px;align-items:flex-end;flex-direction:row-reverse;">
          <div class="gcs" style="height:44px;width:55%;border-radius:16px 4px 16px 16px;"></div>
        </div>
        <div style="display:flex;gap:9px;align-items:flex-end;">
          <div class="gcs" style="width:32px;height:32px;border-radius:50%;flex-shrink:0;"></div>
          <div class="gcs" style="height:42px;width:58%;border-radius:4px 16px 16px 16px;"></div>
        </div>
      </div>
      <div id="gc-load-error">
        <div style="font-size:40px;">⚠️</div>
        <p>Gagal memuat pesan</p>
        <button onclick="window.__gcReload()">🔄 Coba Lagi</button>
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
          <span style="font-size:13px;">↩️</span>
          <span id="gc-reply-text" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
          <button id="gc-reply-cancel">✕</button>
        </div>
        <div id="gc-send-error"></div>
        <div class="gc-row">
          <textarea id="gc-input" placeholder="Ketik pesan..." rows="1" maxlength="${MAX_CHARS}"></textarea>
          <button class="gc-act" id="gc-emoji-btn" title="Emoji">😄</button>
          <button class="gc-act" id="gc-loc-btn" title="Kirim Lokasi">📍</button>
          <button id="gc-send" disabled title="Kirim (Enter)">➤</button>
        </div>
        <div id="gc-char">${MAX_CHARS}</div>
      </div>
    </div>
  </div>

  <button id="gc-scroll-btn" title="Scroll ke bawah">↓</button>

  <div id="gc-ctx">
    <div class="gc-ctx-item" id="gc-ctx-pin">📌 Pin Pesan</div>
    <div class="gc-ctx-item" id="gc-ctx-unpin">📍 Cabut Pin</div>
    <div class="gc-ctx-item" id="gc-ctx-reply">↩️ Balas</div>
    <div class="gc-ctx-item del" id="gc-ctx-del">🗑️ Hapus</div>
  </div>
`;
document.body.appendChild(root);

/* ── REFS ───────────────────────────────────────────── */
const $ = id => document.getElementById(id);
const gcToggle     = $("gc-toggle");
const gcPanel      = $("gc-panel");
const gcClose      = $("gc-close");
const gcMsgs       = $("gc-msgs");
const gcInput      = $("gc-input");
const gcSend       = $("gc-send");
const gcScrollBtn  = $("gc-scroll-btn");
const gcEmojiRow   = $("gc-emoji-row");
const gcEmojiBtn   = $("gc-emoji-btn");
const gcLocBtn     = $("gc-loc-btn");
const gcReplyBar   = $("gc-reply-bar");
const gcReplyTxt   = $("gc-reply-text");
const gcReplyCancel= $("gc-reply-cancel");
const gcCtx        = $("gc-ctx");
const gcChar       = $("gc-char");
const gcCtxPin     = $("gc-ctx-pin");
const gcCtxUnpin   = $("gc-ctx-unpin");
const gcCtxReply   = $("gc-ctx-reply");
const gcCtxDel     = $("gc-ctx-del");
const gcTyping     = $("gc-typing");
const gcSendError  = $("gc-send-error");

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
  return dt.toLocaleDateString("id-ID",{ day:"2-digit", month:"short" });
}

function dateLabel(d) {
  return new Date(d).toLocaleDateString("id-ID",{ day:"2-digit", month:"long", year:"numeric" });
}
function todayLabel() { return dateLabel(new Date()); }

function strColor(s) {
  let h = 0;
  for (let i = 0; i < (s||"").length; i++) h = s.charCodeAt(i) + ((h<<5)-h);
  const c = ["#e8522a","#3b82f6","#8b5cf6","#10b981","#f59e0b","#ef4444","#06b6d4","#d97706"];
  return c[Math.abs(h) % c.length];
}

function showBadge(n) {
  const b = $("gc-badge");
  if (!b) return;
  b.textContent = n > 9 ? "9+" : String(n);
  b.classList.add("show");
}
function hideBadge() { $("gc-badge")?.classList.remove("show"); }

function showSendError(msg) {
  if (!gcSendError) return;
  gcSendError.textContent = "⚠️ " + msg;
  gcSendError.classList.add("show");
  clearTimeout(gcSendError._t);
  gcSendError._t = setTimeout(() => gcSendError.classList.remove("show"), 4000);
}

/* ============================================================
   TYPING INDICATOR — dot animation
   ============================================================ */
function updateTypingUI() {
  if (!gcTyping) return;
  const names = [...typingUsers.values()].map(u => u.name).slice(0, 3);
  if (!names.length) {
    gcTyping.innerHTML = "";
    return;
  }
  const label = names.length === 1
    ? `<strong style="color:#5a5a8a">${esc(names[0])}</strong> sedang mengetik`
    : `<strong style="color:#5a5a8a">${names.slice(0,-1).map(esc).join(", ")}</strong> dan <strong style="color:#5a5a8a">${esc(names[names.length-1])}</strong> mengetik`;
  gcTyping.innerHTML = `${label} <div class="gc-typing-dots"><span></span><span></span><span></span></div>`;
}

function broadcastTyping() {
  if (!currentUser || !realtimeChannel) return;
  clearTimeout(typingTimer);
  realtimeChannel.send({
    type: "broadcast", event: "typing",
    payload: {
      userId: currentUser.id,
      name: myProfile?.username || currentUser.email?.split("@")[0] || "User",
    }
  });
  typingTimer = setTimeout(() => {
    realtimeChannel.send({
      type: "broadcast", event: "typing_stop",
      payload: { userId: currentUser.id }
    });
  }, 3000);
}

/* ============================================================
   TOGGLE PANEL
   ============================================================ */
function togglePanel() {
  isOpen = !isOpen;
  gcPanel.classList.toggle("open", isOpen);
  gcToggle.style.transform   = isOpen ? "scale(0) translateY(20px)" : "";
  gcToggle.style.opacity     = isOpen ? "0" : "";
  gcToggle.style.pointerEvents = isOpen ? "none" : "";
  if (isOpen) {
    unreadCount = 0; hideBadge();
    setTimeout(scrollBottom, 60);
    setTimeout(() => gcInput?.focus(), 400);
  } else {
    setTimeout(() => {
      gcToggle.style.transition = "transform .4s cubic-bezier(.34,1.56,.64,1), opacity .3s ease";
      gcToggle.style.transform  = "";
      gcToggle.style.opacity    = "";
      gcToggle.style.pointerEvents = "";
    }, 50);
  }
}

document.addEventListener("keydown", e => {
  if (e.key === "Escape" && isOpen) { togglePanel(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); togglePanel(); }
});

/* ============================================================
   SCROLL
   ============================================================ */
function scrollBottom() {
  gcMsgs.scrollTop = gcMsgs.scrollHeight;
  isAtBottom = true;
  gcScrollBtn.classList.remove("show");
  hideBadge(); unreadCount = 0;
}

/* ============================================================
   BUILD LEVEL BADGE HTML
   ============================================================ */
function buildLevelBadge(level) {
  const lv  = parseInt(level) || 1;
  const inf = getLevelInfo(lv);
  return `<span class="gc-lvl-badge" style="
    background: ${inf.color}18;
    border-color: ${inf.color}35;
    color: ${inf.color};
  "><span class="lvl-icon">${inf.icon}</span>Lv.${lv}</span>`;
}

/* ============================================================
   BUILD MESSAGE
   ============================================================ */
function buildMsg(m, optimistic = false) {
  const mine   = !!(currentUser && m.user_id === currentUser.id);
  const name   = m.profiles?.username || "Anonim";
  const isAdm  = m.profiles?.role === "admin" || ADMIN_EMAILS.includes(m.profiles?.email);
  const isAnn  = !!m.is_announcement;
  const level  = parseInt(m.profiles?.level) || 1;
  const lvInf  = getLevelInfo(level);

  const el = document.createElement("div");
  el.className = "gc-msg" + (mine?" mine":"") + (m.is_pinned?" pin-hl":"");
  el.id = "gcm-" + m.id;

  /* Context menu */
  el.addEventListener("contextmenu", e => { e.preventDefault(); showCtx(e, m); });
  let longTimer;
  el.addEventListener("touchstart", ev => {
    const touch = ev.touches?.[0];
    longTimer = setTimeout(() => showCtx({
      clientX: touch?.clientX ?? el.getBoundingClientRect().left + 40,
      clientY: touch?.clientY ?? el.getBoundingClientRect().top,
    }, m), 500);
  }, { passive: true });
  el.addEventListener("touchend",  () => clearTimeout(longTimer), { passive: true });
  el.addEventListener("touchmove", () => clearTimeout(longTimer), { passive: true });

  /* ── Avatar ── */
  const av = document.createElement("div");
  av.className = "gc-av";

  const avInner = document.createElement("div");
  avInner.className = "gc-av-inner";
  avInner.style.background = strColor(m.user_id);

  if (m.profiles?.avatar_url) {
    const initial = esc((name[0] || "?").toUpperCase());
    avInner.innerHTML = `<img src="${esc(m.profiles.avatar_url)}" loading="lazy"
      onerror="this.parentElement.innerHTML='${initial}'">`;
  } else {
    avInner.textContent = (name[0] || "?").toUpperCase();
  }

  /* Level ring */
  const avRing = document.createElement("div");
  avRing.className = "gc-av-ring";
  avRing.style.borderColor = lvInf.ring;
  avRing.style.boxShadow   = `0 0 8px ${lvInf.glow}`;

  av.appendChild(avRing);
  av.appendChild(avInner);

  /* ── Body ── */
  const body = document.createElement("div");
  body.className = "gc-body";

  const prevMsg     = messages[messages.indexOf(m) - 1];
  const isNewSender = !prevMsg
    || prevMsg.user_id !== m.user_id
    || (new Date(m.created_at) - new Date(prevMsg.created_at)) > 5 * 60 * 1000;
  if (isNewSender) el.classList.add("new-sender");

  /* Meta row (name + badges) */
  if (!isAnn) {
    const meta = document.createElement("div");
    meta.className = "gc-meta" + (isNewSender ? "" : " hidden");
    meta.innerHTML = `
      <span class="gc-name${isAdm?" adm":""}">${esc(name)}</span>
      ${buildLevelBadge(level)}
      ${isAdm ? `<span class="gc-adm-badge">Admin</span>` : ""}
      ${m.is_pinned ? `<span style="font-size:10px;margin-left:1px;">📌</span>` : ""}`;
    body.appendChild(meta);
  }

  /* Bubble */
  const bubble = document.createElement("div");
  if (isAnn) {
    bubble.className = "gc-bubble ann";
    const icons = { info:"ℹ️", warning:"⚠️", success:"✅", update:"🚀" };
    bubble.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
        <span>${icons[m.ann_type]||"📢"}</span>
        <strong style="font-size:13px;color:#e8522a;">${esc(m.ann_title||"Pengumuman")}</strong>
      </div>
      <div>${fmtText(m.message)}</div>
      <div style="font-size:10px;color:#555;margin-top:5px;">${fmtTime(m.created_at)} · ${esc(name)}</div>`;
  } else {
    bubble.className = "gc-bubble" + (!isNewSender?" cont":"") + (optimistic?" optimistic":"");
    let html = "";
    if (m.reply_preview) {
      html += `<div class="gc-reply-prev">↩️ ${esc(m.reply_preview)}</div>`;
    }
    html += fmtText(m.message);
    if (m.page_url) {
      const path = m.page_url.replace(/^https?:\/\/[^/]+/,"") || "/";
      html += `<br><a class="gc-loc" href="${esc(m.page_url)}" target="_blank">📍 ${esc(path)}</a>`;
    }
    html += `<span class="gc-ts">${fmtTime(m.created_at)}</span>`;
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
      b.innerHTML = `${emoji} <span>${cnt}</span>`;
      b.onclick = () => addReaction(m.id, emoji);
      rxRow.appendChild(b);
    });
    body.appendChild(rxRow);
  }

  if (!isNewSender) av.classList.add("hidden");
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
   LOAD MESSAGES — fetch profiles with level data
   ============================================================ */
async function loadMessages() {
  const skel  = $("gc-skeleton");
  const errEl = $("gc-load-error");

  let { data: chatData, error: chatErr } = await supabase
    .from("global_chat")
    .select("id,user_id,message,is_pinned,is_announcement,ann_title,ann_type,page_url,reply_to,reply_preview,reactions,created_at")
    .order("created_at", { ascending: true })
    .limit(80);

  if (skel) skel.remove();

  if (chatErr) {
    console.error("[GC] loadMessages error:", chatErr);
    if (errEl) errEl.style.display = "flex";
    return;
  }
  if (errEl) errEl.style.display = "none";

  chatData = chatData || [];

  /* Batch-load profiles — include level & total_chapters_read for badges */
  const userIds = [...new Set(chatData.map(m => m.user_id).filter(Boolean))];
  let profileMap = {};
  if (userIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id,username,avatar_url,role,level,total_chapters_read")
      .in("id", userIds);
    (profs || []).forEach(p => { profileMap[p.id] = p; });
  }

  messages = chatData.map(m => ({ ...m, profiles: profileMap[m.user_id] || null }));

  renderAll();
  loadPinned();
  scrollBottom();
}

window.__gcReload = () => loadMessages();

/* ============================================================
   LOAD PINNED
   ============================================================ */
async function loadPinned() {
  const box = $("gc-pinned");
  if (!box) return;
  const { data } = await supabase
    .from("global_chat")
    .select("id,message,is_announcement,ann_title,ann_type")
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
      el.innerHTML = `<span style="font-size:12px;">📌</span><span class="gc-pin-text">${esc(m.message||"")}</span>`;
      el.onclick = () => $("gcm-"+m.id)?.scrollIntoView({ behavior:"smooth", block:"center" });
      box.appendChild(el);
    }
  });
}

/* ============================================================
   ONLINE COUNT & PRESENCE
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

async function updatePresence() {
  if (!currentUser) return;
  await supabase.from("profiles")
    .update({ last_seen: new Date().toISOString() })
    .eq("id", currentUser.id);
}

/* ============================================================
   APPEND NEW MSG (realtime)
   ============================================================ */
function appendNewMsg(m) {
  if ($("gcm-" + m.id)) return;
  messages.push(m);

  const msgDate   = dateLabel(m.created_at);
  const todayStr  = todayLabel();
  const label     = msgDate === todayStr ? "Hari ini" : msgDate;
  const seps      = gcMsgs.querySelectorAll(".gc-date-sep");
  const lastLabel = seps.length ? seps[seps.length-1].textContent.trim() : "";
  if (label !== lastLabel) gcMsgs.appendChild(makeDateSep(label));

  gcMsgs.appendChild(buildMsg(m));
  if (m.is_pinned || m.is_announcement) loadPinned();

  if (isAtBottom && isOpen) {
    scrollBottom();
  } else {
    unreadCount++;
    showBadge(unreadCount);
  }
}

/* ============================================================
   REALTIME — fetch level on new message too
   ============================================================ */
function setupRealtime() {
  realtimeChannel = supabase
    .channel("gc_realtime_v5", { config: { broadcast: { self: true } } })

    .on("broadcast", { event: "new_msg" }, ({ payload }) => {
      if (payload?.msg) appendNewMsg(payload.msg);
    })

    .on("broadcast", { event: "typing" }, ({ payload }) => {
      if (!payload?.userId || payload.userId === currentUser?.id) return;
      const existing = typingUsers.get(payload.userId);
      if (existing) clearTimeout(existing.timer);
      const timer = setTimeout(() => {
        typingUsers.delete(payload.userId);
        updateTypingUI();
      }, 4000);
      typingUsers.set(payload.userId, { name: payload.name || "Seseorang", timer });
      updateTypingUI();
    })
    .on("broadcast", { event: "typing_stop" }, ({ payload }) => {
      if (!payload?.userId) return;
      const u = typingUsers.get(payload.userId);
      if (u) clearTimeout(u.timer);
      typingUsers.delete(payload.userId);
      updateTypingUI();
    })

    .on("postgres_changes", { event:"INSERT", schema:"public", table:"global_chat" }, async p => {
      if ($("gcm-" + p.new.id)) return;
      const { data: prof } = await supabase.from("profiles")
        .select("username,avatar_url,role,level,total_chapters_read")
        .eq("id", p.new.user_id).maybeSingle();
      appendNewMsg({ ...p.new, profiles: prof || null });
    })
    .on("postgres_changes", { event:"DELETE", schema:"public", table:"global_chat" }, p => {
      $("gcm-" + p.old.id)?.remove();
      messages = messages.filter(x => x.id !== p.old.id);
    })
    .on("postgres_changes", { event:"UPDATE", schema:"public", table:"global_chat" }, p => {
      loadPinned();
      const el = $("gcm-" + p.new.id);
      if (el) {
        const m = messages.find(x => x.id === p.new.id);
        if (m) { Object.assign(m, p.new); el.replaceWith(buildMsg(m)); }
      }
    })
    .subscribe(status => {
      if (status !== "SUBSCRIBED") console.log("[GC] realtime:", status);
    });
}

/* ============================================================
   SEND
   ============================================================ */
async function sendMsg() {
  if (!currentUser) return;
  const text = gcInput.value.trim();
  if (!text) return;

  const now = Date.now();
  if (now - lastSentAt < SEND_COOLDOWN) {
    const sisa = Math.ceil((SEND_COOLDOWN - (now - lastSentAt)) / 1000);
    showSendError(`Harap tunggu ${sisa} detik sebelum kirim lagi.`);
    return;
  }
  lastSentAt = now;

  /* Optimistic */
  const tempId = "opt-" + Date.now();
  const optMsg = {
    id: tempId,
    user_id: currentUser.id,
    message: text,
    created_at: new Date().toISOString(),
    is_pinned: false, is_announcement: false,
    page_url: null, reply_to: null, reply_preview: null, reactions: {},
    profiles: myProfile,
  };
  if (replyingTo) {
    optMsg.reply_to      = replyingTo.id;
    optMsg.reply_preview = (replyingTo.message || "").slice(0, 60);
  }
  messages.push(optMsg);

  const todayStr  = todayLabel();
  const label     = dateLabel(optMsg.created_at) === todayStr ? "Hari ini" : dateLabel(optMsg.created_at);
  const seps      = gcMsgs.querySelectorAll(".gc-date-sep");
  const lastLabel = seps.length ? seps[seps.length-1].textContent.trim() : "";
  if (label !== lastLabel) gcMsgs.appendChild(makeDateSep(label));
  gcMsgs.appendChild(buildMsg(optMsg, true));
  scrollBottom();

  gcInput.value = "";
  gcInput.style.height = "auto";
  gcChar.textContent = String(MAX_CHARS);
  gcChar.classList.remove("warn");
  const savedReply = replyingTo;
  cancelReply();
  gcSend.disabled = true;

  const payload = {
    user_id: currentUser.id,
    message: text,
    is_pinned: false, is_announcement: false, page_url: null,
  };
  if (savedReply) {
    payload.reply_to      = savedReply.id;
    payload.reply_preview = (savedReply.message || "").slice(0, 60);
  }

  const { data: inserted, error } = await supabase
    .from("global_chat")
    .insert(payload)
    .select("id,user_id,message,is_pinned,is_announcement,ann_title,ann_type,page_url,reply_to,reply_preview,reactions,created_at")
    .maybeSingle();

  $("gcm-" + tempId)?.remove();
  messages = messages.filter(x => x.id !== tempId);

  if (error) {
    console.error("[GC] sendMsg error:", error);
    showSendError("Gagal kirim: " + (error.message || "Periksa koneksi."));
  } else if (inserted) {
    const fullMsg = { ...inserted, profiles: myProfile || null };
    realtimeChannel?.send({ type:"broadcast", event:"new_msg", payload: { msg: fullMsg } });
  }

  gcSend.disabled = false;
  gcInput.focus();
}

/* ============================================================
   SEND LOCATION
   ============================================================ */
async function sendLocation() {
  if (!currentUser) return;
  const { error } = await supabase.from("global_chat").insert({
    user_id: currentUser.id,
    message: "Sedang di halaman ini 👇",
    page_url: window.location.href,
  });
  if (error) showSendError("Gagal kirim lokasi: " + error.message);
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
  gcChar.textContent = String(left);
  gcChar.classList.toggle("warn", left < 50);
  gcSend.disabled = gcInput.value.trim().length === 0;
  if (currentUser && gcInput.value.trim()) broadcastTyping();
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

  const any = [gcCtxPin,gcCtxUnpin,gcCtxReply,gcCtxDel].some(el => el.style.display !== "none");
  if (!any) return;

  gcCtx.classList.add("show");

  requestAnimationFrame(() => {
    const menuW = gcCtx.offsetWidth  || 160;
    const menuH = gcCtx.offsetHeight || 150;
    const vw = window.innerWidth, vh = window.innerHeight;
    let cx = e.clientX || (e.touches?.[0]?.clientX) || vw/2;
    let cy = e.clientY || (e.touches?.[0]?.clientY) || vh/2;
    gcCtx.style.left = Math.max(8, Math.min(cx, vw - menuW - 8)) + "px";
    gcCtx.style.top  = Math.max(8, Math.min(cy, vh - menuH - 8)) + "px";
  });
}

async function ctxPin()   { if (!ctxTarget||!isAdmin) return; await supabase.from("global_chat").update({is_pinned:true}).eq("id",ctxTarget.id); gcCtx.classList.remove("show"); }
async function ctxUnpin() { if (!ctxTarget||!isAdmin) return; await supabase.from("global_chat").update({is_pinned:false}).eq("id",ctxTarget.id); gcCtx.classList.remove("show"); }

function ctxReply() {
  if (!ctxTarget) return;
  replyingTo = ctxTarget;
  const name = ctxTarget.profiles?.username || "Anonim";
  gcReplyTxt.innerHTML = `<strong style="color:#9090d0">${esc(name)}</strong>: ${esc((ctxTarget.message||"").slice(0,50))}`;
  gcReplyBar.classList.add("show");
  gcCtx.classList.remove("show");
  gcInput.focus();
}

async function ctxDelete() {
  if (!ctxTarget) return;
  if (!confirm("Hapus pesan ini?")) return;
  const { error } = await supabase.from("global_chat").delete().eq("id", ctxTarget.id);
  if (error) showSendError("Gagal hapus pesan.");
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
  if (!m || !currentUser) return;
  const reactions = { ...(m.reactions || {}) };
  reactions[emoji] = (reactions[emoji] || 0) + 1;
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
    gcEmojiBtn.classList.toggle("on",   emojiOpen);
  });

  gcLocBtn.addEventListener("click", sendLocation);
  gcReplyCancel.addEventListener("click", cancelReply);

  gcMsgs.addEventListener("scroll", () => {
    const dist = gcMsgs.scrollHeight - gcMsgs.scrollTop - gcMsgs.clientHeight;
    isAtBottom = dist < 80;
    gcScrollBtn.classList.toggle("show", dist > 200);
    if (isAtBottom) { unreadCount = 0; hideBadge(); }
  }, { passive: true });

  gcScrollBtn.addEventListener("click", scrollBottom);

  document.addEventListener("click", e => {
    if (!gcCtx.contains(e.target)) gcCtx.classList.remove("show");
  });

  gcCtxPin.addEventListener("click",    ctxPin);
  gcCtxUnpin.addEventListener("click",  ctxUnpin);
  gcCtxReply.addEventListener("click",  ctxReply);
  gcCtxDel.addEventListener("click",    ctxDelete);
}

/* ============================================================
   INIT
   ============================================================ */
async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  currentUser = session?.user || null;

  if (currentUser) {
    const meta       = currentUser.user_metadata || {};
    const autoName   = meta.full_name || meta.name || meta.preferred_username || currentUser.email?.split("@")[0] || "User";
    const autoAvatar = meta.avatar_url || meta.picture || null;

    let { data: p } = await supabase
      .from("profiles")
      .select("username,avatar_url,role,is_banned,level,total_chapters_read")
      .eq("id", currentUser.id)
      .maybeSingle();

    if (!p || !p.username) {
      const { data: upserted } = await supabase
        .from("profiles")
        .upsert({ id: currentUser.id, username: autoName, avatar_url: autoAvatar, role: "user" },
                { onConflict: "id", ignoreDuplicates: false })
        .select("username,avatar_url,role,is_banned,level,total_chapters_read")
        .maybeSingle();
      p = upserted || p;
    }

    if (!p) p = { username: autoName, avatar_url: autoAvatar, role: "user", is_banned: false, level: 1, total_chapters_read: 0 };

    myProfile = p;
    isAdmin   = ADMIN_EMAILS.includes(currentUser.email) || p?.role === "admin";

    if (p?.is_banned) {
      $("gc-input-wrap").innerHTML = `
        <p style="text-align:center;padding:14px;color:#e74c3c;font-size:13px;
           font-family:'Nunito',sans-serif;font-weight:800;">🚫 Kamu dibanned dari chat.</p>`;
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

  /* Refresh timestamp tiap menit */
  setInterval(() => {
    gcMsgs.querySelectorAll(".gc-ts").forEach(el => {
      const msgId = el.closest(".gc-msg")?.id?.replace("gcm-","");
      const m     = messages.find(x => String(x.id) === msgId);
      if (m) el.textContent = fmtTime(m.created_at);
    });
  }, 60000);
}

init().catch(err => console.error("[GC] init error:", err));
