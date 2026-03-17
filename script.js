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
  try {
    const res  = await fetch(apiURL);
    const data = await res.json();
    tampilkanKomik(data.komikList);
  } catch (err) {
    console.error("Gagal fetch Top Komik:", err);
  }
}

async function getKomikLatest() {
  try {
    const res  = await fetch(latestURL);
    const data = await res.json();
    tampilkanLatest(data.komikList);
  } catch (err) {
    console.error("Gagal fetch Latest:", err);
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

/* Buka/tutup dropdown menu user */
function toggleMenu() {
  const menu = document.getElementById("menuDropdown");
  /* Kalau sedang tampil → sembunyikan, dan sebaliknya */
  menu.style.display = menu.style.display === "block" ? "none" : "block";
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

/* Tutup dropdown kalau klik di luar area dropdown */
document.addEventListener("click", function (e) {
  const menu = document.getElementById("menuDropdown");
  const btnUser = document.querySelector(".header-right button:last-child");

  if (!menu.contains(e.target) && !btnUser.contains(e.target)) {
    menu.style.display = "none";
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

  /* Kalau input kosong, sembunyikan hasil */
  if (!query) {
    resultBox.style.display = "none";
    return;
  }

  /* Batalkan timer sebelumnya biar tidak spam API */
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

  if (!list || list.length === 0) {
    resultBox.style.display = "none";
    return;
  }

  /* Tampilkan maks 5 hasil */
  list.slice(0, 5).forEach(komik => {
    const coverHD = komik.cover.split("?")[0];

    const item = document.createElement("div");
    item.classList.add("search-item");

    item.innerHTML = `
      <img src="${coverHD}" alt="${komik.title}" loading="lazy">
      <div>
        <p>${komik.title}</p>
        <p>⭐ ${komik.rating}</p>
      </div>
    `;

    item.onclick = () => {
      window.location.href = `detail.html?slug=${komik.slug}`;
    };

    resultBox.appendChild(item);
  });

  resultBox.style.display = "block";
}

/* Klik di luar search → tutup hasil pencarian */
document.addEventListener("click", function (e) {
  const searchBox = document.getElementById("searchInput");
  const resultBox = document.getElementById("searchResult");

  if (!searchBox.contains(e.target) && !resultBox.contains(e.target)) {
    resultBox.style.display = "none";
  }
});

/* ============================================================
   INIT: Jalankan saat halaman pertama dibuka
   ============================================================ */
window.onload = function () {
  /* Terapkan tema yang sudah disimpan sebelumnya */
  const theme = localStorage.getItem("theme");
  if (theme === "light") {
    document.body.classList.add("light");
  }

  /* Fetch semua data */
  getTopKomik();
  getKomikLatest();
  getKomikRekomen();
};
