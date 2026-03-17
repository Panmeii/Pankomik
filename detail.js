const params = new URLSearchParams(window.location.search);
const slug = params.get("slug");

const apiDetail = `https://www.sankavollerei.com/comic/bacakomik/detail/${slug}`;

async function getDetail() {
  try {
    const res = await fetch(apiDetail);
    const data = await res.json();

    tampilkanDetail(data.detail);
  } catch (err) {
    console.log("Error detail:", err);
  }
}

function tampilkanDetail(d) {
  const container = document.getElementById("detailKomik");

  const coverHD = d.cover.split("?")[0];

  container.innerHTML = `
    <div class="detail-header">
      <img src="${coverHD}">
      
      <div class="detail-info">
        <h2>${d.title}</h2>
        <p>⭐ ${d.rating}</p>
        <p>Status: ${d.status}</p>
        <p>Type: ${d.type}</p>
        <p>Author: ${d.author}</p>

        <div class="genres">
          ${d.genres.map(g => `<span class="genre">${g.title}</span>`).join("")}
        </div>
      </div>
    </div>

    <div class="synopsis" id="synopsisBox">
      <h3>Synopsis</h3>
      <p>${d.synopsis}</p>
      <button onclick="toggleSynopsis()">Read More</button>
    </div>

    <div class="chapter-section">
      <h3>Chapter List</h3>
      <div class="chapter-list">
        ${d.chapters.map(ch => {
          const match = ch.slug.match(/chapter-(\d+)/i);
          const nomor = match ? match[1] : "?";

          return `
  <a href="reader.html?slug=${ch.slug}" class="chapter-item">
    <span>Chapter ${nomor}</span>
    <span>${ch.date}</span>
  </a>
`;
        }).join("")}
      </div>
    </div>
  `;
}

function toggleSynopsis() {
  const box = document.getElementById("synopsisBox");
  box.classList.toggle("active");
}
function toggleDarkMode() {
  document.body.classList.toggle("light");

  if (document.body.classList.contains("light")) {
    localStorage.setItem("theme", "light");
  } else {
    localStorage.setItem("theme", "dark");
  }
}

/* load mode */
window.onload = function () {
  const theme = localStorage.getItem("theme");

  if (theme === "light") {
    document.body.classList.add("light");
  }
};
getDetail();