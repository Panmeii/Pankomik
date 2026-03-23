/* ============================================================
   PANKOMIK — tracker.js  v2
   Track 9 jenis halaman, tetap ringan (upsert counter).

   Halaman yang di-track:
     home         →  /
     komik-list   →  /komik
     komik-detail →  /komik/{slug}
     komik-read   →  /baca/{slug}  atau  /komik/{slug}/{chapter}
     novel-list   →  /novel
     novel-detail →  /novel/{slug}
     novel-read   →  /baca-novel/{slug}
     anime-list   →  /anime
     anime-detail →  /anime/{id}
     anime-watch  →  /anime-watch/{ep}

   CARA PASANG di setiap HTML sebelum </body>:
     <script type="module" src="/tracker.js"></script>
   ============================================================ */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://aaqhknkyrnsapvfywdsn.supabase.co";
const SUPABASE_KEY = "sb_publishable_ND-51tP1NF40HRZ3q05N5w_1ZnlPzlL";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

function getPage() {
  const p = window.location.pathname.replace(/\/$/, "") || "/";
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

function shouldTrack(page) {
  const key  = `_pk_${page}`;
  const last = parseInt(sessionStorage.getItem(key) || "0");
  if (Date.now() - last < 30000) return false;
  sessionStorage.setItem(key, String(Date.now()));
  return true;
}

async function track() {
  const page = getPage();
  if (!page || !shouldTrack(page)) return;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const { data } = await sb.from("site_stats").select("views").eq("page", page).maybeSingle();
    await sb.from("site_stats").upsert(
      { page, views: (data?.views || 0) + 1, last_seen: new Date().toISOString() },
      { onConflict: "page" }
    );
  } catch {}
  try {
    const { data } = await sb.from("site_daily").select("views").eq("day", today).eq("page", page).maybeSingle();
    await sb.from("site_daily").upsert(
      { day: today, page, views: (data?.views || 0) + 1 },
      { onConflict: "day,page" }
    );
  } catch {}
}

if (document.readyState === "complete") {
  setTimeout(track, 1500);
} else {
  window.addEventListener("load", () => setTimeout(track, 1500), { once: true });
}
