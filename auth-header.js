/* ============================================================
   PANKOMIK — auth-header.js
   Mengurus semua logika dropdown header yang berhubungan
   dengan status login user.

   Dipakai di: index.html, detail.html, reader.html

   Cara pakai di HTML:
   <script type="module">
     import { initAuthHeader } from "./auth-header.js";
     initAuthHeader();
   </script>
   ============================================================ */

import { getCurrentUser, logout, onAuthChange } from "./supabase.js";

/* ============================================================
   INIT — panggil ini satu kali di setiap halaman
   ============================================================ */
export async function initAuthHeader() {
  /* Cek siapa yang sedang login saat halaman dibuka */
  const user = await getCurrentUser();
  renderDropdown(user);

  /*
    onAuthChange: dipanggil otomatis kalau status login berubah
    (misal: token expired, atau user login di tab lain)
  */
  onAuthChange(renderDropdown);

  /* Pasang toggleMenu ke window agar bisa dipanggil dari onclick di HTML */
  window.toggleMenu = toggleMenu;
}

/* ============================================================
   RENDER ISI DROPDOWN
   Dipanggil ulang setiap kali status auth berubah
   ============================================================ */
function renderDropdown(user) {
  const menu = document.getElementById("menuDropdown");
  if (!menu) return;

  if (user) {
    /*
      User sudah login.
      Ambil nama dari: Google display name → atau bagian sebelum @ di email
    */
    const name = user.user_metadata?.full_name
      || user.user_metadata?.name
      || user.email?.split("@")[0]
      || "User";

    const avatar = user.user_metadata?.avatar_url || null;

    menu.innerHTML = `
      <!-- Info user di bagian atas dropdown -->
      <div style="
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 14px;
        border-bottom: 1px solid var(--border, rgba(255,255,255,0.08));
      ">
        ${avatar
          ? `<img src="${avatar}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;" alt="avatar">`
          : `<div style="width:32px;height:32px;border-radius:50%;background:var(--accent,#e8522a);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:#fff;">${name[0].toUpperCase()}</div>`
        }
        <div>
          <p style="font-size:11px;color:var(--text-muted,#888);margin:0;">Halo,</p>
          <p style="font-size:13px;font-weight:700;margin:0;color:var(--text,#fff);
            max-width:110px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">
            ${name}
          </p>
        </div>
      </div>

      <!-- Menu item -->
      <p onclick="window.location.href='/profil'">👤 Profil Saya</p>
      <p onclick="window.location.href='/profil?tab=bookmark'">🔖 Bookmark</p>
      <p onclick="window.location.href='/profil?tab=history'">📖 Riwayat Baca</p>

      <!-- Keluar (warna merah) -->
      <p
        onclick="handleLogout()"
        style="color:var(--accent,#e8522a);border-top:1px solid var(--border,rgba(255,255,255,0.08));"
      >🚪 Keluar</p>
    `;
  } else {
    /*
      User belum login.
      Tampilkan tombol Masuk dan Daftar yang mengarah ke auth.html
    */
    menu.innerHTML = `
      <p onclick="window.location.href='/masuk'">🔑 Masuk</p>
      <p onclick="window.location.href='/masuk'">📝 Daftar</p>
    `;
  }
}

/* ============================================================
   TOGGLE DROPDOWN — buka/tutup saat tombol 👤 diklik
   ============================================================ */
function toggleMenu() {
  const menu = document.getElementById("menuDropdown");
  if (!menu) return;

  const isOpen = menu.style.display === "block";
  menu.style.display = isOpen ? "none" : "block";
}

/* Tutup dropdown kalau user klik di luar area dropdown & tombol 👤 */
document.addEventListener("click", function (e) {
  const menu    = document.getElementById("menuDropdown");
  const trigger = document.querySelector('button[onclick="toggleMenu()"]');

  if (!menu) return;

  /* Kalau klik di luar dropdown DAN bukan tombol toggle → tutup */
  if (!menu.contains(e.target) && trigger && !trigger.contains(e.target)) {
    menu.style.display = "none";
  }
});

/* ============================================================
   LOGOUT
   window.handleLogout dipanggil dari onclick di dalam innerHTML
   ============================================================ */
window.handleLogout = async function () {
  const konfirmasi = confirm("Yakin ingin keluar?");
  if (!konfirmasi) return;

  await logout();
  /* logout() di supabase.js sudah redirect ke index.html */
};
