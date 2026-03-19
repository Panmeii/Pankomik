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
      redirectTo: window.location.origin + "/"
    }
  });
  if (error) console.error("Google login error:", error);
}

/**
 * Ganti password user yang sedang login
 * @returns { error }
 */
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error };
}

/**
 * Cek apakah user login via Google (OAuth), bukan email/password
 * OAuth user tidak bisa ganti password
 */
export function isOAuthUser(user) {
  return user?.app_metadata?.provider === "google"
    || (user?.identities || []).some(i => i.provider === "google");
}

/**
 * Logout
 */
export async function logout() {
  await supabase.auth.signOut();
  window.location.href = '/';
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
  /* Coba update dulu */
  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();

  /* Kalau update berhasil, return langsung */
  if (!error) return { profile: data, error: null };

  /* Kalau error karena row tidak ada (profiles belum dibuat untuk user ini),
     coba upsert untuk create sekaligus update */
  if (error.code === "PGRST116" || error.message?.includes("No rows")) {
    const { data: upserted, error: upsertError } = await supabase
      .from("profiles")
      .upsert({ id: userId, ...updates })
      .select()
      .single();
    return { profile: upserted, error: upsertError };
  }

  console.error("updateProfile error:", error);
  return { profile: null, error };
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
 * Tabel reading_history → upsert per komik (untuk "terakhir dibaca")
 * Tabel chapter_reads    → insert per chapter unik (untuk hitung total)
 */
export async function saveHistory(userId, komik, chapter) {
  /* 1. Upsert di reading_history (satu baris per komik = chapter terakhir) */
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

  /* 2. Insert di chapter_reads (unik per user+chapter, untuk hitung XP) */
  /*    ignoreDuplicates: true → tidak error kalau sudah pernah baca chapter ini */
  await supabase
    .from("chapter_reads")
    .upsert({
      user_id:      userId,
      chapter_slug: chapter.slug,
      komik_slug:   komik.slug,
      read_at:      new Date().toISOString()
    }, { onConflict: "user_id,chapter_slug", ignoreDuplicates: true });

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
 *
 * Bug fix: destructure error juga — .single() throw PGRST116 jika
 * tidak ada baris, yang sebelumnya di-silent dan bisa menyebabkan
 * data berisi undefined (bukan null) di beberapa versi Supabase client.
 */
export async function getLastRead(userId, komikSlug) {
  if (!userId || !komikSlug) return null;
  const { data, error } = await supabase
    .from("reading_history")
    .select("chapter_slug, chapter_number, read_at")
    .eq("user_id", userId)
    .eq("komik_slug", komikSlug)
    .order("read_at", { ascending: false })
    .limit(1)
    .maybeSingle();          /* maybeSingle: tidak error kalau 0 baris */
  if (error) {
    console.warn("[getLastRead] Error:", error.message);
    return null;
  }
  return data || null;
}


/* ============================================================
   READING PROGRESS
   ============================================================ */

/**
 * Ambil semua reading progress user (untuk halaman profil)
 * Diurutkan berdasarkan waktu update terbaru
 */
export async function getProgress(userId) {
  const { data, error } = await supabase
    .from("reading_progress")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50);
  return { progress: data || [], error };
}

/**
 * Update progress baca.
 * Dipanggil setiap kali user baca chapter baru.
 */
export async function updateProgress(userId, komik, totalChapters) {
  /* Hitung chapter UNIK yang sudah dibaca untuk komik ini
     dari chapter_reads (bukan reading_history yang upsert per komik) */
  const { count: readCount } = await supabase
    .from("chapter_reads")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("komik_slug", komik.slug);

  const readChapters = readCount || 1;
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
  /* Hitung TOTAL chapter unik yang pernah dibaca user (lintas semua komik) */
  const { count } = await supabase
    .from("chapter_reads")
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


/**
 * Ambil total chapter unik yang sudah dibaca user (dari chapter_reads)
 * Dipakai di halaman profil untuk sync manual
 */
export async function getTotalChaptersRead(userId) {
  const { count, error } = await supabase
    .from("chapter_reads")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  return { total: count || 0, error };
}

/**
 * Sync ulang total_chapters_read, level, DAN nama/avatar dari Google.
 * Panggil ini saat halaman profil dibuka.
 */
export async function syncProfileProgress(userId) {
  /* 1. Sync chapter count & level */
  await updateTotalChapters(userId);

  /* 2. Sync nama & avatar dari Google metadata kalau profile masih kosong */
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    /* Pakai maybeSingle() agar tidak error kalau row belum ada */
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, avatar_url")
      .eq("id", userId)
      .maybeSingle();

    const meta       = user.user_metadata || {};
    const googleName = meta.full_name || meta.name || meta.preferred_username
                       || user.email?.split("@")[0] || "User";
    const googleAv   = meta.avatar_url || meta.picture || null;

    /* Hanya update kolom yang masih kosong — tidak timpa yang sudah diset user */
    const updates = {};
    if (!profile?.username)   updates.username   = googleName;
    if (!profile?.avatar_url) updates.avatar_url = googleAv;

    if (Object.keys(updates).length > 0) {
      await supabase
        .from("profiles")
        .upsert({ id: userId, ...updates }, { onConflict: "id", ignoreDuplicates: false });
    }
  } catch (e) {
    console.warn("[syncProfileProgress] metadata sync error:", e);
  }
}


/* ============================================================
   BADGE SYSTEM
   ============================================================ */

/* Definisi badge hardcoded sebagai fallback kalau tabel badges kosong */
const BADGE_DEFINITIONS = [
  { id: "pemula",        name: "Pemula",        icon: "📖", min_chapters: 1    },
  { id: "pembaca_aktif", name: "Pembaca Aktif",  icon: "🔥", min_chapters: 50   },
  { id: "otaku",         name: "Otaku",          icon: "⭐", min_chapters: 200  },
  { id: "legenda",       name: "Legenda",        icon: "👑", min_chapters: 500  },
  { id: "top_reader",    name: "Top Reader",     icon: "🏆", min_chapters: 1000 },
];

/**
 * Cek apakah user layak dapat badge baru, lalu berikan.
 * Dipanggil otomatis setelah update progress.
 */
async function checkAndAwardBadges(userId, totalChapters) {
  /* Coba dari tabel badges dulu */
  let { data: dbBadges } = await supabase
    .from("badges")
    .select("id, min_chapters")
    .lte("min_chapters", totalChapters)
    .gt("min_chapters", 0);

  /* Kalau tabel badges kosong atau tidak ada, pakai definisi hardcoded */
  if (!dbBadges?.length) {
    /* Simulasikan dengan badge hardcoded menggunakan string id */
    const eligible = BADGE_DEFINITIONS.filter(b => b.min_chapters <= totalChapters && totalChapters > 0);
    if (!eligible.length) return;

    /* Ambil badge yang sudah dimiliki (pakai badge_name sebagai key) */
    const { data: owned } = await supabase
      .from("user_badges")
      .select("badge_id")
      .eq("user_id", userId);

    const ownedIds = new Set((owned || []).map(b => b.badge_id));

    const newBadges = eligible
      .filter(b => !ownedIds.has(b.id))
      .map(b => ({ user_id: userId, badge_id: b.id, earned_at: new Date().toISOString() }));

    if (newBadges.length > 0) {
      await supabase.from("user_badges").insert(newBadges);
    }
    return;
  }

  /* Pakai data dari tabel badges DB */
  const { data: ownedBadges } = await supabase
    .from("user_badges")
    .select("badge_id")
    .eq("user_id", userId);

  const ownedIds = new Set((ownedBadges || []).map(b => b.badge_id));

  const newBadges = dbBadges
    .filter(b => !ownedIds.has(b.id))
    .map(b => ({ user_id: userId, badge_id: b.id, earned_at: new Date().toISOString() }));

  if (newBadges.length > 0) {
    await supabase.from("user_badges").insert(newBadges);
  }
}


/* ============================================================
   LEADERBOARD
   ============================================================ */

/**
 * Ambil top N user berdasarkan total_chapters_read dari tabel profiles
 * @param {number} limit  — jumlah user yang ditampilkan (default 20)
 */
export async function getLeaderboard(limit = 20) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, level, total_chapters_read")
    .order("total_chapters_read", { ascending: false })
    .gt("total_chapters_read", 0)
    .limit(limit);
  return { leaderboard: data || [], error };
}

/**
 * Leaderboard novel — top pembaca berdasarkan total_novel_chapters_read
 */
export async function getNovelLeaderboard(limit = 20) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, avatar_url, level, total_novel_chapters_read")
    .order("total_novel_chapters_read", { ascending: false })
    .gt("total_novel_chapters_read", 0)
    .limit(limit);
  return { leaderboard: data || [], error };
}

/* ============================================================
   COMMENTS - FIXED VERSION (No Foreign Key Dependency)
   ============================================================ */

/**
 * Ambil komentar untuk sebuah komik TANPA foreign key relationship
 * Menggunakan query terpisah untuk menghindari error PGRST200
 */
export async function getComments(komikSlug) {
  try {
    // 1. Ambil komentar utama (tanpa join ke profiles)
    const { data: comments, error: commentsError } = await supabase
      .from("comments")
      .select(`
        id, content, created_at, user_id, komik_slug, parent_id, like_count
      `)
      .eq("komik_slug", komikSlug)
      .is("parent_id", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (commentsError) throw commentsError;
    if (!comments || comments.length === 0) return { comments: [], error: null };

    // 2. Ambil semua user_id unik dari komentar
    const userIds = [...new Set(comments.map(c => c.user_id))];

    // 3. Ambil profiles untuk user-user tersebut (query terpisah)
    let profilesMap = {};
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, level")
        .in("id", userIds);

      if (profilesError) {
        console.warn("Error fetching profiles:", profilesError);
      } else if (profiles) {
        profiles.forEach(p => {
          profilesMap[p.id] = p;
        });
      }
    }

    // 4. Ambil like counts untuk semua komentar
    const commentIds = comments.map(c => c.id);
    let likeCountMap = {};

    const { data: likeCounts, error: likeError } = await supabase
      .from("comment_likes")
      .select("comment_id")
      .in("comment_id", commentIds);

    if (likeError) {
      console.warn("Error fetching like counts:", likeError);
    } else if (likeCounts) {
      likeCounts.forEach(like => {
        likeCountMap[like.comment_id] = (likeCountMap[like.comment_id] || 0) + 1;
      });
    }

    // 5. Ambil replies untuk komentar utama
    const { data: replies, error: repliesError } = await supabase
      .from("comments")
      .select(`
        id, content, created_at, user_id, komik_slug, parent_id, like_count
      `)
      .in("parent_id", commentIds)
      .order("created_at", { ascending: true });

    let enrichedReplies = [];
    if (replies && replies.length > 0) {
      // Ambil user_ids dari replies
      const replyUserIds = [...new Set(replies.map(r => r.user_id))];

      // Ambil profiles untuk replies (gabung dengan yang sudah ada)
      const allReplyUserIds = replyUserIds.filter(id => !profilesMap[id]);
      if (allReplyUserIds.length > 0) {
        const { data: replyProfiles } = await supabase
          .from("profiles")
          .select("id, username, avatar_url, level")
          .in("id", allReplyUserIds);

        if (replyProfiles) {
          replyProfiles.forEach(p => {
            profilesMap[p.id] = p;
          });
        }
      }

      // Ambil like counts untuk replies
      const replyIds = replies.map(r => r.id);
      const { data: replyLikes } = await supabase
        .from("comment_likes")
        .select("comment_id")
        .in("comment_id", replyIds);

      let replyLikeMap = {};
      if (replyLikes) {
        replyLikes.forEach(like => {
          replyLikeMap[like.comment_id] = (replyLikeMap[like.comment_id] || 0) + 1;
        });
      }

      // Enrich replies dengan profile dan like count
      enrichedReplies = replies.map(r => ({
        ...r,
        profiles: profilesMap[r.user_id] || { username: "User", avatar_url: null, level: 1 },
        like_count: replyLikeMap[r.id] || r.like_count || 0
      }));
    }

    // 6. Group replies by parent_id
    const repliesByParent = {};
    enrichedReplies.forEach(reply => {
      if (!repliesByParent[reply.parent_id]) {
        repliesByParent[reply.parent_id] = [];
      }
      repliesByParent[reply.parent_id].push(reply);
    });

    // 7. Gabungkan komentar dengan profile dan replies
    const enrichedComments = comments.map(c => ({
      ...c,
      profiles: profilesMap[c.user_id] || { username: "User", avatar_url: null, level: 1 },
      like_count: likeCountMap[c.id] || c.like_count || 0,
      replies: repliesByParent[c.id] || []
    }));

    return { comments: enrichedComments, error: null };

  } catch (err) {
    console.error("Error in getComments:", err);
    return { comments: [], error: err };
  }
}

/**
 * Tambah komentar baru
 */
/* Cooldown guard untuk addComment — cegah spam kiriman cepat */
let _lastCommentAt = 0;
const COMMENT_COOLDOWN_MS = 3000; /* 3 detik antar komentar */

export async function addComment(userId, komikSlug, content, parentId = null) {
  try {
    if (!content || content.trim().length === 0) {
      return { comment: null, error: { message: "Komentar tidak boleh kosong" } };
    }
    if (content.length > 1000) {
      return { comment: null, error: { message: "Komentar terlalu panjang (maks 1000 karakter)" } };
    }

    /* Cooldown check */
    const now = Date.now();
    if (now - _lastCommentAt < COMMENT_COOLDOWN_MS) {
      const sisa = Math.ceil((COMMENT_COOLDOWN_MS - (now - _lastCommentAt)) / 1000);
      return { comment: null, error: { message: `Harap tunggu ${sisa} detik sebelum komentar lagi.` } };
    }
    _lastCommentAt = now;

    const sanitizedContent = content
      .trim()
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    const { data, error } = await supabase
      .from("comments")
      .insert({
        user_id:    userId,
        komik_slug: komikSlug,
        content:    sanitizedContent,
        parent_id:  parentId,
        like_count: 0
      })
      .select()
      .single();

    if (error) throw error;

    // Ambil profile user untuk response
    const { data: profile } = await supabase
      .from("profiles")
      .select("username, avatar_url, level")
      .eq("id", userId)
      .single();

    return { 
      comment: { 
        ...data, 
        profiles: profile || { username: "User", avatar_url: null, level: 1 },
        like_count: 0, 
        replies: [] 
      }, 
      error: null 
    };

  } catch (err) {
    console.error("Error in addComment:", err);
    return { comment: null, error: err };
  }
}

/**
 * Hapus komentar dengan verifikasi ownership
 */
export async function deleteComment(commentId, userId) {
  try {
    // Verifikasi ownership
    const { data: comment, error: fetchError } = await supabase
      .from("comments")
      .select("user_id")
      .eq("id", commentId)
      .single();

    if (fetchError) throw fetchError;
    if (!comment) throw new Error("Komentar tidak ditemukan");
    if (comment.user_id !== userId) {
      throw new Error("Anda tidak memiliki izin untuk menghapus komentar ini");
    }

    // Hapus likes terlebih dahulu
    await supabase
      .from("comment_likes")
      .delete()
      .eq("comment_id", commentId);

    // Hapus replies
    await supabase
      .from("comments")
      .delete()
      .eq("parent_id", commentId);

    // Hapus komentar utama
    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", commentId);

    if (error) throw error;
    return { error: null };

  } catch (err) {
    console.error("Error in deleteComment:", err);
    return { error: err };
  }
}

/**
 * Like / Unlike komentar.
 *
 * Coba via RPC "toggle_comment_like" (SECURITY DEFINER, bypass RLS).
 * Jika RPC belum dibuat, fallback ke insert/delete langsung.
 *
 * ── SQL untuk dijalankan di Supabase SQL Editor ──────────────
 * CREATE OR REPLACE FUNCTION toggle_comment_like(
 *   p_user_id uuid, p_comment_id uuid
 * ) RETURNS json LANGUAGE plpgsql SECURITY DEFINER
 * SET search_path = public AS $$
 * DECLARE
 *   v_exist uuid; v_count int; v_liked boolean;
 * BEGIN
 *   SELECT id INTO v_exist FROM comment_likes
 *   WHERE user_id=p_user_id AND comment_id=p_comment_id LIMIT 1;
 *   IF v_exist IS NOT NULL THEN
 *     DELETE FROM comment_likes WHERE id=v_exist;
 *     v_liked := false;
 *   ELSE
 *     INSERT INTO comment_likes(user_id,comment_id)
 *     VALUES(p_user_id,p_comment_id) ON CONFLICT DO NOTHING;
 *     v_liked := true;
 *   END IF;
 *   SELECT COUNT(*) INTO v_count FROM comment_likes WHERE comment_id=p_comment_id;
 *   UPDATE comments SET like_count=v_count WHERE id=p_comment_id;
 *   RETURN json_build_object('liked',v_liked,'like_count',v_count);
 * END; $$;
 * ─────────────────────────────────────────────────────────────
 */
export async function toggleLike(userId, commentId) {
  const uid = String(userId);
  const cid = String(commentId);

  /* ── 1. Coba RPC (bypass RLS) ───────────────────────────── */
  try {
    const { data, error: rpcErr } = await supabase.rpc("toggle_comment_like", {
      p_user_id: uid,
      p_comment_id: cid,
    });
    if (!rpcErr && data != null) {
      const r = typeof data === "string" ? JSON.parse(data) : data;
      return { liked: !!r.liked, likeCount: r.like_count ?? 0, error: null };
    }
    if (rpcErr) console.warn("[like] RPC gagal →", rpcErr.message, "| pakai fallback");
  } catch (ex) {
    console.warn("[like] RPC exception →", ex, "| pakai fallback");
  }

  /* ── 2. Fallback langsung ────────────────────────────────── */
  try {
    /* Cek sudah like belum */
    const { data: ex, error: exErr } = await supabase
      .from("comment_likes").select("id")
      .eq("user_id", uid).eq("comment_id", cid).maybeSingle();
    if (exErr) throw exErr;

    let liked;
    if (ex) {
      /* Unlike */
      const { error: delErr } = await supabase
        .from("comment_likes").delete().eq("id", ex.id);
      if (delErr) throw delErr;
      liked = false;
    } else {
      /* Like */
      const { error: insErr } = await supabase
        .from("comment_likes").insert({ user_id: uid, comment_id: cid });
      if (insErr && insErr.code !== "23505") throw insErr;
      liked = true;
    }

    /* Hitung ulang */
    const { count } = await supabase
      .from("comment_likes").select("*", { count: "exact", head: true })
      .eq("comment_id", cid);
    const newCount = count ?? (liked ? 1 : 0);

    /* Update like_count — abaikan error RLS */
    supabase.from("comments").update({ like_count: newCount }).eq("id", cid)
      .then(({ error: upErr }) => {
        if (upErr) console.warn("[like] like_count update diblokir RLS:", upErr.message);
      });

    return { liked, likeCount: newCount, error: null };
  } catch (err) {
    console.error("[like] Error:", err);
    return { liked: false, likeCount: null, error: err };
  }
}

/**
 * Cek komentar mana yang sudah di-like oleh user
 */
export async function getLikedComments(userId) {
  try {
    const { data, error } = await supabase
      .from("comment_likes")
      .select("comment_id")
      .eq("user_id", userId);

    if (error) throw error;
    return new Set((data || []).map(l => l.comment_id));

  } catch (err) {
    console.error("Error in getLikedComments:", err);
    return new Set();
  }
}

/* ============================================================
   NOVEL — BOOKMARK
   Tabel: novel_bookmarks (terpisah dari bookmarks komik)
   Kolom: user_id, novel_slug, novel_title, novel_cover, kategori, created_at
   ============================================================ */

export async function addNovelBookmark(userId, novel) {
  const { data, error } = await supabase
    .from("novel_bookmarks")
    .upsert({
      user_id:     userId,
      novel_slug:  novel.slug,
      novel_title: novel.title,
      novel_cover: novel.cover || "",
      kategori:    novel.kategori || "favorit"
    }, { onConflict: "user_id,novel_slug" })
    .select().single();
  return { bookmark: data, error };
}

export async function removeNovelBookmark(userId, novelSlug) {
  const { error } = await supabase
    .from("novel_bookmarks").delete()
    .eq("user_id", userId).eq("novel_slug", novelSlug);
  return { error };
}

export async function checkNovelBookmark(userId, novelSlug) {
  const { data } = await supabase
    .from("novel_bookmarks").select("kategori")
    .eq("user_id", userId).eq("novel_slug", novelSlug).single();
  return { isBookmarked: !!data, kategori: data?.kategori || null };
}

export async function getNovelBookmarks(userId) {
  const { data, error } = await supabase
    .from("novel_bookmarks").select("*")
    .eq("user_id", userId).order("created_at", { ascending: false });
  if (error) return { bookmarks: {}, error };
  const grouped = { favorit: [], lagi_dibaca: [], tamat: [] };
  (data || []).forEach(b => { if (grouped[b.kategori]) grouped[b.kategori].push(b); });
  return { bookmarks: grouped, error: null };
}


/* ============================================================
   NOVEL — READING HISTORY & PROGRESS
   Tabel: novel_reading_history
   Kolom: user_id, novel_slug, novel_title, novel_cover,
          chapter_slug, chapter_title, read_at
   ============================================================ */

export async function saveNovelHistory(userId, novel, chapter) {
  const { data, error } = await supabase
    .from("novel_reading_history")
    .upsert({
      user_id:       userId,
      novel_slug:    novel.slug,
      novel_title:   novel.title,
      novel_cover:   novel.cover || "",
      chapter_slug:  chapter.slug,
      chapter_title: chapter.title || "",
      read_at:       new Date().toISOString()
    }, { onConflict: "user_id,novel_slug" })
    .select().single();

  /* Juga catat di novel_chapter_reads (untuk XP / level) */
  await supabase.from("novel_chapter_reads").upsert({
    user_id:      userId,
    chapter_slug: chapter.slug,
    novel_slug:   novel.slug,
    read_at:      new Date().toISOString()
  }, { onConflict: "user_id,chapter_slug", ignoreDuplicates: true });

  /* Update total chapter di profil */
  await updateTotalNovelChapters(userId);

  return { history: data, error };
}

export async function getNovelHistory(userId) {
  const { data, error } = await supabase
    .from("novel_reading_history").select("*")
    .eq("user_id", userId).order("read_at", { ascending: false }).limit(50);
  return { history: data || [], error };
}

export async function getLastNovelRead(userId, novelSlug) {
  const { data } = await supabase
    .from("novel_reading_history")
    .select("chapter_slug, chapter_title, read_at")
    .eq("user_id", userId).eq("novel_slug", novelSlug).single();
  return data || null;
}

async function updateTotalNovelChapters(userId) {
  const { count } = await supabase
    .from("novel_chapter_reads").select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  await supabase.from("profiles")
    .update({ total_novel_chapters_read: count || 0 })
    .eq("id", userId);
}

export async function getTotalNovelChaptersRead(userId) {
  const { count, error } = await supabase
    .from("novel_chapter_reads").select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  return { total: count || 0, error };
}


/* ============================================================
   KOMENTAR UNIVERSAL — Novel Detail & Reader
   Menggunakan kolom komik_slug sebagai identifier universal.
   Format slug:
     - Komik detail  : "komik-slug"
     - Novel detail  : "novel:novel-slug"
     - Komik chapter : "chapter:chapter-slug"
     - Novel chapter : "novel-chapter:chapter-slug"
   ============================================================ */

/**
 * Ambil komentar untuk slug apapun (komik/novel/chapter)
 * Reusable version dari getComments dengan slug bebas
 */
export async function getCommentsForSlug(contentSlug, limit = 50) {
  try {
    const { data: comments, error: commentsError } = await supabase
      .from("comments")
      .select("id, content, created_at, user_id, komik_slug, parent_id, like_count")
      .eq("komik_slug", contentSlug)
      .is("parent_id", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (commentsError) throw commentsError;
    if (!comments || comments.length === 0) return { comments: [], error: null };

    // Kumpulkan user_id unik
    const userIds = [...new Set(comments.map(c => c.user_id))];

    // Fetch profiles
    let profilesMap = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, level")
        .in("id", userIds);
      (profiles || []).forEach(p => { profilesMap[p.id] = p; });
    }

    // Fetch like counts
    const commentIds = comments.map(c => c.id);
    let likeCountMap = {};
    const { data: likeCounts } = await supabase
      .from("comment_likes")
      .select("comment_id")
      .in("comment_id", commentIds);
    (likeCounts || []).forEach(l => {
      likeCountMap[l.comment_id] = (likeCountMap[l.comment_id] || 0) + 1;
    });

    // Fetch replies
    const { data: replies } = await supabase
      .from("comments")
      .select("id, content, created_at, user_id, komik_slug, parent_id, like_count")
      .in("parent_id", commentIds)
      .order("created_at", { ascending: true });

    let enrichedReplies = [];
    if (replies && replies.length > 0) {
      const replyUserIds = [...new Set(replies.map(r => r.user_id))].filter(id => !profilesMap[id]);
      if (replyUserIds.length > 0) {
        const { data: rp } = await supabase
          .from("profiles")
          .select("id, username, avatar_url, level")
          .in("id", replyUserIds);
        (rp || []).forEach(p => { profilesMap[p.id] = p; });
      }
      const replyIds = replies.map(r => r.id);
      let replyLikeMap = {};
      const { data: replyLikes } = await supabase
        .from("comment_likes")
        .select("comment_id")
        .in("comment_id", replyIds);
      (replyLikes || []).forEach(l => {
        replyLikeMap[l.comment_id] = (replyLikeMap[l.comment_id] || 0) + 1;
      });
      enrichedReplies = replies.map(r => ({
        ...r,
        profiles: profilesMap[r.user_id] || { username: "User", avatar_url: null, level: 1 },
        like_count: replyLikeMap[r.id] || r.like_count || 0
      }));
    }

    const repliesByParent = {};
    enrichedReplies.forEach(r => {
      if (!repliesByParent[r.parent_id]) repliesByParent[r.parent_id] = [];
      repliesByParent[r.parent_id].push(r);
    });

    const enrichedComments = comments.map(c => ({
      ...c,
      profiles: profilesMap[c.user_id] || { username: "User", avatar_url: null, level: 1 },
      like_count: likeCountMap[c.id] || c.like_count || 0,
      replies: repliesByParent[c.id] || []
    }));

    return { comments: enrichedComments, error: null };
  } catch (err) {
    console.error("Error in getCommentsForSlug:", err);
    return { comments: [], error: err };
  }
}

/**
 * Tambah komentar universal (support semua tipe konten)
 * Wrapper tipis dari addComment yang sudah ada
 */
export async function addCommentForSlug(userId, contentSlug, content, parentId = null) {
  return addComment(userId, contentSlug, content, parentId);
}

/**
 * Ambil komentar terbaru dari seluruh platform (untuk widget home)
 * @param {number} limit
 */
export async function getLastComments(limit = 6) {
  try {
    const { data: comments, error } = await supabase
      .from("comments")
      .select("id, content, created_at, user_id, komik_slug, like_count")
      .is("parent_id", null)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    if (!comments || comments.length === 0) return { comments: [], error: null };

    const userIds = [...new Set(comments.map(c => c.user_id))];
    let profilesMap = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, level")
        .in("id", userIds);
      (profiles || []).forEach(p => { profilesMap[p.id] = p; });
    }

    return {
      comments: comments.map(c => ({
        ...c,
        profiles: profilesMap[c.user_id] || { username: "User", avatar_url: null, level: 1 }
      })),
      error: null
    };
  } catch (err) {
    console.error("Error in getLastComments:", err);
    return { comments: [], error: err };
  }
}

/**
 * Ambil komentar milik user sendiri (untuk tab profil)
 * @param {string} userId
 * @param {number} limit
 */
export async function getMyComments(userId, limit = 30) {
  try {
    const { data: comments, error } = await supabase
      .from("comments")
      .select("id, content, created_at, komik_slug, like_count, parent_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return { comments: comments || [], error: null };
  } catch (err) {
    console.error("Error in getMyComments:", err);
    return { comments: [], error: err };
  }
}
