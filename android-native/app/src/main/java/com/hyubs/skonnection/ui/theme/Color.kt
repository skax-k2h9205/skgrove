package com.hyubs.skonnection.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * 브랜드 디자인 토큰 — 웹 styles.css `:root` → iOS `Theme.Palette` 와 **같은 값**이다.
 *
 * 지금까지 안드로이드는 primary만 덮어쓰고 나머지를 Material3 기본 팔레트에 맡겼다.
 * 그래서 카드·상단바·하단바가 웹/iOS와 다른 라벤더 계열로 나왔다. 세 플랫폼이 한 몸으로
 * 보이려면 색을 M3 기본값에서 가져오지 않고 여기서 정해 내려보내야 한다.
 */
object Sk {
    val Page = Color(0xFFFFFFFF)
    val Surface = Color(0xFFFFFFFF)
    val Sunken = Color(0xFFFAFAFA)
    val Ink = Color(0xFF262626)
    val Muted = Color(0xFF616161)

    val Primary = Color(0xFF006BB8)
    val PrimaryStrong = Color(0xFF00376B)
    val Cta = Color(0xFF0073C9)

    val Success = Color(0xFF047857)
    val Danger = Color(0xFFB91C1C)
    val Heart = Color(0xFFED4956)

    val TintPrimary = Color(0xFFE8F4FD)
    val TintPrimaryInk = Color(0xFF00376B)
    val TintSuccess = Color(0xFFECFDF5)
    val TintSuccessInk = Color(0xFF065F46)
    val TintDanger = Color(0xFFFDECEA)
    val TintNeutral = Color(0xFFEFEFEF)

    val Border = Color(0xFFDBDBDB)
    val BorderStrong = Color(0xFFC7C7C7)

    /** 상태·분류 강조색. 배지와 막대에서만 쓰고 본문 색으로는 쓰지 않는다. */
    val Amber = Color(0xFFB45309)
    val Purple = Color(0xFF6D28D9)
    val Cyan = Color(0xFF0E7490)
    val Gray = Color(0xFF616161)
}

/** 모서리 반경 — iOS Theme.Radius 와 동일. */
object SkRadius {
    const val SM = 4
    const val MD = 8
    const val LG = 12
}
