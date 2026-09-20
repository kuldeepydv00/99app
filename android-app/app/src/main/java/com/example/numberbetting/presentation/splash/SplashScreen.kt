package com.example.numberbetting.presentation.splash

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

import com.example.numberbetting.R
import com.example.numberbetting.presentation.components.MoneyDoodleBackground

@Composable
fun SplashScreen(
    onSplashFinished: () -> Unit
) {
    // Animation States
    val scale = remember { Animatable(0.75f) }
    val alpha = remember { Animatable(0f) }

    LaunchedEffect(Unit) {
        // Trigger scale & fade in animation
        scale.animateTo(
            targetValue = 1.0f,
            animationSpec = spring(
                dampingRatio = Spring.DampingRatioMediumBouncy,
                stiffness = Spring.StiffnessLow
            )
        )
        alpha.animateTo(
            targetValue = 1.0f,
            animationSpec = tween(durationMillis = 800)
        )
        
        // Display for 2.5 seconds total then finish splash
        delay(2200)
        onSplashFinished()
    }

    MoneyDoodleBackground {
        // Subtle background pattern glow
        Canvas(modifier = Modifier.fillMaxSize()) {
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(
                        Color(0xFFFFD700).copy(alpha = 0.08f),
                        Color.Transparent
                    ),
                    radius = size.minDimension * 0.75f
                ),
                center = center
            )
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Spacer(modifier = Modifier.height(40.dp))

            // Main Logo Group with Animation
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .scale(scale.value)
                    .alpha(alpha.value)
            ) {
                // Outer Golden Star Circle & Wealth Pot Emblem
                Box(
                    modifier = Modifier.size(210.dp),
                    contentAlignment = Alignment.Center
                ) {
                    // Golden Star Ring Border
                    Canvas(modifier = Modifier.fillMaxSize()) {
                        drawCircle(
                            color = Color(0xFFFFD700).copy(alpha = 0.6f),
                            style = Stroke(
                                width = 3.dp.toPx(),
                                pathEffect = PathEffect.dashPathEffect(floatArrayOf(15f, 15f), 0f)
                            )
                        )
                    }

                    // Golden Inner Circle Frame
                    Box(
                        modifier = Modifier
                            .size(175.dp)
                            .clip(CircleShape)
                            .background(
                                Brush.radialGradient(
                                    colors = listOf(
                                        Color(0xFF2C2416),
                                        Color(0xFF1A140B)
                                    )
                                )
                            )
                            .border(3.dp, Color(0xFFFFD700), CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Image(
                            painter = painterResource(id = R.drawable.app_logo),
                            contentDescription = "99xmatka Logo",
                            modifier = Modifier
                                .size(140.dp)
                                .clip(CircleShape),
                            contentScale = ContentScale.Fit
                        )
                    }

                    // Gold Ribbon Banner
                    Box(
                        modifier = Modifier
                            .align(Alignment.BottomCenter)
                            .offset(y = 12.dp)
                            .background(
                                Brush.horizontalGradient(
                                    colors = listOf(
                                        Color(0xFFB8860B),
                                        Color(0xFFFFD700),
                                        Color(0xFFB8860B)
                                    )
                                ),
                                shape = RoundedCornerShape(12.dp)
                            )
                            .border(1.dp, Color.White.copy(alpha = 0.6f), RoundedCornerShape(12.dp))
                            .padding(horizontal = 28.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = "99xmatka",
                            color = Color(0xFF100C04),
                            fontWeight = FontWeight.Black,
                            fontSize = 15.sp,
                            letterSpacing = 2.sp
                        )
                    }
                }

                Spacer(modifier = Modifier.height(44.dp))

                // Welcome Typography
                Text(
                    text = "Welcome to",
                    color = Color(0xFFE2E8F0),
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Medium,
                    fontFamily = FontFamily.SansSerif
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = "99xmatka App",
                    fontSize = 36.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = Color(0xFFFFD700),
                    letterSpacing = 1.sp,
                    textAlign = TextAlign.Center
                )
            }

            // Three Golden Badges Row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .alpha(alpha.value),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                GoldenBadgeItem(
                    title = "100%",
                    subtitle = "SECURE",
                    icon = "🛡️"
                )
                GoldenBadgeItem(
                    title = "WORLD'S",
                    subtitle = "BEST GAME",
                    icon = "⭐ ⭐ ⭐"
                )
                GoldenBadgeItem(
                    title = "100%",
                    subtitle = "LEGAL",
                    icon = "🎖️"
                )
            }

            // Animated Bottom Loading Spinner
            Box(
                modifier = Modifier
                    .padding(bottom = 36.dp)
                    .alpha(alpha.value),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(
                    modifier = Modifier.size(36.dp),
                    color = Color(0xFFFFD700),
                    strokeWidth = 3.5.dp
                )
            }
        }
    }
}

@Composable
fun GoldenBadgeItem(
    title: String,
    subtitle: String,
    icon: String
) {
    Box(
        modifier = Modifier
            .size(100.dp)
            .clip(CircleShape)
            .background(
                Brush.verticalGradient(
                    colors = listOf(
                        Color(0xFF262016),
                        Color(0xFF141009)
                    )
                )
            )
            .border(2.dp, Color(0xFFFFD700), CircleShape)
            .padding(8.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(icon, fontSize = 10.sp)
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = title,
                color = Color(0xFFFFD700),
                fontWeight = FontWeight.ExtraBold,
                fontSize = 10.sp,
                textAlign = TextAlign.Center
            )
            Text(
                text = subtitle,
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 9.sp,
                textAlign = TextAlign.Center
            )
        }
    }
}
