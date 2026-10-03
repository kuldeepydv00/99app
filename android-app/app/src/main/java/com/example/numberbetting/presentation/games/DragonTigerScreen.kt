package com.example.numberbetting.presentation.games

import androidx.compose.animation.core.Animatable
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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject

private const val DT_GAME = "dragontiger"
private val DT_BOARD = listOf("DRAGON", "TIE", "TIGER")

/**
 * Dragon Tiger: 1-minute rounds. The rule (lower total bet of Dragon and Tiger wins; a Tie comes
 * at random about 1 round in 20) comes from the server and is shown on screen and in "How it works".
 */
@Composable
fun DragonTigerScreen(
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
    var reveal by remember { mutableStateOf<JSONObject?>(null) }
    var revealWon by remember { mutableStateOf(0.0) }
    var revealStaked by remember { mutableStateOf(0.0) }
    var lastSeen by remember { mutableStateOf<String?>(null) }

    suspend fun loadBets(): List<JSONObject> {
        if (mobile.length < 10) return emptyList()
        return try {
            val d = GamesApi.get(context, "/api/games/trading/$DT_GAME/my-bets?mobile=$mobile")
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
            val d = GamesApi.get(context, "/api/games/trading/$DT_GAME/state")
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
                    val bets = loadBets()
                    val mine = bets.filter { it.optString("roundId") == id }
                    revealWon = mine.filter { it.optString("status") == "won" }.sumOf { it.optDouble("win_amount", 0.0) }
                    revealStaked = mine.sumOf { it.optDouble("amount", 0.0) }
                    reveal = newest
                }
                lastSeen = id
            }
        } catch (e: Exception) {
            loadError = e.message
        }
    }

    LaunchedEffect(Unit) {
        loadBets()
        while (true) {
            load()
            delay(2000L)
        }
    }
    LaunchedEffect(Unit) {
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
                Text(loadError ?: "Loading Dragon Tiger…", color = GameColors.Muted, fontSize = 13.sp)
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
    val payout = data.optDouble("payout", 2.0)
    val tiePayout = data.optDouble("tiePayout", 15.0)
    val tieOneIn = data.optInt("tieOneIn", 20)
    val minBet = data.optInt("minBet", 10)
    val maxBet = data.optInt("maxBet", 5000)
    val enabled = data.optBoolean("enabled", true)
    val resultsArr = data.optJSONArray("lastResults") ?: JSONArray()
    val results = (0 until resultsArr.length()).map { resultsArr.getJSONObject(it) }
    val rulesArr = data.optJSONArray("rules") ?: JSONArray()
    val rules = (0 until rulesArr.length()).map { rulesArr.getString(it) }
    val roundBets = myBets.filter { it.optString("roundId") == roundId }
    val pastBets = myBets.filter { it.optString("roundId") != roundId }.take(20)
    val myStake = roundBets.groupBy { it.optString("option") }.mapValues { e -> e.value.sumOf { it.optDouble("amount", 0.0) } }
    fun payOf(o: String) = if (o == "TIE") tiePayout else payout

    LaunchedEffect(roundId, ended) {
        if (ended) {
            delay(1200L)
            load()
        }
    }
    LaunchedEffect(reveal) {
        if (reveal != null) {
            delay(7000L)
            reveal = null
        }
    }

    val showing = reveal
    val winner = showing?.optString("result")
    val showCards = showing?.optJSONObject("cards")

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
                    Text("Dragon Tiger", color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.Black)
                    Text("Dragon / Tiger ${formatPayout(payout)}x · Tie ${formatPayout(tiePayout)}x", color = GameColors.GoldLight, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
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

                // Table
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(24.dp))
                        .background(Brush.horizontalGradient(listOf(Color(0xFF3A0A14), Color(0xFF0B1712), Color(0xFF0A1A3D))))
                        .border(1.dp, GameColors.Gold.copy(alpha = 0.3f), RoundedCornerShape(24.dp))
                        .padding(horizontal = 12.dp, vertical = 12.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        StatusPill(open = !locked)
                        Spacer(Modifier.weight(1f))
                        Text(roundId, color = Color(0xFF9CA3AF), fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                    }
                    Spacer(Modifier.height(10.dp))
                    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("DRAGON", color = Color(0xFFFF8A98), fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 3.sp)
                            Spacer(Modifier.height(8.dp))
                            DtCard(
                                code = showCards?.optString("dragon"), faceDown = showing == null,
                                glow = when (winner) { "DRAGON" -> dtColor("DRAGON"); "TIE" -> dtColor("TIE"); else -> null },
                                flipKey = showing?.optString("roundId")
                            )
                        }
                        CountdownRing(now = now, start = start, lock = lock, end = end, size = 86.dp)
                        Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                            Text("TIGER", color = Color(0xFF8DB7FF), fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 3.sp)
                            Spacer(Modifier.height(8.dp))
                            DtCard(
                                code = showCards?.optString("tiger"), faceDown = showing == null,
                                glow = when (winner) { "TIGER" -> dtColor("TIGER"); "TIE" -> dtColor("TIE"); else -> null },
                                flipKey = showing?.optString("roundId")
                            )
                        }
                    }
                    Spacer(Modifier.height(10.dp))
                    Column(modifier = Modifier.fillMaxWidth().heightIn(min = 44.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        if (showing != null) {
                            Text(
                                if (winner == "TIE") "TIE!" else "${dtName(winner ?: "").uppercase()} WINS",
                                color = dtColor(winner ?: ""), fontSize = 18.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp
                            )
                            when {
                                revealWon > 0.0 -> Text("You won ${inr(revealWon)}!", color = GameColors.Emerald, fontSize = 14.sp, fontWeight = FontWeight.Black)
                                revealStaked > 0.0 -> Text("Not this time", color = GameColors.Muted, fontSize = 11.sp)
                                else -> Text(dtResultLine(showing, tieOneIn), color = Color(0xFF6B7280), fontSize = 11.sp, textAlign = TextAlign.Center)
                            }
                            Text("Result of ${showing.optString("roundId")}", color = Color(0xFF6B7280), fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                        } else if (locked) {
                            Text("Dealing the cards… result in ${clockText(end - now)}", color = GameColors.GoldLight, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 8.dp))
                        } else {
                            Text("Place your bets · closes in ${clockText(lock - now)}", color = Color(0xFFD1D5DB), fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 8.dp))
                        }
                    }
                }

                // Rule
                Spacer(Modifier.height(12.dp))
                Row(
                    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(GameColors.Surface).border(1.dp, GameColors.Gold.copy(alpha = 0.25f), RoundedCornerShape(16.dp)).padding(horizontal = 14.dp, vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(data.optString("ruleLine"), color = Color(0xFFE5E7EB), fontSize = 12.sp, fontWeight = FontWeight.SemiBold, lineHeight = 16.sp, modifier = Modifier.weight(1f))
                    Spacer(Modifier.width(8.dp))
                    Text("ⓘ How it works", color = GameColors.GoldLight, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { showRules = true })
                }

                // Last result
                val last = results.firstOrNull()
                if (last != null) {
                    Spacer(Modifier.height(12.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(GameColors.Deep).border(1.dp, Color(0xFF1F2937), RoundedCornerShape(16.dp)).padding(horizontal = 14.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            val c = last.optJSONObject("cards")
                            Text(last.optString("roundId") + (if (c != null) " · ${c.optString("dragon")} vs ${c.optString("tiger")}" else ""), color = Color(0xFF6B7280), fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                            Text(dtResultLine(last, tieOneIn), color = GameColors.Muted, fontSize = 11.sp)
                        }
                        Spacer(Modifier.width(8.dp))
                        OptionTag(DT_GAME, last.optString("result"), large = true)
                    }
                }

                // Betting board
                Spacer(Modifier.height(16.dp))
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
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    DT_BOARD.forEach { o ->
                        val on = selected.contains(o)
                        val shape = RoundedCornerShape(18.dp)
                        Column(
                            modifier = Modifier
                                .weight(if (o == "TIE") 0.8f else 1f)
                                .height(120.dp)
                                .graphicsLayer { scaleX = if (on) 1.03f else 1f; scaleY = if (on) 1.03f else 1f; alpha = if (locked) 0.45f else if (on) 1f else 0.88f }
                                .clip(shape)
                                .background(Brush.verticalGradient(dtGradient(o)))
                                .then(if (on) Modifier.border(3.dp, Color.White, shape) else Modifier)
                                .clickable(enabled = !locked) {
                                    message = null
                                    if (selected.contains(o)) selected.remove(o) else selected.add(o)
                                },
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Text(dtName(o).uppercase(), color = Color.White, fontSize = if (o == "TIE") 16.sp else 18.sp, fontWeight = FontWeight.Black)
                            Spacer(Modifier.height(4.dp))
                            Text("${formatPayout(payOf(o))}x", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold,
                                modifier = Modifier.clip(RoundedCornerShape(50)).background(Color.Black.copy(alpha = 0.3f)).padding(horizontal = 8.dp, vertical = 2.dp))
                            val mine = myStake[o] ?: 0.0
                            if (mine > 0.0) {
                                Spacer(Modifier.height(8.dp))
                                Text("You: ${inr(mine)}", color = GameColors.Deep, fontSize = 10.sp, fontWeight = FontWeight.Black,
                                    modifier = Modifier.clip(RoundedCornerShape(50)).background(GameColors.Champagne).padding(horizontal = 8.dp, vertical = 2.dp))
                            } else if (on) {
                                Spacer(Modifier.height(8.dp))
                                Text("Picked", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold,
                                    modifier = Modifier.clip(RoundedCornerShape(50)).background(Color.Black.copy(alpha = 0.3f)).padding(horizontal = 8.dp, vertical = 2.dp))
                            }
                        }
                    }
                }

                Spacer(Modifier.height(16.dp))
                AmountPicker(amount = amount, onChange = { amount = it }, minBet = minBet, maxBet = maxBet)

                // Bead road (oldest to newest, 6 per column)
                if (results.isNotEmpty()) {
                    val shown = results.take(60)
                    Spacer(Modifier.height(16.dp))
                    Column(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(GameColors.Deep).border(1.dp, Color(0xFF1F2937), RoundedCornerShape(16.dp)).padding(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("Last ${shown.size} results", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                            listOf("DRAGON", "TIGER", "TIE").forEach { k ->
                                Bead(k, small = true)
                                Text(" ${shown.count { it.optString("result") == k }}  ", color = dtColor(k), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            shown.reversed().chunked(6).forEach { col ->
                                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    col.forEach { r -> Bead(r.optString("result")) }
                                }
                            }
                        }
                    }
                }

                if (pastBets.isNotEmpty()) {
                    Spacer(Modifier.height(16.dp))
                    Column(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(GameColors.Deep).border(1.dp, Color(0xFF1F2937), RoundedCornerShape(16.dp))) {
                        Text("Your recent bets", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(12.dp))
                        pastBets.forEach { b -> MyBetRow(DT_GAME, b, b.optString("roundId").substringAfter("-")) }
                    }
                }
                Spacer(Modifier.height(180.dp))
            }
        }

        Box(modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth()) {
            BetSlip(
                count = selected.size,
                amount = amount,
                winIfHit = amount * payout,
                winText = if (selected.isEmpty()) null else "If it wins: " + selected.joinToString(" · ") { "${dtName(it)} ${inr(amount * payOf(it))}" },
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
                val picks = DT_BOARD.filter { selected.contains(it) }
                scope.launch {
                    try {
                        val bets = JSONArray()
                        picks.forEach { o -> bets.put(JSONObject().put("option", o).put("amount", amount)) }
                        val d = GamesApi.post(context, "/api/games/trading/$DT_GAME/bet", JSONObject().put("mobile", mobile).put("bets", bets))
                        val bal = d.optJSONObject("balances")
                        if (bal != null) onBalances(bal.optDouble("balance", balance), bal.optDouble("bonus_balance", 0.0))
                        message = "Bet placed on ${picks.joinToString(" + ") { dtName(it) }} · ${inr(total.toDouble())}"
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
                title = { Text("How Dragon Tiger works", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp) },
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
    }
}

private fun dtResultLine(r: JSONObject, tieOneIn: Int): String {
    if (r.optBoolean("randomTie", false)) return "Tie, picked at random (about 1 in ${if (tieOneIn > 0) tieOneIn else 20} rounds)"
    val sides = r.optJSONObject("sides")
    val d = sides?.optDouble("DRAGON", 0.0) ?: 0.0
    val t = sides?.optDouble("TIGER", 0.0) ?: 0.0
    return if (r.optInt("tiedCount", 1) > 1) "Dragon ${inr(d)} = Tiger ${inr(t)} · equal, picked at random"
    else "Dragon ${inr(d)} · Tiger ${inr(t)} · lower bet won"
}

@Composable
private fun Bead(result: String, small: Boolean = false) {
    Box(
        modifier = Modifier.size(if (small) 16.dp else 22.dp).clip(CircleShape).background(dtColor(result)),
        contentAlignment = Alignment.Center
    ) {
        Text(
            when (result) { "DRAGON" -> "D"; "TIGER" -> "T"; else -> "=" },
            color = Color.White, fontSize = if (small) 8.sp else 10.sp, fontWeight = FontWeight.Black
        )
    }
}

/** A playing card that flips face up when a result comes in (A low, K high). */
@Composable
private fun DtCard(code: String?, faceDown: Boolean, glow: Color?, flipKey: String?) {
    val rot = remember(flipKey) { Animatable(if (faceDown) 0f else 180f) }
    LaunchedEffect(flipKey) { if (!faceDown) rot.animateTo(0f, tween(durationMillis = 800)) }
    val shape = RoundedCornerShape(12.dp)
    val showFace = !faceDown && !code.isNullOrEmpty() && rot.value <= 90f
    Box(
        modifier = Modifier
            .size(84.dp, 120.dp)
            .graphicsLayer { rotationY = rot.value; cameraDistance = 12f * density }
            .then(if (glow != null && showFace) Modifier.shadow(18.dp, shape, ambientColor = glow, spotColor = glow) else Modifier)
            .clip(shape)
            .background(
                if (showFace) Brush.linearGradient(listOf(Color(0xFFFFFDF7), Color(0xFFE9DFD0)))
                else Brush.linearGradient(
                    0f to GameColors.Surface2, 0.5f to GameColors.Surface2, 0.5f to GameColors.Surface, 1f to GameColors.Surface,
                    start = Offset(0f, 0f), end = Offset(18f, 18f), tileMode = TileMode.Repeated
                )
            )
            .border(if (glow != null && showFace) 3.dp else 2.dp, if (glow != null && showFace) glow else GameColors.Gold.copy(alpha = 0.6f), shape),
        contentAlignment = Alignment.Center
    ) {
        if (showFace && code != null) {
            val suit = cardSuit(code)
            val c = if (isRedSuit(suit)) GameColors.CardRed else GameColors.Deep
            Column(modifier = Modifier.align(Alignment.TopStart).padding(start = 7.dp, top = 5.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(cardRank(code), color = c, fontSize = 17.sp, fontWeight = FontWeight.ExtraBold, lineHeight = 17.sp)
                Text(suitSymbol(suit), color = c, fontSize = 13.sp, lineHeight = 13.sp)
            }
            Text(suitSymbol(suit), color = c, fontSize = 40.sp)
            Column(modifier = Modifier.align(Alignment.BottomEnd).padding(end = 7.dp, bottom = 5.dp).graphicsLayer { rotationZ = 180f }, horizontalAlignment = Alignment.CenterHorizontally) {
                Text(cardRank(code), color = c, fontSize = 17.sp, fontWeight = FontWeight.ExtraBold, lineHeight = 17.sp)
                Text(suitSymbol(suit), color = c, fontSize = 13.sp, lineHeight = 13.sp)
            }
        } else {
            Text("99x", color = GameColors.GoldLight, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = 2.sp,
                modifier = Modifier.clip(RoundedCornerShape(50)).background(GameColors.Deep.copy(alpha = 0.8f)).border(1.dp, GameColors.Gold.copy(alpha = 0.6f), RoundedCornerShape(50)).padding(horizontal = 8.dp, vertical = 3.dp))
        }
    }
}
