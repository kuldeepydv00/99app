package com.example.numberbetting.presentation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.example.numberbetting.domain.LanguageManager

@Composable
fun RulesAndRatesDialog(
    onDismiss: () -> Unit
) {
    Dialog(onDismissRequest = onDismiss) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(24.dp))
                .background(Color(0xFF121927))
                .border(1.dp, Color(0xFF1E293B), RoundedCornerShape(24.dp))
                .padding(20.dp)
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.fillMaxWidth()
            ) {
                // Top Right Close Button
                Box(
                    modifier = Modifier.fillMaxWidth(),
                    contentAlignment = Alignment.CenterEnd
                ) {
                    Box(
                        modifier = Modifier
                            .size(32.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color(0xFF1E293B))
                            .clickable { onDismiss() },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "✕",
                            color = Color(0xFF94A3B8),
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                // Header Icon 📋
                Box(
                    modifier = Modifier
                        .size(48.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(
                            Brush.linearGradient(
                                listOf(Color(0xFFF3D079), Color(0xFFD4AF37))
                            )
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text("📋", fontSize = 24.sp)
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Title
                Text(
                    text = LanguageManager.getText("Rules & Payout Rates", "नियम और पेआउट रेट"),
                    color = Color.White,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 18.sp
                )

                Text(
                    text = LanguageManager.getText("Official Game Multipliers & Limits", "आधिकारिक गेम गुणक और सीमाएँ"),
                    color = Color(0xFF94A3B8),
                    fontSize = 12.sp
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Rate Cards
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // Single Jodi (00-99)
                    RateRow(
                        title = LanguageManager.getText("Single Jodi (00-99)", "सिंगल जोड़ी (00-99)"),
                        subtitle = LanguageManager.getText("₹100 bet pays ₹9,000", "₹100 बेट पर ₹9,000 भुगतान"),
                        badgeText = "90X",
                        badgeColor = Color(0xFF00C853)
                    )

                    // Crossing Matrix
                    RateRow(
                        title = LanguageManager.getText("Crossing Matrix", "क्रॉसिंग मैट्रिक्स"),
                        subtitle = LanguageManager.getText("All combination pairs (₹100 pays ₹9,000)", "सभी संयोजन जोड़ियां (₹100 पर ₹9,000)"),
                        badgeText = "90X",
                        badgeColor = Color(0xFF00C853)
                    )

                    // Haruf Ander (Inside)
                    RateRow(
                        title = LanguageManager.getText("Haruf Ander (Inside)", "हरुफ़ अंदर"),
                        subtitle = LanguageManager.getText("₹100 bet pays ₹900", "₹100 बेट पर ₹900 भुगतान"),
                        badgeText = "9X",
                        badgeColor = Color(0xFFF3D079)
                    )

                    // Haruf Bahar (Outside)
                    RateRow(
                        title = LanguageManager.getText("Haruf Bahar (Outside)", "हरुफ़ बाहर"),
                        subtitle = LanguageManager.getText("₹100 bet pays ₹900", "₹100 बेट पर ₹900 भुगतान"),
                        badgeText = "9X",
                        badgeColor = Color(0xFFF3D079)
                    )

                    // Platform Limits Box
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(16.dp))
                            .background(Color(0xFF0F172A))
                            .border(1.dp, Color(0xFF1E293B), RoundedCornerShape(16.dp))
                            .padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text(
                            text = LanguageManager.getText("⚡ Min Deposit: ₹100", "⚡ न्यूनतम जमा: ₹100"),
                            color = Color(0xFFCBD5E1),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                        Text(
                            text = LanguageManager.getText("🏦 Min Withdrawal: ₹200", "🏦 न्यूनतम निकासी: ₹200"),
                            color = Color(0xFFCBD5E1),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                        Text(
                            text = LanguageManager.getText("🎲 Min Bet: ₹1", "🎲 न्यूनतम बेट: ₹1"),
                            color = Color(0xFFCBD5E1),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }
                }

                Spacer(modifier = Modifier.height(18.dp))

                // GOT IT Button
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(46.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFF00C853))
                        .clickable { onDismiss() },
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = LanguageManager.getText("GOT IT ➔", "समझ गए ➔"),
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun RateRow(
    title: String,
    subtitle: String,
    badgeText: String,
    badgeColor: Color
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Color(0xFF0F172A))
            .border(1.dp, Color(0xFF1E293B), RoundedCornerShape(16.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = subtitle,
                color = Color(0xFF94A3B8),
                fontSize = 10.sp
            )
        }
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(10.dp))
                .background(badgeColor.copy(alpha = 0.15f))
                .border(1.dp, badgeColor.copy(alpha = 0.5f), RoundedCornerShape(10.dp))
                .padding(horizontal = 10.dp, vertical = 4.dp)
        ) {
            Text(
                text = badgeText,
                color = badgeColor,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 13.sp
            )
        }
    }
}
