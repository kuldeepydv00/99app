package com.example.numberbetting.presentation.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val DeepBackground = Color(0xFF0A0F0D)
val SurfaceCard = Color(0xFF123A2C)
val SurfaceBorder = Color(0xFF1E5C46)
val GoldPrimary = Color(0xFFD9B98C)
val GoldAccent = Color(0xFFC9A87C)
val GoldGlow = Color(0xFFC9A87C)
val EmeraldSupportBg = Color(0xFF0C241B)
val EmeraldSupportBorder = Color(0xFF1E5C46)
val AccentEmerald = Color(0xFF3EE08A)
val AccentIndigo = Color(0xFFD9B98C)
val TextSecondary = Color(0xFF8FA89B)
val TextMuted = Color(0xFF7D9186)

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
