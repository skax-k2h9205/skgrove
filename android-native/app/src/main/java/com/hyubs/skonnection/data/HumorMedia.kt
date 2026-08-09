package com.hyubs.skonnection.data

/**
 * 유머 글에 붙은 링크를 어떻게 보여줄지 판단한다(웹 humorRules.ts / iOS HumorStore.thumbnail 이식).
 *
 * 글에는 사용자가 붙여넣은 원본 링크가 그대로 저장된다. 목록 타일은 이미지 URL만 그릴 수 있어서,
 * 유튜브 링크는 여기서 썸네일 주소로 바꿔줘야 한다. 이 변환이 없으면 유튜브를 올린 글만
 * 피드에서 회색 타일로 나온다.
 */
object HumorMedia {

    enum class Kind { Image, Youtube, Video, Link, None }

    private val YOUTUBE_PATTERNS = listOf(
        Regex("""youtu\.be/([\w-]{11})"""),
        Regex("""[?&]v=([\w-]{11})"""),
        Regex("""youtube\.com/embed/([\w-]{11})"""),
        Regex("""youtube\.com/shorts/([\w-]{11})"""),
    )

    private val IMAGE_EXT = Regex("""\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?|$)""", RegexOption.IGNORE_CASE)
    private val VIDEO_EXT = Regex("""\.(mp4|webm|ogg)(\?|$)""", RegexOption.IGNORE_CASE)

    /** 붙여넣은 링크에서 영상 id 추출(watch·youtu.be·shorts·embed). */
    fun youtubeId(url: String): String? =
        YOUTUBE_PATTERNS.firstNotNullOfOrNull { it.find(url)?.groupValues?.getOrNull(1) }

    /**
     * 유튜브 썸네일 주소. API 키·서버가 필요 없는 고정 주소다.
     * hqdefault는 어느 영상에나 있는 480x360 — maxres는 없는 영상이 있어 쓰지 않는다.
     */
    fun youtubeThumb(url: String): String? =
        youtubeId(url)?.let { "https://img.youtube.com/vi/$it/hqdefault.jpg" }

    /** 안전한 scheme(http(s)·data:image)만 미디어로 본다. */
    fun kindOf(url: String?): Kind {
        val s = url?.trim().orEmpty()
        if (s.isEmpty()) return Kind.None
        if (youtubeId(s) != null) return Kind.Youtube
        val isHttp = s.startsWith("http://", true) || s.startsWith("https://", true)
        val isDataImage = s.startsWith("data:image/", true)
        if (isHttp && VIDEO_EXT.containsMatchIn(s)) return Kind.Video
        if (isDataImage || (isHttp && IMAGE_EXT.containsMatchIn(s))) return Kind.Image
        // Supabase Storage 업로드본은 확장자가 없는 경우가 있어 경로로 판단한다.
        if (isHttp && s.contains("supabase.co/storage")) return Kind.Image
        return if (isHttp) Kind.Link else Kind.None
    }

    /** 목록 타일에 그릴 그림. 유튜브는 썸네일로, 이미지는 원본으로, 나머지는 null. */
    fun thumbnail(url: String?): String? = when (kindOf(url)) {
        Kind.Youtube -> youtubeThumb(url!!.trim())
        Kind.Image -> url!!.trim()
        else -> null
    }

    /** 재생 표시를 얹어야 하는 미디어(유튜브·동영상). 정지 그림만 두면 사진과 구분이 안 된다. */
    fun isPlayable(url: String?): Boolean = kindOf(url).let { it == Kind.Youtube || it == Kind.Video }
}
