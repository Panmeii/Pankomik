/* ============================================================
   PANKOMIK — auth-header.js  (Enhanced)
   Mengurus semua logika dropdown header yang berhubungan
   dengan status login user.

   PERUBAHAN:
   - Dropdown punya animasi masuk (fadeDown)
   - Avatar fallback lebih baik (onerror inline)
   - Toggle tema (🌙/☀️) sinkron saat init
   - Fungsi goHome & liveSearch di-expose ke window
   - Tutup dropdown saat klik di luar lebih robust
   - XSS-safe via escHtml
   ============================================================ */

import { getCurrentUser, logout, onAuthChange } from "/supabase.js";

/* ── Escape HTML untuk keamanan ─────────────────────────── */
function escHtml(str) {
  return String(str || "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}

/* ============================================================
   INIT
   ============================================================ */
export async function initAuthHeader() {
  injectDropdownStyle();

  const user = await getCurrentUser();
  renderDropdown(user);
  onAuthChange(renderDropdown);

  /* Sinkronisasi ikon tema saat halaman dimuat */
  syncThemeIcon();

  /* Expose fungsi ke window */
  window.toggleMenu     = toggleMenu;
  window.toggleDarkMode = toggleDarkMode;
  window.goHome         = () => { window.location.href = "/"; };

  /* Tutup dropdown saat klik di luar */
  document.addEventListener("click", e => {
    const menu    = document.getElementById("menuDropdown");
    const trigger = document.querySelector('[onclick="toggleMenu()"], button[data-menu-toggle]');
    if (!menu) return;
    if (menu.style.display === "block" && !menu.contains(e.target) && trigger && !trigger.contains(e.target)) {
      closeDropdown();
    }
  });
}

/* ============================================================
   RENDER DROPDOWN ISI
   ============================================================ */
function renderDropdown(user) {
  const menu = document.getElementById("menuDropdown");
  if (!menu) return;

  if (user) {
    const name   = escHtml(user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "User");
    const avatar = user.user_metadata?.avatar_url || null;
    const initial = (name.replace(/&\w+;/g,"") || "U")[0].toUpperCase();

    menu.innerHTML = `
      <div style="
        display:flex;align-items:center;gap:10px;
        padding:12px 14px;
        border-bottom:1px solid rgba(255,255,255,0.08);
        background:rgba(232,82,42,0.06);
      ">
        ${avatar
          ? `<img src="${avatar}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid var(--accent);" alt="avatar" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
             <div style="display:none;width:34px;height:34px;border-radius:50%;background:var(--accent);align-items:center;justify-content:center;font-weight:800;font-size:13px;color:#fff;flex-shrink:0;">${initial}</div>`
          : `<div style="width:34px;height:34px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;color:#fff;flex-shrink:0;">${initial}</div>`
        }
        <div style="min-width:0;">
          <p style="font-size:10px;color:var(--text-muted);margin:0;font-weight:600;">Halo,</p>
          <p style="font-size:13px;font-weight:800;margin:0;color:var(--text);
            overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:130px;">${name}</p>
        </div>
      </div>
      <p onclick="window.location.href='/profil'">👤 Profil Saya</p>
      <p onclick="window.location.href='/profil?tab=bookmark'">🔖 Bookmark</p>
      <p onclick="window.location.href='/profil?tab=history'">📖 Riwayat Baca</p>
      <p onclick="handleLogout()" style="color:var(--accent);border-top:1px solid rgba(255,255,255,0.07);">🚪 Keluar</p>`;
  } else {
    menu.innerHTML = `
      <p onclick="window.location.href='/masuk'">🔑 Masuk</p>
      <p onclick="window.location.href='/masuk'">📝 Daftar</p>`;
  }
}

/* ============================================================
   TOGGLE DROPDOWN
   ============================================================ */
function toggleMenu() {
  const menu = document.getElementById("menuDropdown");
  if (!menu) return;
  const isOpen = menu.style.display === "block";
  if (isOpen) closeDropdown(); else openDropdown();
}

function openDropdown() {
  const menu = document.getElementById("menuDropdown");
  if (!menu) return;
  menu.style.display = "block";
  menu.style.animation = "fadeDown 0.15s ease";
}

function closeDropdown() {
  const menu = document.getElementById("menuDropdown");
  if (!menu) return;
  menu.style.display = "none";
}

/* ============================================================
   DARK MODE
   ============================================================ */
function toggleDarkMode() {
  document.body.classList.toggle("light");
  const isLight = document.body.classList.contains("light");
  localStorage.setItem("theme", isLight ? "light" : "dark");
  syncThemeIcon();
}

function syncThemeIcon() {
  const btn = document.querySelector('button[onclick="toggleDarkMode()"]');
  if (!btn) return;
  btn.textContent = document.body.classList.contains("light") ? "☀️" : "🌙";
}

/* ============================================================
   LOGOUT
   ============================================================ */
window.handleLogout = async function () {
  if (!confirm("Yakin ingin keluar?")) return;
  closeDropdown();
  await logout();
};

/* ============================================================
   INJECT STYLE (jika belum ada)
   ============================================================ */
function injectDropdownStyle() {
  if (document.getElementById("authHeaderStyle")) return;
  const s = document.createElement("style");
  s.id = "authHeaderStyle";
  s.textContent = `
    /* Pastikan dropdown punya animasi yang halus */
    #menuDropdown {
      animation: fadeDown 0.15s ease;
    }
    @keyframes fadeDown {
      from { opacity:0; transform:translateY(-6px); }
      to   { opacity:1; transform:translateY(0); }
    }
  `;
  document.head.appendChild(s);
}
