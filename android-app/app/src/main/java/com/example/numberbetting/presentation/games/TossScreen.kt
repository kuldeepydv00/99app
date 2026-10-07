package com.example.numberbetting.presentation.games

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
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
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.numberbetting.R
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin

private const val TOSS_GAME = "toss"
private val TOSS_SIDES = listOf("HEAD", "TAIL")
private const val FLIP_MS = 2300L
private const val SHOW_MS = 6500L

/** Angle that shows a side face up: 0 = HEAD, 180 = TAIL. */
private fun tossFace(side: String?): Float = if (side == "TAIL") 180f else 0f

/**
 * Toss: Head or Tail, 1-minute rounds. The rule (lower total bet wins; equal totals picked at random)
 * comes from the server and is shown on screen and in "How it works".
 */
@Composable
fun TossScreen(
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
    var lastSeen by remember { mutableStateOf<String?>(null) }
    // Coin: the face that is up (coinFrom), and an active toss (coinPhase "flip"/"landed" + coinEnd)
    var coinFrom by remember { mutableStateOf(0f) }
    var coinEnd by remember { mutableStateOf(0f) }
    var coinPhase by remember { mutableStateOf<String?>(null) }
    var coinKey by remember { mutableStateOf("") }
    var tossReceipt by remember { mutableStateOf<JSONObject?>(null) }
    var tossWon by remember { mutableStateOf(0.0) }
    var tossStaked by remember { mutableStateOf(0.0) }

    suspend fun loadBets(): List<JSONObject> {
        if (mobile.length < 10) return emptyList()
        return try {
            val d = GamesApi.get(context, "/api/games/trading/$TOSS_GAME/my-bets?mobile=$mobile")
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
            val d = GamesApi.get(context, "/api/games/trading/$TOSS_GAME/state")
            ServerClock.sync(d.optLong("serverTime"))
            st = d
            loadError = null
            val minBet = d.optInt("minBet", 10)
            if (amount < minBet) amount = minBet
            val newest = d.optJSONArray("lastResults")?.optJSONObject(0)
            if (newest != null) {
                val id = newest.optString("roundId")
                val prev = lastSeen
                if (prev == null) {
                    coinFrom = tossFace(newest.optString("result")); coinEnd = coinFrom
                } else if (prev != id) {
                    val bets = loadBets()
                    val mine = bets.filter { it.optString("roundId") == id }
                    tossWon = mine.filter { it.optString("status") == "won" }.sumOf { it.optDouble("win_amount", 0.0) }
                    tossStaked = mine.sumOf { it.optDouble("amount", 0.0) }
                    tossReceipt = newest
                    val target = tossFace(newest.optString("result"))
                    val from = (((if (coinPhase != null) coinEnd else coinFrom) % 360f) + 360f) % 360f
                    coinFrom = from
                    coinEnd = from + 1800f + ((target - from + 360f) % 360f)
                    coinPhase = "flip"
                    coinKey = id
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
    LaunchedEffect(coinKey) {
        if (coinKey.isNotEmpty() && coinPhase == "flip") {
            delay(FLIP_MS)
            coinPhase = "landed"
            delay(SHOW_MS)
            coinPhase = null
            coinFrom = ((coinEnd % 360f) + 360f) % 360f
            coinEnd = coinFrom
        }
    }

    val now = rememberServerNow(250L)
    val data = st

    if (data == null) {
        Box(modifier = Modifier.fillMaxSize().background(GameColors.Bg), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(loadError ?: "Loading Toss…", color = GameColors.Muted, fontSize = 13.sp)
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
    val payout = data.optDouble("payout", 1.9)
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

    LaunchedEffect(roundId, ended) {
        if (ended) {
            delay(1200L)
            load()
        }
    }

    val phase = coinPhase ?: if (locked) "tense" else "idle"
    val landed = coinPhase == "landed" && tossReceipt != null
    val winner = if (landed) tossReceipt?.optString("result") else null

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
                    Text("Toss", color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.Black)
                    Text("Head / Tail pay ${formatPayout(payout)}x", color = GameColors.GoldLight, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
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

                // Stage: the coin
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(24.dp))
                        .drawBehind {
                            drawRect(Brush.verticalGradient(listOf(Color(0xFF0E0B0A), Color(0xFF0A120F), Color(0xFF06120C))))
                            drawRect(Brush.radialGradient(listOf(Color(0x47E23B52), Color.Transparent), center = Offset(size.width * 0.05f, size.height * 0.6f), radius = size.width * 0.55f))
                            drawRect(Brush.radialGradient(listOf(Color(0x473D7BF0), Color.Transparent), center = Offset(size.width * 0.95f, size.height * 0.6f), radius = size.width * 0.55f))
                            drawRect(Brush.radialGradient(listOf(Color(0x38FFD666), Color.Transparent), center = Offset(size.width * 0.5f, size.height * 0.42f), radius = size.width * 0.45f))
                            if (winner != null) drawRect(Brush.radialGradient(listOf(tossColor(winner).copy(alpha = 0.45f), Color.Transparent), center = Offset(size.width * 0.5f, size.height * 0.4f), radius = size.width * 0.6f))
                        }
                        .border(1.dp, GameColors.Gold.copy(alpha = 0.35f), RoundedCornerShape(24.dp))
                ) {
                    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            StatusPill(open = !locked)
                            Spacer(Modifier.weight(1f))
                            Text(roundId, color = Color(0xFF9CA3AF), fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                        }
                        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(bottom = 34.dp)) {
                                Image(painterResource(R.drawable.toss_head), contentDescription = null, modifier = Modifier.size(44.dp))
                                Text("HEAD", color = Color(0xFFFF8A98), fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 2.sp)
                            }
                            Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.Center) {
                                TossCoinView(phase = phase, fromAngle = coinFrom, endAngle = coinEnd, flipKey = coinKey, coinSize = 132.dp, glow = winner?.let { tossColor(it) })
                            }
                            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(bottom = 34.dp)) {
                                Image(painterResource(R.drawable.toss_tail), contentDescription = null, modifier = Modifier.size(44.dp))
                                Text("TAIL", color = Color(0xFF8DB7FF), fontSize = 10.sp, fontWeight = FontWeight.Black, letterSpacing = 2.sp)
                            }
                        }
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth().heightIn(min = 84.dp)) {
                            CountdownRing(now = now, start = start, lock = lock, end = end, size = 80.dp)
                            Spacer(Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                val r = tossReceipt
                                if (landed && r != null) {
                                    Text(
                                        "${tossName(winner ?: "").uppercase()} WINS!",
                                        color = Color(0xFFFFF3B0), fontSize = 24.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp,
                                        style = TextStyle(shadow = Shadow(color = tossColor(winner ?: ""), offset = Offset(0f, 0f), blurRadius = 24f))
                                    )
                                    when {
                                        tossWon > 0.0 -> Text("You won ${inr(tossWon)}!", color = GameColors.Emerald, fontSize = 15.sp, fontWeight = FontWeight.Black)
                                        tossStaked > 0.0 -> Text("Not this time", color = GameColors.Muted, fontSize = 11.sp)
                                        else -> Text(tossResultLine(r), color = Color(0xFF9CA3AF), fontSize = 11.sp, maxLines = 1)
                                    }
                                    Text("Result of ${r.optString("roundId")}", color = Color(0xFF6B7280), fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                                } else if (coinPhase == "flip") {
                                    Text("Tossing…", color = Color(0xFFFFE48A), fontSize = 18.sp, fontWeight = FontWeight.Black)
                                } else if (locked) {
                                    Text("Coin in hand… toss in ${clockText(end - now)}", color = GameColors.GoldLight, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                } else {
                                    Text("Place your bets · closes in ${clockText(lock - now)}", color = Color(0xFFE5E7EB), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                }
                            }
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
                            Text(last.optString("roundId"), color = Color(0xFF6B7280), fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                            Text(tossResultLine(last), color = GameColors.Muted, fontSize = 11.sp)
                        }
                        Spacer(Modifier.width(8.dp))
                        OptionTag(TOSS_GAME, last.optString("result"), large = true)
                    }
                }

                // Bet buttons
                Spacer(Modifier.height(16.dp))
                if (locked) {
                    Column(
                        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color.White.copy(alpha = 0.05f)).border(1.dp, Color(0xFF374151), RoundedCornerShape(14.dp)).padding(12.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("🔒 Betting closed for this round", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold)
                        Text("Toss in ${clockText(end - now)} · next round opens then", color = GameColors.Muted, fontSize = 11.sp, fontFamily = FontFamily.Monospace)
                    }
                    Spacer(Modifier.height(10.dp))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    TOSS_SIDES.forEach { o ->
                        val on = selected.contains(o)
                        val shape = RoundedCornerShape(18.dp)
                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .height(150.dp)
                                .graphicsLayer { scaleX = if (on) 1.03f else 1f; scaleY = if (on) 1.03f else 1f; alpha = if (locked) 0.45f else if (on) 1f else 0.9f }
                                .clip(shape)
                                .background(Brush.verticalGradient(tossGradient(o)))
                                .then(if (on) Modifier.border(3.dp, Color(0xFFFFF3B0), shape) else Modifier.border(1.dp, Color.White.copy(alpha = 0.15f), shape))
                                .clickable(enabled = !locked) {
                                    message = null
                                    if (selected.contains(o)) selected.remove(o) else selected.add(o)
                                },
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Image(
                                painter = painterResource(if (o == "HEAD") R.drawable.toss_head else R.drawable.toss_tail),
                                contentDescription = null, contentScale = ContentScale.Fit, modifier = Modifier.size(66.dp)
                            )
                            Spacer(Modifier.height(6.dp))
                            Text(tossName(o).uppercase(), color = Color.White, fontSize = 19.sp, fontWeight = FontWeight.Black)
                            Text("${formatPayout(payout)}x", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold,
                                modifier = Modifier.clip(RoundedCornerShape(50)).background(Color.Black.copy(alpha = 0.3f)).padding(horizontal = 8.dp, vertical = 2.dp))
                            val mine = myStake[o] ?: 0.0
                            if (mine > 0.0) {
                                Spacer(Modifier.height(4.dp))
                                Text("You: ${inr(mine)}", color = GameColors.Deep, fontSize = 10.sp, fontWeight = FontWeight.Black,
                                    modifier = Modifier.clip(RoundedCornerShape(50)).background(GameColors.Champagne).padding(horizontal = 8.dp, vertical = 2.dp))
                            }
                        }
                    }
                }

                Spacer(Modifier.height(16.dp))
                AmountPicker(amount = amount, onChange = { amount = it }, minBet = minBet, maxBet = maxBet)

                // History (oldest to newest, 6 per column)
                if (results.isNotEmpty()) {
                    val shown = results.take(60)
                    Spacer(Modifier.height(16.dp))
                    Column(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(GameColors.Deep).border(1.dp, Color(0xFF1F2937), RoundedCornerShape(16.dp)).padding(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("Last ${shown.size} tosses", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                            TOSS_SIDES.forEach { k ->
                                TossBead(k, small = true)
                                Text(" ${shown.count { it.optString("result") == k }}  ", color = tossColor(k), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                        Spacer(Modifier.height(8.dp))
                        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            shown.reversed().chunked(6).forEach { col ->
                                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                    col.forEach { r -> TossBead(r.optString("result")) }
                                }
                            }
                        }
                    }
                }

                if (pastBets.isNotEmpty()) {
                    Spacer(Modifier.height(16.dp))
                    Column(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(GameColors.Deep).border(1.dp, Color(0xFF1F2937), RoundedCornerShape(16.dp))) {
                        Text("Your recent bets", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(12.dp))
                        pastBets.forEach { b -> MyBetRow(TOSS_GAME, b, b.optString("roundId").substringAfter("-")) }
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
                winText = if (selected.isEmpty()) null else "If it wins: ${inr(amount * payout)}",
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
                val picks = TOSS_SIDES.filter { selected.contains(it) }
                scope.launch {
                    try {
                        val bets = JSONArray()
                        picks.forEach { o -> bets.put(JSONObject().put("option", o).put("amount", amount)) }
                        val d = GamesApi.post(context, "/api/games/trading/$TOSS_GAME/bet", JSONObject().put("mobile", mobile).put("bets", bets))
                        val bal = d.optJSONObject("balances")
                        if (bal != null) onBalances(bal.optDouble("balance", balance), bal.optDouble("bonus_balance", 0.0))
                        message = "Bet placed on ${picks.joinToString(" + ") { tossName(it) }} · ${inr(total.toDouble())}"
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
                title = { Text("How Toss works", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp) },
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

private fun tossResultLine(r: JSONObject): String {
    val sides = r.optJSONObject("sides")
    val h = sides?.optDouble("HEAD", 0.0) ?: 0.0
    val t = sides?.optDouble("TAIL", 0.0) ?: 0.0
    return if (r.optInt("tiedCount", 1) > 1) "Head ${inr(h)} = Tail ${inr(t)} · equal, picked at random"
    else "Head ${inr(h)} · Tail ${inr(t)} · lower bet won"
}

@Composable
private fun TossBead(result: String, small: Boolean = false) {
    Box(
        modifier = Modifier.size(if (small) 16.dp else 22.dp).clip(CircleShape).background(tossColor(result)).border(1.dp, Color(0x66FFE48A), CircleShape),
        contentAlignment = Alignment.Center
    ) {
        Text(if (result == "TAIL") "T" else "H", color = Color.White, fontSize = if (small) 8.sp else 10.sp, fontWeight = FontWeight.Black)
    }
}

/**
 * The coin. idle: hovers and wobbles showing `fromAngle` · tense: shakes with a gold glow ·
 * flip: tossed up with many turns, landing on `endAngle` · landed: rests on the result and glows.
 * The visible face is swapped at each edge-on moment; a gold band shows the coin's thickness.
 */
@Composable
private fun TossCoinView(phase: String, fromAngle: Float, endAngle: Float, flipKey: String, coinSize: Dp, glow: Color?) {
    val angle = remember(flipKey) { Animatable(fromAngle) }
    val progress = remember(flipKey) { Animatable(0f) }
    val burst = remember(flipKey) { Animatable(0f) }
    LaunchedEffect(flipKey, phase, fromAngle, endAngle) {
        when (phase) {
            "flip" -> {
                launch { progress.snapTo(0f); progress.animateTo(1f, tween(FLIP_MS.toInt(), easing = LinearEasing)) }
                angle.snapTo(fromAngle)
                angle.animateTo(endAngle, tween(FLIP_MS.toInt(), easing = CubicBezierEasing(0.2f, 0.6f, 0.25f, 1f)))
            }
            "landed" -> {
                angle.snapTo(endAngle); progress.snapTo(1f)
                burst.snapTo(0f); burst.animateTo(1f, tween(900))
            }
            else -> { angle.snapTo(fromAngle); progress.snapTo(0f) }
        }
    }
    val infinite = rememberInfiniteTransition(label = "coin")
    val hover by infinite.animateFloat(0f, 1f, infiniteRepeatable(tween(1600, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "hover")
    val wobble by infinite.animateFloat(-1f, 1f, infiniteRepeatable(tween(2500, easing = FastOutSlowInEasing), RepeatMode.Reverse), label = "wobble")
    val shake by infinite.animateFloat(-1f, 1f, infiniteRepeatable(tween(160), RepeatMode.Reverse), label = "shake")
    val pulse by infinite.animateFloat(0.7f, 1f, infiniteRepeatable(tween(700), RepeatMode.Reverse), label = "pulse")

    val p = progress.value
    val arc = if (phase == "flip") {
        if (p < 0.88f) sin(PI * (p / 0.88f)).toFloat() * 0.62f else sin(PI * ((p - 0.88f) / 0.12f)).toFloat() * 0.06f
    } else 0f
    val lift = if (phase == "flip" && p < 0.88f) 1f + 0.18f * sin(PI * (p / 0.88f)).toFloat() else 1f
    val a = angle.value + (if (phase == "idle") wobble * 12f else 0f)
    val norm = ((a % 360f) + 360f) % 360f
    val showTail = norm > 90f && norm < 270f
    val faceTilt = if (showTail) norm - 180f else if (norm >= 270f) norm - 360f else norm
    val edge = abs(sin(Math.toRadians(norm.toDouble())).toFloat())
    val glowColor = glow ?: Color(0xFFFFD666)
    val showGlow = phase == "landed" || phase == "tense"

    Box(modifier = Modifier.size(coinSize * 1.25f, coinSize * 1.6f), contentAlignment = Alignment.BottomCenter) {
        Box(
            modifier = Modifier.fillMaxSize().drawBehind {
                val cx = size.width / 2
                val coinPx = coinSize.toPx()
                val cy = size.height - coinPx * 0.62f
                // shadow on the table (smaller while the coin is high)
                val sh = 1f - arc * 0.9f
                drawOval(Color.Black.copy(alpha = 0.45f * sh), topLeft = Offset(cx - coinPx * 0.38f * sh, size.height - coinPx * 0.12f), size = Size(coinPx * 0.76f * sh, coinPx * 0.1f))
                if (showGlow) {
                    val r = coinPx * 0.75f * pulse
                    drawCircle(Brush.radialGradient(listOf(glowColor.copy(alpha = if (phase == "tense") 0.35f else 0.6f), Color.Transparent), center = Offset(cx, cy), radius = r), radius = r, center = Offset(cx, cy))
                }
                if (phase == "landed" && burst.value < 1f) {
                    for (i in 0 until 12) {
                        val ang = i / 12f * 2f * PI.toFloat()
                        val d = coinPx * 0.8f * burst.value
                        drawCircle(Color(0xFFFFF3B0).copy(alpha = 1f - burst.value), radius = 3.dp.toPx(), center = Offset(cx + cos(ang) * d, cy + sin(ang) * d))
                    }
                }
            }
        )
        Box(
            modifier = Modifier
                .padding(bottom = coinSize * 0.12f)
                .size(coinSize)
                .graphicsLayer {
                    translationY = -arc * coinSize.toPx() - (if (phase == "idle") hover * 8.dp.toPx() else 0f)
                    translationX = if (phase == "tense") shake * 2.dp.toPx() else 0f
                    rotationZ = if (phase == "tense") shake * 1.5f else 0f
                    scaleX = lift; scaleY = lift
                },
            contentAlignment = Alignment.Center
        ) {
            // thickness band, visible when the coin is tilted
            Box(
                modifier = Modifier
                    .size(coinSize * 0.98f, coinSize * (0.03f + 0.09f * edge))
                    .clip(RoundedCornerShape(50))
                    .background(Brush.verticalGradient(listOf(Color(0xFFE2B048), Color(0xFF8A6212), Color(0xFF5E4008))))
            )
            Image(
                painter = painterResource(if (showTail) R.drawable.toss_tail else R.drawable.toss_head),
                contentDescription = if (showTail) "Tail" else "Head",
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxSize().graphicsLayer { rotationX = faceTilt; cameraDistance = 14f * density }
            )
        }
    }
}
