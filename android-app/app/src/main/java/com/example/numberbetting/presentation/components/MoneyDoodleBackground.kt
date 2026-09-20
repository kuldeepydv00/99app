package com.example.numberbetting.presentation.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import com.example.numberbetting.R
import com.example.numberbetting.presentation.theme.DeepBackground

// Diagnostic Switch: Set to false to test performance with decorative image background disabled
var ENABLE_DECORATIVE_BACKGROUND = true

@Composable
fun MoneyDoodleBackground(
    modifier: Modifier = Modifier,
    content: @Composable BoxScope.() -> Unit
) {
    val bgPainter = painterResource(id = R.drawable.whatsapp_money_doodle_bg)
    val radialBrush = remember {
        Brush.radialGradient(
            colors = listOf(
                Color.Transparent,
                Color(0xFF0F0E12).copy(alpha = 0.82f)
            )
        )
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(DeepBackground)
    ) {
        if (ENABLE_DECORATIVE_BACKGROUND) {
            // Hardware Layer Cached Wallpaper Image
            Image(
                painter = bgPainter,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier
                    .fillMaxSize()
                    .graphicsLayer {
                        // Isolate background drawing layer from scroll recomposition invalidations
                        clip = false
                    }
                    .alpha(0.20f)
            )

            // Cached Radial Vignette Layer
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(radialBrush)
            )
        }

        content()
    }
}
