package com.example.numberbetting.presentation.games

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

private fun titleOf(game: String) = when (game) {
    "number" -> "Number Trading"
    "card" -> "Card Trading"
    else -> "Colour Trading"
}

/**
 * Number / Card / Colour Trading. The rule (lowest total bet wins, ties random) is shown
 * under the timer, in the How-it-works sheet, and as a receipt after every round.
 */
@Composable
fun TradingScreen(
    game: String,
    mobile: String,
    balance: Double,
    onBack: () -> Unit,
    onBalances: (balance: Double, bonus: Double) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var st by remember { mutableStateOf<JSONObject?>(null) }
    var loadError by remember { mutableStateOf<String?>(null) }
    val selected = remember { mutableStateListOf<String>() }
    var amount by remember { mutableStateOf(10) }
    var placing by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var messageOk by remember { mutableStateOf(false) }
    var myBets by remember { mutableStateOf<List<JSONObject>>(emptyList()) }
    var showRules by remember { mutableStateOf(false) }
    var suitFilter by remember { mutableStateOf("ALL") }
    var reveal by remember { mutableStateOf<JSONObject?>(null) }
    var revealWon by remember { mutableStateOf(0.0) }
    var lastSeen by remember { mutableStateOf<String?>(null) }

    suspend fun loadBets(): List<JSONObject> {
        if (mobile.length < 10) return emptyList()
        return try {
            val d = GamesApi.get(context, "/api/games/trading/$game/my-bets?mobile=$mobile")
            val arr = d.optJSONArray("bets") ?: JSONArray()
            val list = (0 until arr.length()).map { arr.getJSONObject(it) }
            myBets = list
            list
        } catch (e: Exception) {
            emptyList()
        }
    }

    suspend fun load() {
        try {
            val d = GamesApi.get(context, "/api/games/trading/$game/state")
            ServerClock.sync(d.optLong("serverTime"))
            st = d
            loadError = null
            val minBet = d.optInt("minBet", 10)
            if (amount < minBet) amount = minBet
            val newest = d.optJSONArray("lastResults")?.optJSONObject(0)
            if (newest != null) {
                val id = newest.optString("roundId")
                val prev = lastSeen
                if (prev != null && prev != id) {
                    // A round settled while this screen was open
                    val bets = loadBets()
                    val mine = bets.filter { it.optString("roundId") == id }
                    val won = mine.filter { it.optString("status") == "won" }.sumOf { it.optDouble("win_amount", 0.0) }
                    if (game != "colour" || mine.isNotEmpty()) {
                        revealWon = won
                        reveal = newest
                    }
                }
                lastSeen = id
            }
        } catch (e: Exception) {
            loadError = e.message
        }
    }

    LaunchedEffect(game) {
        loadBets()
        while (true) {
            load()
            delay(if (game == "colour") 2000L else 5000L)
        }
    }
    LaunchedEffect(game) {
        while (true) {
            delay(15000L)
            loadBets()
        }
    }

    val now = rememberServerNow(250L)
    val data = st

    if (data == null) {
        Box(modifier = Modifier.fillMaxSize().background(GameColors.Bg), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(loadError ?: "Loading ${titleOf(game)}…", color = GameColors.Muted, fontSize = 13.sp)
                Spacer(Modifier.height(10.dp))
                Text("← Back", color = GameColors.GoldLight, fontSize = 13.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { onBack() })
            }
        }
        return
    }

    val round = data.optJSONObject("round") ?: JSONObject()
    val roundId = round.optString("roundId")
    val start = round.optLong("start")
    val lock = round.optLong("lock")
    val end = round.optLong("end")
    val locked = now >= lock
    val ended = now >= end
    val payout = data.optDouble("payout", 1.0)
    val minBet = data.optInt("minBet", 10)
    val maxBet = data.optInt("maxBet", 10000)
    val enabled = data.optBoolean("enabled", true)
    val optionsArr = data.optJSONArray("options") ?: JSONArray()
    val options = (0 until optionsArr.length()).map { optionsArr.getString(it) }
    val resultsArr = data.optJSONArray("lastResults") ?: JSONArray()
    val results = (0 until resultsArr.length()).map { resultsArr.getJSONObject(it) }
    val rulesArr = data.optJSONArray("rules") ?: JSONArray()
    val rules = (0 until rulesArr.length()).map { rulesArr.getString(it) }
    val roundBets = myBets.filter { it.optString("roundId") == roundId }
    val pastBets = myBets.filter { it.optString("roundId") != roundId }.take(20)

    // Refresh right as the round ends so the new round and its result appear straight away
    LaunchedEffect(roundId, ended) {
        if (ended) {
            delay(1200L)
            load()
        }
    }
    LaunchedEffect(reveal) {
        if (reveal != null) {
            delay(4500L)
            reveal = null
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(GameColors.Bg)) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth().background(GameColors.Deep).padding(horizontal = 8.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) {
                    Text("←", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(titleOf(game), color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.Black)
                    Text("Pays ${formatPayout(payout)}x", color = GameColors.GoldLight, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                }
                Box(
                    modifier = Modifier.clip(RoundedCornerShape(50)).background(GameColors.Surface).border(1.dp, GameColors.Gold.copy(alpha = 0.4f), RoundedCornerShape(50)).padding(horizontal = 12.dp, vertical = 5.dp)
                ) {
                    Text(inr(balance), color = GameColors.Champagne, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold)
                }
            }

            Column(modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 14.dp)) {
                if (!enabled) {
                    Text(
                        "This game is paused right now.",
                        color = GameColors.Amber, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(GameColors.Amber.copy(alpha = 0.1f)).padding(12.dp)
                    )
                    Spacer(Modifier.height(12.dp))
                }

                // Round card
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(20.dp))
                        .background(Brush.linearGradient(listOf(GameColors.Surface2.copy(alpha = 0.7f), GameColors.Deep)))
                        .border(1.dp, GameColors.Gold.copy(alpha = 0.2f), RoundedCornerShape(20.dp))
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    CountdownRing(now = now, start = start, lock = lock, end = end)
                    Spacer(Modifier.width(14.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        StatusPill(open = !locked)
                        Spacer(Modifier.height(4.dp))
                        Text(roundId, color = Color(0xFF9CA3AF), fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                        Spacer(Modifier.height(6.dp))
                        Text(data.optString("ruleLine"), color = Color(0xFFE5E7EB), fontSize = 12.sp, fontWeight = FontWeight.SemiBold, lineHeight = 16.sp)
                        Spacer(Modifier.height(6.dp))
                        Text("ⓘ How it works", color = GameColors.GoldLight, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { showRules = true })
                    }
                }

                // Receipt of the last round
                val receipt = results.firstOrNull()
                if (receipt != null) {
                    Spacer(Modifier.height(12.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(GameColors.Surface).border(1.dp, GameColors.Gold.copy(alpha = 0.25f), RoundedCornerShape(16.dp)).padding(horizontal = 14.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(receipt.optString("roundId"), color = Color(0xFF6B7280), fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                            val tied = receipt.optInt("tiedCount", 1)
                            Text(
                                "${inr(receipt.optDouble("winningTotal", 0.0))} staked on the result" + (if (tied > 1) " · $tied options tied, picked at random" else " · lowest of all"),
                                color = GameColors.Muted, fontSize = 11.sp
                            )
                        }
                        Spacer(Modifier.width(8.dp))
                        OptionTag(game, receipt.optString("result"), large = true)
                    }
                }

                Spacer(Modifier.height(16.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = when (game) { "number" -> "Tap numbers to pick them"; "card" -> "Tap cards to pick them"; else -> "Tap a colour to pick it" },
                        color = Color(0xFFD1D5DB), fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f)
                    )
                    if (selected.isNotEmpty()) {
                        Text("Clear", color = GameColors.Muted, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { selected.clear() })
                    }
                }
                Spacer(Modifier.height(10.dp))

                if (locked) {
                    Column(
                        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color.White.copy(alpha = 0.05f)).border(1.dp, Color(0xFF374151), RoundedCornerShape(14.dp)).padding(12.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("🔒 Betting closed for this round", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold)
                        Text("Result in ${clockText(end - now)} · next round opens then", color = GameColors.Muted, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                    }
                    Spacer(Modifier.height(10.dp))
                }

                val toggle: (String) -> Unit = { o ->
                    if (!locked) {
                        message = null
                        if (selected.contains(o)) selected.remove(o) else selected.add(o)
                    }
                }

                when (game) {
                    "number" -> NumberGrid(options, selected, locked, toggle)
                    "card" -> {
                        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            listOf("ALL", "S", "H", "D", "C").forEach { s ->
                                val sel = suitFilter == s
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(50))
                                        .then(if (sel) Modifier.background(GameColors.Champagne) else Modifier.background(GameColors.Surface).border(1.dp, GameColors.Border, RoundedCornerShape(50)))
                                        .clickable { suitFilter = s }
                                        .padding(horizontal = 12.dp, vertical = 5.dp)
                                ) {
                                    Text(
                                        text = if (s == "ALL") "All" else "${suitSymbol(s)} ${suitName(s)}",
                                        color = if (sel) (if (isRedSuit(s)) GameColors.CardRed else GameColors.Deep) else (if (isRedSuit(s)) GameColors.ErrorText else Color(0xFFD1D5DB)),
                                        fontSize = 12.sp, fontWeight = FontWeight.ExtraBold
                                    )
                                }
                            }
                        }
                        Spacer(Modifier.height(10.dp))
                        CardGrid(options, if (suitFilter == "ALL") listOf("S", "H", "D", "C") else listOf(suitFilter), selected, locked, toggle)
                    }
                    else -> ColourPads(options, selected, locked, toggle)
                }

                Spacer(Modifier.height(16.dp))
                AmountPicker(amount = amount, onChange = { amount = it }, minBet = minBet, maxBet = maxBet)

                if (roundBets.isNotEmpty()) {
                    Spacer(Modifier.height(16.dp))
                    Column(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(GameColors.Surface).border(1.dp, GameColors.Border, RoundedCornerShape(16.dp)).padding(12.dp)) {
                        Text("Your bets this round", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(8.dp))
                        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            roundBets.forEach { b ->
                                Row(
                                    modifier = Modifier.clip(RoundedCornerShape(50)).background(GameColors.Deep).border(1.dp, GameColors.Border, RoundedCornerShape(50)).padding(horizontal = 8.dp, vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    OptionTag(game, b.optString("option"))
                                    Spacer(Modifier.width(6.dp))
                                    Text(inr(b.optDouble("amount", 0.0)), color = Color(0xFFE5E7EB), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }
                    }
                }

                if (results.isNotEmpty()) {
                    Spacer(Modifier.height(16.dp))
                    Text("Last results", color = Color(0xFFD1D5DB), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Spacer(Modifier.height(8.dp))
                    Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        results.forEach { r ->
                            Column(
                                modifier = Modifier.clip(RoundedCornerShape(12.dp)).background(GameColors.Surface).border(1.dp, Color(0xFF1F2937), RoundedCornerShape(12.dp)).padding(horizontal = 10.dp, vertical = 8.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                if (game == "colour") Box(Modifier.size(22.dp).clip(CircleShape).background(colourOf(r.optString("result"))))
                                else OptionTag(game, r.optString("result"))
                                Spacer(Modifier.height(4.dp))
                                Text(r.optString("roundId").substringAfterLast("-"), color = Color(0xFF6B7280), fontSize = 9.sp, fontFamily = FontFamily.Monospace)
                            }
                        }
                    }
                }

                if (pastBets.isNotEmpty()) {
                    Spacer(Modifier.height(16.dp))
                    Column(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(GameColors.Deep).border(1.dp, Color(0xFF1F2937), RoundedCornerShape(16.dp))) {
                        Text("Your recent bets", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(12.dp))
                        pastBets.forEach { b -> MyBetRow(game, b, b.optString("roundId").substringAfter("-")) }
                    }
                }
                Spacer(Modifier.height(170.dp))
            }
        }

        Box(modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth()) {
            BetSlip(
                count = selected.size,
                amount = amount,
                winIfHit = amount * payout,
                message = message,
                messageOk = messageOk,
                buttonText = if (placing) "PLACING…" else if (locked) "BETTING CLOSED" else "PLACE BET",
                enabled = selected.isNotEmpty() && !placing && !locked && enabled,
                accent = GoldGradient
            ) {
                val total = selected.size * amount
                if (mobile.length < 10) { message = "Please log in to place bets."; messageOk = false; return@BetSlip }
                if (amount < minBet) { message = "Minimum bet is ${inr(minBet.toDouble())}."; messageOk = false; return@BetSlip }
                if (total > balance + 0.001) { message = "Not enough balance. You need ${inr(total.toDouble())}."; messageOk = false; return@BetSlip }
                placing = true
                message = null
                val picks = selected.toList()
                scope.launch {
                    try {
                        val bets = JSONArray()
                        picks.forEach { o -> bets.put(JSONObject().put("option", o).put("amount", amount)) }
                        val d = GamesApi.post(context, "/api/games/trading/$game/bet", JSONObject().put("mobile", mobile).put("bets", bets))
                        val bal = d.optJSONObject("balances")
                        if (bal != null) onBalances(bal.optDouble("balance", balance), bal.optDouble("bonus_balance", 0.0))
                        message = "Bet placed on ${picks.size} ${if (picks.size == 1) "pick" else "picks"} · ${inr(total.toDouble())}"
                        messageOk = true
                        selected.clear()
                        loadBets()
                    } catch (e: Exception) {
                        message = e.message ?: "Could not place bet"
                        messageOk = false
                    }
                    placing = false
                }
            }
        }

        if (showRules) {
            AlertDialog(
                onDismissRequest = { showRules = false },
                confirmButton = {
                    TextButton(onClick = { showRules = false }) {
                        Text("Got it", color = GameColors.GoldLight, fontWeight = FontWeight.Bold)
                    }
                },
                title = { Text("How ${titleOf(game)} works", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        rules.forEach { line ->
                            Row {
                                Text("•  ", color = GameColors.Gold, fontSize = 12.sp)
                                Text(line, color = Color(0xFFD1D5DB), fontSize = 12.sp, lineHeight = 17.sp)
                            }
                        }
                    }
                },
                containerColor = Color(0xFF0C1712)
            )
        }

        val r = reveal
        if (r != null) {
            ResultRevealDialog(game = game, receipt = r, won = revealWon, onDismiss = { reveal = null })
        }
    }
}

@Composable
private fun NumberGrid(options: List<String>, selected: List<String>, locked: Boolean, toggle: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        options.chunked(10).forEach { rowItems ->
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                rowItems.forEach { o ->
                    val on = selected.contains(o)
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .aspectRatio(1f)
                            .clip(RoundedCornerShape(8.dp))
                            .then(if (on) Modifier.background(GameColors.Emerald) else Modifier.background(GameColors.Surface).border(1.dp, GameColors.Border, RoundedCornerShape(8.dp)))
                            .clickable(enabled = !locked) { toggle(o) },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(o, color = if (on) GameColors.Deep else Color(0xFFE5E7EB), fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, fontFamily = FontFamily.Monospace)
                    }
                }
            }
        }
    }
}

@Composable
private fun CardGrid(options: List<String>, suits: List<String>, selected: List<String>, locked: Boolean, toggle: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        suits.forEach { s ->
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("${suitSymbol(s)} ${suitName(s)}", color = if (isRedSuit(s)) GameColors.ErrorText else Color(0xFFD1D5DB), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                options.filter { cardSuit(it) == s }.chunked(7).forEach { rowItems ->
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        rowItems.forEach { o ->
                            val on = selected.contains(o)
                            Column(
                                modifier = Modifier
                                    .weight(1f)
                                    .aspectRatio(5f / 7f)
                                    .graphicsLayer { translationY = if (on) -6f else 0f }
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(GameColors.Ivory)
                                    .then(if (on) Modifier.border(2.dp, GameColors.Champagne, RoundedCornerShape(8.dp)) else Modifier)
                                    .clickable(enabled = !locked) { toggle(o) },
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.Center
                            ) {
                                val c = if (isRedSuit(s)) GameColors.CardRed else GameColors.Deep
                                Text(cardRank(o), color = c, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold)
                                Text(suitSymbol(s), color = c, fontSize = 16.sp)
                            }
                        }
                        // keep card width equal on the short last row
                        for (i in rowItems.size until 7) Spacer(Modifier.weight(1f))
                    }
                }
            }
        }
    }
}

@Composable
private fun ColourPads(options: List<String>, selected: List<String>, locked: Boolean, toggle: (String) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        options.forEach { o ->
            val on = selected.contains(o)
            Column(
                modifier = Modifier
                    .weight(1f)
                    .height(112.dp)
                    .graphicsLayer { scaleX = if (on) 1.04f else 1f; scaleY = if (on) 1.04f else 1f; alpha = if (on) 1f else 0.85f }
                    .clip(RoundedCornerShape(18.dp))
                    .background(colourOf(o))
                    .then(if (on) Modifier.border(3.dp, Color.White, RoundedCornerShape(18.dp)) else Modifier)
                    .clickable(enabled = !locked) { toggle(o) },
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                Text(colourName(o), color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Black)
                if (on) {
                    Spacer(Modifier.height(4.dp))
                    Text("Picked", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold,
                        modifier = Modifier.clip(RoundedCornerShape(50)).background(Color.Black.copy(alpha = 0.25f)).padding(horizontal = 8.dp, vertical = 2.dp))
                }
            }
        }
    }
}

@Composable
private fun ResultRevealDialog(game: String, receipt: JSONObject, won: Double, onDismiss: () -> Unit) {
    val scale = remember { Animatable(0.4f) }
    val spin = remember { Animatable(if (game == "card") 180f else 0f) }
    LaunchedEffect(Unit) {
        launch { scale.animateTo(1f, spring(dampingRatio = 0.5f)) }
        if (game == "card") spin.animateTo(0f, tween(durationMillis = 800))
    }
    val result = receipt.optString("result")
    Dialog(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .width(280.dp)
                .clip(RoundedCornerShape(26.dp))
                .background(Brush.verticalGradient(listOf(GameColors.Surface2, GameColors.Deep)))
                .border(1.dp, GameColors.Gold.copy(alpha = 0.4f), RoundedCornerShape(26.dp))
                .clickable { onDismiss() }
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(receipt.optString("roundId"), color = Color(0xFF9CA3AF), fontSize = 11.sp, fontFamily = FontFamily.Monospace)
            Text("RESULT", color = GameColors.GoldLight, fontSize = 12.sp, fontWeight = FontWeight.Bold, letterSpacing = 3.sp)
            Spacer(Modifier.height(16.dp))
            Box(
                modifier = Modifier.graphicsLayer { scaleX = scale.value; scaleY = scale.value; rotationY = spin.value; cameraDistance = 12f * density },
                contentAlignment = Alignment.Center
            ) {
                when (game) {
                    "colour" -> Box(Modifier.size(96.dp).clip(CircleShape).background(colourOf(result)))
                    "card" -> Column(
                        modifier = Modifier.size(96.dp, 128.dp).clip(RoundedCornerShape(14.dp)).background(GameColors.Ivory),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        val c = if (isRedSuit(cardSuit(result))) GameColors.CardRed else GameColors.Deep
                        Text(cardRank(result), color = c, fontSize = 32.sp, fontWeight = FontWeight.Black)
                        Text(suitSymbol(cardSuit(result)), color = c, fontSize = 36.sp)
                    }
                    else -> Text(result, color = GameColors.Champagne, fontSize = 64.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace)
                }
            }
            Spacer(Modifier.height(16.dp))
            val tied = receipt.optInt("tiedCount", 1)
            Text(
                "${inr(receipt.optDouble("winningTotal", 0.0))} staked on it" + (if (tied > 1) " · $tied tied" else ""),
                color = GameColors.Muted, fontSize = 11.sp, textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(10.dp))
            if (won > 0.0) Text("You won ${inr(won)}!", color = GameColors.Emerald, fontSize = 18.sp, fontWeight = FontWeight.Black)
            else Text("Tap to close", color = Color(0xFF6B7280), fontSize = 11.sp)
        }
    }
}
