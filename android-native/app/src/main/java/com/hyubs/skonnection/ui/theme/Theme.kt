package com.hyubs.skonnection.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/**
 * 브랜드 토큰을 Material3 역할에 매핑한다.
 *
 * Card·NavigationBar 같은 M3 컴포넌트는 surfaceContainer* 역할에서 배경을 가져온다.
 * 이 역할들을 비워두면 M3가 primary에서 톤을 뽑아 카드가 라벤더로 물든다.
 * iOS는 흰 카드 + 회색 테두리라서, 컨테이너 계열을 전부 흰색으로 고정하고
 * 경계는 outline(테두리)으로만 만든다.
 *
 * 다크 팔레트는 두지 않는다 — iOS/웹이 라이트 전용이고, 화면 곳곳의 강조색도
 * 라이트 배경을 전제로 고른 값이다. 반쪽짜리 다크 모드보다 한쪽을 정확히 맞춘다.
 */
private val SkColors = lightColorScheme(
    primary = Sk.Cta,
    onPrimary = Color.White,
    primaryContainer = Sk.TintPrimary,
    onPrimaryContainer = Sk.TintPrimaryInk,
    secondary = Sk.Primary,
    onSecondary = Color.White,
    secondaryContainer = Sk.TintPrimary,
    onSecondaryContainer = Sk.TintPrimaryInk,
    background = Sk.Sunken,
    onBackground = Sk.Ink,
    surface = Sk.Surface,
    onSurface = Sk.Ink,
    surfaceVariant = Sk.TintNeutral,
    onSurfaceVariant = Sk.Muted,
    surfaceContainerLowest = Sk.Surface,
    surfaceContainerLow = Sk.Surface,
    surfaceContainer = Sk.Surface,
    surfaceContainerHigh = Sk.Surface,
    surfaceContainerHighest = Sk.Surface,
    outline = Sk.Border,
    outlineVariant = Sk.BorderStrong,
    error = Sk.Danger,
    onError = Color.White,
    errorContainer = Sk.TintDanger,
    onErrorContainer = Sk.Danger,
)

@Composable
fun SkTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = SkColors, typography = AppTypography, content = content)
}
