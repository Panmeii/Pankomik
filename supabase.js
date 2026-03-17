/* ============================================================
   PANKOMIK — supabase.js
   File ini adalah "jembatan" antara Pankomik dan Supabase.
   Import file ini di semua halaman HTML.

   CARA PAKAI:
   Ganti dua variabel di bawah dengan milikmu:
   - SUPABASE_URL  → dari Settings > API > Project URL
   - SUPABASE_KEY  → dari Settings > API > anon public key
   ============================================================ */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ---- KONFIGURASI ------------------------------------------ */
/* ⚠️  Ganti kedua nilai ini dengan milikmu dari dashboard Supabase */
const SUPABASE_URL = "https://aaqhknkyrnsapvfywdsn.supabase.co";
const SUPABASE_KEY = "sb_publishable_ND-51tP1NF40HRZ3q05N5w_1ZnlPzlL";  /* anon/public key — aman untuk frontend */

/* Buat satu instance client, dipakai di seluruh aplikasi */
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);


/* ============================================================
   AUTH — LOGIN, REGISTER, LOGOUT
   ============================================================ */

/**
 * Daftar dengan email + password
 * @returns { user, error }
 */
export async function registerWithEmail(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  return { user: data?.user, error };
}

/**
 * Login dengan email + password
 * @returns { user, error }
 */
export async function loginWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  return { user: data?.user, error };
}

/**
 * Login dengan Google (OAuth)
 * Redirect ke halaman ini setelah login sukses
 */
export async function loginWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      /* Setelah login Google, user diarahkan ke sini */
      redirectTo: window.location.origin + "/index.html"
    }
  });
  if (error) console.error("Google login error:", error);
}

/**
 * Logout
 */
export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (!error) window.location.href = "index.html";
}

/**
 * Ambil user yang sedang login
 * @returns user object atau null
 */
export async function getCurrentUser() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user || null;
}

/**
 * Dengarkan perubahan status auth (login/logout)
 * @param callback(user) — dipanggil saat status berubah
 */
export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null);
  });
}


/* ============================================================
   PROFILES
   ============================================================ */

/**
 * Ambil profil user berdasarkan id
 */
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*, user_badges(badge_id, earned_at, badges(name, icon, description))")
    .eq("id", userId)
    .single();
  return { profile: data, error };
}

/**
 * Update profil (username, avatar_url)
 */
export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();
  return { profile: data, error };
}

/**
 * Upload foto profil ke Supabase Storage
 * Pastikan sudah buat bucket "avatars" di Storage (public bucket)
 */
export async function uploadAvatar(userId, file) {
  /* Nama file unik berdasarkan user id */
  const path = `${userId}/avatar.${file.name.split(".").pop()}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true });

  if (uploadError) return { url: null, error: uploadError };

  /* Ambil public URL */
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}


/* ============================================================
   BOOKMARKS
   ============================================================ */

/**
 * Tambah bookmark.
 * Kalau sudah ada (komik yang sama), update kategorinya.
 * @param kategori "favorit" | "lagi_dibaca" | "tamat"
 */
export async function addBookmark(userId, komik) {
  /*
    upsert: kalau sudah ada (user_id + komik_slug sama) → update
            kalau belum ada → insert
  */
  const { data, error } = await supabase
    .from("bookmarks")
    .upsert({
      user_id:     userId,
      komik_slug:  komik.slug,
      komik_title: komik.title,
      komik_cover: komik.cover,
      kategori:    komik.kategori || "favorit"
    }, { onConflict: "user_id,komik_slug" })
    .select()
    .single();
  return { bookmark: data, error };
}

/**
 * Hapus bookmark
 */
export async function removeBookmark(userId, komikSlug) {
  const { error } = await supabase
    .from("bookmarks")
    .delete()
    .eq("user_id", userId)
    .eq("komik_slug", komikSlug);
  return { error };
}

/**
 * Cek apakah komik sudah di-bookmark
 * @returns { isBookmarked: boolean, kategori: string|null }
 */
export async function checkBookmark(userId, komikSlug) {
  const { data } = await supabase
    .from("bookmarks")
    .select("kategori")
    .eq("user_id", userId)
    .eq("komik_slug", komikSlug)
    .single();
  return { isBookmarked: !!data, kategori: data?.kategori || null };
}

/**
 * Ambil semua bookmark user, dikelompokkan per kategori
 */
export async function getBookmarks(userId) {
  const { data, error } = await supabase
    .from("bookmarks")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return { bookmarks: {}, error };

  /* Kelompokkan berdasarkan kategori */
  const grouped = { favorit: [], lagi_dibaca: [], tamat: [] };
  data.forEach(b => {
    if (grouped[b.kategori]) grouped[b.kategori].push(b);
  });

  return { bookmarks: grouped, error: null };
}


/* ============================================================
   READING HISTORY
   ============================================================ */

/**
 * Simpan/update riwayat baca.
 * Kalau komik sudah pernah dibaca → update chapter-nya.
 */
export async function saveHistory(userId, komik, chapter) {
  const { data, error } = await supabase
    .from("reading_history")
    .upsert({
      user_id:        userId,
      komik_slug:     komik.slug,
      komik_title:    komik.title,
      komik_cover:    komik.cover,
      chapter_slug:   chapter.slug,
      chapter_number: chapter.number,
      read_at:        new Date().toISOString()
    }, { onConflict: "user_id,komik_slug" })
    .select()
    .single();
  return { history: data, error };
}

/**
 * Ambil semua riwayat baca user (terbaru dulu)
 */
export async function getHistory(userId) {
  const { data, error } = await supabase
    .from("reading_history")
    .select("*")
    .eq("user_id", userId)
    .order("read_at", { ascending: false })
    .limit(50);  /* maks 50 item */
  return { history: data || [], error };
}

/**
 * Ambil chapter terakhir yang dibaca untuk satu komik
 * (dipakai untuk fitur "Lanjut Baca" di detail page)
 */
export async function getLastRead(userId, komikSlug) {
  const { data } = await supabase
    .from("reading_history")
    .select("chapter_slug, chapter_number, read_at")
    .eq("user_id", userId)
    .eq("komik_slug", komikSlug)
    .single();
  return data || null;
}


/* ============================================================
   READING PROGRESS
   ============================================================ */

/**
 * Update progress baca.
 * Dipanggil setiap kali user baca chapter baru.
 */
export async function updateProgress(userId, komik, totalChapters) {
  /* Hitung jumlah chapter unik yang sudah dibaca */
  const { count } = await supabase
    .from("reading_history")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("komik_slug", komik.slug);

  const readChapters = count || 1;
  const percent      = totalChapters > 0
    ? Math.round((readChapters / totalChapters) * 100)
    : 0;

  const { data, error } = await supabase
    .from("reading_progress")
    .upsert({
      user_id:           userId,
      komik_slug:        komik.slug,
      komik_title:       komik.title,
      total_chapters:    totalChapters,
      read_chapters:     readChapters,
      last_chapter_slug: komik.lastChapterSlug,
      updated_at:        new Date().toISOString()
    }, { onConflict: "user_id,komik_slug" })
    .select()
    .single();

  /* Update total chapter di profil & cek badge */
  await updateTotalChapters(userId);

  return { progress: data, percent, error };
}

/**
 * Update total chapter yang dibaca di profil user
 * (dipakai untuk sistem level dan badge)
 */
async function updateTotalChapters(userId) {
  /* Hitung total baris di reading_history user ini */
  const { count } = await supabase
    .from("reading_history")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  const total = count || 0;

  /* Hitung level: naik level tiap 50 chapter */
  const level = Math.floor(total / 50) + 1;

  await supabase
    .from("profiles")
    .update({ total_chapters_read: total, level })
    .eq("id", userId);

  /* Cek dan berikan badge yang layak */
  await checkAndAwardBadges(userId, total);
}


/* ============================================================
   BADGE SYSTEM
   ============================================================ */

/**
 * Cek apakah user layak dapat badge baru, lalu berikan.
 * Dipanggil otomatis setelah update progress.
 */
async function checkAndAwardBadges(userId, totalChapters) {
  /* Ambil semua badge yang syaratnya terpenuhi */
  const { data: eligibleBadges } = await supabase
    .from("badges")
    .select("id")
    .lte("min_chapters", totalChapters);

  if (!eligibleBadges?.length) return;

  /* Ambil badge yang sudah dimiliki user */
  const { data: ownedBadges } = await supabase
    .from("user_badges")
    .select("badge_id")
    .eq("user_id", userId);

  const ownedIds = new Set((ownedBadges || []).map(b => b.badge_id));

  /* Filter badge baru yang belum dimiliki */
  const newBadges = eligibleBadges
    .filter(b => !ownedIds.has(b.id))
    .map(b => ({ user_id: userId, badge_id: b.id }));

  if (newBadges.length > 0) {
    await supabase.from("user_badges").insert(newBadges);
  }
}


/* ============================================================
   COMMENTS
   ============================================================ */

/**
 * Ambil komentar untuk sebuah komik
 * Termasuk info profil user dan jumlah reply
 */
export async function getComments(komikSlug) {
  const { data, error } = await supabase
    .from("comments")
    .select(`
      *,
      profiles (username, avatar_url, level),
      replies:comments!parent_id (
        id, content, like_count, created_at,
        profiles (username, avatar_url)
      )
    `)
    .eq("komik_slug", komikSlug)
    .is("parent_id", null)           /* hanya komentar utama (bukan reply) */
    .order("created_at", { ascending: false })
    .limit(50);

  return { comments: data || [], error };
}

/**
 * Tambah komentar baru
 * @param parentId null untuk komentar baru, UUID untuk reply
 */
export async function addComment(userId, komikSlug, content, parentId = null) {
  const { data, error } = await supabase
    .from("comments")
    .insert({
      user_id:    userId,
      komik_slug: komikSlug,
      content:    content.trim(),
      parent_id:  parentId
    })
    .select("*, profiles(username, avatar_url, level)")
    .single();
  return { comment: data, error };
}

/**
 * Hapus komentar (hanya milik sendiri)
 */
export async function deleteComment(commentId) {
  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId);
  return { error };
}

/**
 * Like / Unlike komentar (toggle)
 * @returns { liked: boolean } — true kalau baru di-like, false kalau di-unlike
 */
export async function toggleLike(userId, commentId) {
  /* Cek apakah sudah like */
  const { data: existing } = await supabase
    .from("comment_likes")
    .select("user_id")
    .eq("user_id", userId)
    .eq("comment_id", commentId)
    .single();

  if (existing) {
    /* Sudah like → unlike */
    await supabase.from("comment_likes")
      .delete()
      .eq("user_id", userId)
      .eq("comment_id", commentId);
    return { liked: false };
  } else {
    /* Belum like → like */
    await supabase.from("comment_likes")
      .insert({ user_id: userId, comment_id: commentId });
    return { liked: true };
  }
}

/**
 * Cek komentar mana yang sudah di-like oleh user
 * @returns Set berisi comment_id yang sudah di-like
 */
export async function getLikedComments(userId) {
  const { data } = await supabase
    .from("comment_likes")
    .select("comment_id")
    .eq("user_id", userId);

  return new Set((data || []).map(l => l.comment_id));
}