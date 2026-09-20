package com.example.numberbetting.presentation.khaiwal

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.example.numberbetting.data.ApiConfig
import com.example.numberbetting.domain.GameScheduleManager
import com.example.numberbetting.domain.LanguageManager
import com.example.numberbetting.presentation.components.MoneyDoodleBackground
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

data class KhaiwalPlayer(
    val id: String,
    val name: String,
    val jodiRate: Double,
    val crossingRate: Double,
    val haroofRate: Double,
    val commissionPct: Double,
    val createdAt: String
)

data class PlayerBetEntry(
    val id: String,
    val playerId: String,
    val playerName: String,
    val gameName: String,
    val category: String, // "Jodi", "Crossing", "Haruf"
    val betsJson: String,
    val totalAmount: Double,
    val commission: Double,
    val gameResult: String?,
    val isWinner: Boolean,
    val virtualPayout: Double,
    val createdAt: String
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun KhaiwalScreen(
    userMobile: String,
    onBack: () -> Unit,
    onSelectPlayerForBet: (gameName: String, playerId: String, playerName: String) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var playersList by remember { mutableStateOf<List<KhaiwalPlayer>>(emptyList()) }
    var isLoading by remember { mutableStateOf(false) }
    var selectedPlayer by remember { mutableStateOf<KhaiwalPlayer?>(null) }
    var selectedPlayerLedger by remember { mutableStateOf<List<PlayerBetEntry>>(emptyList()) }
    var totalPlayerBets by remember { mutableStateOf(0.0) }
    var totalPlayerCommission by remember { mutableStateOf(0.0) }

    var showAddPlayerDialog by remember { mutableStateOf(false) }
    var showMarketSelectDialog by remember { mutableStateOf(false) }
    var selectedTabInLedger by remember { mutableStateOf("ALL") } // "ALL", "JODI", "CROSSING", "HARUF", "HISTORY"
    var selectedDateFilterInLedger by remember { mutableStateOf("ALL") } // "ALL", "TODAY", "YESTERDAY", "CUSTOM"
    var selectedMarketFilterInLedger by remember { mutableStateOf("ALL") }

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
                selectedDateFilterInLedger = "CUSTOM"
            },
            cal.get(java.util.Calendar.YEAR),
            cal.get(java.util.Calendar.MONTH),
            cal.get(java.util.Calendar.DAY_OF_MONTH)
        )
    }

    var showEditPlayerDialog by remember { mutableStateOf(false) }
    var editingPlayer by remember { mutableStateOf<KhaiwalPlayer?>(null) }
    var editName by remember { mutableStateOf("") }
    var editJodiRate by remember { mutableStateOf("95") }
    var editCrossingRate by remember { mutableStateOf("95") }
    var editHarufRate by remember { mutableStateOf("9.5") }
    var editCommissionPct by remember { mutableStateOf("5") }

    var showDeleteConfirmDialog by remember { mutableStateOf(false) }
    var deletingPlayer by remember { mutableStateOf<KhaiwalPlayer?>(null) }

    // Form inputs for Add Player
    var inputName by remember { mutableStateOf("") }
    var inputJodiRate by remember { mutableStateOf("95") }
    var inputCrossingRate by remember { mutableStateOf("95") }
    var inputHarufRate by remember { mutableStateOf("9.5") }
    var inputCommissionPct by remember { mutableStateOf("5") }
    var formError by remember { mutableStateOf("") }

    val cleanMobile = remember(userMobile) { userMobile.replace("[^0-9]".toRegex(), "").takeLast(10) }

    fun fetchPlayers() {
        isLoading = true
        scope.launch(Dispatchers.IO) {
            try {
                val url = URL("${ApiConfig.BASE_URL}/api/user/khaiwal/players?mobile=$cleanMobile")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "GET"
                conn.connectTimeout = 8000
                conn.readTimeout = 8000
                if (conn.responseCode == 200) {
                    val stream = conn.inputStream
                    val text = stream.bufferedReader().use { it.readText() }
                    val json = JSONObject(text)
                    if (json.optBoolean("success", false)) {
                        val arr = json.optJSONArray("players") ?: JSONArray()
                        val list = mutableListOf<KhaiwalPlayer>()
                        for (i in 0 until arr.length()) {
                            val obj = arr.getJSONObject(i)
                            list.add(
                                KhaiwalPlayer(
                                    id = obj.optString("id"),
                                    name = obj.optString("name"),
                                    jodiRate = obj.optDouble("jodi_rate", 95.0),
                                    crossingRate = obj.optDouble("crossing_rate", 95.0),
                                    haroofRate = obj.optDouble("haroof_rate", 9.5),
                                    commissionPct = obj.optDouble("commission_pct", 0.0),
                                    createdAt = obj.optString("createdAt")
                                )
                            )
                        }
                        withContext(Dispatchers.Main) {
                            playersList = list
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                withContext(Dispatchers.Main) { isLoading = false }
            }
        }
    }

    fun fetchPlayerLedger(p: KhaiwalPlayer) {
        scope.launch(Dispatchers.IO) {
            try {
                val url = URL("${ApiConfig.BASE_URL}/api/user/khaiwal/players/${p.id}/ledger?mobile=$cleanMobile")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "GET"
                conn.connectTimeout = 8000
                conn.readTimeout = 8000
                if (conn.responseCode == 200) {
                    val stream = conn.inputStream
                    val text = stream.bufferedReader().use { it.readText() }
                    val json = JSONObject(text)
                    if (json.optBoolean("success", false)) {
                        val totAmt = json.optDouble("totalBetAmount", 0.0)
                        val totComm = json.optDouble("totalCommission", 0.0)
                        val histArr = json.optJSONArray("history") ?: JSONArray()
                        val entries = mutableListOf<PlayerBetEntry>()
                        for (i in 0 until histArr.length()) {
                            val b = histArr.getJSONObject(i)
                            entries.add(
                                PlayerBetEntry(
                                    id = b.optString("id"),
                                    playerId = b.optString("playerId"),
                                    playerName = b.optString("playerName"),
                                    gameName = b.optString("gameName"),
                                    category = b.optString("category", "Jodi"),
                                    betsJson = b.optJSONArray("bets")?.toString() ?: "[]",
                                    totalAmount = b.optDouble("totalAmount", 0.0),
                                    commission = b.optDouble("commission", 0.0),
                                    gameResult = if (b.isNull("gameResult")) null else b.optString("gameResult"),
                                    isWinner = b.optBoolean("isWinner", false),
                                    virtualPayout = b.optDouble("virtualPayout", 0.0),
                                    createdAt = if (!b.isNull("date") && b.optString("date").isNotBlank()) b.optString("date") else b.optString("createdAt")
                                )
                            )
                        }
                        withContext(Dispatchers.Main) {
                            totalPlayerBets = totAmt
                            totalPlayerCommission = totComm
                            selectedPlayerLedger = entries
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun savePlayer() {
        if (inputName.isBlank()) {
            formError = "Please enter player name"
            return
        }
        scope.launch(Dispatchers.IO) {
            try {
                val url = URL("${ApiConfig.BASE_URL}/api/user/khaiwal/players")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.doOutput = true

                val payload = JSONObject().apply {
                    put("mobile", cleanMobile)
                    put("name", inputName.trim())
                    put("jodi_rate", inputJodiRate.toDoubleOrNull() ?: 95.0)
                    put("crossing_rate", inputCrossingRate.toDoubleOrNull() ?: 95.0)
                    put("haroof_rate", inputHarufRate.toDoubleOrNull() ?: 9.5)
                    put("commission_pct", inputCommissionPct.toDoubleOrNull() ?: 0.0)
                }

                conn.outputStream.write(payload.toString().toByteArray())
                if (conn.responseCode == 200) {
                    withContext(Dispatchers.Main) {
                        showAddPlayerDialog = false
                        inputName = ""
                        formError = ""
                        fetchPlayers()
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun updatePlayer() {
        val target = editingPlayer ?: return
        if (editName.isBlank()) return
        scope.launch(Dispatchers.IO) {
            try {
                val url = URL("${ApiConfig.BASE_URL}/api/user/khaiwal/players/update")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.doOutput = true

                val payload = JSONObject().apply {
                    put("mobile", cleanMobile)
                    put("playerId", target.id)
                    put("name", editName.trim())
                    put("jodi_rate", editJodiRate.toDoubleOrNull() ?: 95.0)
                    put("crossing_rate", editCrossingRate.toDoubleOrNull() ?: 95.0)
                    put("haroof_rate", editHarufRate.toDoubleOrNull() ?: 9.5)
                    put("commission_pct", editCommissionPct.toDoubleOrNull() ?: 0.0)
                }

                conn.outputStream.write(payload.toString().toByteArray())
                if (conn.responseCode == 200) {
                    withContext(Dispatchers.Main) {
                        showEditPlayerDialog = false
                        editingPlayer = null
                        fetchPlayers()
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    fun deletePlayer() {
        val target = deletingPlayer ?: return
        scope.launch(Dispatchers.IO) {
            try {
                val url = URL("${ApiConfig.BASE_URL}/api/user/khaiwal/players/delete")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.doOutput = true

                val payload = JSONObject().apply {
                    put("mobile", cleanMobile)
                    put("playerId", target.id)
                }

                conn.outputStream.write(payload.toString().toByteArray())
                if (conn.responseCode == 200) {
                    withContext(Dispatchers.Main) {
                        showDeleteConfirmDialog = false
                        deletingPlayer = null
                        if (selectedPlayer?.id == target.id) selectedPlayer = null
                        fetchPlayers()
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    LaunchedEffect(Unit) {
        fetchPlayers()
    }

    MoneyDoodleBackground {
        Scaffold(
            topBar = {
                TopAppBar(
                    title = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("👑 ", fontSize = 20.sp)
                            Text(
                                "KHAIWAL MANAGEMENT PANEL",
                                color = Color(0xFFF3D079),
                                fontSize = 15.sp,
                                fontWeight = FontWeight.Black
                            )
                        }
                    },
                    navigationIcon = {
                        IconButton(onClick = onBack) {
                            Text("←", color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.Bold)
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFF0F172A))
                )
            },
            containerColor = Color.Transparent
        ) { padding ->
            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // Prominent Khaiwal Role Banner Tag
                item {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(20.dp))
                            .background(
                                Brush.horizontalGradient(
                                    colors = listOf(Color(0xFF1E293D), Color(0xFF0F172A), Color(0xFF1E293D))
                                )
                            )
                            .border(1.5.dp, Color(0xFFF3D079), RoundedCornerShape(20.dp))
                            .padding(16.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column {
                                Text(
                                    text = "YOU ARE A KHAIWAL",
                                    color = Color(0xFFF3D079),
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Black,
                                    letterSpacing = 1.sp
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = "Manage your players, record bets & track commissions",
                                    color = Color(0xFFCBD5E1),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Medium
                                )
                            }
                            Text("👑", fontSize = 32.sp)
                        }
                    }
                }

                // Primary Navigation Buttons
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        // Button 1: Add a Player
                        Button(
                            onClick = { showAddPlayerDialog = true },
                            modifier = Modifier
                                .weight(1f)
                                .height(50.dp),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00C853))
                        ) {
                            Text("➕ Add a Player", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Black)
                        }

                        // Button 2: See Your Players
                        Button(
                            onClick = {
                                selectedPlayer = null
                                fetchPlayers()
                            },
                            modifier = Modifier
                                .weight(1f)
                                .height(50.dp),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1E293D)),
                            border = BorderStroke(1.dp, Color(0xFFF3D079))
                        ) {
                            Text("👥 See Your Players", color = Color(0xFFF3D079), fontSize = 13.sp, fontWeight = FontWeight.Black)
                        }
                    }
                }

                if (selectedPlayer == null) {
                    // List of Players
                    item {
                        Text(
                            "YOUR REGISTERED PLAYERS (${playersList.size})",
                            color = Color.White,
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 0.5.sp
                        )
                    }

                    if (playersList.isEmpty()) {
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(Color(0xFF0F172A))
                                    .padding(24.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text("👤", fontSize = 40.sp)
                                    Spacer(modifier = Modifier.height(8.dp))
                                    Text("No players added yet.", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                                    Text("Tap '+ Add a Player' above to register your first player!", color = Color(0xFF94A3B8), fontSize = 11.sp, textAlign = TextAlign.Center)
                                }
                            }
                        }
                    } else {
                        items(playersList) { p ->
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(16.dp))
                                    .background(Color(0xFF0F172A))
                                    .border(1.dp, Color(0xFF334155), RoundedCornerShape(16.dp))
                                    .padding(14.dp)
                            ) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        modifier = Modifier
                                            .weight(1f)
                                            .clickable {
                                                selectedPlayer = p
                                                fetchPlayerLedger(p)
                                            }
                                    ) {
                                        Box(
                                            modifier = Modifier
                                                .size(40.dp)
                                                .clip(CircleShape)
                                                .background(Color(0xFF1E293B))
                                                .border(1.dp, Color(0xFFF3D079), CircleShape),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Text("👤", fontSize = 18.sp)
                                        }
                                        Spacer(modifier = Modifier.width(12.dp))
                                        Column {
                                            Text(p.name, color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.Black)
                                            Spacer(modifier = Modifier.height(2.dp))
                                            Text(
                                                "Rates: Jodi ${p.jodiRate}x • Haruf ${p.haroofRate}x | Comm: ${p.commissionPct}%",
                                                color = Color(0xFFF3D079),
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.SemiBold
                                            )
                                        }
                                    }

                                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                        // Edit Player Button
                                        IconButton(
                                            onClick = {
                                                editingPlayer = p
                                                editName = p.name
                                                editJodiRate = if (p.jodiRate % 1.0 == 0.0) p.jodiRate.toInt().toString() else p.jodiRate.toString()
                                                editCrossingRate = if (p.crossingRate % 1.0 == 0.0) p.crossingRate.toInt().toString() else p.crossingRate.toString()
                                                editHarufRate = if (p.haroofRate % 1.0 == 0.0) p.haroofRate.toInt().toString() else p.haroofRate.toString()
                                                editCommissionPct = if (p.commissionPct % 1.0 == 0.0) p.commissionPct.toInt().toString() else p.commissionPct.toString()
                                                showEditPlayerDialog = true
                                            },
                                            modifier = Modifier.size(32.dp)
                                        ) {
                                            Text("✏️", fontSize = 14.sp)
                                        }

                                        // Delete Player Button
                                        IconButton(
                                            onClick = {
                                                deletingPlayer = p
                                                showDeleteConfirmDialog = true
                                            },
                                            modifier = Modifier.size(32.dp)
                                        ) {
                                            Text("🗑️", fontSize = 14.sp)
                                        }

                                        Text("➔", color = Color(0xFFF3D079), fontSize = 16.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                    }
                } else {
                    // SELECTED PLAYER LEDGER & TRACKER VIEW
                    val p = selectedPlayer!!

                    item {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                "← Back to Players List",
                                color = Color(0xFFF3D079),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.clickable { selectedPlayer = null }
                            )
                            Text("Player Tracker Profile", color = Color.Gray, fontSize = 11.sp)
                        }
                    }

                    // Player Header Info
                    item {
                        // Dynamic summary calculation based on selected date, market, and category filters
                        val (displayedTotalBets, displayedCommission, displayedTotalWinning) = remember(
                            selectedPlayerLedger,
                            selectedDateFilterInLedger,
                            selectedMarketFilterInLedger,
                            selectedTabInLedger,
                            customSelectedDate
                        ) {
                            val filtered = selectedPlayerLedger.filter { entry ->
                                // 1. Date Filter
                                val ts = entry.createdAt ?: ""
                                val matchesDate = when (selectedDateFilterInLedger) {
                                    "TODAY" -> ts.contains(todayDateStr) || ts.contains("Today") || (!ts.contains("-") && !ts.contains("202"))
                                    "YESTERDAY" -> ts.contains(yesterdayDateStr) || ts.contains("Yesterday")
                                    "CUSTOM" -> ts.contains(customSelectedDate)
                                    else -> true
                                }
                                if (!matchesDate) return@filter false

                                // 2. Market Filter
                                val gName = entry.gameName.uppercase()
                                val matchesMarket = when (selectedMarketFilterInLedger) {
                                    "ALL" -> true
                                    "DESAWAR" -> gName.contains("DESAWAR") || gName.contains("DISAWER")
                                    "SHREE GANESH" -> gName.contains("SHREE GANESH") || gName.contains("SHRI GANESH")
                                    else -> gName.contains(selectedMarketFilterInLedger)
                                }
                                if (!matchesMarket) return@filter false

                                // 3. Category Filter
                                if (selectedTabInLedger == "HISTORY" || selectedTabInLedger == "ALL") return@filter true
                                val rootCat = entry.category.uppercase()

                                try {
                                    val arr = JSONArray(entry.betsJson)
                                    if (arr.length() > 0) {
                                        var hasMatch = false
                                        for (i in 0 until arr.length()) {
                                            val obj = arr.getJSONObject(i)
                                            val bType = obj.optString("betType", obj.optString("bet_type", obj.optString("type", ""))).uppercase()
                                            val numStr = obj.optString("number", obj.optString("num", "")).uppercase()

                                            if (selectedTabInLedger == "CROSSING" && (bType.contains("CROSSING") || rootCat == "CROSSING" || rootCat == "CROSS")) hasMatch = true
                                            else if (selectedTabInLedger == "HARUF" && (bType.contains("HARUF") || bType.contains("HAROOF") || bType.contains("ANDER") || bType.contains("ANDAR") || bType.contains("BAHAR") || numStr.startsWith("A") || numStr.startsWith("B") || rootCat == "HARUF" || rootCat == "HAROOF")) hasMatch = true
                                            else if (selectedTabInLedger == "JODI" && (bType.contains("JODI") || rootCat == "JODI" || (!bType.contains("CROSSING") && !bType.contains("HARUF") && !bType.contains("HAROOF") && !bType.contains("ANDER") && !bType.contains("ANDAR") && !bType.contains("BAHAR") && !numStr.startsWith("A") && !numStr.startsWith("B")))) hasMatch = true
                                        }
                                        return@filter hasMatch
                                    }
                                } catch (e: Exception) {}

                                if (selectedTabInLedger == "JODI" && rootCat == "JODI") return@filter true
                                if (selectedTabInLedger == "CROSSING" && (rootCat == "CROSSING" || rootCat == "CROSS")) return@filter true
                                if (selectedTabInLedger == "HARUF" && (rootCat == "HARUF" || rootCat == "HAROOF")) return@filter true

                                false
                            }

                            val totB = filtered.sumOf { it.totalAmount }
                            val totC = filtered.sumOf { it.commission }
                            val totW = filtered.filter { it.isWinner || it.virtualPayout > 0 }.sumOf { it.virtualPayout }
                            Triple(totB, totC, totW)
                        }

                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(18.dp))
                                .background(Color(0xFF0F172A))
                                .border(1.dp, Color(0xFFF3D079), RoundedCornerShape(18.dp))
                                .padding(16.dp)
                        ) {
                            Column {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column {
                                        Text(p.name, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black)
                                        Text("Registered Player Ledger", color = Color(0xFF94A3B8), fontSize = 11.sp)
                                    }
                                    Button(
                                        onClick = { showMarketSelectDialog = true },
                                        shape = RoundedCornerShape(12.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00C853))
                                    ) {
                                        Text("🎲 Place Bet", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Black)
                                    }
                                }

                                Spacer(modifier = Modifier.height(14.dp))
                                Divider(color = Color(0xFF334155))
                                Spacer(modifier = Modifier.height(14.dp))

                                // Commission, Total Bets & Total Winning Summary Section
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.Top
                                ) {
                                    // Left Column: Total Bets Placed & Total Winning
                                    Column(horizontalAlignment = Alignment.Start) {
                                        Text("TOTAL BETS PLACED", color = Color(0xFF94A3B8), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                        Spacer(modifier = Modifier.height(2.dp))
                                        Text("₹${String.format("%.2f", displayedTotalBets)}", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Black)

                                        Spacer(modifier = Modifier.height(10.dp))

                                        Text("TOTAL WINNING", color = Color(0xFF94A3B8), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                        Spacer(modifier = Modifier.height(2.dp))
                                        Text("₹${String.format("%.2f", displayedTotalWinning)}", color = Color(0xFF38BDF8), fontSize = 16.sp, fontWeight = FontWeight.Black)
                                    }

                                    // Right Column: Your Commission
                                    Column(horizontalAlignment = Alignment.End) {
                                        Text("YOUR COMMISSION (${p.commissionPct}%)", color = Color(0xFFF3D079), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                        Spacer(modifier = Modifier.height(2.dp))
                                        Text("₹${String.format("%.2f", displayedCommission)}", color = Color(0xFF00C853), fontSize = 16.sp, fontWeight = FontWeight.Black)
                                    }
                                }
                            }
                        }
                    }

                    // Date Selector Bar ("All Dates", "Today", "Yesterday", "📅 Calendar")
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.Center,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            val dateOptions = listOf(
                                "ALL" to "All Dates",
                                "TODAY" to "Today",
                                "YESTERDAY" to "Yesterday",
                                "CUSTOM" to "📅 $customDateDisplay"
                            )

                            dateOptions.forEach { (key, label) ->
                                val isSelected = selectedDateFilterInLedger == key
                                Box(
                                    modifier = Modifier
                                        .padding(horizontal = 3.dp)
                                        .clip(RoundedCornerShape(16.dp))
                                        .background(if (isSelected) Color(0xFFF3D079) else Color(0xFF1E293B))
                                        .border(1.dp, if (isSelected) Color(0xFFF3D079) else Color(0xFF334155), RoundedCornerShape(16.dp))
                                        .clickable {
                                            if (key == "CUSTOM") {
                                                datePickerDialog.show()
                                            } else {
                                                selectedDateFilterInLedger = key
                                            }
                                        }
                                        .padding(horizontal = 12.dp, vertical = 6.dp)
                                ) {
                                    Text(
                                        text = label,
                                        color = if (isSelected) Color(0xFF0F172A) else Color.White,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                            }
                        }
                    }

                    // Market Columns Selector Bar (Horizontal Scrollable Tabs)
                    item {
                        androidx.compose.foundation.lazy.LazyRow(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            val markets = listOf("ALL", "SHIV PARWATI", "DELHI BAZAR", "DUBAI MARKET", "SHREE GANESH", "FARIDABAD", "GHAZIABAD", "GALI", "DESAWAR")
                            items(markets.size) { idx ->
                                val mKey = markets[idx]
                                val isSel = selectedMarketFilterInLedger == mKey
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(10.dp))
                                        .background(if (isSel) Color(0xFF10B981) else Color(0xFF1E2638))
                                        .border(1.dp, if (isSel) Color(0xFF34D399) else Color(0xFF334155), RoundedCornerShape(10.dp))
                                        .clickable { selectedMarketFilterInLedger = mKey }
                                        .padding(horizontal = 12.dp, vertical = 6.dp)
                                ) {
                                    Text(
                                        text = mKey,
                                        color = if (isSel) Color(0xFF0F172A) else Color.White,
                                        fontSize = 10.5.sp,
                                        fontWeight = FontWeight.ExtraBold
                                    )
                                }
                            }
                        }
                    }

                    // Category Section Tabs (ALL, JODI, CROSSING, HARUF, HISTORY)
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            listOf("ALL", "JODI", "CROSSING", "HARUF", "HISTORY").forEach { tab ->
                                val isSel = selectedTabInLedger == tab
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(if (isSel) Color(0xFFF3D079) else Color(0xFF0F172A))
                                        .border(1.dp, if (isSel) Color(0xFFF3D079) else Color(0xFF334155), RoundedCornerShape(12.dp))
                                        .clickable { selectedTabInLedger = tab }
                                        .padding(vertical = 10.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = tab,
                                        color = if (isSel) Color.Black else Color.White,
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Black
                                    )
                                }
                            }
                        }
                    }

                    // Filtered Bets List
                    val filteredEntries = selectedPlayerLedger.filter { entry ->
                        // 1. Date Filter
                        val ts = entry.createdAt ?: ""
                        val matchesDate = when (selectedDateFilterInLedger) {
                            "TODAY" -> ts.contains(todayDateStr) || ts.contains("Today") || (!ts.contains("-") && !ts.contains("202"))
                            "YESTERDAY" -> ts.contains(yesterdayDateStr) || ts.contains("Yesterday")
                            "CUSTOM" -> ts.contains(customSelectedDate)
                            else -> true
                        }
                        if (!matchesDate) return@filter false

                        // 2. Market Filter
                        val gName = entry.gameName.uppercase()
                        val matchesMarket = when (selectedMarketFilterInLedger) {
                            "ALL" -> true
                            "DESAWAR" -> gName.contains("DESAWAR") || gName.contains("DISAWER")
                            "SHREE GANESH" -> gName.contains("SHREE GANESH") || gName.contains("SHRI GANESH")
                            else -> gName.contains(selectedMarketFilterInLedger)
                        }
                        if (!matchesMarket) return@filter false

                        // 3. Category Filter
                        if (selectedTabInLedger == "HISTORY" || selectedTabInLedger == "ALL") return@filter true
                        val rootCat = entry.category.uppercase()

                        try {
                            val arr = JSONArray(entry.betsJson)
                            if (arr.length() > 0) {
                                var hasMatch = false
                                for (i in 0 until arr.length()) {
                                    val obj = arr.getJSONObject(i)
                                    val bType = obj.optString("betType", obj.optString("bet_type", obj.optString("type", ""))).uppercase()
                                    val numStr = obj.optString("number", obj.optString("num", "")).uppercase()
                                    
                                    if (selectedTabInLedger == "CROSSING" && (bType.contains("CROSSING") || rootCat == "CROSSING" || rootCat == "CROSS")) hasMatch = true
                                    else if (selectedTabInLedger == "HARUF" && (bType.contains("HARUF") || bType.contains("HAROOF") || bType.contains("ANDER") || bType.contains("ANDAR") || bType.contains("BAHAR") || numStr.startsWith("A") || numStr.startsWith("B") || rootCat == "HARUF" || rootCat == "HAROOF")) hasMatch = true
                                    else if (selectedTabInLedger == "JODI" && (bType.contains("JODI") || rootCat == "JODI" || (!bType.contains("CROSSING") && !bType.contains("HARUF") && !bType.contains("HAROOF") && !bType.contains("ANDER") && !bType.contains("ANDAR") && !bType.contains("BAHAR") && !numStr.startsWith("A") && !numStr.startsWith("B")))) hasMatch = true
                                }
                                return@filter hasMatch
                            }
                        } catch (e: Exception) {}

                        if (selectedTabInLedger == "JODI" && rootCat == "JODI") return@filter true
                        if (selectedTabInLedger == "CROSSING" && (rootCat == "CROSSING" || rootCat == "CROSS")) return@filter true
                        if (selectedTabInLedger == "HARUF" && (rootCat == "HARUF" || rootCat == "HAROOF")) return@filter true

                        false
                    }

                    if (filteredEntries.isEmpty()) {
                        item {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(Color(0xFF0F172A))
                                    .padding(20.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("No entries recorded in $selectedTabInLedger section.", color = Color.Gray, fontSize = 12.sp)
                            }
                        }
                    } else {
                        items(filteredEntries) { b ->
                            KhaiwalBetCardItem(b)
                        }
                    }
                }
            }
        }
    }

    // MODAL 1: ADD PLAYER DIALOG
    if (showAddPlayerDialog) {
        Dialog(onDismissRequest = { showAddPlayerDialog = false }) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color(0xFF1E293B))
                    .border(1.dp, Color(0xFFF3D079), RoundedCornerShape(20.dp))
                    .padding(20.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("➕ Add a New Player", color = Color(0xFFF3D079), fontSize = 18.sp, fontWeight = FontWeight.Black)
                    Text("Set custom payout rates & your commission % for this player.", color = Color.Gray, fontSize = 11.sp)

                    if (formError.isNotBlank()) {
                        Text(formError, color = Color.Red, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }

                    OutlinedTextField(
                        value = inputName,
                        onValueChange = { inputName = it },
                        label = { Text("Player Name") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = inputJodiRate,
                            onValueChange = { inputJodiRate = it },
                            label = { Text("Jodi Rate (X)") },
                            modifier = Modifier.weight(1f),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = inputCrossingRate,
                            onValueChange = { inputCrossingRate = it },
                            label = { Text("Crossing Rate (X)") },
                            modifier = Modifier.weight(1f),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true
                        )
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = inputHarufRate,
                            onValueChange = { inputHarufRate = it },
                            label = { Text("Haruf Rate (X)") },
                            modifier = Modifier.weight(1f),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = inputCommissionPct,
                            onValueChange = { inputCommissionPct = it },
                            label = { Text("Commission (%)") },
                            modifier = Modifier.weight(1f),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true
                        )
                    }

                    Spacer(modifier = Modifier.height(6.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = { showAddPlayerDialog = false },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF334155))
                        ) {
                            Text("Cancel", color = Color.White)
                        }
                        Button(
                            onClick = { savePlayer() },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00C853))
                        ) {
                            Text("Save Player", color = Color.White, fontWeight = FontWeight.Black)
                        }
                    }
                }
            }
        }
    }

    // MODAL 1B: EDIT PLAYER DIALOG
    if (showEditPlayerDialog && editingPlayer != null) {
        Dialog(onDismissRequest = { showEditPlayerDialog = false }) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color(0xFF1E293B))
                    .border(1.dp, Color(0xFFF3D079), RoundedCornerShape(20.dp))
                    .padding(20.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("✏️ Edit Player Details", color = Color(0xFFF3D079), fontSize = 18.sp, fontWeight = FontWeight.Black)
                    Text("Update custom rates & commission % for ${editingPlayer!!.name}:", color = Color.Gray, fontSize = 11.sp)

                    OutlinedTextField(
                        value = editName,
                        onValueChange = { editName = it },
                        label = { Text("Player Name") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = editJodiRate,
                            onValueChange = { editJodiRate = it },
                            label = { Text("Jodi Rate (X)") },
                            modifier = Modifier.weight(1f),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = editCrossingRate,
                            onValueChange = { editCrossingRate = it },
                            label = { Text("Crossing Rate (X)") },
                            modifier = Modifier.weight(1f),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true
                        )
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = editHarufRate,
                            onValueChange = { editHarufRate = it },
                            label = { Text("Haruf Rate (X)") },
                            modifier = Modifier.weight(1f),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = editCommissionPct,
                            onValueChange = { editCommissionPct = it },
                            label = { Text("Commission (%)") },
                            modifier = Modifier.weight(1f),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            singleLine = true
                        )
                    }

                    Spacer(modifier = Modifier.height(6.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = { showEditPlayerDialog = false },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF334155))
                        ) {
                            Text("Cancel", color = Color.White)
                        }
                        Button(
                            onClick = { updatePlayer() },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00C853))
                        ) {
                            Text("Update Player", color = Color.White, fontWeight = FontWeight.Black)
                        }
                    }
                }
            }
        }
    }

    // MODAL 1C: DELETE CONFIRMATION DIALOG
    if (showDeleteConfirmDialog && deletingPlayer != null) {
        Dialog(onDismissRequest = { showDeleteConfirmDialog = false }) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color(0xFF1E293B))
                    .border(1.dp, Color(0xFFEF4444), RoundedCornerShape(20.dp))
                    .padding(20.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("🗑️ Delete Player", color = Color(0xFFEF4444), fontSize = 18.sp, fontWeight = FontWeight.Black)
                    Text("Are you sure you want to delete '${deletingPlayer!!.name}'? All ledger data for this player will be removed.", color = Color.White, fontSize = 13.sp)

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Button(
                            onClick = { showDeleteConfirmDialog = false },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF334155))
                        ) {
                            Text("Cancel", color = Color.White)
                        }
                        Button(
                            onClick = { deletePlayer() },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
                        ) {
                            Text("Delete", color = Color.White, fontWeight = FontWeight.Black)
                        }
                    }
                }
            }
        }
    }

    // MODAL 2: MARKET SELECTION DIALOG (STEP A)
    if (showMarketSelectDialog && selectedPlayer != null) {
        Dialog(onDismissRequest = { showMarketSelectDialog = false }) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color(0xFF1E293B))
                    .border(1.dp, Color(0xFFF3D079), RoundedCornerShape(20.dp))
                    .padding(20.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("🎲 Select Market for ${selectedPlayer!!.name}", color = Color(0xFFF3D079), fontSize = 16.sp, fontWeight = FontWeight.Black)
                    Text("Pick the game market to open standard play board:", color = Color.Gray, fontSize = 11.sp)

                    val allGames = listOf("Shiv Parwati", "Delhi Bazar", "Dubai Market", "Shree Ganesh", "Faridabad", "Ghaziabad", "Gali", "Desawar")
                    val openGames = allGames.filter { GameScheduleManager.getGameState(it, emptyMap()) == GameScheduleManager.GameState.OPEN }

                    if (openGames.isEmpty()) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("⚠️ No markets are currently open for betting.", color = Color(0xFFF3D079), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    } else {
                        LazyColumn(
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(max = 280.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            items(openGames) { g ->
                                Box(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(Color(0xFF0F172A))
                                        .border(1.dp, Color(0xFF00C853).copy(alpha = 0.5f), RoundedCornerShape(12.dp))
                                        .clickable {
                                            showMarketSelectDialog = false
                                            onSelectPlayerForBet(g, selectedPlayer!!.id, selectedPlayer!!.name)
                                        }
                                        .padding(14.dp)
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                            Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(Color(0xFF00C853)))
                                            Text(g, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                                        }
                                        Text("PLAY ➔", color = Color(0xFFF3D079), fontSize = 12.sp, fontWeight = FontWeight.Black)
                                    }
                                }
                            }
                        }
                    }

                    Button(
                        onClick = { showMarketSelectDialog = false },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF334155))
                    ) {
                        Text("Close", color = Color.White)
                    }
                }
            }
        }
    }
}

@Composable
fun KhaiwalBetCardItem(b: PlayerBetEntry) {
    val parsedBets = remember(b.betsJson) {
        val list = mutableListOf<Pair<String, Int>>()
        try {
            val arr = JSONArray(b.betsJson)
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                val rawNum = obj.optString("number", obj.optString("num", ""))
                val amtVal = obj.optInt("amount", obj.optInt("amt", obj.optInt("bet_amount", 0)))
                val bType = obj.optString("betType", obj.optString("bet_type", obj.optString("type", "")))

                val isHaruf = b.category.equals("Haruf", ignoreCase = true) || b.category.equals("Haroof", ignoreCase = true) || bType.contains("Haruf", ignoreCase = true) || bType.contains("Haroof", ignoreCase = true) || rawNum.startsWith("A") || rawNum.startsWith("B")

                val sideTag = if (isHaruf) {
                    if (bType.contains("Ander", ignoreCase = true) || bType.contains("Andar", ignoreCase = true) || bType.contains("Inside", ignoreCase = true) || rawNum.startsWith("A")) {
                        " (Andar)"
                    } else if (bType.contains("Bahar", ignoreCase = true) || bType.contains("Outside", ignoreCase = true) || rawNum.startsWith("B")) {
                        " (Bahar)"
                    } else ""
                } else ""

                val cleanNum = rawNum.replace("A", "").replace("B", "")

                val formattedNum = (if (isHaruf) {
                    cleanNum
                } else if (cleanNum.length == 1 && (b.category.equals("Jodi", ignoreCase = true) || b.category.equals("Crossing", ignoreCase = true))) {
                    "0$cleanNum"
                } else if (cleanNum == "100" || cleanNum == "0") {
                    "00"
                } else {
                    cleanNum
                }) + sideTag

                list.add(Pair(formattedNum, amtVal))
            }
        } catch (e: Exception) {}
        list
    }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF16202E)),
        border = BorderStroke(1.dp, Color(0xFF263346))
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            // Header Bar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF263346))
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = b.gameName,
                        color = Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Color(0xFFF3D079).copy(alpha = 0.2f))
                            .padding(horizontal = 6.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = b.category.uppercase(),
                            color = Color(0xFFF3D079),
                            fontSize = 9.5.sp,
                            fontWeight = FontWeight.Black
                        )
                    }
                }

                Text(
                    text = if (b.gameResult != null) {
                        if (b.isWinner) "• WIN (₹${b.virtualPayout})" else "• LOST"
                    } else "• PENDING",
                    color = if (b.gameResult != null) {
                        if (b.isWinner) Color(0xFF22C55E) else Color(0xFFEF4444)
                    } else Color(0xFFF59E0B),
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            // Body
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(14.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Total Stake: ₹${b.totalAmount}", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Black)
                    Text("Commission: ₹${b.commission}", color = Color(0xFFF3D079), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }

                Spacer(modifier = Modifier.height(10.dp))

                // Number Badges Grid (5 per row)
                val chunked = parsedBets.chunked(5)
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    chunked.forEach { rowItems ->
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            rowItems.forEach { (numStr, amtVal) ->
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
                                            .height(34.dp)
                                            .background(Color(0xFF0F172A)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = numStr,
                                            color = Color.White,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = if (numStr.length > 5) 10.5.sp else if (numStr.length > 3) 12.sp else 14.sp,
                                            maxLines = 1
                                        )
                                    }
                                    // Bottom Box (Amount)
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(24.dp)
                                            .background(Color(0xFF1E293B)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = "₹$amtVal",
                                            color = Color(0xFFF3D079),
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
            }
        }
    }
}
