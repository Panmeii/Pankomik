const API = "https://www.sankavollerei.com/comic/bacakomik/chapter/";
const slug = new URLSearchParams(window.location.search).get("slug");

let autoScroll = null;
let nextSlug = null;
let prevSlug = null;

// FETCH DATA
async function loadChapter() {
  const res = await fetch(API + slug);
  const data = await res.json();

  document.getElementById("title").innerText = data.title;

  nextSlug = data.navigation.next;
  prevSlug = data.navigation.prev;
  const nextBtn = document.getElementById("nextBtn");
const prevBtn = document.getElementById("prevBtn");

// kalau tidak ada next → sembunyikan
if (!nextSlug) {
  nextBtn.style.display = "none";
} else {
  nextBtn.style.display = "inline-block";
}

// kalau tidak ada prev → sembunyikan
if (!prevSlug) {
  prevBtn.style.display = "none";
} else {
  prevBtn.style.display = "inline-block";
}

  const container = document.getElementById("reader");
  container.innerHTML = "";

  data.images.forEach(img => {
    const image = document.createElement("img");
    image.src = img;
    container.appendChild(image);
  });
}

loadChapter();


// NAVIGATION
function nextChapter() {
  if (nextSlug) {
    window.location.href = `reader.html?slug=${nextSlug}`;
  }
}

function prevChapter() {
  if (prevSlug) {
    window.location.href = `reader.html?slug=${prevSlug}`;
  }
}

function goHome() {
  window.location.href = "index.html";
}


// SETTINGS
function toggleSettings() {
  document.getElementById("settings").classList.toggle("active");
}


// AUTO SCROLL
function toggleAutoScroll() {
  if (autoScroll) {
    clearInterval(autoScroll);
    autoScroll = null;
    return;
  }

  const speed = document.getElementById("speed").value;

  autoScroll = setInterval(() => {
    window.scrollBy(0, speed);
  }, 30);
}


// WIDTH CONTROL
document.getElementById("width").addEventListener("input", (e) => {
  document.querySelectorAll("#reader img").forEach(img => {
    img.style.width = e.target.value + "%";
  });
});

let scrollTimeout;
const header = document.querySelector(".reader-header");

// saat scroll
window.addEventListener("scroll", () => {
  header.classList.add("hide");

  clearTimeout(scrollTimeout);

  // muncul lagi saat berhenti scroll
  scrollTimeout = setTimeout(() => {
    header.classList.remove("hide");
  }, 200);
});

document.addEventListener("click", (e) => {
  // jangan trigger kalau klik settings
  if (e.target.closest(".settings")) return;

  header.classList.toggle("hide");
});