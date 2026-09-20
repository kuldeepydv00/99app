package com.example.numberbetting.presentation.home

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.GenericShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import android.content.Context
import android.content.Intent
import androidx.compose.ui.platform.LocalContext
import androidx.compose.foundation.Image
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import com.example.numberbetting.domain.LanguageManager
import com.example.numberbetting.domain.GameScheduleManager
import com.example.numberbetting.data.ApiConfig
import com.example.numberbetting.presentation.theme.*
import com.example.numberbetting.presentation.components.MoneyDoodleBackground
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject
import org.json.JSONArray
import androidx.compose.ui.graphics.asImageBitmap

import androidx.core.net.toUri
import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import kotlin.math.abs

fun openWhatsAppSupport(context: Context, phone: String = "917206561420") {
    val cleanPhone = phone.replace("+", "").replace(" ", "")
    try {
        val intent = Intent(Intent.ACTION_VIEW, "whatsapp://send?phone=$cleanPhone".toUri())
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    } catch (_: Exception) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, "https://api.whatsapp.com/send?phone=$cleanPhone".toUri())
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        } catch (_: Exception) {
            try {
                val intent = Intent(Intent.ACTION_VIEW, "https://wa.me/$cleanPhone".toUri())
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
            } catch (_: Exception) { }
        }
    }
}

@OptIn(ExperimentalMaterialApi::class)
@Composable
fun HomeScreen(
    balance: Double = 0.00,
    declaredResults: Map<String, Int?> = emptyMap(),
    livePlayers: Map<String, Int> = emptyMap(),
    whatsappNumber: String = "917206561420",
    isKhaiwal: Boolean = false,
    onNavigateToBetting: (String) -> Unit,
    onNavigateToWallet: () -> Unit,
    onNavigateToMyBets: () -> Unit,
    onNavigateToChart: () -> Unit = {},
    onNavigateToReferral: () -> Unit = {},
    onNavigateToKhaiwal: () -> Unit = {},
    onMenuClick: () -> Unit = {},
    onRefresh: () -> Unit = {}
) {
    var selectedBottomTab by remember { mutableStateOf("HOME") }
    var showComingSoonDialog by remember { mutableStateOf(false) }
    var comingSoonFeatureName by remember { mutableStateOf("") }
    var selectedDetailGame by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var isRefreshing by remember { mutableStateOf(false) }

    val pullRefreshState = rememberPullRefreshState(
        refreshing = isRefreshing,
        onRefresh = {
            isRefreshing = true
            onRefresh()
            scope.launch {
                delay(1000)
                isRefreshing = false
            }
        }
    )

    val gamesList = remember {
        listOf("Shiv Parwati", "Delhi Bazar", "Dubai Market", "Shree Ganesh", "Faridabad", "Ghaziabad", "Gali", "Desawar")
    }

    // Auto-tick every 5 seconds so live/result game states update smoothly without needing page refresh
    var timeTicker by remember { mutableStateOf(0L) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(5000L)
            timeTicker = System.currentTimeMillis()
        }
    }

    val liveGames = remember(declaredResults, GameScheduleManager.schedules.toMap(), timeTicker) {
        gamesList.filter {
            GameScheduleManager.getGameState(it, declaredResults) == GameScheduleManager.GameState.OPEN
        }
    }

    val resultGames = remember(declaredResults, GameScheduleManager.schedules.toMap(), timeTicker) {
        gamesList.filter {
            GameScheduleManager.getGameState(it, declaredResults) != GameScheduleManager.GameState.OPEN
        }
    }

    Scaffold(
        bottomBar = {
            BottomNavigationBar(
                selectedTab = selectedBottomTab,
                onTabSelected = { tab ->
                    selectedBottomTab = tab
                    when (tab) {
                        "HOME" -> { }
                        "WALLET" -> onNavigateToWallet()
                        "REFERRAL" -> onNavigateToReferral()
                        "MY BET" -> onNavigateToMyBets()
                        "CHART" -> onNavigateToChart()
                        "CHAT" -> openWhatsAppSupport(context, whatsappNumber)
                        else -> {
                            comingSoonFeatureName = tab
                            showComingSoonDialog = true
                        }
                    }
                }
            )
        },
        containerColor = Color.Transparent
    ) { innerPadding ->
        MoneyDoodleBackground {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .pullRefresh(pullRefreshState)
            ) {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 18.dp)
                ) {
                    // Top Header Bar
                    item {
                        Spacer(modifier = Modifier.height(10.dp))
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 6.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Left: Hamburger Menu + Crown Logo + Title & Tagline
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                IconButton(
                                    onClick = onMenuClick,
                                    modifier = Modifier.size(36.dp)
                                ) {
                                    Text("☰", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                                }
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("👑", fontSize = 28.sp)
                                Spacer(modifier = Modifier.width(6.dp))
                                Column {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            text = "95x ",
                                            color = Color(0xFFF3D079),
                                            fontSize = 17.sp,
                                            fontWeight = FontWeight.Black,
                                            letterSpacing = (-0.5).sp
                                        )
                                        Text(
                                            text = "MATKA",
                                            color = Color.White,
                                            fontSize = 17.sp,
                                            fontWeight = FontWeight.Black,
                                            letterSpacing = (-0.5).sp
                                        )
                                    }
                                    Text(
                                        text = "TRUST • FAST • WIN",
                                        color = Color(0xFFF3D079),
                                        fontSize = 7.5.sp,
                                        fontWeight = FontWeight.Black,
                                        letterSpacing = 1.5.sp
                                    )
                                }
                            }

                            // Right: Wallet Pill (Bell Icon Removed as Requested)
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                val formattedBal = if (balance < 0) {
                                    String.format("-₹%.2f", abs(balance))
                                } else if (balance >= 10000 && balance % 1.0 == 0.0) {
                                    "₹" + String.format("%,d", balance.toLong())
                                } else if (balance % 1.0 == 0.0) {
                                    "₹" + String.format("%d", balance.toLong())
                                } else {
                                    String.format("₹%.2f", balance)
                                }

                                val balFontSize = if (formattedBal.length > 10) 10.sp else if (formattedBal.length > 7) 11.5.sp else 13.sp

                                Row(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(20.dp))
                                        .background(Color(0xFF161F2C))
                                        .border(1.5.dp, Color(0xFFF3D079), RoundedCornerShape(20.dp))
                                        .clickable { onNavigateToWallet() }
                                        .padding(start = 10.dp, end = 4.dp, top = 4.dp, bottom = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text("💼", fontSize = 14.sp)
                                    Spacer(modifier = Modifier.width(4.dp))
                                    Text(
                                        text = formattedBal,
                                        color = Color.White,
                                        fontSize = balFontSize,
                                        fontWeight = FontWeight.Black,
                                        fontFamily = FontFamily.Monospace,
                                        maxLines = 1,
                                        softWrap = false
                                    )
                                    Spacer(modifier = Modifier.width(6.dp))
                                    Box(
                                        modifier = Modifier
                                            .size(22.dp)
                                            .clip(CircleShape)
                                            .background(
                                                Brush.linearGradient(
                                                    colors = listOf(Color(0xFFFFE485), Color(0xFFD4AF37))
                                                )
                                            ),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text("+", color = Color.Black, fontSize = 15.sp, fontWeight = FontWeight.Black)
                                    }
                                }
                            }
                        }
                    }



                    // Market Selector Row (Directly below top header bar, matching website)
                    item {
                        Spacer(modifier = Modifier.height(10.dp))
                        MarketSelectorRow(
                            games = gamesList,
                            onGameClick = { selectedDetailGame = it }
                        )
                    }

                    // Luxury Hero Promo Banner
                    item {
                        Spacer(modifier = Modifier.height(12.dp))
                        LuxuryHeroBanner(onPlayNowClick = {
                            if (liveGames.isNotEmpty()) onNavigateToBetting(liveGames.first())
                            else onNavigateToBetting("Gali")
                        })
                    }

                    // 3 Trust Badges Row
                    item {
                        Spacer(modifier = Modifier.height(10.dp))
                        TrustBadgesRow()
                    }

                    // Official Website & Khaiwal Cards (Full Width Stacked Layout matching Image 4)
                    item {
                        val uriHandler = androidx.compose.ui.platform.LocalUriHandler.current
                        Column(
                            modifier = Modifier.fillMaxWidth(),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            // Official Website Card (Full Width)
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(Color(0xFF0F1624))
                                    .border(1.dp, Color(0xFFF3D079).copy(alpha = 0.5f), RoundedCornerShape(16.dp))
                                    .clickable {
                                        try { uriHandler.openUri("https://newmatkadomain.com") } catch (_: Exception) {}
                                    }
                                    .padding(horizontal = 14.dp, vertical = 12.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(
                                        modifier = Modifier.weight(1f),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .size(36.dp)
                                                .clip(CircleShape)
                                                .background(Color(0xFF182234))
                                                .border(1.dp, Color(0xFFF3D079).copy(alpha = 0.5f), CircleShape),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text("🌐", fontSize = 16.sp)
                                        }
                                        Spacer(modifier = Modifier.width(10.dp))
                                        Column {
                                            Text(
                                                "OUR OFFICIAL WEBSITE",
                                                color = Color(0xFFF3D079),
                                                fontSize = 8.5.sp,
                                                fontWeight = FontWeight.ExtraBold,
                                                letterSpacing = 0.5.sp
                                            )
                                            Spacer(modifier = Modifier.height(1.dp))
                                            Text(
                                                "newmatkadomain.com",
                                                color = Color.White,
                                                fontSize = 12.5.sp,
                                                fontWeight = FontWeight.Black
                                            )
                                            Spacer(modifier = Modifier.height(1.dp))
                                            Text(
                                                "Fast • Secure • Always Accessible",
                                                color = Color(0xFF94A3B8),
                                                fontSize = 8.5.sp,
                                                fontWeight = FontWeight.Medium
                                            )
                                        }
                                    }
                                    Box(
                                        modifier = Modifier
                                            .size(26.dp)
                                            .clip(CircleShape)
                                            .background(Color(0xFF182234))
                                            .border(1.dp, Color(0xFFF3D079).copy(alpha = 0.5f), CircleShape),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text("➔", color = Color(0xFFF3D079), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }

                            // Become / You are Khaiwal Card (Full Width)
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(Color(0xFF0F1624))
                                    .border(1.dp, Color(0xFFF3D079).copy(alpha = 0.5f), RoundedCornerShape(16.dp))
                                    .clickable {
                                        if (isKhaiwal) {
                                            onNavigateToKhaiwal()
                                        } else {
                                            try {
                                                val cleanPhone = whatsappNumber.replace("[^0-9]".toRegex(), "")
                                                val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse("https://wa.me/$cleanPhone")).apply {
                                                    addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                                                }
                                                context.startActivity(intent)
                                            } catch (_: Exception) { }
                                        }
                                    }
                                    .padding(horizontal = 14.dp, vertical = 12.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(
                                        modifier = Modifier.weight(1f),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .size(36.dp)
                                                .clip(CircleShape)
                                                .background(Color(0xFF182234))
                                                .border(1.dp, Color(0xFFF3D079).copy(alpha = 0.5f), CircleShape),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text("🤝", fontSize = 16.sp)
                                        }
                                        Spacer(modifier = Modifier.width(10.dp))
                                        Column {
                                            Text(
                                                "KHAIWAL DASHBOARD",
                                                color = Color(0xFFF3D079),
                                                fontSize = 8.5.sp,
                                                fontWeight = FontWeight.ExtraBold,
                                                letterSpacing = 0.5.sp
                                            )
                                            Text(
                                                if (isKhaiwal) "You are a Khaiwal" else "Become a Khaiwal",
                                                color = Color.White,
                                                fontSize = 12.5.sp,
                                                fontWeight = FontWeight.Black
                                            )
                                            Spacer(modifier = Modifier.height(1.dp))
                                            Text(
                                                if (isKhaiwal) "Manage Players • Track Commission" else "Contact Admin on WhatsApp",
                                                color = Color(0xFF94A3B8),
                                                fontSize = 8.5.sp,
                                                fontWeight = FontWeight.Medium
                                            )
                                        }
                                    }
                                    Box(
                                        modifier = Modifier
                                            .size(26.dp)
                                            .clip(CircleShape)
                                            .background(Color(0xFF182234))
                                            .border(1.dp, Color(0xFFF3D079).copy(alpha = 0.5f), CircleShape),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text("➔", color = Color(0xFFF3D079), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                    }

                    // Live Games Section Title (PERMANENTLY ON TOP)
                    item {
                        Spacer(modifier = Modifier.height(26.dp))
                        Text(
                            text = LanguageManager.getText("Live Games", "लाइव गेम"),
                            color = Color.White,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 0.5.sp
                        )
                        Spacer(modifier = Modifier.height(14.dp))
                    }

                    // Live Games Items List
                    items(liveGames, key = { it }) { gameName ->
                        val sched = GameScheduleManager.schedules[gameName]
                        val gameState = GameScheduleManager.getGameState(gameName, declaredResults)
                        val isOpen = gameState == GameScheduleManager.GameState.OPEN
                        val remainingMins = GameScheduleManager.getRemainingMinutesToClose(gameName)

                        val icon = getGameIconEmoji(gameName)

                        val playerCount = livePlayers[gameName]
                            ?: livePlayers[if (gameName == "Shree Ganesh") "Shri Ganesh" else if (gameName == "Shri Ganesh") "Shree Ganesh" else if (gameName == "Desawar") "Disawer" else if (gameName == "Disawer") "Desawar" else gameName]
                            ?: when(gameName) {
                                "Shiv Parwati" -> 487556
                                "Delhi Bazar" -> 614919
                                "Dubai Market" -> 452810
                                "Shree Ganesh" -> 392152
                                "Faridabad" -> 345825
                                "Ghaziabad" -> 298700
                                "Gali" -> 512400
                                "Desawar" -> 684200
                                else -> 500000
                            }

                        LiveGameCard(
                            title = gameName,
                            subtitle = "$playerCount people are playing",
                            icon = icon,
                            isOpen = isOpen,
                            remainingMins = remainingMins,
                            onPlayClick = { onNavigateToBetting(gameName) }
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                    }

                // Results Section Title (PERMANENTLY ON BOTTOM)
                item {
                    Spacer(modifier = Modifier.height(14.dp))
                    Text(
                        text = LanguageManager.getText("Results", "परिणाम"),
                        color = Color.White,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.5.sp
                    )
                    Spacer(modifier = Modifier.height(14.dp))
                }

                // Results Items List
                items(resultGames, key = { it }) { gameName ->
                    val winningNum = declaredResults[gameName]
                    val sched = GameScheduleManager.schedules[gameName]

                    val icon = getGameIconEmoji(gameName)

                    ResultCard(
                        title = gameName,
                        subtitle = if (winningNum != null) LanguageManager.getText("Winning Number", "विजेता नंबर") else LanguageManager.getText("Result to be announced soon", "परिणाम जल्द घोषित होगा") + " at ${sched?.resultTimeStr ?: ""}",
                        icon = icon,
                        isLive = false,
                        winningNumber = winningNum?.let { String.format("%02d", it) },
                        onClick = {
                            if (GameScheduleManager.getGameState(gameName, declaredResults) == GameScheduleManager.GameState.OPEN) {
                                onNavigateToBetting(gameName)
                            } else {
                                android.widget.Toast.makeText(context, "⏳ Result Pending for $gameName", android.widget.Toast.LENGTH_SHORT).show()
                            }
                        }
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                }

                // Bottom Scroll Padding item
                item {
                    Spacer(modifier = Modifier.height(90.dp))
                }
            }

            PullRefreshIndicator(
                refreshing = isRefreshing,
                state = pullRefreshState,
                modifier = Modifier.align(Alignment.TopCenter),
                backgroundColor = Color(0xFF1E293B),
                contentColor = Color(0xFFF3D079)
            )
        }
    }
    }

    if (showComingSoonDialog) {
        val icon = when (comingSoonFeatureName) {
            "CHART" -> "📊"
            "CHAT" -> "🎧"
            "SHARE" -> "🔀"
            else -> "🚀"
        }

        AlertDialog(
            onDismissRequest = {
                showComingSoonDialog = false
                selectedBottomTab = "HOME"
            },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(icon, fontSize = 26.sp, modifier = Modifier.padding(end = 8.dp))
                    Text("$comingSoonFeatureName - Coming Soon!", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                }
            },
            text = {
                Column {
                    Text(
                        text = "The $comingSoonFeatureName feature is currently under active development and will be available in the upcoming app release.",
                        color = TextSecondary,
                        fontSize = 14.sp
                    )
                    Spacer(modifier = Modifier.height(10.dp))
                    Text(
                        text = "Stay tuned for new updates!",
                        color = AccentEmerald,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        showComingSoonDialog = false
                        selectedBottomTab = "HOME"
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = AccentIndigo)
                ) {
                    Text("Got It", fontWeight = FontWeight.Bold)
                }
            },
            containerColor = SurfaceCard
        )
    }

    if (selectedDetailGame != null) {
        CompanyDetailsDialog(
            gameName = selectedDetailGame!!,
            declaredResults = declaredResults,
            onDismiss = { selectedDetailGame = null }
        )
    }
}

val HexagonShape = GenericShape { size, _ ->
    val width = size.width
    val height = size.height
    moveTo(width * 0.5f, 0f)
    lineTo(width, height * 0.25f)
    lineTo(width, height * 0.75f)
    lineTo(width * 0.5f, height)
    lineTo(0f, height * 0.75f)
    lineTo(0f, height * 0.25f)
    close()
}

fun getGameIconEmoji(gameName: String): String {
    return when(gameName) {
        "Shiv Parwati" -> "🔱"
        "Delhi Bazar" -> "🐎"
        "Dubai Market" -> "🏙️"
        "Shree Ganesh", "Shri Ganesh" -> "🐘"
        "Faridabad" -> "♠️"
        "Ghaziabad" -> "📊"
        "Gali" -> "⚡"
        "Desawar", "Disawer" -> "👑"
        else -> "⭐"
    }
}

@Composable
fun MarketHexagonSlidebar(
    games: List<String>,
    onGameClick: (String) -> Unit
) {
    LazyRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(14.dp),
        contentPadding = PaddingValues(horizontal = 4.dp, vertical = 6.dp)
    ) {
        items(games) { game ->
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .clickable { onGameClick(game) }
                    .padding(4.dp)
            ) {
                // Hexagon Container
                Box(
                    modifier = Modifier
                        .size(54.dp)
                        .clip(HexagonShape)
                        .background(
                            Brush.linearGradient(
                                colors = listOf(
                                    Color(0xFFF59E0B),
                                    Color(0xFFB45309),
                                    Color(0xFF78350F)
                                )
                            )
                        )
                        .padding(2.5.dp)
                        .clip(HexagonShape)
                        .background(Color(0xFF1E293B)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = getGameIconEmoji(game),
                        fontSize = 24.sp
                    )
                }
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = game,
                    color = Color.White,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    textAlign = TextAlign.Center
                )
            }
        }
    }
}

@Composable
fun CompanyDetailsDialog(
    gameName: String,
    declaredResults: Map<String, Int?>,
    onDismiss: () -> Unit
) {
    val sched = GameScheduleManager.schedules[gameName] ?: GameScheduleManager.schedules[
        when(gameName) {
            "Disawer" -> "Desawar"
            "Shri Ganesh" -> "Shree Ganesh"
            else -> gameName
        }
    ]

    val openTime = sched?.openTimeStr ?: if (gameName == "Desawar" || gameName == "Disawer") "12:00 PM IST" else "04:00 AM IST"
    val closeTime = sched?.closeTimeStr ?: "12:00 PM IST"
    val resultTime = sched?.resultTimeStr ?: "12:40 PM IST"

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
            border = BorderStroke(1.5.dp, Color(0xFFF3D079).copy(alpha = 0.6f))
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Header Title
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Company details",
                        color = Color(0xFF94A3B8),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                    IconButton(
                        onClick = onDismiss,
                        modifier = Modifier.size(28.dp)
                    ) {
                        Text("✕", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Game Name Header
                Text(
                    text = gameName,
                    color = Color(0xFFFFE485),
                    fontSize = 22.sp,
                    fontWeight = FontWeight.ExtraBold,
                    textAlign = TextAlign.Center
                )

                Spacer(modifier = Modifier.height(16.dp))

                // Large Hexagon Logo
                Box(
                    modifier = Modifier
                        .size(84.dp)
                        .clip(HexagonShape)
                        .background(
                            Brush.linearGradient(
                                colors = listOf(
                                    Color(0xFFF59E0B),
                                    Color(0xFFB45309),
                                    Color(0xFF78350F)
                                )
                            )
                        )
                        .padding(3.dp)
                        .clip(HexagonShape)
                        .background(Color(0xFF0F172A)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = getGameIconEmoji(gameName),
                        fontSize = 40.sp
                    )
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Info Box with Open Time, Close Time & Result Time in Bold
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
                    border = BorderStroke(1.dp, Color(0xFF334155))
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Game Open Time :", color = Color(0xFF94A3B8), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            Text(openTime, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, fontFamily = FontFamily.Monospace)
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Game Close Time :", color = Color(0xFF94A3B8), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            Text(closeTime, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, fontFamily = FontFamily.Monospace)
                        }
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text("Game Result Time :", color = Color(0xFF94A3B8), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            Text(resultTime, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, fontFamily = FontFamily.Monospace)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ResultCard(
    title: String,
    subtitle: String,
    icon: String,
    @Suppress("UNUSED_PARAMETER") isLive: Boolean = false,
    winningNumber: String? = null,
    onClick: () -> Unit = {}
) {
    val goldBorder = remember { Color(0xFFFACC15).copy(alpha = 0.3f) }
    val cardGradient = remember {
        Brush.horizontalGradient(
            colors = listOf(
                Color(0xFF1E2638),
                Color(0xFF151C2A)
            )
        )
    }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() },
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(cardGradient, RoundedCornerShape(20.dp))
                .border(1.dp, goldBorder, RoundedCornerShape(20.dp))
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(54.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color(0xFF26324A))
                        .border(1.dp, Color(0xFF3B4D6C), RoundedCornerShape(16.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(icon, fontSize = 26.sp)
                }

                Spacer(modifier = Modifier.width(14.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = title,
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.3.sp
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = subtitle,
                        color = Color(0xFF94A3B8),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium
                    )
                }

                if (winningNumber != null) {
                    Box(
                        modifier = Modifier
                            .size(46.dp)
                            .clip(CircleShape)
                            .background(Color(0xFF0F2620))
                            .border(1.5.dp, AccentEmerald, CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = winningNumber,
                            color = AccentEmerald,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                    }
                } else {
                    Box(
                        modifier = Modifier
                            .background(Color(0xFFF59E0B).copy(alpha = 0.15f), RoundedCornerShape(20.dp))
                            .border(1.dp, Color(0xFFF59E0B), RoundedCornerShape(20.dp))
                            .padding(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = "⏳ RESULT PENDING",
                            color = Color(0xFFF59E0B),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.ExtraBold,
                            letterSpacing = 0.5.sp
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun LiveGameCard(
    title: String,
    subtitle: String,
    icon: String,
    isOpen: Boolean = true,
    remainingMins: Int = -1,
    onPlayClick: () -> Unit
) {
    val goldBorder = remember { Color(0xFFFACC15).copy(alpha = 0.3f) }
    val cardGradient = remember {
        Brush.horizontalGradient(
            colors = listOf(
                Color(0xFF1E2638),
                Color(0xFF151C2A)
            )
        )
    }
    val playGradient = remember {
        Brush.horizontalGradient(
            colors = listOf(
                Color(0xFFFFE599),
                Color(0xFFD4AF37),
                Color(0xFF8C6D13)
            )
        )
    }

    val isUrgent = isOpen && remainingMins in 1..30
    val badgeBg = if (!isOpen) Color(0xFFF59E0B).copy(alpha = 0.15f)
                  else if (isUrgent) Color(0xFFF59E0B).copy(alpha = 0.15f)
                  else Color(0xFFD4AF37).copy(alpha = 0.15f)

    val badgeBorderColor = if (!isOpen) Color(0xFFF59E0B)
                          else if (isUrgent) Color(0xFFF59E0B)
                          else Color(0xFFF5D77F).copy(alpha = 0.6f)

    val badgeTextColor = if (!isOpen) Color(0xFFF59E0B)
                         else if (isUrgent) Color(0xFFF59E0B)
                         else Color(0xFFF5D77F)

    val badgeText = if (!isOpen) "⏳ RESULT PENDING"
                    else if (isUrgent) "⏰ $remainingMins MINUTES LEFT"
                    else "BETTING OPEN"

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onPlayClick() },
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.Transparent)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(cardGradient, RoundedCornerShape(20.dp))
                .border(1.dp, goldBorder, RoundedCornerShape(20.dp))
                .padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(54.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(Color(0xFF26324A))
                        .border(1.dp, Color(0xFF3B4D6C), RoundedCornerShape(16.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(icon, fontSize = 26.sp)
                }

                Spacer(modifier = Modifier.width(14.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = title,
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.3.sp
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                    Text(
                        text = subtitle,
                        color = Color(0xFF94A3B8),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Medium
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    Box(
                        modifier = Modifier
                            .background(badgeBg, RoundedCornerShape(20.dp))
                            .border(1.dp, badgeBorderColor, RoundedCornerShape(20.dp))
                            .padding(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .clip(CircleShape)
                                    .background(badgeTextColor)
                            )
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = badgeText,
                                color = badgeTextColor,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.ExtraBold,
                                letterSpacing = 0.5.sp
                            )
                        }
                    }
                }

                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(14.dp))
                        .background(playGradient)
                        .clickable { onPlayClick() }
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "PLAY",
                            color = Color.Black,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.ExtraBold,
                            letterSpacing = 0.5.sp
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "➔",
                            color = Color.Black,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun MarketSelectorRow(
    games: List<String>,
    onGameClick: (String) -> Unit
) {
    LazyRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        contentPadding = PaddingValues(vertical = 4.dp)
    ) {
        items(games) { game ->
            val isActive = (game == "Shiv Parwati")
            val icon = when(game) {
                "Shiv Parwati" -> "🔱"
                "Delhi Bazar" -> "🐎"
                "Dubai Market" -> "🏙️"
                "Shree Ganesh", "Shri Ganesh" -> "🐘"
                "Faridabad" -> "♠️"
                "Ghaziabad" -> "🛡️"
                "Gali" -> "👑"
                "Desawar", "Disawer" -> "⭐"
                else -> "🎯"
            }
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .width(84.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(
                        if (isActive) Brush.verticalGradient(listOf(Color(0xFF1F293D), Color(0xFF0D121F)))
                        else Brush.verticalGradient(listOf(Color(0xFF131924), Color(0xFF0F1420)))
                    )
                    .border(
                        if (isActive) 2.dp else 1.dp,
                        if (isActive) Color(0xFFD4AF37) else Color(0xFFD4AF37).copy(alpha = 0.4f),
                        RoundedCornerShape(16.dp)
                    )
                    .clickable { onGameClick(game) }
                    .padding(vertical = 10.dp, horizontal = 4.dp)
            ) {
                Text(text = icon, fontSize = 28.sp)
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = game,
                    color = Color.White,
                    fontSize = 10.5.sp,
                    fontWeight = FontWeight.Bold,
                    maxLines = 1,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(6.dp))
                Box(
                    modifier = Modifier
                        .height(2.5.dp)
                        .width(20.dp)
                        .background(Color(0xFFD4AF37), RoundedCornerShape(1.dp))
                )
            }
        }
    }
}

@Composable
fun LuxuryHeroBanner(onPlayNowClick: () -> Unit) {
    var bannerEnabled by remember { mutableStateOf(true) }
    var imageBitmap by remember { mutableStateOf(BannerCache.cachedBitmap) }

    LaunchedEffect(Unit) {
        var lastImg: String? = null
        while (true) {
            withContext(Dispatchers.IO) {
                for (baseUrl in ApiConfig.getWorkingUrls()) {
                    try {
                        // 1. Try /api/game/banner
                        val url = URL("$baseUrl/api/game/banner")
                        val conn = url.openConnection() as HttpURLConnection
                        conn.requestMethod = "GET"
                        conn.setRequestProperty("Bypass-Tunnel-Reminder", "true")
                        conn.connectTimeout = 2500
                        if (conn.responseCode == 200) {
                            val text = conn.inputStream.bufferedReader().readText()
                            var targetImg: String = ""
                            if (text.trim().startsWith("{")) {
                                val obj = JSONObject(text)
                                targetImg = obj.optString("imageUrl", "")
                                if (targetImg.isEmpty()) targetImg = obj.optString("image", "")
                                val isEnabled = obj.optBoolean("enabled", true)
                                withContext(Dispatchers.Main) {
                                    bannerEnabled = isEnabled
                                }
                            } else if (text.trim().startsWith("data:image") || text.trim().startsWith("/9j/")) {
                                targetImg = text.trim()
                            }

                            // 2. If empty or placeholder, check /api/game/banners list
                            if (targetImg.isEmpty() || targetImg == "banner1.png" || targetImg == "banner2.png") {
                                try {
                                    val listUrl = URL("$baseUrl/api/game/banners")
                                    val listConn = listUrl.openConnection() as HttpURLConnection
                                    listConn.requestMethod = "GET"
                                    listConn.setRequestProperty("Bypass-Tunnel-Reminder", "true")
                                    listConn.connectTimeout = 2500
                                    if (listConn.responseCode == 200) {
                                        val listText = listConn.inputStream.bufferedReader().readText()
                                        if (listText.trim().startsWith("[")) {
                                            val arr = JSONArray(listText)
                                            if (arr.length() > 0) {
                                                val firstObj = arr.getJSONObject(0)
                                                targetImg = firstObj.optString("link", "")
                                                if (targetImg.isEmpty()) targetImg = firstObj.optString("previewUrl", "")
                                                if (targetImg.isEmpty()) targetImg = firstObj.optString("imageUrl", "")
                                                if (targetImg.isEmpty()) targetImg = firstObj.optString("image", "")
                                            }
                                        }
                                    }
                                } catch (_: Exception) {}
                            }

                            if (targetImg.isNotEmpty() && targetImg != "banner1.png" && targetImg != "banner2.png" && targetImg != lastImg) {
                                lastImg = targetImg
                                try {
                                    val bytes = if (targetImg.startsWith("data:image")) {
                                        android.util.Base64.decode(targetImg.substringAfter(","), android.util.Base64.DEFAULT)
                                    } else if (targetImg.startsWith("/9j/") || targetImg.startsWith("iVBORw0KGgo") || targetImg.startsWith("R0lGOD") || (targetImg.length > 50 && !targetImg.contains(" ") && !targetImg.startsWith("http"))) {
                                        try {
                                            android.util.Base64.decode(targetImg, android.util.Base64.DEFAULT)
                                        } catch (_: Exception) { null }
                                    } else {
                                        null
                                    }
                                    val bmp = if (bytes != null) {
                                        android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                                    } else if (targetImg.startsWith("http://") || targetImg.startsWith("https://")) {
                                        android.graphics.BitmapFactory.decodeStream(URL(targetImg).openStream())
                                    } else {
                                        null
                                    }
                                    if (bmp != null) {
                                        val decodedBmp = bmp.asImageBitmap()
                                        withContext(Dispatchers.Main) {
                                            BannerCache.cachedBitmap = decodedBmp
                                            imageBitmap = decodedBmp
                                        }
                                    }
                                } catch (_: Exception) {}
                            }
                            break
                        }
                    } catch (_: Exception) {}
                }
            }
            delay(3500)
        }
    }

    if (!bannerEnabled) return

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .border(1.5.dp, Brush.horizontalGradient(listOf(Color(0xFFF3D079), Color(0xFFD4AF37), Color(0xFFF3D079))), RoundedCornerShape(20.dp)),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF141720))
    ) {
        if (imageBitmap != null) {
            Image(
                bitmap = imageBitmap!!,
                contentDescription = "Custom Promotional Banner",
                contentScale = ContentScale.FillWidth,
                modifier = Modifier
                    .fillMaxWidth()
                    .wrapContentHeight()
            )
        } else {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        Brush.linearGradient(
                            colors = listOf(Color(0xFF1E2638), Color(0xFF10141D), Color(0xFF1C2230))
                        )
                    )
                    .padding(16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "INDIA'S MOST TRUSTED",
                            color = Color(0xFFF3D079),
                            fontSize = 10.sp,
                            fontWeight = FontWeight.ExtraBold,
                            letterSpacing = 1.sp
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "99xmatka",
                            color = Color.White,
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Black,
                            letterSpacing = 0.5.sp
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "FAST • SECURE • HIGH PAYOUTS",
                            color = Color(0xFF94A3B8),
                            fontSize = 9.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Spacer(modifier = Modifier.height(10.dp))

                        Box(
                            modifier = Modifier
                                .background(Color(0xFFF3D079).copy(alpha = 0.15f), RoundedCornerShape(20.dp))
                                .border(1.dp, Color(0xFFF3D079), RoundedCornerShape(20.dp))
                                .padding(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Text(
                                text = "INDIA KA SABSE PEHLA KHAIWAL",
                                color = Color(0xFFF3D079),
                                fontSize = 9.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(20.dp))
                                .background(
                                    Brush.horizontalGradient(
                                        colors = listOf(Color(0xFFFFE485), Color(0xFFD4AF37))
                                    )
                                )
                                .padding(horizontal = 18.dp, vertical = 9.dp)
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = "PLAY NOW",
                                    color = Color.Black,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Black
                                )
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("➔", color = Color.Black, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.width(10.dp))

                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Image(
                            painter = painterResource(id = com.example.numberbetting.R.drawable.ic_95x_logo),
                            contentDescription = "Crown Graphic",
                            modifier = Modifier
                                .size(90.dp)
                                .clip(RoundedCornerShape(16.dp))
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = "PLAY BIG WIN BIGGER",
                            color = Color(0xFFF3D079),
                            fontSize = 8.sp,
                            fontWeight = FontWeight.Black
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun TrustBadgesRow() {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        TrustBadgeItem(icon = "🛡️", title = "100% SECURE", sub = "Safe & Trusted")
        TrustBadgeItem(icon = "⚡", title = "INSTANT RESULT", sub = "Real-Time Updates")
        TrustBadgeItem(icon = "🎧", title = "24x7 SUPPORT", sub = "Always With You")
    }
}

@Composable
fun TrustBadgeItem(icon: String, title: String, sub: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(30.dp)
                .clip(CircleShape)
                .background(Color(0xFF161F2C))
                .border(1.dp, Color(0xFFF3D079).copy(alpha = 0.5f), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Text(icon, fontSize = 13.sp)
        }
        Spacer(modifier = Modifier.width(5.dp))
        Column {
            Text(title, color = Color.White, fontSize = 9.sp, fontWeight = FontWeight.Black)
            Text(sub, color = Color(0xFF94A3B8), fontSize = 8.sp, fontWeight = FontWeight.Medium)
        }
    }
}

@Composable
fun RechargeBonusBanner(onRechargeClick: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(
                Brush.horizontalGradient(
                    colors = listOf(Color(0xFF1A160F), Color(0xFF2D2313), Color(0xFF1A160F))
                )
            )
            .border(1.dp, Color(0xFFF3D079), RoundedCornerShape(18.dp))
            .clickable { onRechargeClick() }
            .padding(horizontal = 14.dp, vertical = 12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("🎁", fontSize = 24.sp)
                Spacer(modifier = Modifier.width(10.dp))
                Column {
                    Text(
                        text = "GET 8% EXTRA",
                        color = Color(0xFFF3D079),
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Black
                    )
                    Text(
                        text = "ON EVERY RECHARGE",
                        color = Color.White,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }

            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(20.dp))
                    .background(
                        Brush.horizontalGradient(
                            colors = listOf(Color(0xFFFFE485), Color(0xFFD4AF37))
                        )
                    )
                    .padding(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Text(
                    text = "RECHARGE NOW ➔",
                    color = Color.Black,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black
                )
            }
        }
    }
}

val HomeVectorIcon: ImageVector by lazy {
    ImageVector.Builder(
        name = "HomeVectorIcon",
        defaultWidth = 24.dp,
        defaultHeight = 24.dp,
        viewportWidth = 24f,
        viewportHeight = 24f
    ).path(fill = SolidColor(Color.White)) {
        moveTo(10f, 20f)
        verticalLineToRelative(-6f)
        horizontalLineToRelative(4f)
        verticalLineToRelative(6f)
        horizontalLineToRelative(5f)
        verticalLineToRelative(-8f)
        horizontalLineToRelative(3f)
        lineTo(12f, 3f)
        lineTo(2f, 12f)
        horizontalLineToRelative(3f)
        close()
    }.build()
}

val ChartVectorIcon: ImageVector by lazy {
    ImageVector.Builder(
        name = "ChartVectorIcon",
        defaultWidth = 24.dp,
        defaultHeight = 24.dp,
        viewportWidth = 24f,
        viewportHeight = 24f
    ).path(fill = SolidColor(Color.White)) {
        moveTo(4f, 9f)
        horizontalLineToRelative(4f)
        verticalLineToRelative(11f)
        horizontalLineTo(4f)
        close()
        moveTo(10f, 4f)
        horizontalLineToRelative(4f)
        verticalLineToRelative(16f)
        horizontalLineToRelative(-4f)
        close()
        moveTo(16f, 12f)
        horizontalLineToRelative(4f)
        verticalLineToRelative(8f)
        horizontalLineToRelative(-4f)
        close()
    }.build()
}

val CrownVectorIcon: ImageVector by lazy {
    ImageVector.Builder(
        name = "CrownVectorIcon",
        defaultWidth = 24.dp,
        defaultHeight = 24.dp,
        viewportWidth = 24f,
        viewportHeight = 24f
    ).path(fill = SolidColor(Color.White)) {
        moveTo(5f, 16f)
        lineTo(3f, 5f)
        lineToRelative(5.5f, 5f)
        lineTo(12f, 4f)
        lineToRelative(3.5f, 6f)
        lineTo(21f, 5f)
        lineToRelative(-2f, 11f)
        horizontalLineTo(5f)
        close()
        moveTo(19f, 19f)
        curveToRelative(0f, 0.6f, -0.4f, 1f, -1f, 1f)
        horizontalLineTo(6f)
        curveToRelative(-0.6f, 0f, -1f, -0.4f, -1f, -1f)
        verticalLineToRelative(-1f)
        horizontalLineToRelative(14f)
        verticalLineToRelative(1f)
        close()
    }.build()
}

val ChatVectorIcon: ImageVector by lazy {
    ImageVector.Builder(
        name = "ChatVectorIcon",
        defaultWidth = 24.dp,
        defaultHeight = 24.dp,
        viewportWidth = 24f,
        viewportHeight = 24f
    ).path(fill = SolidColor(Color.White)) {
        moveTo(20f, 2f)
        horizontalLineTo(4f)
        curveToRelative(-1.1f, 0f, -1.99f, 0.9f, -1.99f, 2f)
        lineTo(2f, 22f)
        lineToRelative(4f, -4f)
        horizontalLineToRelative(14f)
        curveToRelative(1.1f, 0f, 2f, -0.9f, 2f, -2f)
        verticalLineTo(4f)
        curveToRelative(0f, -1.1f, -0.9f, -2f, -2f, -2f)
        close()
        moveTo(6f, 9f)
        horizontalLineToRelative(12f)
        verticalLineToRelative(2f)
        horizontalLineTo(6f)
        verticalLineTo(9f)
        close()
        moveTo(14f, 14f)
        horizontalLineTo(6f)
        verticalLineToRelative(-2f)
        horizontalLineToRelative(8f)
        verticalLineToRelative(2f)
        close()
        moveTo(18f, 8f)
        horizontalLineTo(6f)
        verticalLineTo(6f)
        horizontalLineToRelative(12f)
        verticalLineToRelative(2f)
        close()
    }.build()
}

val ReferVectorIcon: ImageVector by lazy {
    ImageVector.Builder(
        name = "ReferVectorIcon",
        defaultWidth = 24.dp,
        defaultHeight = 24.dp,
        viewportWidth = 24f,
        viewportHeight = 24f
    ).path(fill = SolidColor(Color.White)) {
        moveTo(20f, 6f)
        horizontalLineToRelative(-2.18f)
        curveToRelative(0.11f, -0.31f, 0.18f, -0.65f, 0.18f, -1f)
        curveToRelative(0f, -1.66f, -1.34f, -3f, -3f, -3f)
        curveToRelative(-1.05f, 0f, -1.96f, 0.54f, -2.5f, 1.35f)
        lineToRelative(-0.5f, 0.67f)
        lineToRelative(-0.5f, -0.68f)
        curveToRelative(-0.54f, -0.81f, -1.45f, -1.35f, -2.5f, -1.35f)
        curveToRelative(-1.66f, 0f, -3f, 1.34f, -3f, 3f)
        curveToRelative(0f, 0.35f, 0.07f, 0.69f, 0.18f, 1f)
        horizontalLineTo(4f)
        curveToRelative(-1.11f, 0f, -1.99f, 0.89f, -1.99f, 2f)
        lineTo(2f, 19f)
        curveToRelative(0f, 1.11f, 0.89f, 2f, 2f, 2f)
        horizontalLineToRelative(16f)
        curveToRelative(1.11f, 0f, 2f, -0.89f, 2f, -2f)
        verticalLineTo(8f)
        curveToRelative(0f, -1.11f, -0.89f, -2f, -2f, -2f)
        close()
        moveTo(15f, 4f)
        curveToRelative(0.55f, 0f, 1f, 0.45f, 1f, 1f)
        reflectiveCurveToRelative(-0.45f, 1f, -1f, 1f)
        reflectiveCurveToRelative(-1f, -0.45f, -1f, -1f)
        reflectiveCurveToRelative(0.45f, -1f, 1f, -1f)
        close()
        moveTo(9f, 4f)
        curveToRelative(0.55f, 0f, 1f, 0.45f, 1f, 1f)
        reflectiveCurveToRelative(-0.45f, 1f, -1f, 1f)
        reflectiveCurveToRelative(-1f, -0.45f, -1f, -1f)
        reflectiveCurveToRelative(0.45f, -1f, 1f, -1f)
        close()
        moveTo(20f, 19f)
        horizontalLineTo(4f)
        verticalLineTo(8f)
        horizontalLineToRelative(16f)
        verticalLineToRelative(11f)
        close()
    }.build()
}

@Composable
fun BottomNavigationBar(
    selectedTab: String,
    onTabSelected: (String) -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 4.dp),
        contentAlignment = Alignment.BottomCenter
    ) {
        // Main Outer Capsule Container matching Website CSS
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(60.dp)
                .clip(RoundedCornerShape(30.dp))
                .background(
                    Brush.verticalGradient(
                        colors = listOf(Color(0xFF0F172A), Color(0xFF0B101D))
                    )
                )
                .border(
                    1.5.dp,
                    Brush.horizontalGradient(
                        colors = listOf(Color(0xFFFFE599), Color(0xFFD4AF37), Color(0xFFFFE599))
                    ),
                    RoundedCornerShape(30.dp)
                ),
            contentAlignment = Alignment.Center
        ) {
            Row(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 4.dp),
                horizontalArrangement = Arrangement.SpaceAround,
                verticalAlignment = Alignment.CenterVertically
            ) {
                BottomNavItem(
                    icon = HomeVectorIcon,
                    label = LanguageManager.getText("HOME", "होम"),
                    isSelected = selectedTab == "HOME",
                    onClick = { onTabSelected("HOME") }
                )
                BottomNavItem(
                    icon = ChartVectorIcon,
                    label = LanguageManager.getText("CHART", "चार्ट"),
                    isSelected = selectedTab == "CHART",
                    onClick = { onTabSelected("CHART") }
                )

                // Placeholder space for center elevated MY BET crown button
                Spacer(modifier = Modifier.width(52.dp))

                BottomNavItem(
                    icon = ChatVectorIcon,
                    label = LanguageManager.getText("CHAT", "चैट"),
                    isSelected = selectedTab == "CHAT",
                    onClick = { onTabSelected("CHAT") }
                )
                BottomNavItem(
                    icon = ReferVectorIcon,
                    label = LanguageManager.getText("REFER", "रिफर"),
                    isSelected = selectedTab == "REFERRAL",
                    onClick = { onTabSelected("REFERRAL") }
                )
            }
        }

        // CENTER ELEVATED FLOATING GOLD CROWN BUTTON FOR MY BET (100% Copy of Website CSS)
        val isMyBetSelected = selectedTab == "MY BET"
        Box(
            modifier = Modifier
                .offset(y = (-14).dp)
                .size(56.dp),
            contentAlignment = Alignment.Center
        ) {
            // Intense Golden Radial Glow aura matching Website shadow-[0_0_25px_rgba(212,175,55,0.8)]
            Box(
                modifier = Modifier
                    .size(62.dp)
                    .clip(CircleShape)
                    .background(
                        Brush.radialGradient(
                            colors = listOf(
                                Color(0xFFF5D77F).copy(alpha = if (isMyBetSelected) 0.85f else 0.5f),
                                Color(0xFFD4AF37).copy(alpha = if (isMyBetSelected) 0.45f else 0.2f),
                                Color.Transparent
                            )
                        )
                    )
            )

            // Outer Gradient Gold Ring
            Box(
                modifier = Modifier
                    .size(52.dp)
                    .clip(CircleShape)
                    .background(
                        Brush.linearGradient(
                            colors = listOf(Color(0xFFFFE599), Color(0xFFD4AF37), Color(0xFF8C6D13))
                        )
                    )
                    .border(
                        if (isMyBetSelected) 2.dp else 1.5.dp,
                        if (isMyBetSelected) Color(0xFFFFF7D6) else Color(0xFFF3D079).copy(alpha = 0.8f),
                        CircleShape
                    )
                    .clickable { onTabSelected("MY BET") }
                    .padding(2.dp)
                    .clip(CircleShape)
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(Color(0xFF1E293B), Color(0xFF0A0E17))
                        )
                    ),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Icon(
                        imageVector = CrownVectorIcon,
                        contentDescription = "MY BET",
                        tint = Color(0xFFF5D77F),
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.height(1.dp))
                    Text(
                        text = "MY BET",
                        color = Color(0xFFF5D77F),
                        fontSize = 7.5.sp,
                        fontWeight = FontWeight.Black,
                        letterSpacing = (-0.5).sp
                    )
                }
            }
        }
    }
}

@Composable
fun BottomNavItem(
    icon: ImageVector,
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier.clickable { onClick() }
    ) {
        if (isSelected) {
            // Golden Glow Aura behind selected tab item matching Website shadow-[0_0_12px_rgba(212,175,55,0.4)]
            Box(
                modifier = Modifier
                    .size(width = 56.dp, height = 44.dp)
                    .clip(RoundedCornerShape(22.dp))
                    .background(
                        Brush.radialGradient(
                            colors = listOf(
                                Color(0xFFF5D77F).copy(alpha = 0.5f),
                                Color(0xFFD4AF37).copy(alpha = 0.2f),
                                Color.Transparent
                            )
                        )
                    )
            )
        }

        val activeBg = if (isSelected) {
            Modifier
                .clip(RoundedCornerShape(22.dp))
                .background(
                    Brush.horizontalGradient(
                        colors = listOf(Color(0x55D4AF37), Color(0x358C6D13))
                    )
                )
                .border(1.2.dp, Color(0xFFF5D77F).copy(alpha = 0.85f), RoundedCornerShape(22.dp))
                .padding(horizontal = 12.dp, vertical = 4.dp)
        } else {
            Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        }

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
            modifier = Modifier.then(activeBg)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = label,
                tint = if (isSelected) Color(0xFFF5D77F) else Color(0xFF94A3B8),
                modifier = Modifier.size(19.dp)
            )
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = label,
                color = if (isSelected) Color(0xFFF5D77F) else Color(0xFF94A3B8),
                fontSize = 8.5.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 0.5.sp
            )
        }
    }
}

object BannerCache {
    var cachedBitmap: androidx.compose.ui.graphics.ImageBitmap? = null
}

data class DynamicBannerState(
    val title: String = "",
    val subtitle: String = "",
    val imageUrl: String = "",
    val referralText: String = "",
    val enabled: Boolean = true
)

@Composable
fun PromotionalBannerCard() {
    var bannerState by remember { mutableStateOf(DynamicBannerState()) }
    var imageBitmap by remember { mutableStateOf(BannerCache.cachedBitmap) }

    LaunchedEffect(Unit) {
        var lastImg: String? = null
        while (true) {
            withContext(Dispatchers.IO) {
                for (baseUrl in ApiConfig.getWorkingUrls()) {
                    try {
                        val url = URL("$baseUrl/api/game/banner")
                        val conn = url.openConnection() as HttpURLConnection
                        conn.requestMethod = "GET"
                        conn.setRequestProperty("Bypass-Tunnel-Reminder", "true")
                        conn.connectTimeout = 2000
                        if (conn.responseCode == 200) {
                            val text = conn.inputStream.bufferedReader().readText()
                            if (text.trim().startsWith("{")) {
                                val obj = JSONObject(text)
                                val titleStr = obj.optString("title", "")
                                val subStr = obj.optString("subtitle", "")
                                val refStr = obj.optString("referralText", "")
                                val img = obj.optString("imageUrl", "")
                                val isEnabled = obj.optBoolean("enabled", true)

                                withContext(Dispatchers.Main) {
                                    bannerState = DynamicBannerState(
                                        title = titleStr,
                                        subtitle = subStr,
                                        imageUrl = img,
                                        referralText = refStr,
                                        enabled = isEnabled
                                    )
                                }

                                if (img.isNotEmpty() && img != lastImg) {
                                    lastImg = img
                                    try {
                                        val bytes = if (img.startsWith("data:image")) {
                                            android.util.Base64.decode(img.substringAfter(","), android.util.Base64.DEFAULT)
                                        } else if (img.startsWith("/9j/") || img.startsWith("iVBORw0KGgo") || img.startsWith("R0lGOD") || (img.length > 50 && !img.contains(" ") && !img.startsWith("http"))) {
                                            try {
                                                android.util.Base64.decode(img, android.util.Base64.DEFAULT)
                                            } catch (_: Exception) { null }
                                        } else {
                                            null
                                        }
                                        val bmp = if (bytes != null) {
                                            android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                                        } else {
                                            android.graphics.BitmapFactory.decodeStream(URL(img).openStream())
                                        }
                                        if (bmp != null) {
                                            val decodedBmp = bmp.asImageBitmap()
                                            withContext(Dispatchers.Main) {
                                                BannerCache.cachedBitmap = decodedBmp
                                                imageBitmap = decodedBmp
                                            }
                                        }
                                    } catch (_: Exception) { }
                                }
                                break
                            }
                        }
                    } catch (_: Exception) { }
                }
            }
            delay(3000)
        }
    }

    if (!bannerState.enabled) return

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .border(1.5.dp, Color(0xFFF3D079), RoundedCornerShape(20.dp)),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF141414))
    ) {
        if (imageBitmap != null) {
            Image(
                bitmap = imageBitmap!!,
                contentDescription = "Custom Dynamic Promotional Banner",
                contentScale = ContentScale.FillWidth,
                modifier = Modifier
                    .fillMaxWidth()
                    .wrapContentHeight()
            )
        } else {
            Image(
                painter = painterResource(id = com.example.numberbetting.R.drawable.banner_promo),
                contentDescription = "Promotional Banner",
                contentScale = ContentScale.FillWidth,
                modifier = Modifier
                    .fillMaxWidth()
                    .wrapContentHeight()
            )
        }
    }
}
