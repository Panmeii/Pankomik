/* ============================================================
   PANKOMIK — reader.js  (Fase 2)
   Fitur baru:
   ✅ Auto-save riwayat baca ke Supabase saat chapter dimuat
   ✅ Update reading progress
   ============================================================ */

import { getCurrentUser, saveHistory, updateProgress } from "./supabase.js";

const API  = "https://www.sankavollerei.com/comic/bacakomik/chapter/";
const slug = new URLSearchParams(window.location.search).get("slug");

if (!slug) window.location.href = "index.html";

let autoScrollInterval = null;
let nextSlug           = null;
let prevSlug           = null;
let currentUser        = null;
let historyWasSaved    = false;

/* ============================================================
   INIT
   ============================================================ */
window.addEventListener("DOMContentLoaded", async () => {
  currentUser = await getCurrentUser();
  await loadChapter();
});

/* ============================================================
   FETCH & RENDER CHAPTER
   ============================================================ */
async function loadChapter() {
  try {
    const res  = await fetch(API + slug);
    const data = await res.json();

    document.title = `${data.title} — Pankomik`;
    document.getElementById("title").innerText = data.title;

    nextSlug = data.navigation?.next || null;
    prevSlug = data.navigation?.prev || null;

    document.getElementById("nextBtn").style.display = nextSlug ? "inline-block" : "none";
    document.getElementById("prevBtn").style.display = prevSlug ? "inline-block" : "none";

    renderImages(data.images);

    /* Auto-save riwayat kalau sudah login, tidak blocking render */
    if (currentUser && !historyWasSaved) {
      historyWasSaved = true;
      autoSaveHistory(data); /* sengaja tidak await agar tidak delay tampilan */
    }

  } catch (err) {
    console.error("Gagal load chapter:", err);
    document.getElementById("reader").innerHTML = `
      <div style="padding:60px 20px;text-align:center;color:#888">
        <p style="font-size:32px">😕</p><p>Gagal memuat chapter.</p>
        <button onclick="location.reload()" style="margin-top:12px;padding:8px 18px;
          background:#e8522a;color:#fff;border:none;border-radius:8px;cursor:pointer;">
          Coba Lagi
        </button>
      </div>`;
  }
}

function renderImages(images) {
  const container = document.getElementById("reader");
  container.innerHTML = "";
  const savedWidth = localStorage.getItem("imgWidth") || 100;
  document.getElementById("width").value = savedWidth;

  images.forEach((src, i) => {
    const img   = document.createElement("img");
    img.src     = src;
    img.loading = i < 3 ? "eager" : "lazy";
    img.style.width = savedWidth + "%";
    container.appendChild(img);
  });
}

/* ============================================================
   AUTO-SAVE RIWAYAT BACA
   Dipanggil sekali setelah chapter berhasil dimuat.

   Cara ekstrak info komik dari slug chapter:
   Slug:  "one-piece-chapter-1050"
   Komik: "one-piece"            (hapus "-chapter-XX")
   Nomor: "1050"                 (regex dari slug)
   ============================================================ */
async function autoSaveHistory(data) {
  const match         = slug.match(/chapter-(\d+)/i);
  const chapterNumber = match ? match[1] : "?";
  const komikSlug     = slug.replace(/-chapter-\d+.*/i, "");
  const komikTitle    = data.title.replace(/\s*chapter\s*\d+.*/i, "").trim();

  /* Simpan ke reading_history */
  await saveHistory(
    currentUser.id,
    { slug: komikSlug, title: komikTitle, cover: "" },
    { slug: slug, number: chapterNumber }
  );

  /* Update reading_progress */
  await updateProgress(
    currentUser.id,
    { slug: komikSlug, title: komikTitle, lastChapterSlug: slug },
    0 /* total chapters — diupdate saat user buka halaman detail */
  );
}

/* ============================================================
   NAVIGASI
   ============================================================ */
window.nextChapter = () => { if (nextSlug) window.location.href = `reader.html?slug=${nextSlug}`; };
window.prevChapter = () => { if (prevSlug) window.location.href = `reader.html?slug=${prevSlug}`; };
window.goHome      = () => { window.location.href = "index.html"; };

window.toggleMenu = function () {
  const m = document.getElementById("menuDropdown");
  if (m) m.style.display = m.style.display === "block" ? "none" : "block";
};

/* ============================================================
   SETTINGS
   ============================================================ */
window.toggleSettings = function () {
  document.getElementById("settings").classList.toggle("active");
};

document.addEventListener("click", e => {
  const panel = document.getElementById("settings");
  const btn   = document.querySelector('button[onclick="toggleSettings()"]');
  if (panel?.classList.contains("active")
      && !panel.contains(e.target) && !btn?.contains(e.target)) {
    panel.classList.remove("active");
  }
});

/* ============================================================
   LEBAR GAMBAR
   ============================================================ */
document.getElementById("width")?.addEventListener("input", e => {
  const val = e.target.value;
  document.querySelectorAll("#reader img").forEach(img => img.style.width = val + "%");
  localStorage.setItem("imgWidth", val);
});

/* ============================================================
   AUTO SCROLL
   ============================================================ */
window.toggleAutoScroll = function () {
  const btn = document.getElementById("autoBtn");
  if (autoScrollInterval) {
    clearInterval(autoScrollInterval);
    autoScrollInterval = null;
    btn.textContent = "▶️ Mulai Auto Scroll";
    btn.classList.remove("running");
    return;
  }
  const speed = parseInt(document.getElementById("speed").value);
  autoScrollInterval = setInterval(() => {
    window.scrollBy(0, speed);
    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 10) {
      clearInterval(autoScrollInterval);
      autoScrollInterval = null;
      btn.textContent = "▶️ Mulai Auto Scroll";
      btn.classList.remove("running");
    }
  }, 30);
  btn.textContent = "⏹️ Stop";
  btn.classList.add("running");
};

/* ============================================================
   HEADER AUTO-HIDE
   ============================================================ */
const readerHeader = document.querySelector(".reader-header");
let   scrollTimer  = null;

window.addEventListener("scroll", () => {
  readerHeader?.classList.add("hide");
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => readerHeader?.classList.remove("hide"), 1500);
});

document.getElementById("reader")?.addEventListener("click", () => {
  readerHeader?.classList.toggle("hide");
});
