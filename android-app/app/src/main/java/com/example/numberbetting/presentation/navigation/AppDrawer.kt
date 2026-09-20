package com.example.numberbetting.presentation.navigation

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

import androidx.compose.ui.platform.LocalContext
import com.example.numberbetting.domain.LanguageManager
import com.example.numberbetting.presentation.home.openWhatsAppSupport

import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll

@Composable
fun AppDrawerContent(
    currentRoute: String,
    balance: Double = 0.00,
    userName: String = "User",
    userPhone: String = "",
    whatsappNumber: String = "917206561420",
    onNavigate: (String) -> Unit,
    onOpenRulesDialog: () -> Unit = {},
    onLogout: () -> Unit = {},
    onCloseDrawer: () -> Unit
) {
    val selectedLanguage = LanguageManager.currentLanguage
    val context = LocalContext.current
    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxHeight()
            .width(310.dp)
            .background(Color(0xFF070A0F)) // Luxury dark background
            .verticalScroll(scrollState)
            .padding(horizontal = 24.dp, vertical = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // 99xmatka Brand Logo
        androidx.compose.foundation.Image(
            painter = androidx.compose.ui.res.painterResource(id = com.example.numberbetting.R.drawable.ic_95x_logo),
            contentDescription = "99xmatka Logo",
            modifier = Modifier
                .size(72.dp)
                .clip(CircleShape)
                .border(2.dp, Brush.linearGradient(listOf(Color(0xFFF5D77F), Color(0xFFD4AF37))), CircleShape)
        )

        Spacer(modifier = Modifier.height(10.dp))

        // Name & Phone
        Text(
            text = userName,
            color = Color.White,
            fontWeight = FontWeight.Bold,
            fontSize = 20.sp
        )
        Spacer(modifier = Modifier.height(2.dp))
        Text(
            text = userPhone,
            color = Color(0xFFA69B99),
            fontSize = 14.sp
        )

        Spacer(modifier = Modifier.height(20.dp))

        // Main Navigation Options
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            DrawerActionItem(
                icon = "🏠",
                label = LanguageManager.getText("Home / Live Games", "होम / लाइव गेम"),
                onClick = { onNavigate("game") }
            )

            DrawerActionItem(
                icon = "📋",
                label = LanguageManager.getText("Rules & Payout Rates", "नियम और पेआउट रेट"),
                onClick = {
                    onCloseDrawer()
                    onOpenRulesDialog()
                }
            )

            DrawerActionItem(
                icon = "🕒",
                label = LanguageManager.getText("My Bets History", "मेरी बेट्स का इतिहास"),
                onClick = { onNavigate("my_bets") }
            )

            DrawerActionItem(
                icon = "💳",
                label = LanguageManager.getText("Personal Wallet", "व्यक्तिगत वॉलेट"),
                onClick = { onNavigate("wallet") }
            )

            DrawerActionItem(
                icon = "💬",
                label = LanguageManager.getText("WhatsApp Support", "व्हाट्सएप सहायता"),
                onClick = { openWhatsAppSupport(context, whatsappNumber) }
            )

            DrawerActionItem(
                icon = "🚪",
                label = LanguageManager.getText("Logout", "लॉगआउट"),
                onClick = { onLogout() }
            )
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Change Language Section
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.Start
        ) {
            Text(
                text = LanguageManager.getText("Change Language", "भाषा बदलें"),
                color = Color.White,
                fontWeight = FontWeight.SemiBold,
                fontSize = 15.sp
            )

            Spacer(modifier = Modifier.height(8.dp))

            // English Option
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { LanguageManager.currentLanguage = "English" }
                    .padding(vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "English",
                    color = if (selectedLanguage == "English") Color.White else Color(0xFFA69B99),
                    fontSize = 15.sp,
                    fontWeight = if (selectedLanguage == "English") FontWeight.Bold else FontWeight.Normal
                )
            }

            // Hindi Option
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { LanguageManager.currentLanguage = "Hindi" }
                    .padding(vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "हिन्दी",
                    color = if (selectedLanguage == "Hindi") Color.White else Color(0xFFA69B99),
                    fontSize = 15.sp,
                    fontWeight = if (selectedLanguage == "Hindi") FontWeight.Bold else FontWeight.Normal
                )
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Logout Pill Button with Red Gradient
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp)
                .clip(RoundedCornerShape(24.dp))
                .background(
                    Brush.horizontalGradient(
                        colors = listOf(Color(0xFFFF3E55), Color(0xFFFF5F6D))
                    )
                )
                .clickable { onLogout() },
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = LanguageManager.getText("LOGOUT", "लॉगआउट"),
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp,
                letterSpacing = 1.sp
            )
        }
    }
}

@Composable
fun DrawerActionItem(
    icon: String,
    label: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = icon,
            fontSize = 20.sp,
            modifier = Modifier.padding(end = 16.dp)
        )
        Text(
            text = label,
            color = Color.White,
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold
        )
    }
}
