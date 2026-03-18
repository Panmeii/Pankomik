/* ============================================================
   PANKOMIK - script.js
   Update Terbaru pakai API komikindo dengan pagination:
   https://www.sankavollerei.com/comic/komikindo/latest/{page}
   ============================================================ */

/* ---- URL API ---------------------------------------------- */
const apiURL    = "https://www.sankavollerei.com/comic/bacakomik/top";
const latestURL = "https://www.sankavollerei.com/comic/komikindo/latest";
const rekomURL  = "https://www.sankavollerei.com/comic/bacakomik/recomen";

/* ---- Pretty URL helpers ----------------------------------- */
function komikURL(slug)              { return `/komik/${slug}`; }
function readerURL(chSlug, komikSlug) { return komikSlug ? `/komik/${komikSlug}/${chSlug}` : `/baca/${chSlug}`; }

/* ---- Helper: ambil cover URL dengan aman ------------------ */
function safeCover(komik) {
  /* komikindo API pakai field 'image', bacakomik pakai 'cover' */
  const raw = komik?.image || komik?.cover || komik?.thumbnail || "";
  return raw ? raw.split("?")[0] : "";
}

/* ---- STATE PAGINATION ------------------------------------- */
let latestPage    = 1;
let hasNextPage   = false;
let isLoadingMore = false;

/* ============================================================
   FETCH: TOP KOMIK
   ============================================================ */
async function getTopKomik() {
  const container = document.getElementById("topKomik");
  container.innerHTML = Array(5).fill(`<div class="card skeleton skeleton-card"></div>`).join("");
  try {
    const res  = await fetch(apiURL);
    const data = await res.json();
    container.innerHTML = "";
    tampilkanKomik(data.komikList || []);
  } catch (err) {
    console.error("Gagal fetch Top Komik:", err);
    container.innerHTML = `<p style="padding:14px;color:var(--text-muted);font-size:13px;">Gagal memuat. Cek koneksi internet.</p>`;
  }
}

/* ============================================================
   FETCH: LATEST (halaman pertama — reset grid)
   ============================================================ */
async function getKomikLatest() {
  const container = document.getElementById("komikLatest");
  latestPage    = 1;
  hasNextPage   = false;
  container.innerHTML = Array(4).fill(`<div class="grid-card skeleton skeleton-grid"></div>`).join("");

  try {
    const res  = await fetch(`${latestURL}/${latestPage}`);
    const data = await res.json();
    const list = data.komikList || data.data || data.comics || [];

    container.innerHTML = "";
    tampilkanLatest(list);

    hasNextPage = data.pagination?.hasNextPage ?? data.hasNextPage ?? (list.length >= 10);
    updateLoadMoreBtn();
  } catch (err) {
    console.error("Gagal fetch Latest:", err);
    container.innerHTML = `<p style="padding:14px;color:var(--text-muted);font-size:13px;">Gagal memuat konten terbaru.</p>`;
  }
}

/* ============================================================
   FETCH: LOAD MORE (append ke grid)
   ============================================================ */
window.loadMore = async function () {
  if (isLoadingMore || !hasNextPage) return;
  isLoadingMore = true;

  const btn     = document.getElementById("loadMoreBtn");
  const spinner = document.getElementById("loadMoreSpinner");

  if (btn)     { btn.disabled = true; btn.textContent = "Memuat..."; }
  if (spinner) spinner.style.display = "grid";

  latestPage++;

  try {
    const res  = await fetch(`${latestURL}/${latestPage}`);
    const data = await res.json();
    const list = data.komikList || data.data || data.comics || [];

    tampilkanLatest(list);

    hasNextPage = data.pagination?.hasNextPage ?? data.hasNextPage ?? (list.length >= 10);
    updateLoadMoreBtn();

    /* Scroll ke kartu baru pertama */
    const allCards = document.querySelectorAll(".grid-card");
    const firstNew = allCards[allCards.length - list.length];
    if (firstNew) {
      setTimeout(() => firstNew.scrollIntoView({ behavior: "smooth", block: "nearest" }), 100);
    }
  } catch (err) {
    console.error("Gagal load more:", err);
    latestPage--;
    if (btn) {
      btn.textContent    = "⚠️ Coba Lagi";
      btn.style.borderColor = "var(--accent)";
      btn.style.color       = "var(--accent)";
    }
  } finally {
    isLoadingMore = false;
    if (btn)     btn.disabled = false;
    if (spinner) spinner.style.display = "none";
  }
};

/* ---- Update tombol load-more ------------------------------ */
function updateLoadMoreBtn() {
  const wrap      = document.getElementById("loadMoreWrap");
  const btn       = document.getElementById("loadMoreBtn");
  const pageInfo  = document.getElementById("pageInfo");
  if (!wrap) return;

  if (pageInfo) pageInfo.textContent = `Halaman ${latestPage}`;

  wrap.style.display = "flex";
  if (hasNextPage) {
    if (btn) {
      btn.disabled       = false;
      btn.textContent    = "Muat Lebih Banyak ↓";
      btn.style.opacity  = "1";
      btn.style.borderColor = "";
      btn.style.color       = "";
    }
  } else {
    if (btn) {
      btn.disabled      = true;
      btn.textContent   = "✅ Semua Sudah Dimuat";
      btn.style.opacity = "0.5";
    }
  }
}

/* ============================================================
   FETCH: REKOMENDASI
   ============================================================ */
async function getKomikRekomen() {
  try {
    const res  = await fetch(rekomURL);
    const data = await res.json();
    tampilkanRekomen(data.komikList || []);
  } catch (err) {
    console.error("Gagal fetch Rekomendasi:", err);
  }
}

/* ============================================================
   RENDER: TOP KOMIK (slider, maks 10)
   ============================================================ */
function tampilkanKomik(komikList) {
  const container = document.getElementById("topKomik");
  komikList.slice(0, 10).forEach((komik, index) => {
    if (!komik || !komik.slug) return;
    const coverHD = safeCover(komik);
    const card    = document.createElement("div");
    card.classList.add("card");
    card.innerHTML = `
      <div class="rank">#${index + 1}</div>
      ${coverHD ? `<img src="${coverHD}" alt="${komik.title || ''}" loading="lazy" onerror="this.style.display='none'">` : `<div style="width:100%;height:160px;background:var(--bg-surface);display:flex;align-items:center;justify-content:center;font-size:32px;">🖼️</div>`}
      <div class="info">
        <p>${komik.title || "Untitled"}</p>
        <p>⭐ ${komik.rating || "?"}</p>
      </div>`;
    card.onclick = () => { window.location.href = komikURL(komik.slug); };
    container.appendChild(card);
  });
}

/* ============================================================
   RENDER: LATEST — append ke grid
   ============================================================ */
function tampilkanLatest(komikList) {
  const container = document.getElementById("komikLatest");

  komikList.forEach(komik => {
    if (!komik || !komik.slug) return;

    const coverHD = safeCover(komik);
    const type    = (komik.type || "manhwa").toLowerCase();
    const title   = komik.title || "Untitled";

    /* API komikindo: chapter & date ada di dalam array chapters[0] */
    const latestChapter = (komik.chapters && komik.chapters[0]) || {};
    const chapter = latestChapter.title || komik.chapter || komik.ch || "";
    const date    = latestChapter.date  || komik.date   || komik.time || "";
    const chapterSlug = latestChapter.slug || komik.slug;

    const card = document.createElement("div");
    card.classList.add("grid-card");

    const imgHtml = coverHD
      ? `<img src="${coverHD}" alt="${title}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
      : "";
    const fallbackDisplay = coverHD ? "none" : "flex";
    const chLink = chapterSlug
      ? `<a class="grid-ch-link" href="${readerURL(chapterSlug, komik.slug)}" onclick="event.stopPropagation()">Baca ▶</a>`
      : "";

    card.innerHTML =
      `<div class="badge ${type}">${komik.type || "manhwa"}</div>` +
      imgHtml +
      `<div style="display:${fallbackDisplay};width:100%;height:155px;background:var(--bg-surface);align-items:center;justify-content:center;font-size:32px;color:var(--text-muted);">🖼️</div>` +
      `<div class="grid-info">` +
        `<p class="title">${title}</p>` +
        `<div class="grid-meta">` +
          `<div class="grid-ch-row">` +
            `<span class="grid-chapter">📖 ${chapter || "–"}</span>` +
            chLink +
          `</div>` +
          `<span class="grid-date">🕐 ${date || "–"}</span>` +
        `</div>` +
      `</div>`;

    /* Klik judul/cover → detail, klik chapter → langsung baca */
    card.onclick = () => { window.location.href = komikURL(komik.slug); };
    container.appendChild(card);
  });
}

/* ============================================================
   RENDER: REKOMENDASI
   ============================================================ */
function tampilkanRekomen(komikList) {
  const container = document.getElementById("komikRekomen");
  komikList.forEach(komik => {
    if (!komik || !komik.slug) return;
    const coverHD = safeCover(komik);
    const card    = document.createElement("div");
    card.classList.add("rekom-card");
    card.innerHTML = `
      ${coverHD ? `<img src="${coverHD}" alt="${komik.title || ''}" loading="lazy" onerror="this.style.display='none'">` : ""}
      <div class="rekom-info">
        <p class="title">${komik.title || "Untitled"}</p>
        <p>⭐ ${komik.rating || "?"}</p>
        <p>🎭 ${komik.genre || ""}</p>
      </div>`;
    card.onclick = () => { window.location.href = komikURL(komik.slug); };
    container.appendChild(card);
  });
}

/* ============================================================
   NAVIGASI & UI
   ============================================================ */
function goHome()         { window.location.href = "/"; }
function toggleDarkMode() {
  document.body.classList.toggle("light");
  localStorage.setItem("theme", document.body.classList.contains("light") ? "light" : "dark");
}

document.addEventListener("click", function (e) {
  const searchBox = document.getElementById("searchInput");
  const resultBox = document.getElementById("searchResult");
  if (searchBox && resultBox && !searchBox.contains(e.target) && !resultBox.contains(e.target)) {
    resultBox.style.display = "none";
  }
});

/* ============================================================
   LIVE SEARCH (debounce 400ms)
   ============================================================ */
let searchTimeout = null;

async function liveSearch() {
  const query     = document.getElementById("searchInput").value.trim();
  const resultBox = document.getElementById("searchResult");
  if (!query) { resultBox.style.display = "none"; return; }

  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    try {
      const res  = await fetch(`https://www.sankavollerei.com/comic/bacakomik/search/${encodeURIComponent(query)}`);
      const data = await res.json();
      tampilkanSearch(data.komikList || []);
    } catch (err) { console.error("Search error:", err); }
  }, 400);
}

function tampilkanSearch(list) {
  const resultBox = document.getElementById("searchResult");
  resultBox.innerHTML = "";
  if (!list || list.length === 0) { resultBox.style.display = "none"; return; }

  list.slice(0, 5).forEach(komik => {
    if (!komik || !komik.slug) return;
    const coverHD = safeCover(komik);
    const item    = document.createElement("div");
    item.classList.add("search-item");
    item.innerHTML = `
      ${coverHD ? `<img src="${coverHD}" alt="${komik.title || ''}" loading="lazy">` : `<div style="width:40px;height:40px;background:var(--bg-surface);border-radius:6px;flex-shrink:0;"></div>`}
      <div><p>${komik.title || "Untitled"}</p><p>⭐ ${komik.rating || "?"}</p></div>`;
    item.onclick = () => { window.location.href = komikURL(komik.slug); };
    resultBox.appendChild(item);
  });
  resultBox.style.display = "block";
}

/* ============================================================
   INIT
   ============================================================ */
window.onload = function () {
  if (localStorage.getItem("theme") === "light") document.body.classList.add("light");

  getTopKomik();
  getKomikLatest();
  getKomikRekomen();
  getGenreChips();

  /* Back to top */
  const btn = document.getElementById("backToTop");
  if (btn) {
    window.addEventListener("scroll", () => {
      btn.classList.toggle("visible", window.scrollY > 300);
    }, { passive: true });
  }

  /* Infinite scroll */
  window.addEventListener("scroll", () => {
    const scrollBottom = window.scrollY + window.innerHeight;
    const docHeight    = document.body.offsetHeight;
    if (scrollBottom >= docHeight - 400 && hasNextPage && !isLoadingMore) {
      window.loadMore();
    }
  }, { passive: true });
};

/* ============================================================
   GENRE CHIPS
   ============================================================ */
async function getGenreChips() {
  const container = document.getElementById("genreChipsIndex");
  if (!container) return;
  try {
    /* Pakai API baru komikindo — field: name + value (slug) */
    const res  = await fetch("https://www.sankavollerei.com/comic/komikindo/genres");
    const data = await res.json();

    const TYPOS = new Set(["actio","traged"]);
    const seen  = new Set();

    const genres = (data.genres || [])
      .filter(g => {
        const val  = (g.value || g.slug || "").toLowerCase();
        const name = (g.name  || g.title || "");
        if (!val || !name || name.length < 3) return false;
        if (TYPOS.has(val)) return false;
        if (seen.has(val)) return false;
        seen.add(val);
        return true;
      })
      .sort((a, b) => {
        const na = a.name || a.title;
        const nb = b.name || b.title;
        return na.localeCompare(nb, "id");
      });

    /* Tampilkan 16 genre populer di home */
    const popular = ["action","romance","fantasy","comedy","drama",
                     "adventure","horror","thriller","shounen","isekai",
                     "supernatural","school-life","martial-arts","mystery",
                     "sports","psychological"];
    const sorted = [
      ...genres.filter(g => popular.includes(g.value || g.slug)),
      ...genres.filter(g => !popular.includes(g.value || g.slug)),
    ];

    container.innerHTML = sorted.slice(0, 16).map(g => {
      const slug = g.value || g.slug;
      const name = g.name  || g.title;
      return `<button class="genre-chip-index" onclick="window.location.href='/genre/${encodeURIComponent(slug)}'">
        ${name}
      </button>`;
    }).join("") + `
      <button class="genre-chip-index" style="border-color:var(--accent);color:var(--accent);font-weight:800;"
        onclick="window.location.href='/genre/'">Semua →</button>`;

  } catch (err) {
    console.error("Gagal fetch genre chips:", err);
    if (container) container.innerHTML = "";
  }
}

/* ============================================================
   TOAST UTILITY
   ============================================================ */
window.showToast = function (msg, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className   = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
};
