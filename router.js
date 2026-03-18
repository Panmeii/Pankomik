/* ============================================================
   PANKOMIK — router.js
   Helper URL routing: pretty URL ↔ query param fallback

   Import di setiap halaman:
     import { getSlug, getKomikSlug, navigateTo } from "./router.js";
   ============================================================ */

/* ── Baca slug dari path atau query param ─────────────────── */

/**
 * Ambil chapter slug dari URL.
 * Mendukung format:
 *   - /komik/naruto/naruto-chapter-1  → "naruto-chapter-1"
 *   - /baca/naruto-chapter-1          → "naruto-chapter-1"
 *   - reader.html?slug=naruto-chapter-1 → "naruto-chapter-1"
 */
export function getSlug() {
  const path   = window.location.pathname;
  const params = new URLSearchParams(window.location.search);

  // Pretty URL /komik/:komikSlug/:chapterSlug
  const komikChapterMatch = path.match(/^\/komik\/([^/]+)\/([^/]+)\/?$/);
  if (komikChapterMatch) return komikChapterMatch[2];

  // Pretty URL /baca/:chapterSlug
  const bacaMatch = path.match(/^\/baca\/([^/]+)\/?$/);
  if (bacaMatch) return bacaMatch[1];

  // Fallback: query param ?slug=
  return params.get("slug") || null;
}

/**
 * Ambil komik slug (judul komik) dari URL.
 * Mendukung format:
 *   - /komik/naruto                   → "naruto"
 *   - /komik/naruto/naruto-chapter-1  → "naruto"
 *   - detail.html?slug=naruto         → "naruto"
 */
export function getKomikSlug() {
  const path   = window.location.pathname;
  const params = new URLSearchParams(window.location.search);

  // /komik/:komikSlug/:chapterSlug
  const komikChapterMatch = path.match(/^\/komik\/([^/]+)\/([^/]+)\/?$/);
  if (komikChapterMatch) return komikChapterMatch[1];

  // /komik/:komikSlug
  const komikMatch = path.match(/^\/komik\/([^/]+)\/?$/);
  if (komikMatch) return komikMatch[1];

  // query param ?komik= (diset Netlify dari redirect rule)
  if (params.get("komik")) return params.get("komik");

  // query param ?slug= (halaman detail)
  return params.get("slug") || null;
}

/* ── Buat URL dari slug ────────────────────────────────────── */

/**
 * Buat URL halaman detail komik.
 * Hasilnya: /komik/naruto
 */
export function komikURL(komikSlug) {
  return `/komik/${komikSlug}`;
}

/**
 * Buat URL halaman reader / baca chapter.
 * Hasilnya: /komik/naruto/naruto-chapter-1
 *
 * Kalau komikSlug tidak tersedia, fallback ke /baca/:chapterSlug
 */
export function readerURL(chapterSlug, komikSlug) {
  if (komikSlug) return `/komik/${komikSlug}/${chapterSlug}`;
  return `/baca/${chapterSlug}`;
}

/**
 * Buat URL halaman novel.
 * Hasilnya: /novel/the-beginning-after-the-end
 */
export function novelURL(novelSlug) {
  return `/novel/${novelSlug}`;
}

/**
 * Buat URL halaman genre.
 */
export function genreURL(genreSlug) {
  return `/genre/${genreSlug}`;
}

/* ── Navigasi helper ──────────────────────────────────────── */

/**
 * Update URL di browser (tanpa reload halaman).
 * Dipakai di reader saat ganti chapter.
 */
export function pushURL(chapterSlug, komikSlug, pageTitle) {
  const url = readerURL(chapterSlug, komikSlug);
  history.pushState({ chapterSlug, komikSlug }, pageTitle || "", url);
  if (pageTitle) document.title = pageTitle;
}

/**
 * Navigasi ke halaman detail komik.
 */
export function navigateToKomik(komikSlug) {
  window.location.href = komikURL(komikSlug);
}

/**
 * Navigasi ke halaman reader.
 */
export function navigateToReader(chapterSlug, komikSlug) {
  window.location.href = readerURL(chapterSlug, komikSlug);
}