{
  "rewrites": [
    { "source": "/novel",                         "destination": "/novel.html" },
    { "source": "/novel/",                        "destination": "/novel.html" },
    { "source": "/genre",                         "destination": "/genre.html" },
    { "source": "/genre/",                        "destination": "/genre.html" },
    { "source": "/donatur",                       "destination": "/donatur.html" },
    { "source": "/donatur/",                      "destination": "/donatur.html" },
    { "source": "/profil",                        "destination": "/profile.html" },
    { "source": "/profil/",                       "destination": "/profile.html" },
    { "source": "/masuk",                         "destination": "/auth.html" },
    { "source": "/masuk/",                        "destination": "/auth.html" },
    { "source": "/komik/:komikSlug/:chapterSlug", "destination": "/reader.html?slug=:chapterSlug&komik=:komikSlug" },
    { "source": "/komik/:slug",                   "destination": "/detail.html?slug=:slug" },
    { "source": "/baca/:slug",                    "destination": "/reader.html?slug=:slug" },
    { "source": "/novel/:slug",                   "destination": "/novel-detail.html?slug=:slug" },
    { "source": "/baca-novel/:slug",              "destination": "/novel-reader.html?slug=:slug" },
    { "source": "/genre/:slug",                   "destination": "/genre.html?genre=:slug" }
  ]
}
