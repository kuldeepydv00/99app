package com.example.numberbetting.presentation.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val DeepBackground = Color(0xFF070A0F)
val SurfaceCard = Color(0xFF111723)
val SurfaceBorder = Color(0xFF232D3F)
val GoldPrimary = Color(0xFFF3D079)
val GoldAccent = Color(0xFFEAB308)
val GoldGlow = Color(0xFFD4AF37)
val EmeraldSupportBg = Color(0xFF042F2E)
val EmeraldSupportBorder = Color(0xFF065F46)
val AccentEmerald = Color(0xFF00E676)
val AccentIndigo = Color(0xFFF3D079)
val TextSecondary = Color(0xFF94A3B8)
val TextMuted = Color(0xFF64748B)

private val ProfessionalDarkColorScheme = darkColorScheme(
    primary = AccentIndigo,
    secondary = AccentEmerald,
    tertiary = AccentEmerald,
    background = DeepBackground,
    surface = SurfaceCard
)

@Composable
fun NumberBettingTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = ProfessionalDarkColorScheme,
        content = content
    )
}
