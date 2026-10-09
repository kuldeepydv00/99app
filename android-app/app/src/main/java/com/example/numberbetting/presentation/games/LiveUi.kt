package com.example.numberbetting.presentation.games

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import kotlinx.coroutines.delay
import org.json.JSONObject
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

// Live players and the live bets feed.
// Counts are real: logged-in players with that game or market open right now (each account once).
// Below the admin's cut-off the server sends no number and the app shows a green "Live" dot instead.

private val LiveGreen = Color(0xFF1FD65F)
private val FeedMute = Color(0xFF8DA2B5)
private val FeedDim = Color(0xFF5F7487)

/** Latest counts from the server, shared by every screen. */
object LivePlayers {
    var enabled by mutableStateOf(false)
        private set
    var total by mutableStateOf<Int?>(null)
        private set
    var counts by mutableStateOf<Map<String, Int>>(emptyMap())
        private set

    fun update(json: JSONObject) {
        enabled = json.optBoolean("enabled", false)
        total = if (json.has("total") && !json.isNull("total")) json.optInt("total") else null
        val o = json.optJSONObject("counts")
        val m = mutableMapOf<String, Int>()
        if (o != null) {
            val keys = o.keys()
            while (keys.hasNext()) { val k = keys.next(); m[k] = o.optInt(k) }
        }
        counts = m
    }

    /** "24 playing", or null when the number is below the cut-off (or counts are off). */
    fun label(key: String): String? = if (enabled) counts[key]?.let { "${fmtCount(it)} playing" } else null
}

private fun fmtCount(n: Int): String = String.format(Locale("en", "IN"), "%,d", n)

/** True while the app is on screen (between onStart and onStop). */
@Composable
fun rememberAppVisible(): Boolean {
    val owner = LocalLifecycleOwner.current
    var visible by remember { mutableStateOf(owner.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) }
    DisposableEffect(owner) {
        val obs = LifecycleEventObserver { _, e ->
            if (e == Lifecycle.Event.ON_START) visible = true
            if (e == Lifecycle.Event.ON_STOP) visible = false
        }
        owner.lifecycle.addObserver(obs)
        onDispose { owner.lifecycle.removeObserver(obs) }
    }
    return visible
}

/**
 * Tells the server where this player is, every 15 s and at once when it changes.
 * where: "lobby", a game key ("dice", "jet", …), "matka:<market>" or "matka99:<key>"; null = not logged in.
 * Stops while the app is in the background, so the player drops off the count after 45 s.
 */
@Composable
fun LivePresence(where: String?) {
    val context = LocalContext.current
    val visible = rememberAppVisible()
    LaunchedEffect(where, visible) {
        if (!visible) return@LaunchedEffect
        while (true) {
            try {
                val r = if (where != null) {
                    GamesApi.post(context, "/api/games/live/ping", JSONObject().put("where", where).put("platform", "android"))
                } else {
                    GamesApi.get(context, "/api/games/live")
                }
                LivePlayers.update(r)
            } catch (_: Exception) { }
            delay(15_000L)
        }
    }
}

@Composable
private fun PulseDot(size: Int = 6) {
    val t = rememberInfiniteTransition(label = "live")
    val a by t.animateFloat(0.35f, 1f, infiniteRepeatable(tween(900), RepeatMode.Reverse), label = "liveDot")
    Box(Modifier.size(size.dp).alpha(a).clip(CircleShape).background(LiveGreen))
}

/** "● 24 playing", or "● Live" below the cut-off. Nothing when the admin switched counts off. */
@Composable
fun LiveBadge(key: String, modifier: Modifier = Modifier, fontSize: TextUnit = 11.sp, showLive: Boolean = true) {
    if (!LivePlayers.enabled) return
    val text = LivePlayers.label(key) ?: if (showLive) "Live" else return
    Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically) {
        PulseDot()
        Spacer(Modifier.width(5.dp))
        Text(text, color = LiveGreen, fontSize = fontSize, fontWeight = FontWeight.Bold, maxLines = 1)
    }
}

/** Dark pill for the top of a picture: "● 24 playing" / "● Live". */
@Composable
fun LivePill(key: String, modifier: Modifier = Modifier, showLive: Boolean = true) {
    if (!LivePlayers.enabled) return
    val text = LivePlayers.label(key) ?: if (showLive) "Live" else return
    Row(
        modifier = modifier.clip(RoundedCornerShape(6.dp)).background(Color.Black.copy(alpha = 0.62f)).padding(horizontal = 7.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        PulseDot(5)
        Spacer(Modifier.width(5.dp))
        Text(text, color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold, maxLines = 1)
    }
}

/** "● 128 online" across the whole app (hidden below the cut-off). */
@Composable
fun LiveTotal(modifier: Modifier = Modifier) {
    val n = LivePlayers.total
    if (!LivePlayers.enabled || n == null) return
    Row(
        modifier = modifier.clip(RoundedCornerShape(50)).background(LiveGreen.copy(alpha = 0.12f))
            .border(1.dp, LiveGreen.copy(alpha = 0.3f), RoundedCornerShape(50)).padding(horizontal = 9.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        PulseDot(5)
        Spacer(Modifier.width(5.dp))
        Text("${fmtCount(n)} online", color = LiveGreen, fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
}

/* ---------------- live bets feed ---------------- */

private val ICON = mapOf(
    "jet" to "✈️", "mines" to "💣", "dice" to "🎲", "dragontiger" to "🐉", "toss" to "🪙",
    "colour" to "🎨", "number" to "🔢", "card" to "🃏", "matka" to "👑", "matka99" to "💎"
)

private fun feedMoney(v: Double, dp: Int = 2): String =
    "₹" + String.format(Locale("en", "IN"), if (dp == 0) "%,.0f" else "%,.2f", v)

private fun feedTime(iso: String): String = try {
    val p = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
    val d = p.parse(iso.take(19))
    SimpleDateFormat("h:mm a", Locale.US).apply { timeZone = TimeZone.getTimeZone("Asia/Kolkata") }.format(d!!)
} catch (_: Exception) { "" }

private fun enc(s: String?): String = URLEncoder.encode(s ?: "", "UTF-8")

/**
 * Live bets under a game, a market or the home lobby: "Latest bets" and "Big wins" (last 2 days).
 * game: a game key, "matka" or "matka99" (with market), or null for every game.
 */
@Composable
fun LiveBetsSection(game: String?, market: String? = null, title: String = "Live bets", modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val visible = rememberAppVisible()
    var data by remember(game, market) { mutableStateOf<JSONObject?>(null) }
    var failed by remember(game, market) { mutableStateOf(false) }
    var tab by remember { mutableStateOf("latest") }
    var more by remember { mutableStateOf(false) }

    LaunchedEffect(game, market, visible) {
        if (!visible) return@LaunchedEffect
        while (true) {
            try {
                data = GamesApi.get(context, "/api/games/live/feed?game=${enc(game)}&market=${enc(market)}")
                failed = false
            } catch (_: Exception) { failed = true }
            delay(5_000L)
        }
    }

    val d = data
    if (d != null && !d.optBoolean("feed", true)) return
    val arr = d?.optJSONArray(if (tab == "latest") "latest" else "bigWins")
    val all = if (arr == null) emptyList() else (0 until arr.length()).map { arr.getJSONObject(it) }
    val rows = if (more) all else all.take(10)

    Column(
        modifier = modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color.White.copy(alpha = 0.035f))
            .border(1.dp, Color.White.copy(alpha = 0.07f), RoundedCornerShape(14.dp))
    ) {
        Row(modifier = Modifier.fillMaxWidth().padding(start = 12.dp, end = 8.dp, top = 10.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            PulseDot()
            Spacer(Modifier.width(7.dp))
            Text(title, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            Row(modifier = Modifier.clip(RoundedCornerShape(50)).background(Color.Black.copy(alpha = 0.3f)).padding(3.dp)) {
                listOf("latest" to "Latest", "wins" to "🏆 Big wins").forEach { (k, l) ->
                    val on = tab == k
                    Text(
                        l, color = if (on) Color.White else FeedMute, fontSize = 11.sp, fontWeight = FontWeight.Bold,
                        modifier = Modifier.clip(RoundedCornerShape(50)).background(if (on) Color.White.copy(alpha = 0.12f) else Color.Transparent)
                            .clickable { tab = k; more = false }.padding(horizontal = 10.dp, vertical = 5.dp)
                    )
                }
            }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(Color.Black.copy(alpha = 0.25f)))

        when {
            d == null -> Text(if (failed) "Could not load live bets. Retrying…" else "Loading live bets…", color = FeedMute, fontSize = 12.sp,
                textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(vertical = 22.dp))
            rows.isEmpty() -> Text(if (tab == "latest") "No bets yet. New bets show here as they are placed." else "No big wins in the last 2 days.",
                color = FeedMute, fontSize = 12.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 22.dp))
            else -> Column {
                rows.forEachIndexed { i, e -> FeedRow(e, i % 2 == 1) }
                if (all.size > 10) {
                    Text(
                        if (more) "Show less" else "Show more (${all.size - 10})", color = FeedMute, fontSize = 12.sp, fontWeight = FontWeight.Bold,
                        textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().clickable { more = !more }.padding(vertical = 11.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun FeedRow(e: JSONObject, shaded: Boolean) {
    val game = e.optString("game")
    val market = e.optString("market", "").takeIf { it.isNotEmpty() && it != "null" }
    val name = if (game == "matka" || game == "matka99") market ?: e.optString("gameLabel") else e.optString("gameLabel")
    val detail = if (game == "matka" || game == "matka99") e.optString("gameLabel") else e.optString("detail")
    val status = e.optString("status")
    val amount = e.optDouble("amount", 0.0)
    val payout = e.optDouble("payout", 0.0)
    val mult = if (e.isNull("multiplier")) null else e.optDouble("multiplier")
    Row(
        modifier = Modifier.fillMaxWidth().background(if (shaded) Color.Black.copy(alpha = 0.16f) else Color.Transparent).padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier.size(32.dp).clip(RoundedCornerShape(8.dp)).background(Color.White.copy(alpha = 0.07f)),
            contentAlignment = Alignment.Center
        ) { Text(ICON[game] ?: "🎮", fontSize = 15.sp) }
        Spacer(Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(name, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                if (detail.isNotEmpty()) {
                    Text(" · $detail", color = FeedDim, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
            Text(
                "${e.optString("player")} · ${feedMoney(amount, 0)} · ${feedTime(e.optString("at"))}",
                color = FeedMute, fontSize = 11.sp, fontFamily = FontFamily.Monospace, maxLines = 1, overflow = TextOverflow.Ellipsis
            )
        }
        Spacer(Modifier.width(8.dp))
        Column(horizontalAlignment = Alignment.End) {
            when (status) {
                "pending" -> Text("In play", color = Color(0xFFF5B544), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                "won" -> Text("+${feedMoney(payout)}", color = LiveGreen, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold)
                else -> Text("-${feedMoney(amount)}", color = FeedDim, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }
            Text(if (mult == null) "—" else String.format(Locale.US, "%.2fx", mult), color = FeedMute, fontSize = 11.sp)
        }
    }
}

/** Small "Live bets" button that opens the feed in a dialog (for screens with no room below, like Matka betting). */
@Composable
fun LiveBetsButton(game: String, market: String?, title: String) {
    var open by remember { mutableStateOf(false) }
    Row(
        modifier = Modifier.clip(RoundedCornerShape(50)).background(LiveGreen.copy(alpha = 0.12f))
            .border(1.dp, LiveGreen.copy(alpha = 0.3f), RoundedCornerShape(50)).clickable { open = true }.padding(horizontal = 9.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        PulseDot(5)
        Spacer(Modifier.width(5.dp))
        Text("Live bets", color = LiveGreen, fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
    if (open) {
        Dialog(onDismissRequest = { open = false }) {
            Column(
                modifier = Modifier.fillMaxWidth().heightIn(max = 620.dp).clip(RoundedCornerShape(16.dp)).background(Color(0xFF13202A)).padding(10.dp)
            ) {
                Column(modifier = Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    LiveBetsSection(game = game, market = market, title = title)
                }
                Text(
                    "Close", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(top = 10.dp).clip(RoundedCornerShape(10.dp)).background(Color.White.copy(alpha = 0.1f))
                        .clickable { open = false }.padding(vertical = 11.dp)
                )
            }
        }
    }
}
