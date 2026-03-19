/* ============================================================
   PANKOMIK — router.js
   Helper URL routing: pretty URL ↔ query param fallback

   Import di setiap halaman:
     import { getSlug, getKomikSlug, navigateTo } from "/router.js";

   Mendukung semua section:
     - Komik  : /komik/:slug, /komik/:komik/:chapter, /baca/:slug
     - Novel  : /novel/:slug, /baca-novel/:slug
     - Anime  : /anime/:id, /anime-watch/:ep, /anime-genre/:genre
     - Genre  : /genre/:slug
   ============================================================ */


/* ════════════════════════════════════════════════════════════
   KOMIK — Slug helpers
   ════════════════════════════════════════════════════════════ */

/**
 * Ambil chapter slug dari URL.
 *   /komik/naruto/naruto-chapter-1  → "naruto-chapter-1"
 *   /baca/naruto-chapter-1          → "naruto-chapter-1"
 *   reader.html?slug=…              → nilai query param
 */
export function getSlug() {
  const path   = window.location.pathname;
  const params = new URLSearchParams(window.location.search);

  const komikChapterMatch = path.match(/^\/komik\/([^/]+)\/([^/]+)\/?$/);
  if (komikChapterMatch) return komikChapterMatch[2];

  const bacaMatch = path.match(/^\/baca\/([^/]+)\/?$/);
  if (bacaMatch) return bacaMatch[1];

  return params.get("slug") || null;
}

/**
 * Ambil komik slug dari URL.
 *   /komik/naruto                  → "naruto"
 *   /komik/naruto/naruto-chapter-1 → "naruto"
 *   detail.html?slug=naruto        → "naruto"
 */
export function getKomikSlug() {
  const path   = window.location.pathname;
  const params = new URLSearchParams(window.location.search);

  const komikChapterMatch = path.match(/^\/komik\/([^/]+)\/([^/]+)\/?$/);
  if (komikChapterMatch) return komikChapterMatch[1];

  const komikMatch = path.match(/^\/komik\/([^/]+)\/?$/);
  if (komikMatch) return komikMatch[1];

  if (params.get("komik")) return params.get("komik");
  return params.get("slug") || null;
}


/* ════════════════════════════════════════════════════════════
   NOVEL — Slug helpers
   ════════════════════════════════════════════════════════════ */

/**
 * Ambil novel slug dari URL.
 *   /novel/overlord  → "overlord"
 *   novel-detail.html?slug=overlord → "overlord"
 */
export function getNovelSlug() {
  const path   = window.location.pathname;
  const params = new URLSearchParams(window.location.search);

  const novelMatch = path.match(/^\/novel\/([^/]+)\/?$/);
  if (novelMatch) return novelMatch[1];

  return params.get("slug") || null;
}

/**
 * Ambil chapter slug novel dari URL.
 *   /baca-novel/overlord-chapter-1  → "overlord-chapter-1"
 *   novel-reader.html?slug=…        → nilai query param
 */
export function getNovelChapterSlug() {
  const path   = window.location.pathname;
  const params = new URLSearchParams(window.location.search);

  const bacaNovelMatch = path.match(/^\/baca-novel\/([^/]+)\/?$/);
  if (bacaNovelMatch) return bacaNovelMatch[1];

  return params.get("slug") || null;
}


/* ════════════════════════════════════════════════════════════
   ANIME — Slug helpers
   ════════════════════════════════════════════════════════════ */

/**
 * Ambil anime ID dari URL.
 *   /anime/one-piece-sub-indo  → "one-piece-sub-indo"
 *   anime-detail.html?id=…    → nilai query param
 */
export function getAnimeId() {
  const path   = window.location.pathname;
  const params = new URLSearchParams(window.location.search);

  /* /anime/:id  — tapi jangan cocok dengan /anime (tanpa trailing) */
  const animeMatch = path.match(/^\/anime\/([^/]+)\/?$/);
  if (animeMatch) return animeMatch[1];

  return params.get("id") || null;
}

/**
 * Ambil episode ID dari URL.
 *   /anime-watch/sd-p2-episode-10-sub-indo  → "sd-p2-episode-10-sub-indo"
 *   anime-watch.html?ep=…                  → nilai query param
 */
export function getAnimeEpisodeId() {
  const path   = window.location.pathname;
  const params = new URLSearchParams(window.location.search);

  const watchMatch = path.match(/^\/anime-watch\/([^/]+)\/?$/);
  if (watchMatch) return watchMatch[1];

  return params.get("ep") || null;
}

/**
 * Ambil genre ID anime dari URL.
 *   /anime-genre/action  → "action"
 *   anime-genre.html?genre=action → "action"
 */
export function getAnimeGenreId() {
  const path   = window.location.pathname;
  const params = new URLSearchParams(window.location.search);

  const genreAnimeMatch = path.match(/^\/anime-genre\/([^/]+)\/?$/);
  if (genreAnimeMatch) return genreAnimeMatch[1];

  return params.get("genre") || null;
}

/**
 * Ambil genre slug komik dari URL.
 *   /genre/action  → "action"
 *   genre.html?genre=action → "action"
 */
export function getGenreSlug() {
  const path   = window.location.pathname;
  const params = new URLSearchParams(window.location.search);

  const genreMatch = path.match(/^\/genre\/([^/]+)\/?$/);
  if (genreMatch) return genreMatch[1];

  return params.get("genre") || null;
}


/* ════════════════════════════════════════════════════════════
   URL BUILDERS — buat pretty URL dari slug/id
   ════════════════════════════════════════════════════════════ */

/** /komik/naruto */
export function komikURL(komikSlug) {
  return `/komik/${komikSlug}`;
}

/**
 * /komik/naruto/naruto-chapter-1
 * Fallback ke /baca/:chapterSlug jika komikSlug tidak ada.
 */
export function readerURL(chapterSlug, komikSlug) {
  if (komikSlug) return `/komik/${komikSlug}/${chapterSlug}`;
  return `/baca/${chapterSlug}`;
}

/** /novel/overlord */
export function novelURL(novelSlug) {
  return `/novel/${novelSlug}`;
}

/** /baca-novel/overlord-chapter-1 */
export function novelReaderURL(chapterSlug) {
  return `/baca-novel/${chapterSlug}`;
}

/** /anime/one-piece-sub-indo */
export function animeURL(animeId) {
  return `/anime/${animeId}`;
}

/** /anime-watch/sd-p2-episode-10-sub-indo */
export function animeWatchURL(episodeId) {
  return `/anime-watch/${episodeId}`;
}

/** /anime-genre/action */
export function animeGenreURL(genreId) {
  return `/anime-genre/${genreId}`;
}

/** /genre/action (komik genre) */
export function genreURL(genreSlug) {
  return `/genre/${genreSlug}`;
}


/* ════════════════════════════════════════════════════════════
   NAVIGATION HELPERS — langsung pindah halaman
   ════════════════════════════════════════════════════════════ */

/** Navigasi ke halaman detail komik */
export function navigateToKomik(komikSlug) {
  window.location.href = komikURL(komikSlug);
}

/** Navigasi ke halaman reader komik */
export function navigateToReader(chapterSlug, komikSlug) {
  window.location.href = readerURL(chapterSlug, komikSlug);
}

/** Navigasi ke halaman detail novel */
export function navigateToNovel(novelSlug) {
  window.location.href = novelURL(novelSlug);
}

/** Navigasi ke halaman baca novel */
export function navigateToNovelReader(chapterSlug) {
  window.location.href = novelReaderURL(chapterSlug);
}

/** Navigasi ke halaman detail anime */
export function navigateToAnime(animeId) {
  window.location.href = animeURL(animeId);
}

/** Navigasi ke halaman tonton episode anime */
export function navigateToWatch(episodeId) {
  window.location.href = animeWatchURL(episodeId);
}

/** Navigasi ke halaman genre anime */
export function navigateToAnimeGenre(genreId) {
  window.location.href = animeGenreURL(genreId);
}


/* ════════════════════════════════════════════════════════════
   PUSH STATE — update URL tanpa reload (untuk reader)
   ════════════════════════════════════════════════════════════ */

/**
 * Update URL komik reader tanpa reload.
 * Dipakai saat user ganti chapter.
 */
export function pushURL(chapterSlug, komikSlug, pageTitle) {
  const url = readerURL(chapterSlug, komikSlug);
  history.pushState({ chapterSlug, komikSlug }, pageTitle || "", url);
  if (pageTitle) document.title = pageTitle;
}

/**
 * Update URL novel reader tanpa reload.
 */
export function pushNovelURL(chapterSlug, pageTitle) {
  const url = novelReaderURL(chapterSlug);
  history.pushState({ chapterSlug }, pageTitle || "", url);
  if (pageTitle) document.title = pageTitle;
}

/**
 * Update URL anime watch tanpa reload.
 * Dipakai saat user ganti episode via navigasi.
 */
export function pushAnimeURL(episodeId, pageTitle) {
  const url = animeWatchURL(episodeId);
  history.pushState({ episodeId }, pageTitle || "", url);
  if (pageTitle) document.title = pageTitle;
}
