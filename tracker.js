/* ============================================================
   PANKOMIK — tracker.js  v3
   - Track 10 jenis halaman via upsert counter
   - Expose window.trackNow() untuk SPA navigation
     (dipanggil dari reader.js / novel-reader saat ganti chapter)
   ============================================================ */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://aaqhknkyrnsapvfywdsn.supabase.co";
const SUPABASE_KEY = "sb_publishable_ND-51tP1NF40HRZ3q05N5w_1ZnlPzlL";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ── Mapping path → page key ── */
function getPage(path) {
  const p = (path || window.location.pathname).replace(/\/$/, "") || "/";
  if (p === "" || p === "/" || p === "/index.html") return "home";
  if (/^\/komik\/[^/]+\/[^/]+/.test(p)) return "komik-read";
  if (/^\/komik\/[^/]+/.test(p))         return "komik-detail";
  if (p === "/komik")                     return "komik-list";
  if (/^\/baca\//.test(p))               return "komik-read";
  if (/^\/novel\/[^/]+/.test(p))         return "novel-detail";
  if (p === "/novel")                     return "novel-list";
  if (/^\/baca-novel\//.test(p))         return "novel-read";
  if (/^\/anime-watch\//.test(p))        return "anime-watch";
  if (/^\/anime\/[^/]+/.test(p))         return "anime-detail";
  if (p === "/anime")                     return "anime-list";
  return null;
}

/* ── Throttle per page key: skip jika < 30 detik lalu ── */
const _lastTracked = {};
function shouldTrack(page, force) {
  if (force) { _lastTracked[page] = Date.now(); return true; }
  const last = _lastTracked[page] || 0;
  if (Date.now() - last < 30000) return false;
  _lastTracked[page] = Date.now();
  return true;
}

/* ── Core upsert ── */
/* Fix #12: Race condition dihindari dengan dua strategi:
   1. Untuk site_stats: coba RPC "increment_stat" dulu (atomic di DB side).
      Kalau RPC tidak ada, fallback ke upsert biasa dengan last_seen sebagai tiebreaker.
   2. Untuk site_daily: sama, coba RPC "increment_daily" dulu, fallback ke upsert.
   Tanpa RPC di DB, cara paling aman adalah insert dengan ON CONFLICT DO UPDATE
   menggunakan "views = excluded.views + site_stats.views" — tapi Supabase JS client
   tidak support expression. Solusi pragmatis: pakai upsert + ignoreDuplicates=false
   yang di-handle DB dengan trigger increment jika tersedia, atau terima minor double-count
   yang jarang terjadi pada traffic rendah. */
async function doTrack(page) {
  const today = new Date().toISOString().slice(0, 10);
  const now   = new Date().toISOString();

  /* ── site_stats: coba atomic RPC dulu ── */
  try {
    const { error: rpcErr } = await sb.rpc("increment_page_view", { p_page: page });
    if (rpcErr) throw rpcErr; /* RPC tidak ada → fallback */
  } catch {
    /* Fallback: upsert biasa — minor race condition bisa terjadi pada traffic tinggi */
    try {
      const { data } = await sb.from("site_stats").select("views").eq("page", page).maybeSingle();
      await sb.from("site_stats").upsert(
        { page, views: (data?.views || 0) + 1, last_seen: now },
        { onConflict: "page" }
      );
    } catch {}
  }

  /* ── site_daily: coba atomic RPC dulu ── */
  try {
    const { error: rpcErr } = await sb.rpc("increment_daily_view", { p_page: page, p_day: today });
    if (rpcErr) throw rpcErr;
  } catch {
    try {
      const { data } = await sb.from("site_daily").select("views").eq("day", today).eq("page", page).maybeSingle();
      await sb.from("site_daily").upsert(
        { day: today, page, views: (data?.views || 0) + 1 },
        { onConflict: "day,page" }
      );
    } catch {}
  }
}

/* ── Track otomatis saat halaman load ── */
function track(force) {
  const page = getPage();
  if (!page || !shouldTrack(page, force)) return;
  doTrack(page);
}

/* ── PUBLIC: dipanggil dari reader.js / novel-reader setelah pushURL ──
   Contoh pemakaian di reader.js, setelah pushURL():
     if (window.trackNow) window.trackNow();
   Atau dengan path eksplisit:
     if (window.trackNow) window.trackNow('/baca/' + chapterSlug);
*/
window.trackNow = function(path) {
  const page = getPage(path);
  if (!page) return;
  /* Force = true: abaikan throttle, langsung track */
  _lastTracked[page] = 0;
  shouldTrack(page, true);
  doTrack(page);
};

/* ── Jalankan saat halaman pertama load ── */
if (document.readyState === "complete") {
  setTimeout(track, 1500);
} else {
  window.addEventListener("load", () => setTimeout(track, 1500), { once: true });
}
