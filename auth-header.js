/* ============================================================
   PANKOMIK — auth-header.js  v4 Premium
   - Dropdown premium glassmorphism
   - Accent color dari localStorage diterapkan global
   - Avatar dengan ring warna level
   - Klik username/avatar → halaman profil publik user lain
   ============================================================ */

import { getCurrentUser, logout, onAuthChange } from "/supabase.js";

/* ── Escape HTML ─────────────────────────────────────────── */
function escHtml(str) {
  return String(str || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

/* ════════════════════════════════════════════════════════════
   ACCENT COLOR SYSTEM
   ════════════════════════════════════════════════════════════ */
export function applyAccentColor(hex) {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return;
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);

  /* Derive dark / light / glow from base */
  const dark  = `#${Math.max(0,r-46).toString(16).padStart(2,'0')}${Math.max(0,g-24).toString(16).padStart(2,'0')}${Math.max(0,b-24).toString(16).padStart(2,'0')}`;
  const light = `#${Math.min(255,r+30).toString(16).padStart(2,'0')}${Math.min(255,g+30).toString(16).padStart(2,'0')}${Math.min(255,b+30).toString(16).padStart(2,'0')}`;

  const root = document.documentElement;
  root.style.setProperty('--accent',       hex);
  root.style.setProperty('--accent-dark',  dark);
  root.style.setProperty('--accent-light', light);
  root.style.setProperty('--accent-glow',  `rgba(${r},${g},${b},0.28)`);
  root.style.setProperty('--accent-soft',  `rgba(${r},${g},${b},0.10)`);
}

export function loadSavedAccent() {
  const saved = localStorage.getItem("pankomik-accent");
  if (saved) applyAccentColor(saved);
}

/* ════════════════════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════════════════════ */
export async function initAuthHeader() {
  injectDropdownStyle();
  loadSavedAccent();

  const user = await getCurrentUser();
  renderDropdown(user);
  onAuthChange(renderDropdown);

  syncThemeIcon();

  window.toggleMenu     = toggleMenu;
  window.toggleDarkMode = toggleDarkMode;
  window.goHome         = () => { window.location.href = "/"; };
  window.liveSearch     = window.liveSearch || (() => {});

  /* Tutup dropdown klik di luar */
  document.addEventListener("click", e => {
    const menu    = document.getElementById("menuDropdown");
    const trigger = document.querySelector('[onclick="toggleMenu()"]');
    if (!menu) return;
    if (menu.style.display === "block" && !menu.contains(e.target) && trigger && !trigger.contains(e.target)) {
      closeDropdown();
    }
  });
}

/* ════════════════════════════════════════════════════════════
   RENDER DROPDOWN
   ════════════════════════════════════════════════════════════ */
function renderDropdown(user) {
  const menu = document.getElementById("menuDropdown");
  if (!menu) return;

  if (user) {
    const name    = escHtml(user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "User");
    const avatar  = user.user_metadata?.avatar_url || null;
    const initial = (name.replace(/&\w+;/g,"") || "U")[0].toUpperCase();
    const email   = escHtml(user.email || "");

    menu.innerHTML = `
      <!-- Profile header row -->
      <div class="dd-profile-row" onclick="window.location.href='/profil'">
        <div class="dd-avatar">
          ${avatar
            ? `<img src="${avatar}" alt="avatar" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
               <div class="dd-avatar-fallback" style="display:none;">${initial}</div>`
            : `<div class="dd-avatar-fallback">${initial}</div>`}
        </div>
        <div class="dd-info">
          <span class="dd-name">${name}</span>
          <span class="dd-email">${email}</span>
        </div>
        <span class="dd-arrow">›</span>
      </div>

      <!-- Menu items -->
      <div class="dd-items">
        <p onclick="window.location.href='/profil'"><span class="dd-icon">👤</span> Profil Saya</p>
        <p onclick="window.location.href='/profil?tab=bookmark'"><span class="dd-icon">🔖</span> Bookmark</p>
        <p onclick="window.location.href='/profil?tab=history'"><span class="dd-icon">📖</span> Riwayat Baca</p>
        <p onclick="window.location.href='/profil?tab=settings'"><span class="dd-icon">⚙️</span> Pengaturan & Tema</p>
        <p onclick="window.location.href='/fitur'"><span class="dd-icon">🚀</span> Fitur Pankomik</p>
        <p onclick="window.location.href='/support'" class="dd-support"><span class="dd-icon">☕</span> Dukung Pankomik</p>
        <p onclick="handleLogout()" class="dd-logout"><span class="dd-icon">🚪</span> Keluar</p>
      </div>`;
  } else {
    menu.innerHTML = `
      <div class="dd-guest">
        <div class="dd-guest-icon">👤</div>
        <p class="dd-guest-text">Masuk untuk pengalaman lebih baik</p>
      </div>
      <div class="dd-items">
        <p onclick="window.location.href='/masuk'"><span class="dd-icon">🔑</span> Masuk</p>
        <p onclick="window.location.href='/masuk'"><span class="dd-icon">📝</span> Daftar Akun</p>
        <p onclick="window.location.href='/fitur'"><span class="dd-icon">🚀</span> Fitur Pankomik</p>
        <p onclick="window.location.href='/support'" class="dd-support"><span class="dd-icon">☕</span> Dukung Pankomik</p>
      </div>`;
  }
}

/* ════════════════════════════════════════════════════════════
   TOGGLE
   ════════════════════════════════════════════════════════════ */
function toggleMenu() {
  const menu = document.getElementById("menuDropdown");
  if (!menu) return;
  menu.style.display === "block" ? closeDropdown() : openDropdown();
}

function openDropdown() {
  const menu = document.getElementById("menuDropdown");
  if (!menu) return;
  menu.style.display = "block";
  menu.style.animation = "dropIn 0.18s cubic-bezier(.34,1.56,.64,1)";
}

function closeDropdown() {
  const menu = document.getElementById("menuDropdown");
  if (!menu) return;
  menu.style.display = "none";
}

/* ════════════════════════════════════════════════════════════
   DARK MODE
   ════════════════════════════════════════════════════════════ */
function toggleDarkMode() {
  document.body.classList.toggle("light");
  localStorage.setItem("theme", document.body.classList.contains("light") ? "light" : "dark");
  syncThemeIcon();
}

function syncThemeIcon() {
  const btn = document.querySelector('button[onclick="toggleDarkMode()"]');
  if (btn) btn.textContent = document.body.classList.contains("light") ? "☀️" : "🌙";
}

/* ════════════════════════════════════════════════════════════
   LOGOUT
   ════════════════════════════════════════════════════════════ */
window.handleLogout = async function () {
  if (!confirm("Yakin ingin keluar?")) return;
  closeDropdown();
  await logout();
  window.location.href = "/";
};

/* ════════════════════════════════════════════════════════════
   INJECT STYLES
   ════════════════════════════════════════════════════════════ */
function injectDropdownStyle() {
  if (document.getElementById("authHeaderStyle")) return;
  const s = document.createElement("style");
  s.id = "authHeaderStyle";
  s.textContent = `
    #menuDropdown {
      font-family: 'Nunito', sans-serif;
    }

    /* Profile header in dropdown */
    .dd-profile-row {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 16px 12px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      cursor: pointer;
      transition: background 0.12s;
    }
    .dd-profile-row:hover { background: rgba(255,255,255,0.03); }

    .dd-avatar {
      width: 40px; height: 40px; border-radius: 50%; overflow: hidden; flex-shrink: 0;
      border: 2px solid var(--accent); position: relative;
    }
    .dd-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .dd-avatar-fallback {
      width: 100%; height: 100%;
      background: linear-gradient(135deg, var(--accent), var(--accent-dark));
      color: #fff; display: flex; align-items: center; justify-content: center;
      font-weight: 900; font-size: 16px;
    }

    .dd-info { flex: 1; min-width: 0; }
    .dd-name  { display: block; font-size: 13px; font-weight: 800; color: var(--text); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width: 120px; }
    .dd-email { display: block; font-size: 10px; color: var(--text-muted); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; max-width: 120px; margin-top: 1px; }
    .dd-arrow { font-size: 18px; color: var(--text-dim); flex-shrink: 0; }

    /* Guest block */
    .dd-guest { padding: 16px 16px 10px; text-align: center; }
    .dd-guest-icon { font-size: 32px; margin-bottom: 6px; }
    .dd-guest-text { font-size: 12px; color: var(--text-muted); font-weight: 600; line-height: 1.4; }

    /* Items */
    .dd-items {}
    .dd-items p {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 16px; cursor: pointer; font-size: 13px; font-weight: 700;
      color: var(--text); margin: 0;
      border-bottom: 1px solid var(--border);
      transition: background 0.12s, color 0.12s, padding-left 0.12s;
    }
    .dd-items p:last-child { border-bottom: none; }
    .dd-items p:hover { background: rgba(255,255,255,0.035); color: var(--accent); padding-left: 20px; }
    .dd-items p .dd-icon { font-size: 15px; flex-shrink: 0; width: 20px; text-align: center; }
    .dd-support { color: var(--accent2) !important; font-weight: 800 !important; }
    .dd-logout  { color: #e74c3c !important; }
    .dd-logout:hover { background: rgba(231,76,60,0.06) !important; color: #e74c3c !important; }

    @keyframes dropIn {
      from { opacity: 0; transform: translateY(-10px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
  `;
  document.head.appendChild(s);
}
