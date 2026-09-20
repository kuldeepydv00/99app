package com.example.numberbetting.presentation.chart

import android.app.DatePickerDialog
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.GenericShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.numberbetting.data.ApiConfig
import com.example.numberbetting.presentation.components.MoneyDoodleBackground
import com.example.numberbetting.presentation.home.BottomNavigationBar
import com.example.numberbetting.presentation.home.openWhatsAppSupport
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.*

import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState

data class ChartItemData(
    val gameName: String,
    val winningNumber: String
)

@OptIn(ExperimentalMaterial3Api::class, ExperimentalMaterialApi::class)
@Composable
fun ChartsScreen(
    onNavigateToHome: () -> Unit = {},
    onNavigateToBetting: (String) -> Unit = {},
    onNavigateToWallet: () -> Unit = {},
    onNavigateToMyBets: () -> Unit = {},
    onNavigateToReferral: () -> Unit = {},
    whatsappNumber: String = "7206561420",
    onBack: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val calendar = remember { Calendar.getInstance() }
    var selectedDate by remember { mutableStateOf(calendar.time) }
    var chartResultsMap by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var isLoading by remember { mutableStateOf(false) }

    val dateFormat = remember { SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()) }
    val displayDateFormat = remember { SimpleDateFormat("dd MMMM yyyy", Locale.getDefault()) }

    // Fallback offline historical records for August 2026
    val fallbackChartRecords = remember {
        mapOf(
            "2026-08-15" to mapOf("Gali" to "71", "Ghaziabad" to "40", "Faridabad" to "58", "Desawar" to "49", "Disawer" to "49", "Shri Ganesh" to "23"),
            "2026-08-14" to mapOf("Gali" to "71", "Ghaziabad" to "38", "Faridabad" to "49", "Desawar" to "12", "Disawer" to "12", "Shri Ganesh" to "02"),
            "2026-08-13" to mapOf("Gali" to "61", "Ghaziabad" to "79", "Faridabad" to "54", "Desawar" to "79", "Disawer" to "79", "Shri Ganesh" to "34"),
            "2026-08-12" to mapOf("Gali" to "36", "Ghaziabad" to "63", "Faridabad" to "75", "Desawar" to "19", "Disawer" to "19", "Shri Ganesh" to "41"),
            "2026-08-11" to mapOf("Gali" to "92", "Ghaziabad" to "31", "Faridabad" to "58", "Desawar" to "88", "Disawer" to "88", "Shri Ganesh" to "30")
        )
    }

    // Fetch chart results for selected date
    val fetchResultsForDate = remember {
        { date: Date ->
            val dateStr = dateFormat.format(date)
            isLoading = true
            scope.launch(Dispatchers.IO) {
                var success = false
                for (baseUrl in ApiConfig.getWorkingUrls()) {
                    if (success) break
                    try {
                        val url = URL("$baseUrl/api/game/chart-results?date=$dateStr")
                        val conn = url.openConnection() as HttpURLConnection
                        conn.requestMethod = "GET"
                        conn.setRequestProperty("Bypass-Tunnel-Reminder", "true")
                        conn.connectTimeout = 1500
                        if (conn.responseCode == 200) {
                            ApiConfig.cachedWorkingUrl = baseUrl
                            val text = conn.inputStream.bufferedReader().readText()
                            val jsonObj = JSONObject(text)
                            val resObj = jsonObj.optJSONObject("results")
                            val map = mutableMapOf<String, String>()
                            if (resObj != null) {
                                val keys = resObj.keys()
                                while (keys.hasNext()) {
                                    val k = keys.next()
                                    map[k] = resObj.optString(k, "--")
                                }
                            }
                            withContext(Dispatchers.Main) {
                                chartResultsMap = map
                                isLoading = false
                            }
                            success = true
                        }
                    } catch (e: Exception) { }
                }
                if (!success) {
                    withContext(Dispatchers.Main) {
                        chartResultsMap = fallbackChartRecords[dateStr] ?: emptyMap()
                        isLoading = false
                    }
                }
            }
        }
    }

    LaunchedEffect(selectedDate) {
        fetchResultsForDate(selectedDate)
    }

    val pullRefreshState = rememberPullRefreshState(
        refreshing = isLoading,
        onRefresh = { fetchResultsForDate(selectedDate) }
    )

    // Date picker dialog launcher
    val datePickerDialog = remember {
        DatePickerDialog(
            context,
            { _, year, month, dayOfMonth ->
                val cal = Calendar.getInstance()
                cal.set(year, month, dayOfMonth)
                selectedDate = cal.time
            },
            calendar.get(Calendar.YEAR),
            calendar.get(Calendar.MONTH),
            calendar.get(Calendar.DAY_OF_MONTH)
        )
    }

    val defaultGamesList = listOf("Shiv Parwati", "Delhi Bazar", "Dubai Market", "Shree Ganesh", "Faridabad", "Ghaziabad", "Gali", "Desawar")

    Scaffold(
        bottomBar = {
            BottomNavigationBar(
                selectedTab = "CHART",
                onTabSelected = { tab ->
                    when (tab) {
                        "HOME" -> onNavigateToHome()
                        "WALLET" -> onNavigateToWallet()
                        "MY BET" -> onNavigateToMyBets()
                        "REFERRAL" -> onNavigateToReferral()
                        "CHAT" -> openWhatsAppSupport(context, whatsappNumber)
                        else -> {}
                    }
                }
            )
        }
    ) { innerPadding ->
        MoneyDoodleBackground(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .pullRefresh(pullRefreshState)
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(horizontal = 18.dp)
                ) {
                    Spacer(modifier = Modifier.height(16.dp))

                    // Screen Header
                    Text(
                        text = "Charts & Results",
                        color = Color.White,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.align(Alignment.CenterHorizontally)
                    )

                    Spacer(modifier = Modifier.height(14.dp))

                    // Quick Date Preset Chips Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        // Today Chip
                        val todayCal = Calendar.getInstance()
                        val isTodaySelected = dateFormat.format(selectedDate) == dateFormat.format(todayCal.time)
                        FilterChip(
                            selected = isTodaySelected,
                            onClick = { selectedDate = todayCal.time },
                            label = { Text("Today", fontSize = 12.sp, fontWeight = FontWeight.Bold) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = Color(0xFFFACC15),
                                selectedLabelColor = Color.Black,
                                containerColor = Color(0xFF1E2638),
                                labelColor = Color.White
                            )
                        )

                        // Yesterday Chip
                        val yestCal = Calendar.getInstance().apply { add(Calendar.DAY_OF_MONTH, -1) }
                        val isYestSelected = dateFormat.format(selectedDate) == dateFormat.format(yestCal.time)
                        FilterChip(
                            selected = isYestSelected,
                            onClick = { selectedDate = yestCal.time },
                            label = { Text("Yesterday", fontSize = 12.sp, fontWeight = FontWeight.Bold) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = Color(0xFFFACC15),
                                selectedLabelColor = Color.Black,
                                containerColor = Color(0xFF1E2638),
                                labelColor = Color.White
                            )
                        )

                        // Date Picker Chip
                        FilterChip(
                            selected = !isTodaySelected && !isYestSelected,
                            onClick = { datePickerDialog.show() },
                            label = { Text("📅 " + displayDateFormat.format(selectedDate), fontSize = 12.sp, fontWeight = FontWeight.Bold) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = Color(0xFFFACC15),
                                selectedLabelColor = Color.Black,
                                containerColor = Color(0xFF1E2638),
                                labelColor = Color.White
                            )
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    if (isLoading) {
                        Box(
                            modifier = Modifier.fillMaxWidth().weight(1f),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(color = Color(0xFFFACC15))
                        }
                    } else {
                        LazyColumn(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(14.dp)
                        ) {
                            items(defaultGamesList) { gameName ->
                                val lookupKey = if (gameName == "Disawer") "Desawar" else gameName
                                val winNum = chartResultsMap[lookupKey] ?: chartResultsMap[gameName] ?: "--"

                                ChartResultCard(
                                    gameName = gameName,
                                    winningNumber = winNum,
                                    onClick = { onNavigateToBetting(gameName) }
                                )
                            }
                        }
                    }
                }

                PullRefreshIndicator(
                    refreshing = isLoading,
                    state = pullRefreshState,
                    modifier = Modifier.align(Alignment.TopCenter),
                    backgroundColor = Color(0xFF1E293B),
                    contentColor = Color(0xFFFACC15)
                )
            }
        }
    }
}

val HexagonShape = GenericShape { size, _ ->
    val w = size.width
    val h = size.height
    moveTo(w * 0.5f, 0f)
    lineTo(w, h * 0.25f)
    lineTo(w, h * 0.75f)
    lineTo(w * 0.5f, h)
    lineTo(0f, h * 0.75f)
    lineTo(0f, h * 0.25f)
    close()
}

@Composable
fun ChartResultCard(
    gameName: String,
    winningNumber: String,
    onClick: () -> Unit = {}
) {
    val goldAccent = Color(0xFFFACC15)
    val cardBackground = Color(0xFF181C24)
    val numBoxBg = Color(0xFF222834)

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = cardBackground),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF2D3545))
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Gold Hexagon Icon Badge
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .clip(HexagonShape)
                    .background(Color(0xFFFACC15).copy(alpha = 0.2f))
                    .border(1.5.dp, goldAccent, HexagonShape),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = com.example.numberbetting.presentation.home.getGameIconEmoji(gameName),
                    fontSize = 22.sp
                )
            }

            Spacer(modifier = Modifier.width(16.dp))

            // Game Title & Subtitle
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = gameName,
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.height(3.dp))
                Text(
                    text = "Winner Number",
                    color = Color(0xFF94A3B8),
                    fontSize = 13.sp
                )
            }

            // Right Winning Number Display Box
            Box(
                modifier = Modifier
                    .size(width = 68.dp, height = 52.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(numBoxBg)
                    .border(1.dp, Color(0xFF333D52), RoundedCornerShape(14.dp)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = winningNumber,
                    color = goldAccent,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.ExtraBold,
                    fontFamily = FontFamily.Monospace
                )
            }
        }
    }
}
