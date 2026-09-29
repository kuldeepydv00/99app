package com.example.numberbetting.presentation.games

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import org.json.JSONObject

/**
 * Home page blocks under Matka: "99x Matka" (all markets as square tiles) and
 * "Trading" (Number / Card / Colour tiles with live countdowns). One lobby call feeds both.
 */
@Composable
fun NewGamesHomeSections(onOpenMatka99: (String) -> Unit, onOpenTrading: (String) -> Unit, onOpenChart99: () -> Unit = {}) {
    val context = LocalContext.current
    var lobby by remember { mutableStateOf<JSONObject?>(null) }
    var failed by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        while (true) {
            try {
                val d = GamesApi.get(context, "/api/games/lobby")
                ServerClock.sync(d.optLong("serverTime"))
                lobby = d
                failed = false
            } catch (e: Exception) {
                failed = true
            }
            delay(5000)
        }
    }
    val now = rememberServerNow(1000L)

    val data = lobby
    if (data == null) {
        Text(
            text = if (failed) "New games are unavailable right now." else "Loading 99x Matka and Trading…",
            color = GameColors.Muted,
            fontSize = 12.sp,
            modifier = Modifier.fillMaxWidth().padding(vertical = 20.dp),
            textAlign = TextAlign.Center
        )
        return
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        Matka99HomeBlock(data.optJSONObject("matka99"), onOpenMatka99, onOpenChart99)
        Spacer(Modifier.height(30.dp))
        TradingHomeBlock(data.optJSONObject("trading"), now, onOpenTrading)
    }
}

@Composable
private fun Matka99HomeBlock(m99: JSONObject?, onOpen: (String) -> Unit, onOpenChart: () -> Unit) {
    val arr = m99?.optJSONArray("markets")
    val open = mutableListOf<JSONObject>()
    val closed = mutableListOf<JSONObject>()
    if (arr != null) {
        for (i in 0 until arr.length()) {
            val m = arr.getJSONObject(i)
            if (!m.optBoolean("enabled", true)) continue
            if (m.optBoolean("isOpen")) open.add(m) else closed.add(m)
        }
    }

    Row(verticalAlignment = Alignment.CenterVertically) {
        Text("99x Matka", color = GameColors.Ivory, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold)
        Spacer(Modifier.width(8.dp))
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(50))
                .background(GameColors.Rose.copy(alpha = 0.12f))
                .border(1.dp, GameColors.Rose.copy(alpha = 0.6f), RoundedCornerShape(50))
                .padding(horizontal = 8.dp, vertical = 2.dp)
        ) {
            Text("FIXED 99x", color = GameColors.Ivory, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold)
        }
        Spacer(Modifier.weight(1f))
        Text("Chart ›", color = GameColors.GoldLight, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { onOpenChart() })
    }
    Text("${open.size} open now · every winning Jodi pays 99x", color = GameColors.Muted, fontSize = 11.sp, modifier = Modifier.padding(top = 2.dp))
    Spacer(Modifier.height(12.dp))

    TileGrid(open + closed) { m, tileModifier ->
        val key = m.optString("key")
        val isOpen = m.optBoolean("isOpen")
        val today = m.optString("todayResult", "").takeIf { it.isNotEmpty() && it != "null" }
        val rt = m.optString("resultTime", "").takeIf { it.isNotEmpty() && it != "null" } ?: m.optString("close")
        MarketTile(
            icon = "99x",
            name = m.optString("name"),
            sub = if (isOpen) "Pays ${formatPayout(m99?.optDouble("payout", 99.0) ?: 99.0)}x" else "Opens ${shortTime(m.optString("open"))}",
            state = if (isOpen) TileState.Open("Closes ${shortTime(m.optString("close"))}") else TileState.Closed(today, shortTime(rt)),
            onClick = { onOpen(key) },
            modifier = tileModifier,
            rose = true
        )
    }
}

@Composable
private fun TradingHomeBlock(trading: JSONObject?, now: Long, onOpen: (String) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text("Trading", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold)
        Spacer(Modifier.width(8.dp))
        Box(
            modifier = Modifier.clip(RoundedCornerShape(50)).background(GameColors.Emerald.copy(alpha = 0.15f)).padding(horizontal = 8.dp, vertical = 2.dp)
        ) {
            Text("NEW", color = GameColors.Emerald, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold)
        }
    }
    Text("Quick rounds. Lowest total bet wins each round.", color = GameColors.Muted, fontSize = 11.sp, modifier = Modifier.padding(top = 2.dp))
    Spacer(Modifier.height(12.dp))

    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        listOf("number", "card", "colour").forEach { g ->
            val t = trading?.optJSONObject(g)
            val round = t?.optJSONObject("round")
            val lock = round?.optLong("lock") ?: 0L
            val end = round?.optLong("end") ?: 0L
            val locked = now >= lock
            val left = if (locked) end - now else lock - now
            val enabled = t?.optBoolean("enabled", true) ?: false
            val last = t?.optJSONObject("lastResult")?.optString("result", "") ?: ""
            val topTint = when (g) {
                "number" -> GameColors.Emerald.copy(alpha = 0.22f)
                "card" -> GameColors.Champagne.copy(alpha = 0.22f)
                else -> GameColors.Blue.copy(alpha = 0.22f)
            }
            Column(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(18.dp))
                    .background(Brush.verticalGradient(listOf(topTint, GameColors.Deep)))
                    .border(1.dp, GameColors.Gold.copy(alpha = 0.25f), RoundedCornerShape(18.dp))
                    .clickable(enabled = enabled) { onOpen(g) }
                    .padding(top = 14.dp, bottom = 12.dp, start = 6.dp, end = 6.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(modifier = Modifier.height(46.dp), contentAlignment = Alignment.Center) {
                    when (g) {
                        "number" -> Text("07", color = GameColors.Emerald, fontSize = 30.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace)
                        "card" -> Row {
                            MiniCard("A♠", false, -12f)
                            Spacer(Modifier.width(2.dp))
                            MiniCard("K♥", true, 6f)
                        }
                        else -> Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                            listOf("RED", "BLUE", "GREEN").forEach { c ->
                                Box(Modifier.size(18.dp).clip(CircleShape).background(colourOf(c)))
                            }
                        }
                    }
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    text = when (g) { "number" -> "Number"; "card" -> "Card"; else -> "Colour" },
                    color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold
                )
                Text(
                    text = when (g) { "number" -> "00–99 · hourly"; "card" -> "52 cards · hourly"; else -> "3 colours · 1 min" },
                    color = GameColors.Muted, fontSize = 9.sp
                )
                Spacer(Modifier.height(6.dp))
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(50))
                        .background(if (locked) Color.White.copy(alpha = 0.1f) else GameColors.Emerald.copy(alpha = 0.15f))
                        .padding(horizontal = 7.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = (if (locked) "Result " else "Closes ") + clockText(left),
                        color = if (locked) Color(0xFFD1D5DB) else GameColors.Emerald,
                        fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, fontFamily = FontFamily.Monospace
                    )
                }
                Spacer(Modifier.height(5.dp))
                Text("Pays ${formatPayout(t?.optDouble("payout", 0.0) ?: 0.0)}x", color = GameColors.GoldLight, fontSize = 9.sp, fontWeight = FontWeight.Bold)
                if (last.isNotEmpty() && last != "null") {
                    Spacer(Modifier.height(4.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Last ", color = Color(0xFF6B7280), fontSize = 9.sp)
                        OptionTag(g, last)
                    }
                }
            }
        }
    }
}

@Composable
private fun MiniCard(label: String, red: Boolean, angle: Float) {
    Box(
        modifier = Modifier
            .rotate(angle)
            .size(30.dp, 42.dp)
            .clip(RoundedCornerShape(5.dp))
            .background(GameColors.Ivory),
        contentAlignment = Alignment.Center
    ) {
        Text(label, color = if (red) GameColors.CardRed else GameColors.Deep, fontSize = 11.sp, fontWeight = FontWeight.Black)
    }
}

fun formatPayout(p: Double): String = if (p == Math.floor(p)) p.toLong().toString() else p.toString()
