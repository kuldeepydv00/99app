package com.example.numberbetting.presentation.games

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import java.text.NumberFormat
import java.util.Locale

object GameColors {
    val Bg = Color(0xFF06120C)
    val Surface = Color(0xFF0C241B)
    val Surface2 = Color(0xFF123A2C)
    val Deep = Color(0xFF0A0F0D)
    val Border = Color(0xFF1E5C46)
    val Gold = Color(0xFFC9A87C)
    val GoldLight = Color(0xFFE0C9A0)
    val Champagne = Color(0xFFF0DDB8)
    val Ivory = Color(0xFFF5EDE2)
    val Rose = Color(0xFFE0B7A0)
    val Emerald = Color(0xFF3EE08A)
    val Muted = Color(0xFF8FA89B)
    val Amber = Color(0xFFF5B544)
    val Red = Color(0xFFFF4D5E)
    val Blue = Color(0xFF3D8BFF)
    val Green = Color(0xFF2ECC8F)
    val CardRed = Color(0xFFE23B52)
    val ErrorText = Color(0xFFFF6B7E)
}

fun inr(amount: Double): String {
    val nf = NumberFormat.getNumberInstance(Locale("en", "IN"))
    nf.maximumFractionDigits = 2
    return "₹" + nf.format(amount)
}

fun clockText(ms: Long): String {
    val s = if (ms < 0) 0L else ms / 1000
    val h = s / 3600
    val m = (s % 3600) / 60
    val sec = s % 60
    return if (h > 0) String.format(Locale.US, "%d:%02d:%02d", h, m, sec)
    else String.format(Locale.US, "%02d:%02d", m, sec)
}

fun colourOf(option: String): Color = when (option) {
    "RED" -> GameColors.Red
    "BLUE" -> GameColors.Blue
    else -> GameColors.Green
}

fun colourName(option: String): String = when (option) {
    "RED" -> "Red"
    "BLUE" -> "Blue"
    "GREEN" -> "Green"
    else -> option
}

fun suitSymbol(s: String): String = when (s) { "S" -> "♠"; "H" -> "♥"; "D" -> "♦"; else -> "♣" }
fun suitName(s: String): String = when (s) { "S" -> "Spades"; "H" -> "Hearts"; "D" -> "Diamonds"; else -> "Clubs" }
fun isRedSuit(s: String): Boolean = s == "H" || s == "D"
fun cardRank(code: String): String = code.dropLast(1)
fun cardSuit(code: String): String = code.takeLast(1)

/** A clock that ticks with the server's time, for countdowns. */
@Composable
fun rememberServerNow(periodMs: Long = 500L): Long {
    var t by remember { mutableStateOf(ServerClock.now()) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(periodMs)
            t = ServerClock.now()
        }
    }
    return t
}

/** Compact rendering of any option: number box, playing card, or colour dot + name. */
@Composable
fun OptionTag(game: String, value: String?, large: Boolean = false) {
    if (value.isNullOrEmpty()) {
        Text("—", color = GameColors.Muted, fontSize = 12.sp)
        return
    }
    when (game) {
        "card" -> {
            val suit = cardSuit(value)
            Box(
                modifier = (if (large) Modifier.size(40.dp, 56.dp) else Modifier)
                    .clip(RoundedCornerShape(6.dp))
                    .background(GameColors.Ivory)
                    .padding(horizontal = if (large) 0.dp else 6.dp, vertical = if (large) 0.dp else 2.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = cardRank(value) + suitSymbol(suit),
                    color = if (isRedSuit(suit)) GameColors.CardRed else GameColors.Deep,
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = if (large) 17.sp else 12.sp
                )
            }
        }
        "colour" -> {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(if (large) 20.dp else 12.dp).clip(CircleShape).background(colourOf(value)))
                Spacer(Modifier.width(6.dp))
                Text(colourName(value), color = Color.White, fontWeight = FontWeight.Bold, fontSize = if (large) 16.sp else 12.sp)
            }
        }
        else -> {
            Box(
                modifier = (if (large) Modifier.size(44.dp) else Modifier)
                    .clip(RoundedCornerShape(6.dp))
                    .background(GameColors.Deep)
                    .border(1.dp, GameColors.Gold.copy(alpha = 0.5f), RoundedCornerShape(6.dp))
                    .padding(horizontal = if (large) 0.dp else 6.dp, vertical = if (large) 0.dp else 2.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(matkaPick(value), color = GameColors.Champagne, fontWeight = FontWeight.ExtraBold, fontFamily = FontFamily.Monospace, fontSize = if (large) 18.sp else 12.sp)
            }
        }
    }
}

/** 99x Haroof picks are stored as "A3" / "B3": show them as "Andar 3" / "Bahar 3". */
fun matkaPick(option: String?): String {
    val o = option ?: return "—"
    return if (Regex("^[AB]\\d$").matches(o)) (if (o[0] == 'A') "Andar " else "Bahar ") + o[1] else o
}

/** Ring that empties as the betting window runs out; amber in the last 10%, grey when locked. */
@Composable
fun CountdownRing(now: Long, start: Long, lock: Long, end: Long, size: Dp = 92.dp) {
    val locked = now >= lock
    val total = if (locked) end - lock else lock - start
    val left = if (locked) end - now else lock - now
    val frac = if (total > 0) (left.toFloat() / total.toFloat()).coerceIn(0f, 1f) else 0f
    val animated by animateFloatAsState(targetValue = frac, animationSpec = tween(durationMillis = 300))
    val color = when {
        locked -> GameColors.Muted
        frac < 0.1f -> GameColors.Amber
        else -> GameColors.Emerald
    }
    Box(modifier = Modifier.size(size), contentAlignment = Alignment.Center) {
        Canvas(modifier = Modifier.fillMaxSize().padding(6.dp)) {
            drawArc(color = Color.White.copy(alpha = 0.08f), startAngle = -90f, sweepAngle = 360f, useCenter = false, style = Stroke(width = 6.dp.toPx()))
            drawArc(color = color, startAngle = -90f, sweepAngle = 360f * animated, useCenter = false, style = Stroke(width = 6.dp.toPx(), cap = StrokeCap.Round))
        }
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(clockText(left), color = Color.White, fontWeight = FontWeight.ExtraBold, fontSize = 16.sp, fontFamily = FontFamily.Monospace)
            Text(if (locked) "RESULT IN" else "CLOSES IN", color = color, fontSize = 8.sp, fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
        }
    }
}

@Composable
fun StatusPill(open: Boolean) {
    val c = if (open) GameColors.Emerald else GameColors.Muted
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(c.copy(alpha = 0.12f))
            .border(1.dp, c.copy(alpha = 0.4f), RoundedCornerShape(50))
            .padding(horizontal = 10.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (open) {
            Box(Modifier.size(6.dp).clip(CircleShape).background(c))
            Spacer(Modifier.width(5.dp))
        }
        Text(if (open) "BETTING OPEN" else "LOCKED", color = c, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 1.sp)
    }
}

val GoldGradient = Brush.horizontalGradient(listOf(Color(0xFFF0DDB8), Color(0xFFE0C9A0), Color(0xFFC9A87C)))
val RoseGradient = Brush.horizontalGradient(listOf(Color(0xFFF5EDE2), Color(0xFFE8CDB8), Color(0xFFE0B7A0)))

/** Amount chips (₹10 … ₹1,000) plus a custom amount field. */
@Composable
fun AmountPicker(amount: Int, onChange: (Int) -> Unit, minBet: Int, maxBet: Int, accent: Brush = GoldGradient) {
    var custom by remember { mutableStateOf("") }
    Column {
        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            listOf(10, 50, 100, 500, 1000).filter { it in minBet..maxBet }.forEach { a ->
                val selected = amount == a && custom.isEmpty()
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(50))
                        .then(if (selected) Modifier.background(accent) else Modifier.background(GameColors.Surface).border(1.dp, GameColors.Border, RoundedCornerShape(50)))
                        .clickable { custom = ""; onChange(a) }
                        .padding(horizontal = 14.dp, vertical = 7.dp)
                ) {
                    Text(inr(a.toDouble()), color = if (selected) GameColors.Deep else Color(0xFFD1D5DB), fontSize = 12.sp, fontWeight = FontWeight.ExtraBold)
                }
            }
            Box(
                modifier = Modifier
                    .width(96.dp)
                    .clip(RoundedCornerShape(50))
                    .background(GameColors.Deep)
                    .border(1.dp, if (custom.isNotEmpty()) GameColors.Gold else GameColors.Border, RoundedCornerShape(50))
                    .padding(horizontal = 12.dp, vertical = 7.dp)
            ) {
                BasicTextField(
                    value = custom,
                    onValueChange = { v ->
                        val clean = v.filter { it.isDigit() }.take(6)
                        custom = clean
                        clean.toIntOrNull()?.let { onChange(it) }
                    },
                    singleLine = true,
                    textStyle = TextStyle(color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold),
                    cursorBrush = SolidColor(GameColors.Gold),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    decorationBox = { inner ->
                        if (custom.isEmpty()) Text("Custom ₹", color = Color(0xFF6B7280), fontSize = 12.sp)
                        inner()
                    }
                )
            }
        }
        Spacer(Modifier.height(6.dp))
        Text("${inr(minBet.toDouble())} min · ${inr(maxBet.toDouble())} max per pick", color = Color(0xFF6B7280), fontSize = 10.sp)
    }
}

/** Sticky bottom bet slip used by the 99x and trading screens. */
@Composable
fun BetSlip(
    count: Int,
    amount: Int,
    winIfHit: Double,
    message: String?,
    messageOk: Boolean,
    buttonText: String,
    enabled: Boolean,
    accent: Brush,
    onPlace: () -> Unit
) {
    Column(modifier = Modifier.fillMaxWidth().background(GameColors.Deep.copy(alpha = 0.97f))) {
      Box(Modifier.fillMaxWidth().height(1.dp).background(GameColors.Gold.copy(alpha = 0.25f)))
      Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp)) {
        if (!message.isNullOrEmpty()) {
            Text(
                text = message,
                color = if (messageOk) GameColors.Emerald else GameColors.ErrorText,
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.align(Alignment.CenterHorizontally)
            )
            Spacer(Modifier.height(6.dp))
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = if (count == 0) "Nothing picked yet" else "$count × ${inr(amount.toDouble())}",
                color = GameColors.Muted,
                fontSize = 12.sp,
                modifier = Modifier.weight(1f)
            )
            Text("Total ", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Text(inr((count * amount).toDouble()), color = GameColors.Champagne, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold)
        }
        if (count > 0) {
            Text(
                text = "If one of your picks wins: ${inr(winIfHit)}",
                color = Color(0xFF6B7280),
                fontSize = 10.sp,
                modifier = Modifier.align(Alignment.CenterHorizontally).padding(top = 2.dp)
            )
        }
        Spacer(Modifier.height(8.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(50.dp)
                .clip(RoundedCornerShape(14.dp))
                .background(accent)
                .then(if (enabled) Modifier.clickable { onPlace() } else Modifier.background(Color.Black.copy(alpha = 0.55f))),
            contentAlignment = Alignment.Center
        ) {
            Text(buttonText, color = if (enabled) GameColors.Deep else Color(0xFF3A3A3A), fontWeight = FontWeight.ExtraBold, fontSize = 15.sp, letterSpacing = 1.sp)
        }
      }
    }
}
