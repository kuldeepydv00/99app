package com.example.numberbetting.presentation.games

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
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
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

/** 99x Matka betting: Jodi grid (00–99) or Crossing helper, fixed 99x payout. */
@Composable
fun Matka99BettingScreen(
    marketKey: String,
    mobile: String,
    balance: Double,
    onBack: () -> Unit,
    onBalances: (balance: Double, bonus: Double) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var data by remember { mutableStateOf<JSONObject?>(null) }
    var myBets by remember { mutableStateOf<List<JSONObject>>(emptyList()) }
    var mode by remember { mutableStateOf("jodi") }
    val picked = remember { mutableStateListOf<String>() }
    var digits by remember { mutableStateOf("") }
    var withJoda by remember { mutableStateOf(true) }
    var amount by remember { mutableStateOf(10) }
    var placing by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var messageOk by remember { mutableStateOf(false) }
    var showRules by remember { mutableStateOf(false) }

    suspend fun loadBets() {
        if (mobile.length < 10) return
        try {
            val d = GamesApi.get(context, "/api/games/matka99/my-bets?mobile=$mobile")
            val arr = d.optJSONArray("bets") ?: JSONArray()
            myBets = (0 until arr.length()).map { arr.getJSONObject(it) }.filter { it.optString("market") == marketKey }
        } catch (e: Exception) { }
    }

    LaunchedEffect(Unit) {
        while (true) {
            try {
                data = GamesApi.get(context, "/api/games/matka99/markets")
            } catch (e: Exception) { }
            delay(15000)
        }
    }
    LaunchedEffect(Unit) {
        while (true) {
            loadBets()
            delay(20000)
        }
    }

    val market: JSONObject? = run {
        val arr = data?.optJSONArray("markets")
        var found: JSONObject? = null
        if (arr != null) {
            for (i in 0 until arr.length()) {
                if (arr.getJSONObject(i).optString("key") == marketKey) found = arr.getJSONObject(i)
            }
        }
        found
    }
    val isOpen = market?.optBoolean("isOpen") ?: false
    val closed = market != null && !isOpen
    val minBet = data?.optInt("minBet", 10) ?: 10
    val maxBet = data?.optInt("maxBet", 10000) ?: 10000

    val crossing: List<String> = run {
        val ds = digits.filter { it.isDigit() }.toList().distinct()
        val out = mutableListOf<String>()
        ds.forEach { a -> ds.forEach { b -> if (a != b || withJoda) out.add("$a$b") } }
        out
    }
    val numbers: List<String> = if (mode == "jodi") picked.toList() else crossing

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
                    Text(market?.optString("name") ?: "99x Matka", color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.Black)
                    Text("99x Matka · fixed 99x payout", color = GameColors.Rose, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                }
                Box(
                    modifier = Modifier.clip(RoundedCornerShape(50)).background(GameColors.Surface).border(1.dp, GameColors.Gold.copy(alpha = 0.4f), RoundedCornerShape(50)).padding(horizontal = 12.dp, vertical = 5.dp)
                ) {
                    Text(inr(balance), color = GameColors.Champagne, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold)
                }
            }

            Column(
                modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 14.dp)
            ) {
                // Hero card
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(20.dp))
                        .background(Brush.linearGradient(listOf(GameColors.Surface2.copy(alpha = 0.7f), GameColors.Deep)))
                        .border(1.dp, GameColors.Rose.copy(alpha = 0.4f), RoundedCornerShape(20.dp))
                        .padding(16.dp)
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(market?.optString("name") ?: "…", color = GameColors.Ivory, fontSize = 24.sp, fontWeight = FontWeight.Black)
                            Text(
                                if (market != null) "Open ${market.optString("open")} · Close ${market.optString("close")} · Result ${market.optString("resultTime").ifEmpty { market.optString("close") }}" else "Loading…",
                                color = GameColors.Muted, fontSize = 11.sp
                            )
                        }
                        Column(horizontalAlignment = Alignment.End) {
                            Text("99x", color = GameColors.Ivory, fontSize = 30.sp, fontWeight = FontWeight.Black)
                            Text("EVERY WIN", color = GameColors.Muted, fontSize = 8.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
                        }
                    }
                    Spacer(Modifier.height(10.dp))
                    if (market != null) StatusPill(open = isOpen)
                    // How the last automatic result was picked
                    val last = market?.optJSONObject("lastResult")
                    if (last != null && last.has("tiedCount")) {
                        val tied = last.optInt("tiedCount", 1)
                        Spacer(Modifier.height(6.dp))
                        Text(
                            "Last result ${last.optString("number")} (${last.optString("date")}): ${inr(last.optDouble("winningTotal", 0.0))} was bet on it" +
                                if (tied > 1) " · picked at random from $tied numbers tied for lowest" else " · lowest of all 100 numbers",
                            color = Color(0xFF6B7280), fontSize = 10.sp, lineHeight = 14.sp
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    Text(
                        data?.optString("ruleLine")?.ifEmpty { null } ?: "Result at the market’s result time: the number with the lowest total bet wins. Ties are picked at random.",
                        color = Color(0xFFE5E7EB), fontSize = 12.sp, fontWeight = FontWeight.SemiBold, lineHeight = 16.sp
                    )
                    Text(
                        "ⓘ How it works", color = GameColors.GoldLight, fontSize = 11.sp, fontWeight = FontWeight.Bold,
                        modifier = Modifier.padding(top = 4.dp).clickable { showRules = true }
                    )
                }

                if (closed) {
                    Spacer(Modifier.height(12.dp))
                    Text(
                        "Betting is closed for ${market?.optString("name")}. It opens again at ${market?.optString("open")}.",
                        color = Color(0xFFD1D5DB), fontSize = 12.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Color.White.copy(alpha = 0.05f)).padding(12.dp)
                    )
                }

                Spacer(Modifier.height(14.dp))
                // Jodi / Crossing toggle
                Row(
                    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(GameColors.Deep).border(1.dp, GameColors.Border, RoundedCornerShape(12.dp)).padding(4.dp)
                ) {
                    listOf("jodi" to "Jodi", "crossing" to "Crossing").forEach { (key, label) ->
                        val sel = mode == key
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(9.dp))
                                .then(if (sel) Modifier.background(RoseGradient) else Modifier)
                                .clickable { mode = key; message = null }
                                .padding(vertical = 9.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(label, color = if (sel) GameColors.Deep else GameColors.Muted, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold)
                        }
                    }
                }
                Spacer(Modifier.height(14.dp))

                if (mode == "jodi") {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        for (row in 0 until 10) {
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                for (col in 0 until 10) {
                                    val n = String.format(Locale.US, "%02d", row * 10 + col)
                                    val on = picked.contains(n)
                                    Box(
                                        modifier = Modifier
                                            .weight(1f)
                                            .aspectRatio(1f)
                                            .clip(RoundedCornerShape(8.dp))
                                            .then(
                                                if (on) Modifier.background(RoseGradient)
                                                else Modifier.background(GameColors.Surface).border(1.dp, GameColors.Border, RoundedCornerShape(8.dp))
                                            )
                                            .clickable(enabled = !closed) {
                                                message = null
                                                if (on) picked.remove(n) else picked.add(n)
                                            },
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(n, color = if (on) GameColors.Deep else Color(0xFFE5E7EB), fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, fontFamily = FontFamily.Monospace)
                                    }
                                }
                            }
                        }
                    }
                } else {
                    Box(
                        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(GameColors.Deep).border(1.dp, GameColors.Border, RoundedCornerShape(14.dp)).padding(vertical = 12.dp, horizontal = 14.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        BasicTextField(
                            value = digits,
                            onValueChange = { v -> digits = v.filter { it.isDigit() }.take(10) },
                            singleLine = true,
                            enabled = !closed,
                            textStyle = TextStyle(color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, fontFamily = FontFamily.Monospace, textAlign = TextAlign.Center, letterSpacing = 6.sp),
                            cursorBrush = SolidColor(GameColors.Rose),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier.fillMaxWidth(),
                            decorationBox = { inner ->
                                Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxWidth()) {
                                    if (digits.isEmpty()) Text("Type digits, e.g. 247", color = Color(0xFF4B5563), fontSize = 13.sp)
                                    inner()
                                }
                            }
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(GameColors.Surface).padding(start = 14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("Include doubles (Joda) like 22, 44", color = Color(0xFFD1D5DB), fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                        Checkbox(
                            checked = withJoda,
                            onCheckedChange = { withJoda = it },
                            colors = CheckboxDefaults.colors(checkedColor = GameColors.Rose, checkmarkColor = GameColors.Deep)
                        )
                    }
                    if (crossing.isNotEmpty()) {
                        Spacer(Modifier.height(10.dp))
                        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            crossing.forEach { OptionTag("number", it) }
                        }
                    }
                }

                Spacer(Modifier.height(16.dp))
                AmountPicker(amount = amount, onChange = { amount = it }, minBet = minBet, maxBet = maxBet, accent = RoseGradient)

                if (myBets.isNotEmpty()) {
                    Spacer(Modifier.height(16.dp))
                    Column(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(GameColors.Deep).border(1.dp, Color(0xFF1F2937), RoundedCornerShape(16.dp))) {
                        Text("Your ${market?.optString("name") ?: ""} bets", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(12.dp))
                        myBets.take(30).forEach { b -> MyBetRow("number", b, b.optString("dateKey")) }
                    }
                }
                Spacer(Modifier.height(170.dp))
            }
        }

        Box(modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth()) {
            BetSlip(
                count = numbers.size,
                amount = amount,
                winIfHit = amount * 99.0,
                message = message,
                messageOk = messageOk,
                buttonText = if (placing) "PLACING…" else if (closed) "BETTING CLOSED" else "PLACE BET",
                enabled = numbers.isNotEmpty() && !placing && !closed && market != null,
                accent = RoseGradient
            ) {
                val total = numbers.size * amount
                if (mobile.length < 10) { message = "Please log in to place bets."; messageOk = false; return@BetSlip }
                if (amount < minBet) { message = "Minimum bet is ${inr(minBet.toDouble())}."; messageOk = false; return@BetSlip }
                if (total > balance + 0.001) { message = "Not enough balance. You need ${inr(total.toDouble())}."; messageOk = false; return@BetSlip }
                placing = true
                message = null
                val toSend = numbers.toList()
                scope.launch {
                    try {
                        val bets = JSONArray()
                        toSend.forEach { n -> bets.put(JSONObject().put("number", n).put("amount", amount)) }
                        val body = JSONObject().put("mobile", mobile).put("market", marketKey).put("bets", bets)
                        val d = GamesApi.post(context, "/api/games/matka99/bet", body)
                        val bal = d.optJSONObject("balances")
                        if (bal != null) onBalances(bal.optDouble("balance", balance), bal.optDouble("bonus_balance", 0.0))
                        message = "Bet placed on ${toSend.size} ${if (toSend.size == 1) "number" else "numbers"} · ${inr(total.toDouble())}"
                        messageOk = true
                        picked.clear()
                        digits = ""
                        loadBets()
                    } catch (e: Exception) {
                        message = e.message ?: "Could not place bet"
                        messageOk = false
                    }
                    placing = false
                }
            }
        }
    }

    if (showRules) {
        val rulesArr = data?.optJSONArray("rules")
        AlertDialog(
            onDismissRequest = { showRules = false },
            confirmButton = {
                TextButton(onClick = { showRules = false }) {
                    Text("Got it", color = GameColors.GoldLight, fontWeight = FontWeight.Bold)
                }
            },
            title = { Text("How 99x Matka works", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (rulesArr != null) {
                        for (i in 0 until rulesArr.length()) {
                            Row {
                                Text("•  ", color = GameColors.Rose, fontSize = 12.sp)
                                Text(rulesArr.optString(i), color = Color(0xFFD1D5DB), fontSize = 12.sp, lineHeight = 17.sp)
                            }
                        }
                    }
                }
            },
            containerColor = Color(0xFF0C1712)
        )
    }
}

/** One row of the "your bets" lists on the new game screens. */
@Composable
fun MyBetRow(game: String, b: JSONObject, subtitle: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        OptionTag(game, b.optString("option"))
        Spacer(Modifier.width(8.dp))
        Text("${inr(b.optDouble("amount", 0.0))} · $subtitle", color = GameColors.Muted, fontSize = 11.sp, modifier = Modifier.weight(1f))
        when (b.optString("status")) {
            "won" -> Text("+" + inr(b.optDouble("win_amount", 0.0)), color = GameColors.Emerald, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold)
            "lost" -> Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Result ", color = Color(0xFF6B7280), fontSize = 11.sp)
                OptionTag(game, b.optString("result"))
            }
            "refunded" -> Text("Refunded", color = Color(0xFF7DD3FC), fontSize = 11.sp, fontWeight = FontWeight.Bold)
            else -> Text("Pending", color = GameColors.Amber, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        }
    }
}
