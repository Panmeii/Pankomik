const apiURL = "https://www.sankavollerei.com/comic/bacakomik/top";
const latestURL = "https://www.sankavollerei.com/comic/bacakomik/latest";
const rekomURL = "https://www.sankavollerei.com/comic/bacakomik/recomen";

async function getTopKomik() {
  try {
    const res = await fetch(apiURL);
    const data = await res.json();

    tampilkanKomik(data.komikList);
  } catch (err) {
    console.log("Error:", err);
  }
}

async function getKomikLastest() {
  try {
  const res = await fetch(latestURL);
  const data = await res.json();
  
  tampilkanLatest(data.komikList);
  } catch(err) {
    console.log("Error Latest", err);
  }
}

async function getKomikRekomen() {
  try {
    const res = await fetch(rekomURL);
    const data = await res.json();
    
    tampilkanRekomen(data.komikList);
  } catch(err) {
    console.log("Error Rekomen", err);
  }
}

function tampilkanKomik(komikList) {
  const container = document.getElementById("topKomik");

  komikList.slice(0, 10).forEach((komik, index) => {
    
    const coverHD = komik.cover.split("?")[0];
    const card = document.createElement("div");
    card.classList.add("card");

    card.innerHTML = `
      <div class="rank">#${index + 1}</div>
      <img src="${coverHD}" alt="${komik.title}">
      <div class="info">
        <p>${komik.title}</p>
        <p>⭐ ${komik.rating}</p>
      </div>
    `;

    container.appendChild(card);
    card.onclick = () => {
  window.location.href = `detail.html?slug=${komik.slug}`;
};
  });
}

function tampilkanLatest (komikList) {
  const container = document.getElementById("komikLatest");
  
  komikList.forEach(komik => {
    const coverHD = komik.cover.split("?")[0];
    
    const card = document.createElement("div");
    card.classList.add("grid-card");
    
    card.innerHTML = `
    <div class="badge ${komik.type}">${komik.type}</div>
    <img src="${coverHD}" alt="${komik.title}">
    <div class="grid-info">
    <p class="title">${komik.title}</p>
    <p>📖 ${komik.chapter}</p>
    <p>⏱️ ${komik.date}</p>
    </div>
    `;
    container.appendChild(card);
    card.onclick = () => {
  window.location.href = `detail.html?slug=${komik.slug}`;
};
  });
  
}

function tampilkanRekomen (komikList) {
  const container = document.getElementById("komikRekomen");
  
  komikList.forEach(komik => {
    const coverHD = komik.cover.split("?")[0];
    
    const card = document.createElement("div");
    card.classList.add("rekom-card");
    
    card.innerHTML = `
      <img src="${coverHD}" alt="${komik.title}">
      <div class="rekom-info">
        <p class="title">${komik.title}</p>
        <p>⭐ ${komik.rating}</p>
        <p>🎭 ${komik.genre}</p>
      </div>
    `;
    container.appendChild(card);
    card.onclick = () => {
  window.location.href = `detail.html?slug=${komik.slug}`;
};
  });
}

function goHome() {
  window.location.href = "index.html";
}

function toggleMenu() {
  const menu = document.getElementById("menuDropdown");
  menu.style.display = menu.style.display === "block" ? "none" : "block";
}
function toggleDarkMode() {
  document.body.classList.toggle("light");
}
function toggleDarkMode() {
  document.body.classList.toggle("light");

  if (document.body.classList.contains("light")) {
    localStorage.setItem("theme", "light");
  } else {
    localStorage.setItem("theme", "dark");
  }
}

// load saat buka web
window.onload = function () {
  const theme = localStorage.getItem("theme");

  if (theme === "light") {
    document.body.classList.add("light");
  }
};

// live search
let timeout = null;

async function liveSearch() {
  const query = document.getElementById("searchInput").value;
  const resultBox = document.getElementById("searchResult");

  // kalau kosong, hide
  if (!query) {
    resultBox.style.display = "none";
    return;
  }

  // debounce biar gak spam API
  clearTimeout(timeout);

  timeout = setTimeout(async () => {
    try {
      const url = `https://www.sankavollerei.com/comic/bacakomik/search/${encodeURIComponent(query)}`;
      const res = await fetch(url);
      const data = await res.json();

      tampilkanSearch(data.komikList);
    } catch (err) {
      console.log("Search error:", err);
    }
  }, 400); // delay 400ms
}

function tampilkanSearch(list) {
  const resultBox = document.getElementById("searchResult");

  resultBox.innerHTML = "";

  if (!list || list.length === 0) {
    resultBox.style.display = "none";
    return;
  }

  list.slice(0, 5).forEach(komik => {

    const coverHD = komik.cover.split("?")[0];

    const item = document.createElement("div");
    item.classList.add("search-item");

    item.innerHTML = `
      <img src="${coverHD}">
      <div>
        <p>${komik.title}</p>
        <p>⭐ ${komik.rating}</p>
      </div>
    `;

    resultBox.appendChild(item);
  });

  resultBox.style.display = "block";
}

getTopKomik();
getKomikLastest();
getKomikRekomen();