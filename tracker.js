/* ============================================================
   PANKOMIK — tracker.js  (ringan, tidak membebani DB)

   Cara kerja:
   - Hanya track 3 halaman: Home (/), Detail Komik (/komik/*), Baca (/baca/*)
   - Pakai UPSERT counter — tidak insert baris baru setiap visit
   - 1 baris per halaman di site_stats (total 3 baris selamanya)
   - 1 baris per (hari × halaman) di site_daily (max 3 baris/hari)
   - Throttle 30 detik per halaman per session → tidak spam saat reload

   CARA PASANG: tambahkan di index.html, detail.html, reader.html:
   <script type="module" src="/tracker.js"></script>
   ============================================================ */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://aaqhknkyrnsapvfywdsn.supabase.co";
const SUPABASE_KEY = "sb_publishable_ND-51tP1NF40HRZ3q05N5w_1ZnlPzlL";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

function getPage() {
  const path = window.location.pathname;
  if (path === "/" || path === "/index.html") return "/";
  if (path.startsWith("/komik/"))  return "/komik";
  if (path.startsWith("/baca/"))   return "/baca";
  return null;
}

function shouldTrack(page) {
  const key  = `_pk_${page.replace(/\//g,"_")||"home"}`;
  const last = parseInt(sessionStorage.getItem(key) || "0");
  if (Date.now() - last < 30_000) return false;
  sessionStorage.setItem(key, String(Date.now()));
  return true;
}

async function track() {
  const page = getPage();
  if (!page || !shouldTrack(page)) return;

  const today = new Date().toISOString().slice(0, 10);

  /* Update site_stats (total semua waktu) */
  try {
    const { data } = await sb
      .from("site_stats").select("views").eq("page", page).maybeSingle();
    await sb.from("site_stats").upsert(
      { page, views: (data?.views || 0) + 1, last_seen: new Date().toISOString() },
      { onConflict: "page" }
    );
  } catch { /* silent */ }

  /* Update site_daily (per hari) */
  try {
    const { data } = await sb
      .from("site_daily").select("views")
      .eq("day", today).eq("page", page).maybeSingle();
    await sb.from("site_daily").upsert(
      { day: today, page, views: (data?.views || 0) + 1 },
      { onConflict: "day,page" }
    );
  } catch { /* silent */ }
}

if (document.readyState === "complete") {
  setTimeout(track, 1500);
} else {
  window.addEventListener("load", () => setTimeout(track, 1500), { once: true });
}
