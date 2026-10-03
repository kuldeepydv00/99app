package com.example.numberbetting.presentation.games

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.numberbetting.R
import kotlinx.coroutines.delay
import org.json.JSONObject

/*
 * Home page game lobby: one picture box per game (Matka, 99x Matka, Number, Card, Colour),
 * plus the 99x Matka market page. One lobby call (/api/games/lobby, every 5 s) feeds both.
 */

/** Polls the games lobby every 5 s. Null until the first successful load. */
@Composable
fun rememberLobby(): JSONObject? {
    val context = LocalContext.current
    var lobby by remember { mutableStateOf<JSONObject?>(null) }
    LaunchedEffect(Unit) {
        while (true) {
            try {
                val d = GamesApi.get(context, "/api/games/lobby")
                ServerClock.sync(d.optLong("serverTime"))
                lobby = d
            } catch (_: Exception) { }
            delay(5000)
        }
    }
    return lobby
}

private fun matka99Markets(lobby: JSONObject?): List<JSONObject> {
    val arr = lobby?.optJSONObject("matka99")?.optJSONArray("markets") ?: return emptyList()
    val out = mutableListOf<JSONObject>()
    for (i in 0 until arr.length()) {
        val m = arr.getJSONObject(i)
        if (m.optBoolean("enabled", true)) out.add(m)
    }
    return out
}

fun matka99OpenCount(lobby: JSONObject?): Int = matka99Markets(lobby).count { it.optBoolean("isOpen") }

/** Page header for a home section: back button, title, badge, subtitle, optional right action. */
@Composable
fun SectionHeader(title: String, badge: String?, subtitle: String?, onBack: () -> Unit, right: (@Composable () -> Unit)? = null) {
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(GameColors.Surface)
                .border(1.dp, GameColors.Gold.copy(alpha = 0.4f), RoundedCornerShape(12.dp))
                .clickable { onBack() },
            contentAlignment = Alignment.Center
        ) {
            Text("←", color = GameColors.GoldLight, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(title, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold)
                if (!badge.isNullOrEmpty()) {
                    Spacer(Modifier.width(8.dp))
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(50))
                            .background(GameColors.Gold.copy(alpha = 0.12f))
                            .border(1.dp, GameColors.Gold.copy(alpha = 0.5f), RoundedCornerShape(50))
                            .padding(horizontal = 8.dp, vertical = 2.dp)
                    ) {
                        Text(badge, color = GameColors.GoldLight, fontSize = 10.sp, fontWeight = FontWeight.ExtraBold)
                    }
                }
            }
            if (!subtitle.isNullOrEmpty()) Text(subtitle, color = GameColors.Muted, fontSize = 11.sp)
        }
        if (right != null) right()
    }
}

/** 99x Matka markets as square tiles (open first, then closed). */
@Composable
fun Matka99Section(lobby: JSONObject?, onOpen: (String) -> Unit) {
    if (lobby == null) {
        Text(
            "Loading 99x Matka…", color = GameColors.Muted, fontSize = 12.sp,
            modifier = Modifier.fillMaxWidth().padding(vertical = 30.dp), textAlign = TextAlign.Center
        )
        return
    }
    val payout = lobby.optJSONObject("matka99")?.optDouble("payout", 99.0) ?: 99.0
    val markets = matka99Markets(lobby)
    val ordered = markets.filter { it.optBoolean("isOpen") } + markets.filter { !it.optBoolean("isOpen") }
    TileGrid(ordered) { m, tileModifier ->
        val key = m.optString("key")
        val isOpen = m.optBoolean("isOpen")
        val today = m.optString("todayResult", "").takeIf { it.isNotEmpty() && it != "null" }
        val rt = m.optString("resultTime", "").takeIf { it.isNotEmpty() && it != "null" } ?: m.optString("close")
        MarketTile(
            icon = "99x",
            name = m.optString("name"),
            sub = if (isOpen) "Pays ${formatPayout(payout)}x" else "Opens ${shortTime(m.optString("open"))}",
            state = if (isOpen) TileState.Open("Closes ${shortTime(m.optString("close"))}") else TileState.Closed(today, shortTime(rt)),
            onClick = { onOpen(key) },
            modifier = tileModifier,
            rose = true
        )
    }
}

private data class BoxInfo(val status: String, val badge: String, val live: Boolean, val enabled: Boolean = true)

/** Home lobby: a big picture box per game with a "Play …" label, live status and PLAY button. */
@Composable
fun GameBoxes(
    lobby: JSONObject?,
    matkaOpen: Int,
    matkaTotal: Int,
    onOpenMatka: () -> Unit,
    onOpenMatka99: () -> Unit,
    onOpenTrading: (String) -> Unit,
    onOpenJet: () -> Unit = {}
) {
    val now = rememberServerNow(1000L)

    fun tradingInfo(g: String): BoxInfo {
        if (lobby == null) return BoxInfo("Loading…", "Live", false)
        val t = lobby.optJSONObject("trading")?.optJSONObject(g) ?: return BoxInfo("Unavailable", "Paused", false, false)
        if (!t.optBoolean("enabled", true)) return BoxInfo("Paused for now", "Paused", false, false)
        val round = t.optJSONObject("round")
        val lock = round?.optLong("lock") ?: 0L
        val end = round?.optLong("end") ?: 0L
        val locked = now >= lock
        val left = if (locked) end - now else lock - now
        val pays = formatPayout(t.optDouble("payout", 0.0))
        val paysText = if (g == "dragontiger") "${pays}x · Tie ${formatPayout(t.optDouble("tiePayout", 15.0))}x" else "pays ${pays}x"
        return BoxInfo(
            (if (locked) "Result in " else "Betting closes in ") + clockText(left) + " · " + paysText,
            if (locked) "Result soon" else "Live",
            !locked
        )
    }

    val m99Total = matka99Markets(lobby).size
    val m99Open = matka99OpenCount(lobby)
    val m99Pays = formatPayout(lobby?.optJSONObject("matka99")?.optDouble("payout", 99.0) ?: 99.0)

    Row(verticalAlignment = Alignment.Bottom, modifier = Modifier.fillMaxWidth()) {
        Text("All games", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold, modifier = Modifier.weight(1f))
        Text("Tap a game to play", color = Color(0xFF6B7280), fontSize = 11.sp)
    }
    Spacer(Modifier.height(12.dp))

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        GameBox(
            image = R.drawable.banner_matka, title = "Play Matka",
            info = BoxInfo("$matkaOpen of $matkaTotal markets open · results daily", if (matkaOpen > 0) "Live" else "Closed", matkaOpen > 0),
            rose = false, onClick = onOpenMatka
        )
        GameBox(
            image = R.drawable.banner_matka99, title = "Play 99x Matka",
            info = if (lobby == null) BoxInfo("Loading…", "Live", false)
                   else BoxInfo("$m99Open of $m99Total open · lowest-bet number wins · pays ${m99Pays}x", if (m99Open > 0) "Live" else "Closed", m99Open > 0),
            rose = true, onClick = onOpenMatka99
        )
        val jet = jetLobbyStatus(lobby, now)
        GameBox(
            image = R.drawable.banner_jet, title = "Play 99x Jet",
            info = BoxInfo(jet.first, if (jet.second) "Live" else if (lobby == null) "Live" else "Paused", jet.second, jet.third),
            rose = false, onClick = onOpenJet
        )
        GameBox(image = R.drawable.banner_dragontiger, title = "Play Dragon Tiger", info = tradingInfo("dragontiger"), rose = false, onClick = { onOpenTrading("dragontiger") })
        GameBox(image = R.drawable.banner_number, title = "Play Number Trading", info = tradingInfo("number"), rose = false, onClick = { onOpenTrading("number") })
        GameBox(image = R.drawable.banner_card, title = "Play Card Trading", info = tradingInfo("card"), rose = false, onClick = { onOpenTrading("card") })
        GameBox(image = R.drawable.banner_colour, title = "Play Colour Trading", info = tradingInfo("colour"), rose = false, onClick = { onOpenTrading("colour") })
    }
}

@Composable
private fun GameBox(image: Int, title: String, info: BoxInfo, rose: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(18.dp)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .alpha(if (info.enabled) 1f else 0.5f)
            .clip(shape)
            .background(Color(0xFF0B1712))
            .border(1.dp, GameColors.Gold.copy(alpha = 0.25f), shape)
            .clickable(enabled = info.enabled) { onClick() }
    ) {
        Image(
            painter = painterResource(image),
            contentDescription = title,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxWidth().aspectRatio(30f / 17f).background(GameColors.Deep)
        )
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        title, color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold,
                        maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false)
                    )
                    Spacer(Modifier.width(8.dp))
                    val fg = if (info.live) GameColors.Emerald else Color(0xFFD1D5DB)
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(50))
                            .background(if (info.live) GameColors.Emerald.copy(alpha = 0.15f) else Color.White.copy(alpha = 0.1f))
                            .padding(horizontal = 7.dp, vertical = 2.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(Modifier.size(5.dp).clip(CircleShape).background(fg))
                        Spacer(Modifier.width(4.dp))
                        Text(info.badge.uppercase(), color = fg, fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, maxLines = 1)
                    }
                }
                Text(info.status, color = GameColors.Muted, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            Spacer(Modifier.width(10.dp))
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (rose) RoseGradient else GoldGradient)
                    .padding(horizontal = 14.dp, vertical = 9.dp)
            ) {
                Text("PLAY →", color = GameColors.Deep, fontSize = 11.sp, fontWeight = FontWeight.Black)
            }
        }
    }
}

fun formatPayout(p: Double): String = if (p == Math.floor(p)) p.toLong().toString() else p.toString()
