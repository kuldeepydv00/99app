package com.example.numberbetting.presentation.history

import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.SpanStyle

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.numberbetting.presentation.theme.*
import com.example.numberbetting.presentation.components.MoneyDoodleBackground

import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay

data class BetItemData(
    val id: String,
    val gameName: String,
    val number: Int,
    val stakeAmount: Double,
    val potentialPayout: Double,
    val status: String, // "pending", "won", "lost"
    val winAmount: Double,
    val timestamp: String
)

@OptIn(ExperimentalMaterialApi::class)
@Composable
fun MyBetsScreen(
    placedBetsList: List<BetItemData> = emptyList(),
    onBack: () -> Unit = {},
    onRefresh: () -> Unit = {}
) {
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

    val context = androidx.compose.ui.platform.LocalContext.current
    var selectedDateFilter by remember { mutableStateOf("TODAY") }
    var selectedMarketFilter by remember { mutableStateOf("ALL") }

    val todayDateStr = remember {
        val sdf = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
        sdf.timeZone = java.util.TimeZone.getTimeZone("Asia/Kolkata")
        sdf.format(java.util.Date())
    }
    val yesterdayDateStr = remember {
        val sdf = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
        sdf.timeZone = java.util.TimeZone.getTimeZone("Asia/Kolkata")
        val cal = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("Asia/Kolkata"))
        cal.add(java.util.Calendar.DATE, -1)
        sdf.format(cal.time)
    }

    var customSelectedDate by remember { mutableStateOf(todayDateStr) }
    var customDateDisplay by remember { mutableStateOf("Calendar") }

    val datePickerDialog = remember {
        val cal = java.util.Calendar.getInstance()
        android.app.DatePickerDialog(
            context,
            { _, year, month, dayOfMonth ->
                val selectedCal = java.util.Calendar.getInstance()
                selectedCal.set(year, month, dayOfMonth)
                customSelectedDate = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.getDefault()).format(selectedCal.time)
                customDateDisplay = java.text.SimpleDateFormat("dd MMM", java.util.Locale.getDefault()).format(selectedCal.time)
                selectedDateFilter = "CUSTOM"
            },
            cal.get(java.util.Calendar.YEAR),
            cal.get(java.util.Calendar.MONTH),
            cal.get(java.util.Calendar.DAY_OF_MONTH)
        )
    }

    val filteredBetsList = placedBetsList.filter { bet ->
        val ts = bet.timestamp ?: ""
        val matchesDate = when (selectedDateFilter) {
            "TODAY" -> ts == "Today" || ts.contains(todayDateStr) || ts.contains("Just now") || (!ts.contains("-") && !ts.contains("202"))
            "YESTERDAY" -> ts.contains(yesterdayDateStr) || ts.contains("Yesterday")
            "CUSTOM" -> ts.contains(customSelectedDate)
            else -> true
        }

        val gName = bet.gameName.uppercase()
        val matchesMarket = when (selectedMarketFilter) {
            "ALL" -> true
            "DESAWAR" -> gName.contains("DESAWAR") || gName.contains("DISAWER")
            "SHREE GANESH" -> gName.contains("SHREE GANESH") || gName.contains("SHRI GANESH")
            else -> gName.contains(selectedMarketFilter)
        }
        matchesDate && matchesMarket
    }

    MoneyDoodleBackground {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .pullRefresh(pullRefreshState)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(16.dp)
            ) {
                // Header
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = onBack) {
                        Text("←", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "My Bets History",
                        color = Color.White,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Date Selector Bar ("Today", "Yesterday", "📅 Calendar")
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val dateOptions = listOf(
                        "TODAY" to "Today",
                        "YESTERDAY" to "Yesterday",
                        "CUSTOM" to "📅 $customDateDisplay"
                    )

                    dateOptions.forEach { (key, label) ->
                        val isSelected = selectedDateFilter == key
                        Box(
                            modifier = Modifier
                                .padding(horizontal = 4.dp)
                                .clip(RoundedCornerShape(20.dp))
                                .background(if (isSelected) Color(0xFFF3D079) else Color(0xFF1E293B))
                                .border(1.dp, if (isSelected) Color(0xFFF3D079) else SurfaceBorder, RoundedCornerShape(20.dp))
                                .clickable {
                                    if (key == "CUSTOM") {
                                        datePickerDialog.show()
                                    } else {
                                        selectedDateFilter = key
                                    }
                                }
                                .padding(horizontal = 16.dp, vertical = 7.dp)
                        ) {
                            Text(
                                text = label,
                                color = if (isSelected) Color(0xFF0F172A) else Color.White,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Permanent Market Columns / Tabs Bar
                androidx.compose.foundation.lazy.LazyRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    val markets = listOf("ALL", "SHIV PARWATI", "DELHI BAZAR", "DUBAI MARKET", "SHREE GANESH", "FARIDABAD", "GHAZIABAD", "GALI", "DESAWAR")
                    items(markets.size) { idx ->
                        val mKey = markets[idx]
                        val isSel = selectedMarketFilter == mKey
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (isSel) Color(0xFF10B981) else Color(0xFF1E2638))
                                .border(1.dp, if (isSel) Color(0xFF34D399) else SurfaceBorder, RoundedCornerShape(12.dp))
                                .clickable { selectedMarketFilter = mKey }
                                .padding(horizontal = 14.dp, vertical = 8.dp)
                        ) {
                            Text(
                                text = mKey,
                                color = if (isSel) Color(0xFF0F172A) else Color.White,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                if (filteredBetsList.isEmpty()) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("📜", fontSize = 48.sp)
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = "No bets placed for $selectedMarketFilter",
                                color = Color.White,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "Select another date or market column to view bids.",
                                color = TextSecondary,
                                fontSize = 13.sp
                            )
                        }
                    }
                } else {
                    val groupedBets = remember(filteredBetsList) {
                        filteredBetsList.groupBy { bet ->
                            val cleanG = bet.gameName.replace(" (Jodi)", "").replace(" (Crossing)", "").replace(" (Ander)", "").replace(" (Bahar)", "").trim()
                            val ts = bet.timestamp ?: ""
                            val betCategory = when {
                                bet.gameName.contains("(Crossing)") || (bet.id ?: "").startsWith("cross_") -> "CROSSING"
                                bet.gameName.contains("(Ander)") || (bet.id ?: "").startsWith("har_a") || (bet.id ?: "").contains("ander") -> "HAROOF_ANDER"
                                bet.gameName.contains("(Bahar)") || (bet.id ?: "").startsWith("har_b") || (bet.id ?: "").contains("bahar") -> "HAROOF_BAHAR"
                                bet.gameName.contains("Haroof") || (bet.id ?: "").startsWith("har_") -> "HAROOF"
                                else -> "JODI"
                            }
                            val timeKey = try {
                                if (ts.contains("T")) ts.split(".")[0].take(16)
                                else if (ts.contains("-") && ts.length >= 16) ts.take(16)
                                else ts
                            } catch (e: Exception) { ts }
                            "${cleanG}_${betCategory}_${timeKey}"
                        }.map { (key, items) ->
                            val first = items.first()
                            val rawName = first.gameName
                            val cleanName = rawName.replace(" (Jodi)", "").replace(" (Crossing)", "").replace(" (Ander)", "").replace(" (Bahar)", "").trim()
                            val betTypeLabel = when {
                                items.any { it.gameName.contains("(Crossing)") || (it.id ?: "").startsWith("cross_") } -> "Crossing Game"
                                items.any { it.gameName.contains("(Ander)") || (it.id ?: "").startsWith("har_a") } -> "Haroof Ander Game"
                                items.any { it.gameName.contains("(Bahar)") || (it.id ?: "").startsWith("har_b") } -> "Haroof Bahar Game"
                                items.any { it.gameName.contains("(Ander)") || it.gameName.contains("(Bahar)") || (it.id ?: "").startsWith("har_") } -> "Haroof Game"
                                else -> "Jodi Game"
                            }
                            val totalStake = items.sumOf { if (it.stakeAmount.isNaN() || it.stakeAmount.isInfinite()) 0.0 else it.stakeAmount }
                            val totalWin = items.sumOf { if (it.winAmount.isNaN() || it.winAmount.isInfinite()) 0.0 else it.winAmount }
                            val overallStatus = when {
                                items.any { (it.status ?: "").lowercase() == "won" } -> "won"
                                items.all { (it.status ?: "").lowercase() == "lost" } -> "lost"
                                else -> "pending"
                            }
                            val sortedItems = items.sortedBy { b ->
                                if (b.number == 100) 0 else b.number
                            }
                            BetGroup(
                                key = key,
                                gameName = rawName,
                                cleanGameName = cleanName,
                                betTypeLabel = betTypeLabel,
                                dateStr = first.timestamp ?: "",
                                status = overallStatus,
                                totalAmount = totalStake,
                                totalWin = totalWin,
                                items = sortedItems
                            )
                        }
                    }

                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        itemsIndexed(
                            items = groupedBets,
                            key = { index, item -> "${item.key}_$index" }
                        ) { _, item ->
                            BetGroupCardItem(group = item)
                        }
                    }
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

data class BetGroup(
    val key: String,
    val gameName: String,
    val cleanGameName: String,
    val betTypeLabel: String,
    val dateStr: String,
    val status: String,
    val totalAmount: Double,
    val totalWin: Double,
    val items: List<BetItemData>
)

@Composable
fun BetGroupCardItem(group: BetGroup) {
    val cleanTs = group.dateStr
    val formattedDate = try {
        if (cleanTs.contains("T") || (cleanTs.contains("-") && cleanTs.contains(":"))) {
            val tsWithoutZ = cleanTs.replace("Z", "").split(".")[0]
            val isoFormat = if (cleanTs.contains("T")) {
                java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.getDefault()).apply {
                    timeZone = java.util.TimeZone.getTimeZone("UTC")
                }
            } else {
                java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.getDefault()).apply {
                    timeZone = java.util.TimeZone.getTimeZone("UTC")
                }
            }
            val parsed = isoFormat.parse(tsWithoutZ)
            val outFormat = java.text.SimpleDateFormat("MMMM dd, yyyy • hh:mm a", java.util.Locale.getDefault()).apply {
                timeZone = java.util.TimeZone.getDefault()
            }
            if (parsed != null) outFormat.format(parsed) else cleanTs
        } else if (cleanTs.isNotBlank() && cleanTs != "Today" && cleanTs != "Just now") {
            cleanTs
        } else {
            java.text.SimpleDateFormat("MMMM dd, yyyy • hh:mm a", java.util.Locale.getDefault()).format(java.util.Date())
        }
    } catch (e: Exception) {
        if (cleanTs.isNotBlank()) cleanTs else "Today"
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF16202E)),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF263346))
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            // Top Header Bar
            val statusColor = when (group.status.lowercase()) {
                "won" -> Color(0xFF22C55E)
                "lost" -> Color(0xFFEF4444)
                else -> Color(0xFFF59E0B)
            }
            val statusText = when (group.status.lowercase()) {
                "won" -> "• Completed"
                "lost" -> "• Completed"
                else -> "• Pending"
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF263346))
                    .padding(horizontal = 16.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = group.cleanGameName,
                    color = Color.White,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = statusText,
                    color = statusColor,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            // Card Body
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = group.cleanGameName,
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )

                Spacer(modifier = Modifier.height(2.dp))

                Text(
                    text = formattedDate,
                    color = Color(0xFF94A3B8),
                    fontSize = 12.sp
                )

                Spacer(modifier = Modifier.height(6.dp))

                Text(
                    text = group.betTypeLabel,
                    color = Color(0xFFF3D079),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = "Amount placed on the numbers",
                    color = Color(0xFF94A3B8),
                    fontSize = 12.sp
                )

                Spacer(modifier = Modifier.height(12.dp))

                // Number Badges Grid (5 Cards per Row, NO Horizontal Swipe)
                val chunkedItems = group.items.chunked(5)
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    chunkedItems.forEach { rowItems ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            rowItems.forEach { item ->
                                val gName = item.gameName
                                val isAnder = gName.contains("Ander", ignoreCase = true) || item.id.startsWith("har_a", ignoreCase = true) || item.id.contains("ander", ignoreCase = true)
                                val isBahar = gName.contains("Bahar", ignoreCase = true) || item.id.startsWith("har_b", ignoreCase = true) || item.id.contains("bahar", ignoreCase = true)
                                val isHaroof = isAnder || isBahar || gName.contains("Haroof", ignoreCase = true) || item.id.startsWith("har_", ignoreCase = true)

                                val haroofBadge = when {
                                    isAnder -> "A"
                                    isBahar -> "B"
                                    else -> ""
                                }

                                val numStr = if (isHaroof) {
                                    if (haroofBadge.isNotEmpty()) "${item.number} ($haroofBadge)" else "${item.number}"
                                } else if (item.number == 100 || item.number == 0) {
                                    "00"
                                } else {
                                    item.number.toString().padStart(2, '0')
                                }

                                val stk = if (item.stakeAmount.isNaN() || item.stakeAmount.isInfinite()) 0 else item.stakeAmount.toInt()

                                Column(
                                    horizontalAlignment = Alignment.CenterHorizontally,
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(8.dp))
                                        .border(1.dp, Color(0xFF263346), RoundedCornerShape(8.dp))
                                ) {
                                    // Top Box (Number)
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(36.dp)
                                            .background(Color(0xFF0F172A)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = numStr,
                                            color = Color.White,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = if (numStr.length > 3) 12.sp else 15.sp,
                                            fontFamily = FontFamily.Monospace
                                        )
                                    }
                                    // Bottom Box (Amount)
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(26.dp)
                                            .background(Color(0xFFF3D079)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = "₹$stk",
                                            color = Color(0xFF0F172A),
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 11.sp
                                        )
                                    }
                                }
                            }

                            repeat(5 - rowItems.size) {
                                Spacer(modifier = Modifier.weight(1f))
                            }
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Total Amount Button
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFF263346))
                        .padding(vertical = 12.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Total Amount: ₹${group.totalAmount.toInt()}",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    )
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Rewards Text
                if (group.status.lowercase() == "won") {
                    Text(
                        text = "🎉 Won: +₹${group.totalWin.toInt()}",
                        color = Color(0xFF00C853),
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp
                    )
                } else {
                    Text(
                        text = "No Rewards",
                        color = Color(0xFFF3D079),
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp
                    )
                }
            }
        }
    }
}

