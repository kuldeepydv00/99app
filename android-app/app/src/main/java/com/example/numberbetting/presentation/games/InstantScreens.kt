package com.example.numberbetting.presentation.games

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.IconButton
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale
import kotlin.math.floor
import kotlin.math.roundToInt

/*
 * Dice and Mines (instant games, provably fair, admin-set house edge). Same API as the website:
 *   GET  /api/games/instant/{dice|mines}/state       limits + rules
 *   POST /api/games/dice/bet                          { mobile, amount, target, mode }
 *   GET  /api/games/mines/active?mobile=              the Mines game in play (to carry on)
 *   POST /api/games/mines/start | reveal | cashout    { mobile, amount, mines } | { mobile, tile } | { mobile }
 *   GET  /api/games/fairness?mobile=  POST /api/games/fairness/rotate
 */

/** Navy casino colours used by the instant games. */
object Nv {
    val Bg = Color(0xFF0F1923)
    val Side = Color(0xFF0B141C)
    val Panel = Color(0xFF1A2C38)
    val Input = Color(0xFF0F212E)
    val Edge = Color(0xFF2F4553)
    val EdgeHover = Color(0xFF557086)
    val Card2 = Color(0xFF213443)
    val Text = Color(0xFFB1BAD3)
    val Mute = Color(0xFF8DA2B5)
    val Dim = Color(0xFF5F7487)
    val Blue = Color(0xFF1D6FE8)
    val Green = Color(0xFF1FD65F)
    val GreenDark = Color(0xFF05210F)
    val Red = Color(0xFFF04A5C)
    val Gold = Color(0xFFF2C14E)
    val Gem = Color(0xFF071824)
}

private fun money(v: Double): String = "₹" + String.format(Locale("en", "IN"), "%,.2f", v)
private fun jsonList(arr: JSONArray?): List<JSONObject> = if (arr == null) emptyList() else (0 until arr.length()).map { arr.getJSONObject(it) }
private fun stringList(arr: JSONArray?): List<String> = if (arr == null) emptyList() else (0 until arr.length()).map { arr.getString(it) }

@Composable
private fun InstantHeader(title: String, sub: String, balance: Double, onBack: () -> Unit, liveKey: String? = null) {
    Row(
        modifier = Modifier.fillMaxWidth().background(Nv.Side).padding(horizontal = 8.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        IconButton(onClick = onBack) { Text("←", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold) }
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.Bold)
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (liveKey != null) { LiveBadge(liveKey, fontSize = 11.sp); Spacer(Modifier.width(8.dp)) }
                Text(sub, color = Nv.Mute, fontSize = 11.sp)
            }
        }
        Box(
            modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(Nv.Input).border(1.dp, Nv.Edge, RoundedCornerShape(8.dp))
                .padding(horizontal = 12.dp, vertical = 7.dp)
        ) { Text(money(balance), color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold) }
        Spacer(Modifier.width(6.dp))
    }
}

@Composable
private fun NvButton(text: String, bg: Color, fg: Color = Color.White, enabled: Boolean = true, sub: String? = null, onClick: () -> Unit) {
    Box(
        modifier = Modifier.fillMaxWidth().height(52.dp).clip(RoundedCornerShape(10.dp)).background(bg)
            .alpha(if (enabled) 1f else 0.5f).clickable(enabled = enabled) { onClick() },
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(text, color = fg, fontSize = 16.sp, fontWeight = FontWeight.Bold)
            if (sub != null) Text(sub, color = fg.copy(alpha = 0.85f), fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun NvLabel(text: String, right: String? = null, rightColor: Color = Nv.Mute) {
    Row(modifier = Modifier.fillMaxWidth().padding(bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(text, color = Nv.Text, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
        if (right != null) Text(right, color = rightColor, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun ReadBox(text: String, color: Color = Color.White) {
    Box(
        modifier = Modifier.fillMaxWidth().height(46.dp).clip(RoundedCornerShape(10.dp)).background(Nv.Input)
            .border(1.dp, Nv.Edge, RoundedCornerShape(10.dp)).padding(horizontal = 12.dp),
        contentAlignment = Alignment.CenterStart
    ) { Text(text, color = color, fontSize = 15.sp, fontWeight = FontWeight.Bold) }
}

@Composable
private fun NoticeLine(message: String?, ok: Boolean) {
    if (message.isNullOrEmpty()) return
    Text(
        message, color = if (ok) Nv.Green else Nv.Red, fontSize = 12.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth().padding(top = 10.dp).clip(RoundedCornerShape(8.dp))
            .background((if (ok) Nv.Green else Nv.Red).copy(alpha = 0.1f)).padding(10.dp)
    )
}

/** Editable number box: shows `value`, lets the player type, and hands the typed text back on Done / leaving the box. */
@Composable
private fun NumberBox(value: String, suffix: String, onCommit: (String) -> Unit, modifier: Modifier = Modifier, trailing: (@Composable () -> Unit)? = null) {
    val focusManager = LocalFocusManager.current
    var text by remember { mutableStateOf(value) }
    var focused by remember { mutableStateOf(false) }
    LaunchedEffect(value, focused) { if (!focused) text = value }
    Row(
        modifier = modifier.height(44.dp).clip(RoundedCornerShape(8.dp)).background(Nv.Input)
            .border(1.dp, if (focused) Nv.Blue else Nv.Edge, RoundedCornerShape(8.dp)).padding(horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        BasicTextField(
            value = text,
            onValueChange = { v -> text = v.filter { it.isDigit() || it == '.' }.take(9) },
            singleLine = true,
            textStyle = TextStyle(color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold),
            cursorBrush = SolidColor(Nv.Blue),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { onCommit(text); focusManager.clearFocus() }),
            modifier = Modifier.weight(1f).onFocusChanged { f ->
                if (focused && !f.isFocused) onCommit(text)
                focused = f.isFocused
            }
        )
        if (trailing != null) trailing() else Text(suffix, color = Nv.Mute, fontSize = 13.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun RulesDialog(title: String, rules: List<String>, onClose: () -> Unit) {
    AlertDialog(
        onDismissRequest = onClose,
        containerColor = Nv.Panel,
        title = { Text(title, color = Color.White, fontWeight = FontWeight.Bold) },
        text = {
            Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                rules.forEach { Text("•  $it", color = Nv.Text, fontSize = 13.sp, modifier = Modifier.padding(bottom = 8.dp)) }
            }
        },
        confirmButton = { TextButton(onClick = onClose) { Text("Got it", color = Nv.Blue, fontWeight = FontWeight.Bold) } }
    )
}

/** Seeds: the hashed server seed, the client seed (can be changed), and the last revealed server seed. */
@Composable
private fun FairnessDialog(mobile: String, onClose: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var fair by remember { mutableStateOf<JSONObject?>(null) }
    var client by remember { mutableStateOf("") }
    var msg by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        try {
            val d = GamesApi.get(context, "/api/games/fairness?mobile=$mobile")
            fair = d; client = d.optJSONObject("current")?.optString("clientSeed") ?: ""
        } catch (e: Exception) { msg = e.message }
    }
    AlertDialog(
        onDismissRequest = onClose,
        containerColor = Nv.Panel,
        title = { Text("Fairness", color = Color.White, fontWeight = FontWeight.Bold) },
        text = {
            Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                val cur = fair?.optJSONObject("current")
                if (cur == null) {
                    Text(msg ?: "Loading…", color = Nv.Mute, fontSize = 13.sp)
                } else {
                    Text("Active server seed (hashed)", color = Nv.Text, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Text(cur.optString("serverHash"), color = Color.White, fontSize = 11.sp, fontFamily = FontFamily.Monospace, modifier = Modifier.padding(vertical = 4.dp))
                    Spacer(Modifier.height(6.dp))
                    Text("Client seed", color = Nv.Text, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Box(Modifier.fillMaxWidth().padding(vertical = 4.dp).clip(RoundedCornerShape(8.dp)).background(Nv.Input).border(1.dp, Nv.Edge, RoundedCornerShape(8.dp)).padding(10.dp)) {
                        BasicTextField(
                            value = client,
                            onValueChange = { v -> client = v.filter { it.isLetterOrDigit() || it == '-' || it == '_' }.take(64) },
                            singleLine = true,
                            textStyle = TextStyle(color = Color.White, fontSize = 12.sp, fontFamily = FontFamily.Monospace),
                            cursorBrush = SolidColor(Nv.Blue)
                        )
                    }
                    Text("Bets with this pair: ${cur.optInt("nonce")}", color = Nv.Mute, fontSize = 12.sp)
                    Spacer(Modifier.height(8.dp))
                    NvButton("Change seeds", Nv.Edge) {
                        scope.launch {
                            try {
                                val d = GamesApi.post(context, "/api/games/fairness/rotate", JSONObject().put("mobile", mobile).put("clientSeed", client))
                                fair = d; client = d.optJSONObject("current")?.optString("clientSeed") ?: client
                                msg = "New seeds are in use. The old server seed is shown below."
                            } catch (e: Exception) { msg = e.message }
                        }
                    }
                    val prev = fair?.optJSONArray("previous")?.optJSONObject(0)
                    if (prev != null) {
                        Spacer(Modifier.height(10.dp))
                        Text("Previous server seed (revealed)", color = Nv.Text, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        Text(prev.optString("serverSeed"), color = Color.White, fontSize = 11.sp, fontFamily = FontFamily.Monospace, modifier = Modifier.padding(vertical = 4.dp))
                        Text("Client seed ${prev.optString("clientSeed")} · ${prev.optInt("nonces")} bets", color = Nv.Mute, fontSize = 11.sp)
                    }
                    if (msg != null) Text(msg!!, color = Nv.Text, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
                    Spacer(Modifier.height(8.dp))
                    stringList(fair?.optJSONArray("howItWorks")).forEach { Text("• $it", color = Nv.Mute, fontSize = 11.sp, modifier = Modifier.padding(bottom = 4.dp)) }
                }
            }
        },
        confirmButton = { TextButton(onClick = onClose) { Text("Close", color = Nv.Blue, fontWeight = FontWeight.Bold) } }
    )
}

@Composable
private fun FooterBar(name: String, onRules: () -> Unit, onFair: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().background(Nv.Panel).padding(horizontal = 8.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        TextButton(onClick = onRules) { Text("ⓘ How to play", color = Nv.Text, fontSize = 12.sp, fontWeight = FontWeight.Bold) }
        Spacer(Modifier.weight(1f))
        Text("99x $name", color = Color.White.copy(alpha = 0.8f), fontSize = 13.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.weight(1f))
        Box(
            modifier = Modifier.clip(RoundedCornerShape(8.dp)).background(Nv.Card2).clickable { onFair() }.padding(horizontal = 12.dp, vertical = 8.dp)
        ) { Text("🛡 Fairness", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold) }
    }
}

@Composable
private fun BetsList(rows: List<JSONObject>, describe: (JSONObject) -> String) {
    Column(modifier = Modifier.fillMaxWidth().padding(top = 14.dp).clip(RoundedCornerShape(10.dp)).background(Nv.Panel)) {
        Text("My bets", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(14.dp))
        if (rows.isEmpty()) {
            Text("Your bets on this game will show here.", color = Nv.Mute, fontSize = 12.sp, modifier = Modifier.fillMaxWidth().padding(bottom = 18.dp), textAlign = TextAlign.Center)
        }
        rows.forEachIndexed { i, b ->
            val status = b.optString("status")
            Row(
                modifier = Modifier.fillMaxWidth().background(if (i % 2 == 1) Nv.Input.copy(alpha = 0.5f) else Color.Transparent).padding(horizontal = 14.dp, vertical = 9.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(describe(b), color = Color.White, fontSize = 12.sp, modifier = Modifier.weight(1f))
                Text(money(b.optDouble("amount")), color = Nv.Text, fontSize = 12.sp, modifier = Modifier.padding(horizontal = 8.dp))
                Text(
                    when (status) { "won" -> "+" + money(b.optDouble("win_amount")); "pending" -> "Open"; "refunded" -> "Refunded"; else -> "-" + money(b.optDouble("amount")) },
                    color = when (status) { "won" -> Nv.Green; "pending" -> GameColors.Amber; else -> Nv.Mute },
                    fontSize = 12.sp, fontWeight = FontWeight.Bold
                )
            }
        }
    }
}

// ============================== DICE ==============================

@Composable
fun DiceScreen(mobile: String, balance: Double, onBack: () -> Unit, onBalances: (balance: Double, bonus: Double) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var cfg by remember { mutableStateOf<JSONObject?>(null) }
    var rules by remember { mutableStateOf<List<String>>(emptyList()) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var amount by remember { mutableStateOf(10) }
    var mode by remember { mutableStateOf("over") }
    var target by remember { mutableStateOf(50.5) }
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var messageOk by remember { mutableStateOf(false) }
    var lastRoll by remember { mutableStateOf<Double?>(null) }
    var lastWon by remember { mutableStateOf(false) }
    var recent by remember { mutableStateOf<List<Pair<Double, Boolean>>>(emptyList()) }
    var bets by remember { mutableStateOf<List<JSONObject>>(emptyList()) }
    var showRules by remember { mutableStateOf(false) }
    var showFair by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        try {
            val d = GamesApi.get(context, "/api/games/instant/dice/state")
            cfg = d.optJSONObject("config"); rules = stringList(d.optJSONArray("rules"))
            val minBet = cfg?.optInt("minBet", 10) ?: 10
            if (amount < minBet) amount = minBet
        } catch (e: Exception) { loadError = e.message ?: "Could not load Dice" }
        if (mobile.length >= 10) {
            try { bets = jsonList(GamesApi.get(context, "/api/games/instant/my-bets?mobile=$mobile&game=dice&limit=20").optJSONArray("bets")) } catch (_: Exception) { }
        }
    }

    Column(modifier = Modifier.fillMaxSize().background(Nv.Bg)) {
        InstantHeader("Dice", "99x Originals", balance, onBack, liveKey = "dice")
        val c = cfg
        if (c == null) {
            Text(loadError ?: "Loading Dice…", color = Nv.Mute, fontSize = 13.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = 80.dp))
            return@Column
        }
        val edge = c.optDouble("edgePct", 10.0) / 100.0
        val minC = c.optDouble("minChance", 0.01)
        val maxC = c.optDouble("maxChance", 89.09)
        val maxProfit = c.optDouble("maxProfit", 50000.0)
        val chance = ((if (mode == "over") 100.0 - target else target) * 100).roundToInt() / 100.0
        val multiplier = floor(100.0 * (1 - edge) / chance * 10000 + 1e-9) / 10000
        val profit = (amount * multiplier - amount).coerceAtLeast(0.0)
        val tooBig = profit > maxProfit

        fun setChance(ch: Double) {
            val cc = (ch.coerceIn(minC, maxC) * 100).roundToInt() / 100.0
            target = if (mode == "over") ((100.0 - cc) * 100).roundToInt() / 100.0 else cc
        }
        fun setFromTarget(t: Double) = setChance(if (mode == "over") 100.0 - t else t)

        fun bet() {
            if (busy) return
            if (mobile.length < 10) { message = "Please log in to play."; messageOk = false; return }
            if (amount > balance + 0.001) { message = "Not enough balance for ${inr(amount.toDouble())}."; messageOk = false; return }
            if (tooBig) { message = "Max profit per bet is ${inr(maxProfit)}. Lower the bet or the multiplier."; messageOk = false; return }
            busy = true; message = null
            scope.launch {
                try {
                    val d = GamesApi.post(context, "/api/games/dice/bet", JSONObject().put("mobile", mobile).put("amount", amount).put("target", target).put("mode", mode))
                    val roll = d.optDouble("roll"); val won = d.optBoolean("won")
                    lastRoll = roll; lastWon = won
                    recent = (listOf(roll to won) + recent).take(8)
                    d.optJSONObject("bet")?.let { bets = (listOf(it) + bets).take(20) }
                    d.optJSONObject("balances")?.let { onBalances(it.optDouble("balance", balance), it.optDouble("bonus_balance", 0.0)) }
                    if (won) { message = "Rolled ${String.format(Locale.US, "%.2f", roll)} · won ${inr(d.optDouble("payout"))}"; messageOk = true } else message = null
                } catch (e: Exception) { message = e.message ?: "Could not place bet"; messageOk = false }
                busy = false
            }
        }

        Column(modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(12.dp)) {
            if (!c.optBoolean("enabled", true)) {
                Text("This game is paused right now.", color = GameColors.Amber, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                    modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp).clip(RoundedCornerShape(10.dp)).background(GameColors.Amber.copy(alpha = 0.1f)).padding(12.dp))
            }
            Column(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Nv.Panel)) {
                // game area
                Column(modifier = Modifier.fillMaxWidth().background(Nv.Input).padding(12.dp)) {
                    Row(modifier = Modifier.fillMaxWidth().height(30.dp).horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.End)) {
                        recent.forEach { (r, w) ->
                            Box(Modifier.clip(RoundedCornerShape(50)).background(if (w) Nv.Green else Nv.Edge).padding(horizontal = 10.dp, vertical = 5.dp)) {
                                Text(String.format(Locale.US, "%.2f", r), color = if (w) Nv.GreenDark else Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                    Spacer(Modifier.height(44.dp))
                    // slider: red loses, green wins; marker shows the last roll
                    BoxWithConstraints(modifier = Modifier.fillMaxWidth().height(56.dp)) {
                        val w = maxWidth
                        val inset = 18.dp
                        val track = w - inset * 2
                        Canvas(modifier = Modifier.fillMaxSize()) {
                            val h = size.height
                            drawRoundRect(Nv.Edge, topLeft = Offset(0f, h * 0.18f), size = Size(size.width, h * 0.64f), cornerRadius = CornerRadius(h, h))
                            val x0 = inset.toPx(); val tw = size.width - inset.toPx() * 2
                            val y = h / 2
                            val split = x0 + tw * (target / 100.0).toFloat()
                            val redEnd = if (mode == "over") split else x0 + tw
                            val greenStart = if (mode == "over") split else x0
                            val greenEnd = if (mode == "over") x0 + tw else split
                            drawLine(Nv.Red, Offset(x0, y), Offset(if (mode == "over") redEnd else x0 + tw, y), strokeWidth = 10.dp.toPx(), cap = StrokeCap.Round)
                            drawLine(Nv.Green, Offset(greenStart, y), Offset(greenEnd, y), strokeWidth = 10.dp.toPx(), cap = StrokeCap.Round)
                        }
                        Slider(
                            value = target.toFloat(),
                            onValueChange = { setFromTarget((it * 100).roundToInt() / 100.0) },
                            valueRange = 0f..100f,
                            enabled = !busy,
                            colors = SliderDefaults.colors(
                                thumbColor = Nv.Blue, activeTrackColor = Color.Transparent, inactiveTrackColor = Color.Transparent,
                                disabledThumbColor = Nv.Blue, disabledActiveTrackColor = Color.Transparent, disabledInactiveTrackColor = Color.Transparent
                            ),
                            modifier = Modifier.fillMaxWidth().padding(horizontal = inset - 10.dp).align(Alignment.Center)
                        )
                        val roll = lastRoll
                        if (roll != null) {
                            val markerW = 62.dp
                            Box(
                                modifier = Modifier.offset(x = inset + track * (roll / 100.0).toFloat() - markerW / 2, y = (-40).dp)
                                    .size(markerW, 34.dp).clip(RoundedCornerShape(8.dp)).background(if (lastWon) Nv.Green else Nv.Red),
                                contentAlignment = Alignment.Center
                            ) { Text(String.format(Locale.US, "%.2f", roll), color = if (lastWon) Nv.GreenDark else Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold) }
                        }
                    }
                    Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp)) {
                        listOf("0", "25", "50", "75", "100").forEachIndexed { i, t ->
                            Text(t, color = Nv.Text, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f),
                                textAlign = when (i) { 0 -> TextAlign.Start; 4 -> TextAlign.End; else -> TextAlign.Center })
                        }
                    }
                    Spacer(Modifier.height(14.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Nv.Panel).padding(10.dp)) {
                        Column(Modifier.weight(1f)) {
                            Text("Multiplier", color = Nv.Text, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 4.dp))
                            NumberBox(String.format(Locale.US, "%.4f", multiplier), "×", onCommit = { s -> s.toDoubleOrNull()?.let { m -> if (m > 0) setChance(100.0 * (1 - edge) / m) } })
                        }
                        Column(Modifier.weight(1f)) {
                            Text(if (mode == "over") "Roll Over" else "Roll Under", color = Nv.Text, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 4.dp))
                            NumberBox(String.format(Locale.US, "%.2f", target), "", onCommit = { s -> s.toDoubleOrNull()?.let { setFromTarget(it) } }) {
                                Text("⇄", color = Nv.Mute, fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clickable(enabled = !busy) {
                                    mode = if (mode == "over") "under" else "over"
                                    target = ((100.0 - target) * 100).roundToInt() / 100.0
                                })
                            }
                        }
                        Column(Modifier.weight(1f)) {
                            Text("Win Chance", color = Nv.Text, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 4.dp))
                            NumberBox(String.format(Locale.US, "%.2f", chance), "%", onCommit = { s -> s.toDoubleOrNull()?.let { setChance(it) } })
                        }
                    }
                }
                // bet panel
                Column(modifier = Modifier.fillMaxWidth().padding(12.dp)) {
                    AmountPicker(
                        amount = amount, onChange = { amount = it }, minBet = c.optInt("minBet", 10), maxBet = c.optInt("maxBet", 10000),
                        accent = SolidColor(Nv.Blue), balance = balance, enabled = !busy, label = "Bet Amount",
                        fieldBg = Nv.Input, borderColor = Nv.Edge, accentText = Color.White
                    )
                    Spacer(Modifier.height(10.dp))
                    NvLabel("Profit on Win", String.format(Locale.US, "%.4f×", multiplier))
                    ReadBox(money(profit), if (tooBig) Nv.Red else Color.White)
                    if (tooBig) Text("Max profit per bet is ${inr(maxProfit)}.", color = Nv.Red, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp))
                    Spacer(Modifier.height(12.dp))
                    NvButton(if (busy) "…" else "Bet", Nv.Blue, enabled = !busy && !tooBig && c.optBoolean("enabled", true)) { bet() }
                    NoticeLine(message, messageOk)
                }
                FooterBar("Dice", { showRules = true }, { showFair = true })
            }
            BetsList(bets) { b ->
                "${b.optString("result")} · ${if (b.optString("mode") == "under") "under" else "over"} ${String.format(Locale.US, "%.2f", b.optDouble("target"))}"
            }
            Spacer(Modifier.height(16.dp))
            LiveBetsSection(game = "dice", title = "Live bets · Dice")
            Spacer(Modifier.height(24.dp))
        }
    }
    if (showRules) RulesDialog("How Dice works", rules) { showRules = false }
    if (showFair) FairnessDialog(mobile) { showFair = false }
}

// ============================== MINES ==============================

/** Green gem, drawn from a 64 x 64 design. */
@Composable
fun GemIcon(size: Dp, alpha: Float = 1f) {
    Canvas(modifier = Modifier.size(size).alpha(alpha)) {
        val k = this.size.width / 64f
        fun poly(color: Color, vararg pts: Float) {
            val p = Path()
            p.moveTo(pts[0] * k, pts[1] * k)
            var i = 2
            while (i < pts.size) { p.lineTo(pts[i] * k, pts[i + 1] * k); i += 2 }
            p.close()
            drawPath(p, color)
        }
        poly(Color(0xFF00B84E), 10f, 23f, 21f, 10f, 43f, 10f, 54f, 23f, 32f, 56f)
        poly(Color(0xFF5CF58D), 10f, 23f, 21f, 10f, 25f, 23f)
        poly(Color(0xFF9BFFB8), 21f, 10f, 43f, 10f, 39f, 23f, 25f, 23f)
        poly(Color(0xFF3EE57A), 43f, 10f, 54f, 23f, 39f, 23f)
        poly(Color(0xFF00D45A), 10f, 23f, 25f, 23f, 32f, 56f)
        poly(Color(0xFF26F06E), 25f, 23f, 39f, 23f, 32f, 56f)
        poly(Color(0xFF009E43), 39f, 23f, 54f, 23f, 32f, 56f)
    }
}

/** Red mine. */
@Composable
fun MineIcon(size: Dp, alpha: Float = 1f) {
    Canvas(modifier = Modifier.size(size).alpha(alpha)) {
        val k = this.size.width / 64f
        val c = Offset(32f * k, 32f * k)
        val spike = Color(0xFF7A0E1C)
        listOf(0f to 1f, 1f to 0f, 0.7071f to 0.7071f, 0.7071f to -0.7071f).forEach { (dx, dy) ->
            drawLine(spike, Offset(c.x - dx * 24f * k, c.y - dy * 24f * k), Offset(c.x + dx * 24f * k, c.y + dy * 24f * k), strokeWidth = 5f * k, cap = StrokeCap.Round)
        }
        drawCircle(Color(0xFFC8102E), radius = 17f * k, center = c)
        drawCircle(Color(0xFFFF8C99).copy(alpha = 0.85f), radius = 5.5f * k, center = Offset(26f * k, 26f * k))
        drawCircle(Color.White, radius = 2.2f * k, center = Offset(24.5f * k, 24.5f * k))
    }
}

@Composable
fun MinesScreen(mobile: String, balance: Double, onBack: () -> Unit, onBalances: (balance: Double, bonus: Double) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var cfg by remember { mutableStateOf<JSONObject?>(null) }
    var rules by remember { mutableStateOf<List<String>>(emptyList()) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var amount by remember { mutableStateOf(10) }
    var mines by remember { mutableStateOf(3) }
    var game by remember { mutableStateOf<JSONObject?>(null) }
    var busy by remember { mutableStateOf(false) }
    var opening by remember { mutableStateOf(-1) }
    var message by remember { mutableStateOf<String?>(null) }
    var messageOk by remember { mutableStateOf(false) }
    var win by remember { mutableStateOf<Pair<Double, Double>?>(null) }
    var bets by remember { mutableStateOf<List<JSONObject>>(emptyList()) }
    var showRules by remember { mutableStateOf(false) }
    var showFair by remember { mutableStateOf(false) }

    suspend fun loadBets() {
        if (mobile.length < 10) return
        try { bets = jsonList(GamesApi.get(context, "/api/games/instant/my-bets?mobile=$mobile&game=mines&limit=20").optJSONArray("bets")) } catch (_: Exception) { }
    }

    LaunchedEffect(Unit) {
        try {
            val d = GamesApi.get(context, "/api/games/instant/mines/state")
            cfg = d.optJSONObject("config"); rules = stringList(d.optJSONArray("rules"))
            val minBet = cfg?.optInt("minBet", 10) ?: 10
            if (amount < minBet) amount = minBet
        } catch (e: Exception) { loadError = e.message ?: "Could not load Mines" }
        if (mobile.length >= 10) {
            try {
                val a = GamesApi.get(context, "/api/games/mines/active?mobile=$mobile").optJSONObject("game")
                if (a != null) { game = a; amount = a.optInt("amount", amount); mines = a.optInt("mines", mines) }
            } catch (_: Exception) { }
        }
        loadBets()
    }

    fun picksOf(g: JSONObject?): List<Int> { val a = g?.optJSONArray("picks") ?: return emptyList(); return (0 until a.length()).map { a.getInt(it) } }
    fun minesOf(g: JSONObject?): List<Int> { val a = g?.optJSONArray("minesAt") ?: return emptyList(); return (0 until a.length()).map { a.getInt(it) } }

    Column(modifier = Modifier.fillMaxSize().background(Nv.Bg)) {
        InstantHeader("Mines", "99x Originals", balance, onBack, liveKey = "mines")
        val c = cfg
        if (c == null) {
            Text(loadError ?: "Loading Mines…", color = Nv.Mute, fontSize = 13.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = 80.dp))
            return@Column
        }
        val g = game
        val playing = g?.optString("status") == "playing"
        val over = g != null && !playing
        val picks = picksOf(g)
        val minesAt = minesOf(g)
        val hit = if (g != null && !g.isNull("hit")) g.optInt("hit", -1) else -1

        fun finish(d: JSONObject) {
            val ng = d.optJSONObject("game") ?: return
            game = ng
            d.optJSONObject("balances")?.let { onBalances(it.optDouble("balance", balance), it.optDouble("bonus_balance", 0.0)) }
            if (ng.optString("status") == "cashed") win = ng.optDouble("multiplier") to d.optDouble("payout")
            scope.launch { loadBets() }
        }

        fun start() {
            if (busy) return
            if (mobile.length < 10) { message = "Please log in to play."; messageOk = false; return }
            if (amount > balance + 0.001) { message = "Not enough balance for ${inr(amount.toDouble())}."; messageOk = false; return }
            busy = true; message = null; win = null
            scope.launch {
                try {
                    val d = GamesApi.post(context, "/api/games/mines/start", JSONObject().put("mobile", mobile).put("amount", amount).put("mines", mines))
                    game = d.optJSONObject("game")
                    d.optJSONObject("balances")?.let { onBalances(it.optDouble("balance", balance), it.optDouble("bonus_balance", 0.0)) }
                } catch (e: Exception) { message = e.message ?: "Could not start"; messageOk = false }
                busy = false
            }
        }

        fun open(tile: Int) {
            if (!playing || busy || picks.contains(tile)) return
            busy = true; opening = tile; message = null
            scope.launch {
                try {
                    val d = GamesApi.post(context, "/api/games/mines/reveal", JSONObject().put("mobile", mobile).put("tile", tile))
                    val ng = d.optJSONObject("game")
                    if (ng?.optString("status") == "playing") game = ng
                    else {
                        finish(d)
                        val auto = d.optString("auto", "")
                        if (auto.isNotEmpty() && auto != "null") { message = if (auto == "all gems found") "All gems found!" else "Max profit reached: cashed out."; messageOk = true }
                    }
                } catch (e: Exception) { message = e.message ?: "Could not open the tile"; messageOk = false }
                opening = -1; busy = false
            }
        }

        fun cashOut() {
            if (!playing || busy || picks.isEmpty()) return
            busy = true; message = null
            scope.launch {
                try { finish(GamesApi.post(context, "/api/games/mines/cashout", JSONObject().put("mobile", mobile))) }
                catch (e: Exception) { message = e.message ?: "Could not cash out"; messageOk = false }
                busy = false
            }
        }

        Column(modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(12.dp)) {
            if (!c.optBoolean("enabled", true)) {
                Text("This game is paused right now.", color = GameColors.Amber, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                    modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp).clip(RoundedCornerShape(10.dp)).background(GameColors.Amber.copy(alpha = 0.1f)).padding(12.dp))
            }
            Column(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Nv.Panel)) {
                // grid
                Column(modifier = Modifier.fillMaxWidth().background(Nv.Input).padding(12.dp)) {
                    Box {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            for (r in 0 until 5) {
                                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                    for (col in 0 until 5) {
                                        val i = r * 5 + col
                                        val picked = picks.contains(i)
                                        val isMine = minesAt.contains(i)
                                        val tileMod = Modifier.weight(1f).aspectRatio(1f)
                                        if (picked || over) {
                                            val dim = over && !picked && i != hit
                                            Box(
                                                modifier = tileMod.clip(RoundedCornerShape(8.dp))
                                                    .background(if (i == hit) Nv.Red.copy(alpha = 0.25f) else Nv.Gem)
                                                    .then(if (i == hit) Modifier.border(2.dp, Nv.Red, RoundedCornerShape(8.dp)) else Modifier),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                BoxWithConstraints(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                                    if (over && isMine) MineIcon(maxWidth * 0.62f, if (dim) 0.4f else 1f)
                                                    else GemIcon(maxWidth * 0.58f, if (dim) 0.35f else 1f)
                                                }
                                            }
                                        } else {
                                            Box(
                                                modifier = tileMod
                                                    .drawBehind { drawRoundRect(Color(0xFF1B2C38), topLeft = Offset(0f, 5.dp.toPx()), size = Size(size.width, size.height), cornerRadius = CornerRadius(8.dp.toPx())) }
                                                    .clip(RoundedCornerShape(8.dp))
                                                    .background(if (opening == i) Nv.EdgeHover else Nv.Edge)
                                                    .clickable(enabled = playing && !busy) { open(i) }
                                            )
                                        }
                                    }
                                }
                            }
                        }
                        val w = win
                        if (w != null && g?.optString("status") == "cashed") {
                            Column(
                                modifier = Modifier.align(Alignment.Center).clip(RoundedCornerShape(12.dp)).background(Nv.Panel)
                                    .border(3.dp, Nv.Green, RoundedCornerShape(12.dp)).clickable { win = null }.padding(horizontal = 28.dp, vertical = 16.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text(String.format(Locale.US, "%.2f×", w.first), color = Nv.Green, fontSize = 30.sp, fontWeight = FontWeight.Bold)
                                Text(money(w.second), color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                    Text(
                        when {
                            playing -> "Now ${String.format(Locale.US, "%.2f", g!!.optDouble("multiplier"))}×" + (if (!g.isNull("next")) "  ·  Next gem ${String.format(Locale.US, "%.2f", g.optDouble("next"))}×" else "")
                            over && g?.optString("status") == "busted" -> "Mine! Bet lost · tap Bet to play again"
                            over -> "Cashed out at ${String.format(Locale.US, "%.2f", g!!.optDouble("multiplier"))}× · tap Bet to play again"
                            else -> "Pick the mines, place a bet, then open tiles"
                        },
                        color = when { over && g?.optString("status") == "busted" -> Nv.Red; over -> Nv.Green; else -> Nv.Text },
                        fontSize = 12.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()
                    )
                }
                // bet panel
                Column(modifier = Modifier.fillMaxWidth().padding(12.dp)) {
                    AmountPicker(
                        amount = amount, onChange = { amount = it }, minBet = c.optInt("minBet", 10), maxBet = c.optInt("maxBet", 10000),
                        accent = SolidColor(Nv.Blue), balance = balance, enabled = !playing && !busy, label = "Bet Amount",
                        fieldBg = Nv.Input, borderColor = Nv.Edge, accentText = Color.White
                    )
                    Spacer(Modifier.height(10.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Column(Modifier.weight(1f)) {
                            NvLabel("Mines")
                            Row(
                                modifier = Modifier.fillMaxWidth().height(46.dp).clip(RoundedCornerShape(10.dp)).background(Nv.Input).border(1.dp, Nv.Edge, RoundedCornerShape(10.dp))
                                    .alpha(if (playing) 0.6f else 1f),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(Modifier.size(46.dp).clickable(enabled = !playing && !busy) { if (mines > 1) mines -= 1 }, contentAlignment = Alignment.Center) { Text("−", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold) }
                                Text("${if (playing) g!!.optInt("mines") else mines}", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, modifier = Modifier.weight(1f))
                                Box(Modifier.size(46.dp).clickable(enabled = !playing && !busy) { if (mines < 24) mines += 1 }, contentAlignment = Alignment.Center) { Text("+", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold) }
                            }
                        }
                        Column(Modifier.weight(1f)) {
                            NvLabel("Gems")
                            ReadBox("${25 - (if (playing) g!!.optInt("mines") else mines)}")
                        }
                    }
                    Spacer(Modifier.height(12.dp))
                    if (playing) {
                        val cash = g!!.optDouble("cashout")
                        NvButton(if (picks.isEmpty()) "Open a tile" else "Cash Out ${money(cash)}", Nv.Green, Nv.GreenDark, enabled = picks.isNotEmpty() && !busy) { cashOut() }
                        Spacer(Modifier.height(8.dp))
                        NvButton("Random Pick", Nv.Edge, enabled = !busy) {
                            val free = (0 until 25).filter { !picks.contains(it) }
                            if (free.isNotEmpty()) open(free.random())
                        }
                        Spacer(Modifier.height(10.dp))
                        val prof = cash - g.optDouble("amount")
                        NvLabel("Total Profit (${String.format(Locale.US, "%.2f", g.optDouble("multiplier"))}×)", money(prof), if (prof >= 0) Nv.Green else Nv.Red)
                    } else {
                        NvButton(if (busy) "…" else "Bet", Nv.Blue, enabled = !busy && c.optBoolean("enabled", true)) { start() }
                    }
                    NoticeLine(message, messageOk)
                }
                FooterBar("Mines", { showRules = true }, { showFair = true })
            }
            BetsList(bets) { b ->
                val n = b.optInt("mines"); val p = b.optJSONArray("picks")?.length() ?: 0
                "$n mine${if (n == 1) "" else "s"} · " + (if (b.optString("status") == "pending") "in play" else "$p gem${if (p == 1) "" else "s"}")
            }
            Spacer(Modifier.height(16.dp))
            LiveBetsSection(game = "mines", title = "Live bets · Mines")
            Spacer(Modifier.height(24.dp))
        }
    }
    if (showRules) RulesDialog("How Mines works", rules) { showRules = false }
    if (showFair) FairnessDialog(mobile) { showFair = false }
}
