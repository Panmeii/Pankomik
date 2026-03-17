/* ============================================================
   PANKOMIK - script.js
   Logika untuk halaman index.html:
   - Fetch data dari API
   - Tampilkan kartu komik
   - Live search
   - Toggle dark mode & menu
   ============================================================ */

/* ---- URL API ---------------------------------------------- */
/* Semua endpoint API dikumpulkan di sini biar mudah diubah */
const apiURL    = "https://www.sankavollerei.com/comic/bacakomik/top";
const latestURL = "https://www.sankavollerei.com/comic/bacakomik/latest";
const rekomURL  = "https://www.sankavollerei.com/comic/bacakomik/recomen";

/* ============================================================
   FETCH DATA
   async/await: kita tunggu data dari server sebelum lanjut
   try/catch: kalau ada error (misal internet mati), tidak crash
   ============================================================ */

async function getTopKomik() {
  /* Tampilkan skeleton dulu */
  const container = document.getElementById("topKomik");
  container.innerHTML = Array(5).fill(`<div class="card skeleton skeleton-card"></div>`).join("");

  try {
    const res  = await fetch(apiURL);
    const data = await res.json();
    container.innerHTML = "";
    tampilkanKomik(data.komikList);
  } catch (err) {
    console.error("Gagal fetch Top Komik:", err);
    container.innerHTML = `<p style="padding:14px;color:var(--text-muted);font-size:13px;">Gagal memuat. Cek koneksi internet.</p>`;
  }
}

async function getKomikLatest() {
  const container = document.getElementById("komikLatest");
  container.innerHTML = Array(4).fill(`<div class="grid-card skeleton skeleton-grid"></div>`).join("");

  try {
    const res  = await fetch(latestURL);
    const data = await res.json();
    container.innerHTML = "";
    tampilkanLatest(data.komikList);
  } catch (err) {
    console.error("Gagal fetch Latest:", err);
    container.innerHTML = "";
  }
}

async function getKomikRekomen() {
  try {
    const res  = await fetch(rekomURL);
    const data = await res.json();
    tampilkanRekomen(data.komikList);
  } catch (err) {
    console.error("Gagal fetch Rekomendasi:", err);
  }
}

/* ============================================================
   RENDER: TOP KOMIK (slider horizontal, max 10)
   ============================================================ */
function tampilkanKomik(komikList) {
  const container = document.getElementById("topKomik");

  /* Ambil hanya 10 teratas */
  komikList.slice(0, 10).forEach((komik, index) => {
    /* Hapus query string dari URL cover supaya gambar lebih bersih */
    const coverHD = komik.cover.split("?")[0];

    const card = document.createElement("div");
    card.classList.add("card");

    card.innerHTML = `
      <div class="rank">#${index + 1}</div>
      <img src="${coverHD}" alt="${komik.title}" loading="lazy">
      <div class="info">
        <p>${komik.title}</p>
        <p>⭐ ${komik.rating}</p>
      </div>
    `;

    /* Klik kartu → buka halaman detail */
    card.onclick = () => {
      window.location.href = `detail.html?slug=${komik.slug}`;
    };

    container.appendChild(card);
  });
}

/* ============================================================
   RENDER: LATEST UPDATE (grid 2 kolom)
   ============================================================ */
function tampilkanLatest(komikList) {
  const container = document.getElementById("komikLatest");

  komikList.forEach(komik => {
    const coverHD = komik.cover.split("?")[0];

    const card = document.createElement("div");
    card.classList.add("grid-card");

    /*
      Badge tipe komik (manga/manhwa/manhua) menggunakan kelas CSS
      yang berbeda-beda warnanya → lihat style.css bagian .badge
    */
    card.innerHTML = `
      <div class="badge ${komik.type.toLowerCase()}">${komik.type}</div>
      <img src="${coverHD}" alt="${komik.title}" loading="lazy">
      <div class="grid-info">
        <p class="title">${komik.title}</p>
        <p>📖 ${komik.chapter}</p>
        <p>⏱️ ${komik.date}</p>
      </div>
    `;

    card.onclick = () => {
      window.location.href = `detail.html?slug=${komik.slug}`;
    };

    container.appendChild(card);
  });
}

/* ============================================================
   RENDER: REKOMENDASI (list vertikal)
   ============================================================ */
function tampilkanRekomen(komikList) {
  const container = document.getElementById("komikRekomen");

  komikList.forEach(komik => {
    const coverHD = komik.cover.split("?")[0];

    const card = document.createElement("div");
    card.classList.add("rekom-card");

    card.innerHTML = `
      <img src="${coverHD}" alt="${komik.title}" loading="lazy">
      <div class="rekom-info">
        <p class="title">${komik.title}</p>
        <p>⭐ ${komik.rating}</p>
        <p>🎭 ${komik.genre}</p>
      </div>
    `;

    card.onclick = () => {
      window.location.href = `detail.html?slug=${komik.slug}`;
    };

    container.appendChild(card);
  });
}

/* ============================================================
   NAVIGASI & UI
   ============================================================ */

/* Kembali ke halaman utama */
function goHome() {
  window.location.href = "index.html";
}

/* Ganti tema gelap ↔ terang, simpan pilihan ke localStorage */
function toggleDarkMode() {
  document.body.classList.toggle("light");

  /* localStorage: data tetap tersimpan walau browser ditutup */
  if (document.body.classList.contains("light")) {
    localStorage.setItem("theme", "light");
  } else {
    localStorage.setItem("theme", "dark");
  }
}

/* Klik di luar search → tutup hasil pencarian */
document.addEventListener("click", function (e) {
  const searchBox = document.getElementById("searchInput");
  const resultBox = document.getElementById("searchResult");

  if (searchBox && resultBox &&
      !searchBox.contains(e.target) && !resultBox.contains(e.target)) {
    resultBox.style.display = "none";
  }
});

/* ============================================================
   LIVE SEARCH
   Debounce 400ms: API tidak dipanggil setiap ketikan,
   hanya dipanggil setelah user berhenti mengetik 400ms
   ============================================================ */
let searchTimeout = null;

async function liveSearch() {
  const query     = document.getElementById("searchInput").value.trim();
  const resultBox = document.getElementById("searchResult");

  if (!query) { resultBox.style.display = "none"; return; }

  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    try {
      const url  = `https://www.sankavollerei.com/comic/bacakomik/search/${encodeURIComponent(query)}`;
      const res  = await fetch(url);
      const data = await res.json();
      tampilkanSearch(data.komikList);
    } catch (err) {
      console.error("Search error:", err);
    }
  }, 400);
}

function tampilkanSearch(list) {
  const resultBox = document.getElementById("searchResult");
  resultBox.innerHTML = "";
  if (!list || list.length === 0) { resultBox.style.display = "none"; return; }

  list.slice(0, 5).forEach(komik => {
    const coverHD = komik.cover.split("?")[0];
    const item    = document.createElement("div");
    item.classList.add("search-item");
    item.innerHTML = `
      <img src="${coverHD}" alt="${komik.title}" loading="lazy">
      <div>
        <p>${komik.title}</p>
        <p>⭐ ${komik.rating}</p>
      </div>`;
    item.onclick = () => { window.location.href = `detail.html?slug=${komik.slug}`; };
    resultBox.appendChild(item);
  });
  resultBox.style.display = "block";
}

/* ============================================================
   INIT: Jalankan saat halaman pertama dibuka
   ============================================================ */
window.onload = function () {
  const theme = localStorage.getItem("theme");
  if (theme === "light") {
    document.body.classList.add("light");
  }
  getTopKomik();
  getKomikLatest();
  getKomikRekomen();
  getGenreChips();

  /* Back to top */
  const btn = document.getElementById("backToTop");
  if (btn) {
    window.addEventListener("scroll", () => {
      btn.classList.toggle("visible", window.scrollY > 300);
    });
  }
};

/* ============================================================
   GENRE CHIPS (di index.html)
   ============================================================ */
async function getGenreChips() {
  const container = document.getElementById("genreChipsIndex");
  if (!container) return;

  try {
    const res  = await fetch("https://www.sankavollerei.com/comic/bacakomik/genres");
    const data = await res.json();
    const genres = (data.genres || []).filter(g => g.title.length >= 3);

    container.innerHTML = genres.slice(0, 20).map(g => `
      <button class="genre-chip-index"
        onclick="window.location.href='genre.html?genre=${encodeURIComponent(g.slug)}'">
        ${g.title}
      </button>
    `).join("") + `
      <button class="genre-chip-index"
        style="border-color:var(--accent);color:var(--accent);"
        onclick="window.location.href='genre.html'">
        Lainnya →
      </button>`;
  } catch (err) {
    console.error("Gagal fetch genre chips:", err);
    if (container) container.innerHTML = "";
  }
}

/* ============================================================
   TOAST UTILITY
   Panggil: showToast("Pesan!", "success"|"error"|"info")
   ============================================================ */
window.showToast = function(msg, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
};
