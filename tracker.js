/* ============================================================
   PANKOMIK — tracker.js
   Lacak kunjungan halaman ke tabel page_views di Supabase.

   CARA PAKAI: tambahkan di semua halaman HTML sebelum </body>
   <script type="module" src="/tracker.js"></script>

   TABEL SUPABASE yang dibutuhkan:
   CREATE TABLE page_views (
     id         bigserial PRIMARY KEY,
     path       text NOT NULL,
     title      text,
     referrer   text,
     device     text,
     session_id text,
     user_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
     created_at timestamptz DEFAULT now()
   );
   ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "allow_insert" ON page_views FOR INSERT WITH CHECK (true);
   CREATE POLICY "allow_admin_read" ON page_views FOR SELECT
     USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role='admin'));
   ============================================================ */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCurrentUser } from "/supabase.js";

const SUPABASE_URL = "https://aaqhknkyrnsapvfywdsn.supabase.co";
const SUPABASE_KEY = "sb_publishable_ND-51tP1NF40HRZ3q05N5w_1ZnlPzlL";

const _sb = createClient(SUPABASE_URL, SUPABASE_KEY);

/* ── Session ID: persisten per browser session ── */
function getSessionId() {
  let sid = sessionStorage.getItem("_pk_sid");
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem("_pk_sid", sid);
  }
  return sid;
}

/* ── Deteksi perangkat ── */
function getDevice() {
  const ua = navigator.userAgent;
  if (/tablet|ipad|playbook|silk/i.test(ua)) return "tablet";
  if (/mobile|android|iphone|ipod|blackberry|windows phone/i.test(ua)) return "mobile";
  return "desktop";
}

/* ── Throttle: jangan track halaman yang sama dalam 5 detik ── */
let _lastTracked = "";
let _lastTime    = 0;

async function trackPageView() {
  const path = window.location.pathname + window.location.search;
  const now  = Date.now();

  /* Skip kalau halaman sama dan baru saja di-track */
  if (path === _lastTracked && now - _lastTime < 5000) return;
  _lastTracked = path;
  _lastTime    = now;

  /* Skip halaman admin */
  if (path.startsWith("/admin")) return;

  try {
    /* Ambil user yang sedang login (opsional, bisa null) */
    let userId = null;
    try {
      const user = await getCurrentUser();
      userId = user?.id || null;
    } catch { /* abaikan jika gagal */ }

    await _sb.from("page_views").insert({
      path:       path,
      title:      document.title || "",
      referrer:   document.referrer || null,
      device:     getDevice(),
      session_id: getSessionId(),
      user_id:    userId,
    });
  } catch (err) {
    /* Silent fail — jangan ganggu UX kalau tracking gagal */
    console.debug("[tracker] skip:", err?.message);
  }
}

/* ── Track saat halaman dimuat ── */
if (document.readyState === "complete") {
  trackPageView();
} else {
  window.addEventListener("load", trackPageView, { once: true });
}

/* ── Track SPA navigation (kalau pakai router.js) ── */
(function() {
  const orig = history.pushState.bind(history);
  history.pushState = function(...args) {
    orig(...args);
    setTimeout(trackPageView, 100);
  };
  window.addEventListener("popstate", () => setTimeout(trackPageView, 100));
})();
