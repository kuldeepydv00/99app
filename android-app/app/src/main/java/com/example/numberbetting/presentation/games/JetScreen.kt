package com.example.numberbetting.presentation.games

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
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.numberbetting.data.ApiConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.Locale
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec
import kotlin.math.atan2
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

// 99x Jet: a fair crash game. The blast point of every round is fixed before betting opens
// (from a published hash chain), so players can check each round with "Fair play".

private val JetSky = listOf(Color(0xFF163A52), Color(0xFF0B2233), Color(0xFF05101A))
private val JetOrange = Color(0xFFF08A24)
private val JetRed = Color(0xFFFF6B70)

private fun jetMult(growth: Double, ms: Long): Double = if (ms <= 0) 1.0 else floor(exp(growth * ms) * 100 + 1e-9) / 100
private fun fmtX(x: Double?): String = if (x == null || x.isNaN() || x <= 0.0) "—" else String.format(Locale.US, "%.2fx", x)
private fun JSONObject.dbl(k: String): Double? = if (has(k) && !isNull(k)) optDouble(k) else null
private fun JSONObject.lng(k: String): Long = if (has(k) && !isNull(k)) optLong(k) else 0L
private fun JSONObject.str(k: String): String = if (has(k) && !isNull(k)) optString(k) else ""

// ---------- checking a round on the phone (same maths as the server) ----------
private fun sha256Hex(s: String): String =
    MessageDigest.getInstance("SHA-256").digest(s.toByteArray()).joinToString("") { "%02x".format(it) }

private fun hmacHex(key: String, msg: String): String {
    val mac = Mac.getInstance("HmacSHA256")
    mac.init(SecretKeySpec(key.toByteArray(), "HmacSHA256"))
    return mac.doFinal(msg.toByteArray()).joinToString("") { "%02x".format(it) }
}

private fun blastPointOf(seed: String, salt: String, edge: Double): Double {
    val h = hmacHex(seed, salt)
    val r = java.lang.Long.parseLong(h.substring(0, 13), 16).toDouble() / 2.0.pow(52)
    val keep = (10000 - Math.round(edge * 10000)) / 100.0
    return min(2000.0, max(1.0, floor(keep / (1 - r)) / 100))
}

private class Proof(val id: String, val hash: String, val seed: String, val point: Double?, val hashOk: Boolean, val recomputed: Double, val pointOk: Boolean?)

private fun checkProof(p: JSONObject): Proof {
    val seed = p.str("seed")
    val salt = p.str("salt")
    val edge = p.optDouble("edge", 0.04)
    val point = p.dbl("point")
    val re = blastPointOf(seed, salt, edge)
    return Proof(p.str("id"), p.str("hash"), seed, point, sha256Hex(seed) == p.str("hash"), re, if (point == null) null else re == point)
}

// ---------- live stream reader (server-sent events) ----------
private suspend fun readJetStream(onEvent: suspend (String, JSONObject) -> Unit) {
    val base = ApiConfig.getWorkingUrls().firstOrNull() ?: return
    val conn = URL("$base/api/games/jet/stream").openConnection() as HttpURLConnection
    conn.connectTimeout = 6000
    conn.readTimeout = 40000 // the server sends a ping every 15 s
    conn.setRequestProperty("Accept", "text/event-stream")
    conn.setRequestProperty("Bypass-Tunnel-Reminder", "true")
    conn.setRequestProperty("User-Agent", "Mozilla/5.0")
    try {
        conn.inputStream.bufferedReader().use { reader ->
            var event = "message"
            val data = StringBuilder()
            while (kotlin.coroutines.coroutineContext.isActive) {
                val line = reader.readLine() ?: break
                when {
                    line.isEmpty() -> {
                        if (data.isNotEmpty()) {
                            val json = try { JSONObject(data.toString()) } catch (e: Exception) { null }
                            if (json != null) onEvent(event, json)
                        }
                        data.setLength(0)
                        event = "message"
                    }
                    line.startsWith(":") -> onEvent("ping", JSONObject())
                    line.startsWith("event:") -> event = line.substring(6).trim()
                    line.startsWith("data:") -> {
                        if (data.isNotEmpty()) data.append('\n')
                        data.append(line.substring(5).trim())
                    }
                }
            }
        }
    } finally {
        conn.disconnect()
    }
}

@Composable
fun JetScreen(
    mobile: String,
    balance: Double,
    onBack: () -> Unit,
    onBalances: (balance: Double, bonus: Double) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var config by remember { mutableStateOf<JSONObject?>(null) }
    var round by remember { mutableStateOf(JSONObject().put("phase", "waiting")) }
    var history by remember { mutableStateOf<List<JSONObject>>(emptyList()) }
    var live by remember { mutableStateOf(JSONObject()) }
    var fairness by remember { mutableStateOf(JSONObject()) }
    var rules by remember { mutableStateOf<List<String>>(emptyList()) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var lastEventAt by remember { mutableStateOf(0L) }

    var active by remember { mutableStateOf<List<JSONObject>>(emptyList()) }
    var myBets by remember { mutableStateOf<List<JSONObject>>(emptyList()) }
    var message by remember { mutableStateOf<String?>(null) }
    var messageOk by remember { mutableStateOf(true) }
    var busySlot by remember { mutableStateOf(0) }
    var tab by remember { mutableStateOf("all") }
    var showRules by remember { mutableStateOf(false) }
    var showFair by remember { mutableStateOf(false) }
    var proof by remember { mutableStateOf<Proof?>(null) }
    var proofError by remember { mutableStateOf<String?>(null) }

    fun toList(arr: JSONArray?): List<JSONObject> = if (arr == null) emptyList() else (0 until arr.length()).map { arr.getJSONObject(it) }

    fun applyState(d: JSONObject) {
        ServerClock.sync(d.optLong("serverTime"))
        config = d.optJSONObject("config")
        round = d.optJSONObject("round") ?: JSONObject().put("phase", "waiting")
        history = toList(d.optJSONArray("history"))
        live = d.optJSONObject("live") ?: JSONObject()
        fairness = d.optJSONObject("fairness") ?: JSONObject()
        val r = d.optJSONArray("rules")
        rules = if (r == null) emptyList() else (0 until r.length()).map { r.getString(it) }
        loadError = null
    }

    suspend fun poll() {
        try {
            applyState(GamesApi.get(context, "/api/games/jet/state"))
        } catch (e: Exception) {
            loadError = e.message ?: "Could not load 99x Jet"
        }
    }

    suspend fun loadMine() {
        if (mobile.length < 10) return
        try {
            val d = GamesApi.get(context, "/api/games/jet/my-bets?mobile=$mobile")
            val newActive = toList(d.optJSONArray("active"))
            for (a in newActive) {
                val before = active.find { it.str("id") == a.str("id") }
                if (before != null && before.str("status") == "pending" && a.str("status") == "won") {
                    message = "Bet ${a.optInt("slot")}: cashed out at ${fmtX(a.dbl("cashout"))} · won ${inr(a.optDouble("win", 0.0))}"
                    messageOk = true
                }
            }
            active = newActive
            myBets = toList(d.optJSONArray("bets"))
            val bal = d.optJSONObject("balances")
            if (bal != null) onBalances(bal.optDouble("balance", balance), bal.optDouble("bonus_balance", 0.0))
        } catch (e: Exception) { }
    }

    // Live events, reconnecting when the stream drops
    LaunchedEffect(Unit) {
        withContext(Dispatchers.IO) {
            while (isActive) {
                try {
                    readJetStream { type, d ->
                        withContext(Dispatchers.Main) {
                            lastEventAt = System.currentTimeMillis()
                            if (d.has("serverTime")) ServerClock.sync(d.optLong("serverTime"))
                            when (type) {
                                "state" -> applyState(d)
                                "round" -> {
                                    round = d.optJSONObject("round") ?: round
                                    live = JSONObject().put("count", 0).put("players", 0).put("staked", 0).put("bets", JSONArray())
                                }
                                "fly" -> round = d.optJSONObject("round") ?: round
                                "blast" -> {
                                    val r = d.optJSONObject("round")
                                    if (r != null) {
                                        round = r
                                        val p = r.dbl("point")
                                        if (p != null) history = (listOf(JSONObject().put("id", r.str("id")).put("point", p)) + history).take(30)
                                    }
                                    loadMine()
                                }
                                "bets" -> live = d
                                "paused" -> round = JSONObject().put("phase", "paused")
                                "config" -> config = d.optJSONObject("config") ?: config
                            }
                        }
                    }
                } catch (e: Exception) { }
                delay(2000L)
            }
        }
    }
    // Fallback: poll when the stream is quiet (some networks buffer it)
    LaunchedEffect(Unit) {
        poll()
        loadMine()
        while (true) {
            delay(1500L)
            if (System.currentTimeMillis() - lastEventAt > 20000L) poll()
        }
    }
    LaunchedEffect(Unit) {
        while (true) {
            delay(6000L)
            loadMine()
        }
    }
    val roundId = round.str("id")
    LaunchedEffect(roundId) { if (roundId.isNotEmpty()) loadMine() }
    LaunchedEffect(message) {
        if (message != null) {
            delay(4000L)
            message = null
        }
    }

    // Clock: every frame while flying, otherwise every 100 ms
    val phase = round.str("phase")
    var now by remember { mutableStateOf(ServerClock.now()) }
    LaunchedEffect(phase) {
        if (phase == "flying") {
            while (true) withFrameMillis { now = ServerClock.now() }
        } else {
            while (true) {
                now = ServerClock.now()
                delay(100L)
            }
        }
    }

    val cfg = config
    if (cfg == null) {
        Box(modifier = Modifier.fillMaxSize().background(GameColors.Bg), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(loadError ?: "Loading 99x Jet…", color = GameColors.Muted, fontSize = 13.sp)
                Spacer(Modifier.height(10.dp))
                Text("← Back", color = GameColors.GoldLight, fontSize = 13.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { onBack() })
            }
        }
        return
    }

    val growth = cfg.optDouble("growth", 0.00006)

    fun act(slot: Int, path: String, body: JSONObject, ok: (JSONObject) -> String) {
        if (mobile.length < 10) { message = "Please log in to play."; messageOk = false; return }
        busySlot = slot
        scope.launch {
            try {
                val d = GamesApi.post(context, path, body.put("mobile", mobile).put("slot", slot))
                val bal = d.optJSONObject("balances")
                if (bal != null) onBalances(bal.optDouble("balance", balance), bal.optDouble("bonus_balance", 0.0))
                message = ok(d)
                messageOk = true
                loadMine()
            } catch (e: Exception) {
                message = e.message ?: "Something went wrong"
                messageOk = false
            }
            busySlot = 0
        }
    }

    fun openProof(id: String) {
        proof = null
        proofError = null
        scope.launch {
            try {
                val d = GamesApi.get(context, "/api/games/jet/round/$id")
                val p = d.optJSONObject("round") ?: throw Exception("Round not found")
                proof = withContext(Dispatchers.Default) { checkProof(p) }
            } catch (e: Exception) {
                proofError = e.message ?: "Could not check this round"
            }
        }
    }

    fun slotActive(slot: Int): JSONObject? {
        val list = active.filter { it.optInt("slot") == slot }
        return list.find { it.str("status") == "pending" && !it.optBoolean("queued") }
            ?: list.find { it.optBoolean("queued") }
            ?: list.find { !it.optBoolean("queued") }
    }

    Box(modifier = Modifier.fillMaxSize().background(GameColors.Bg)) {
        Column(modifier = Modifier.fillMaxSize()) {
            // Header
            Row(
                modifier = Modifier.fillMaxWidth().background(GameColors.Deep).padding(horizontal = 8.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) { Text("←", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold) }
                Column(modifier = Modifier.weight(1f)) {
                    Text("99x Jet", color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.Black)
                    Text("Fair crash game · up to ${cfg.optInt("maxPoint", 2000)}x", color = GameColors.GoldLight, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                }
                Text("ⓘ", color = GameColors.Muted, fontSize = 18.sp, modifier = Modifier.clickable { showRules = true }.padding(horizontal = 10.dp))
                Box(
                    modifier = Modifier.clip(RoundedCornerShape(50)).background(GameColors.Surface).border(1.dp, GameColors.Gold.copy(alpha = 0.4f), RoundedCornerShape(50)).padding(horizontal = 12.dp, vertical = 5.dp)
                ) {
                    Text(inr(balance), color = GameColors.Champagne, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold)
                }
            }

            Column(modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 14.dp, vertical = 12.dp)) {
                // Last blast points
                Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (history.isEmpty()) Text("No rounds yet", color = Color(0xFF6B7280), fontSize = 11.sp)
                    history.forEach { h ->
                        val p = h.optDouble("point", 1.0)
                        val c = if (p >= 10) Color(0xFFF0C36A) else if (p >= 2) GameColors.Emerald else Color(0xFFD1D5DB)
                        Text(
                            fmtX(p), color = c, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, fontFamily = FontFamily.Monospace,
                            modifier = Modifier.clip(RoundedCornerShape(50)).background(c.copy(alpha = 0.1f)).border(1.dp, c.copy(alpha = 0.4f), RoundedCornerShape(50))
                                .clickable { showFair = true; openProof(h.str("id")) }.padding(horizontal = 9.dp, vertical = 3.dp)
                        )
                    }
                }
                Spacer(Modifier.height(10.dp))

                JetFlight(round = round, growth = growth, bettingSec = cfg.optInt("bettingSec", 8), now = now)

                Spacer(Modifier.height(6.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    val code = round.str("hash")
                    Text(
                        (if (roundId.isEmpty()) "—" else roundId) + (if (code.length > 10) " · code ${code.take(10)}…" else ""),
                        color = Color(0xFF6B7280), fontSize = 10.sp, fontFamily = FontFamily.Monospace, modifier = Modifier.weight(1f), maxLines = 1
                    )
                    Text("🛡 Fair play", color = GameColors.GoldLight, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { showFair = true })
                }

                val msg = message
                if (msg != null) {
                    Spacer(Modifier.height(8.dp))
                    val c = if (messageOk) GameColors.Emerald else GameColors.ErrorText
                    Text(
                        msg, color = c, fontSize = 12.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(c.copy(alpha = 0.1f)).border(1.dp, c.copy(alpha = 0.4f), RoundedCornerShape(12.dp)).padding(10.dp)
                    )
                }

                Spacer(Modifier.height(10.dp))
                for (slot in 1..2) {
                    JetBetPanel(
                        slot = slot, cfg = cfg, round = round, active = slotActive(slot), now = now, balance = balance,
                        busy = busySlot == slot, act = { path, body, ok -> act(slot, path, body, ok) },
                        onError = { message = it; messageOk = false }
                    )
                    Spacer(Modifier.height(10.dp))
                }
                Text(
                    "${inr(cfg.optDouble("minBet", 10.0))}–${inr(cfg.optDouble("maxBet", 10000.0))} per bet · max win ${inr(cfg.optDouble("maxWin", 100000.0))} per bet · ${cfg.optDouble("edgePct", 4.0)}% house edge",
                    color = Color(0xFF6B7280), fontSize = 10.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth()
                )
                Spacer(Modifier.height(12.dp))

                // All bets / My bets
                Column(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(GameColors.Deep).border(1.dp, Color(0xFF1F2937), RoundedCornerShape(16.dp))) {
                    Row {
                        listOf("all" to "All bets · ${live.optInt("count", 0)}", "mine" to "My bets").forEach { (k, label) ->
                            Text(
                                label, color = if (tab == k) GameColors.Champagne else Color(0xFF6B7280), fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, textAlign = TextAlign.Center,
                                modifier = Modifier.weight(1f).clickable { tab = k }.padding(vertical = 10.dp)
                            )
                        }
                    }
                    if (tab == "all") {
                        Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 4.dp)) {
                            Text("${live.optInt("players", 0)} PLAYERS", color = Color(0xFF6B7280), fontSize = 9.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                            Text("${inr(live.optDouble("staked", 0.0))} STAKED", color = Color(0xFF6B7280), fontSize = 9.sp, fontWeight = FontWeight.Bold)
                        }
                        val list = toList(live.optJSONArray("bets"))
                        if (list.isEmpty()) Text("No bets in this round yet.", color = Color(0xFF6B7280), fontSize = 11.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(14.dp))
                        list.forEach { b ->
                            val st = b.str("status")
                            BetLine(
                                b.str("name"), inr(b.optDouble("amount", 0.0)),
                                if (st == "won") fmtX(b.dbl("cashout")) else if (st == "lost") "lost" else if (phase == "flying") "flying" else "—",
                                if (st == "won") inr(b.optDouble("win", 0.0)) else "—", st == "won"
                            )
                        }
                    } else {
                        if (myBets.isEmpty()) Text(if (mobile.length < 10) "Log in to see your bets." else "No 99x Jet bets yet.", color = Color(0xFF6B7280), fontSize = 11.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(14.dp))
                        myBets.take(30).forEach { b ->
                            val st = b.str("status")
                            BetLine(
                                b.str("roundId"), inr(b.optDouble("amount", 0.0)),
                                when (st) { "won" -> fmtX(b.dbl("cashout")); "lost" -> "✕ ${fmtX(b.dbl("result"))}"; "refunded" -> "refunded"; else -> "open" },
                                if (st == "won") "+" + inr(b.optDouble("win_amount", 0.0)) else "—", st == "won"
                            )
                        }
                    }
                    Spacer(Modifier.height(6.dp))
                }
                Spacer(Modifier.height(24.dp))
            }
        }
    }

    if (showRules) {
        AlertDialog(
            onDismissRequest = { showRules = false },
            confirmButton = { TextButton(onClick = { showRules = false }) { Text("Got it", color = GameColors.GoldLight, fontWeight = FontWeight.Bold) } },
            title = { Text("How 99x Jet works", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp) },
            text = {
                Column(modifier = Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    rules.forEach { line ->
                        Row {
                            Text("•  ", color = GameColors.GoldLight, fontSize = 12.sp)
                            Text(line, color = Color(0xFFD1D5DB), fontSize = 12.sp, lineHeight = 17.sp)
                        }
                    }
                }
            },
            containerColor = Color(0xFF0C1712)
        )
    }

    if (showFair) {
        AlertDialog(
            onDismissRequest = { showFair = false; proof = null; proofError = null },
            confirmButton = { TextButton(onClick = { showFair = false; proof = null; proofError = null }) { Text("Close", color = GameColors.GoldLight, fontWeight = FontWeight.Bold) } },
            title = { Text("Fair play", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp) },
            text = {
                Column(modifier = Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Every blast point is fixed before betting opens. Before a round you see its code; after the blast the seed is shown, and your phone recomputes the point.", color = Color(0xFFD1D5DB), fontSize = 11.sp, lineHeight = 15.sp)
                    Text("Chain end: ${fairness.str("terminatingHash")}", color = Color(0xFF9CA3AF), fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                    Text("Salt: ${fairness.str("salt")}", color = Color(0xFF9CA3AF), fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                    Text("Tap a past round to check it", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        history.take(15).forEach { h ->
                            Text(
                                "${h.str("id")} · ${fmtX(h.optDouble("point"))}", color = GameColors.Champagne, fontSize = 10.sp, fontFamily = FontFamily.Monospace,
                                modifier = Modifier.clip(RoundedCornerShape(50)).border(1.dp, GameColors.Border, RoundedCornerShape(50)).clickable { openProof(h.str("id")) }.padding(horizontal = 8.dp, vertical = 3.dp)
                            )
                        }
                    }
                    val pe = proofError
                    if (pe != null) Text(pe, color = GameColors.ErrorText, fontSize = 11.sp)
                    val p = proof
                    if (p != null) {
                        Column(
                            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(GameColors.Emerald.copy(alpha = 0.06f)).border(1.dp, GameColors.Emerald.copy(alpha = 0.3f), RoundedCornerShape(12.dp)).padding(10.dp),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Text(p.id, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold)
                            Text("Code shown before: ${p.hash}", color = Color(0xFF9CA3AF), fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                            Text("Seed revealed: ${p.seed}", color = Color(0xFF9CA3AF), fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                            Text(if (p.hashOk) "✓ SHA-256(seed) matches the code" else "✕ seed does not match the code", color = if (p.hashOk) GameColors.Emerald else GameColors.ErrorText, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                            val ok = p.pointOk
                            if (ok != null) Text(
                                if (ok) "✓ Recomputed blast point ${fmtX(p.recomputed)} matches" else "✕ Recomputed ${fmtX(p.recomputed)}, round shows ${fmtX(p.point)}",
                                color = if (ok) GameColors.Emerald else GameColors.ErrorText, fontSize = 11.sp, fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            },
            containerColor = Color(0xFF0C1712)
        )
    }
}

@Composable
private fun BetLine(a: String, b: String, c: String, d: String, won: Boolean) {
    Row(
        modifier = Modifier.fillMaxWidth().background(if (won) GameColors.Emerald.copy(alpha = 0.05f) else Color.Transparent).padding(horizontal = 12.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(a, color = Color(0xFFD1D5DB), fontSize = 11.sp, fontFamily = FontFamily.Monospace, maxLines = 1, modifier = Modifier.weight(1.2f))
        Text(b, color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.End, modifier = Modifier.weight(1f))
        Text(c, color = if (won) GameColors.Emerald else Color(0xFF9CA3AF), fontSize = 11.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, textAlign = TextAlign.End, modifier = Modifier.weight(1f))
        Text(d, color = if (won) GameColors.Emerald else Color(0xFF4B5563), fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, textAlign = TextAlign.End, modifier = Modifier.weight(1f))
    }
}

// ---------- the flight picture ----------
private fun DrawScope.drawJet(s: Float) {
    drawOval(
        brush = Brush.radialGradient(listOf(Color(0xFFFFF3C4), Color(0xFFFFB547), Color(0x00FF5A2A)), center = Offset(-96f * s, 0f), radius = 46f * s),
        topLeft = Offset(-142f * s, -14f * s), size = Size(92f * s, 28f * s)
    )
    val body = Path().apply {
        moveTo(-70f * s, -10f * s); lineTo(40f * s, -12f * s)
        quadraticBezierTo(78f * s, -10f * s, 92f * s, 0f)
        quadraticBezierTo(78f * s, 10f * s, 40f * s, 12f * s)
        lineTo(-70f * s, 10f * s); close()
    }
    drawPath(body, Brush.verticalGradient(listOf(Color(0xFFFFF6DF), Color(0xFFE8C88E), Color(0xFF8A6D47)), startY = -12f * s, endY = 12f * s))
    fun wing(points: List<Pair<Float, Float>>, c: Color) {
        val p = Path()
        points.forEachIndexed { i, (x, y) -> if (i == 0) p.moveTo(x * s, y * s) else p.lineTo(x * s, y * s) }
        p.close()
        drawPath(p, c)
    }
    wing(listOf(-6f to -10f, -40f to -62f, -22f to -62f, 28f to -10f), Color(0xFFC9A87C))
    wing(listOf(-6f to 10f, -40f to 62f, -22f to 62f, 28f to 10f), Color(0xFFB08E5E))
    wing(listOf(-70f to -8f, -88f to -34f, -76f to -34f, -52f to -8f), Color(0xFFC9A87C))
    wing(listOf(-70f to 8f, -88f to 34f, -76f to 34f, -52f to 8f), Color(0xFFB08E5E))
    drawOval(Color(0xD9163A52), topLeft = Offset(40f * s, -8f * s), size = Size(32f * s, 10f * s))
}

@Composable
private fun JetFlight(round: JSONObject, growth: Double, bettingSec: Int, now: Long) {
    val phase = round.str("phase")
    val flyAt = round.lng("flyAt")
    val ended = phase == "ended" || phase == "void"
    val endedAt = round.lng("endedAt")
    val flownMs = if (flyAt <= 0) 0L else if (ended && endedAt > 0) endedAt - flyAt else max(0L, now - flyAt)
    val point = round.dbl("point")
    val m = if (ended && point != null) point else jetMult(growth, flownMs)
    val bettingLeft = max(0L, round.lng("bettingEndsAt") - now)

    Box(
        modifier = Modifier.fillMaxWidth().aspectRatio(360f / 210f).clip(RoundedCornerShape(18.dp))
            .background(Brush.radialGradient(JetSky)).border(1.dp, GameColors.Gold.copy(alpha = 0.25f), RoundedCornerShape(18.dp)),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val w = size.width
            val h = size.height
            val x0 = w * 0.05f
            val y0 = h * 0.895f
            val axis = Color(0x40E0C9A0)
            drawLine(axis, Offset(x0, y0), Offset(w * 0.97f, y0), 2f)
            drawLine(axis, Offset(x0, y0), Offset(x0, h * 0.07f), 2f)
            val span = max(8000.0, flownMs * 1.12)
            val topM = max(2.0, m * 1.15)
            fun px(ms: Double) = (x0 + (ms / span) * (w * 0.83)).toFloat()
            fun py(mm: Double) = (y0 - ((mm - 1) / (topM - 1)) * (h * 0.71)).toFloat()
            val s = w / 360f * 0.32f
            if ((phase == "flying" || phase == "ended") && flownMs > 0) {
                val line = Path()
                val area = Path()
                area.moveTo(x0, y0)
                for (i in 0..48) {
                    val t = flownMs * i / 48.0
                    val x = px(t)
                    val y = py(exp(growth * t))
                    if (i == 0) line.moveTo(x, y) else line.lineTo(x, y)
                    area.lineTo(x, y)
                }
                val tipX = px(flownMs.toDouble())
                area.lineTo(tipX, y0)
                area.close()
                drawPath(area, Brush.verticalGradient(listOf(Color(0x59E0C9A0), Color(0x00E0C9A0)), startY = h * 0.1f, endY = y0))
                drawPath(line, if (phase == "ended") JetRed else GameColors.Champagne, style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round, join = StrokeJoin.Round))
                val tipY = py(exp(growth * flownMs))
                if (phase == "flying") {
                    val prev = max(0.0, flownMs - span / 30)
                    val climb = Math.toDegrees(atan2((py(exp(growth * prev)) - tipY).toDouble(), (tipX - px(prev)).toDouble())).toFloat()
                    translate(tipX, tipY) { rotate(-climb.coerceIn(8f, 70f), pivot = Offset.Zero) { drawJet(s) } }
                } else {
                    drawCircle(Color(0x59FF5A2A), radius = 16.dp.toPx(), center = Offset(tipX, tipY))
                    drawCircle(Color(0xCCFFB547), radius = 8.dp.toPx(), center = Offset(tipX, tipY))
                }
            }
            if (phase == "betting") translate(x0 + 24f * w / 360f, y0 - 8f * h / 210f) { rotate(-8f, pivot = Offset.Zero) { drawJet(s) } }
        }
        when (phase) {
            "flying" -> Text(String.format(Locale.US, "%.2fx", m), color = Color.White, fontSize = 44.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace)
            "ended" -> Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text("BLASTED", color = JetRed, fontSize = 13.sp, fontWeight = FontWeight.Black, letterSpacing = 4.sp)
                Text(fmtX(point), color = JetRed, fontSize = 44.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace)
            }
            "void" -> Text("Round cancelled · open bets refunded", color = GameColors.Amber, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            "betting" -> Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth(0.6f)) {
                Text("PLACE YOUR BETS", color = Color(0xFFBFE0F5), fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 3.sp)
                Text(String.format(Locale.US, "%.1fs", bettingLeft / 1000.0), color = Color.White, fontSize = 28.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace)
                Spacer(Modifier.height(6.dp))
                val frac = if (bettingSec > 0) (bettingLeft / (bettingSec * 1000f)).coerceIn(0f, 1f) else 0f
                Box(modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(50)).background(Color.White.copy(alpha = 0.1f))) {
                    Box(modifier = Modifier.fillMaxWidth(frac).height(6.dp).clip(RoundedCornerShape(50)).background(Brush.horizontalGradient(listOf(GameColors.Emerald, GameColors.Champagne))))
                }
            }
            "paused" -> Text("99x Jet is paused right now", color = Color(0xFFD1D5DB), fontSize = 13.sp, fontWeight = FontWeight.Bold)
            else -> Text("Next round starting…", color = Color(0xFFD1D5DB), fontSize = 13.sp, fontWeight = FontWeight.Bold)
        }
    }
}

// ---------- one bet panel ----------
@Composable
private fun JetBetPanel(
    slot: Int, cfg: JSONObject, round: JSONObject, active: JSONObject?, now: Long, balance: Double, busy: Boolean,
    act: (String, JSONObject, (JSONObject) -> String) -> Unit, onError: (String) -> Unit
) {
    val minBet = cfg.optInt("minBet", 10)
    val maxBet = cfg.optInt("maxBet", 10000)
    val maxWin = cfg.optDouble("maxWin", 100000.0)
    val minCashout = cfg.optDouble("minCashout", 1.01)
    val growth = cfg.optDouble("growth", 0.00006)
    var mode by remember { mutableStateOf(if (slot == 1) "bet" else "auto") }
    var amount by remember { mutableStateOf(max(minBet, if (slot == 1) 100 else 50)) }
    var amountText by remember { mutableStateOf(amount.toString()) }
    var auto by remember { mutableStateOf(if (slot == 1) "2.00" else "3.00") }

    val phase = round.str("phase")
    val rid = round.str("id")
    val status = active?.str("status") ?: ""
    val queued = active?.optBoolean("queued") ?: false
    val inRound = active != null && !queued && active.str("roundId") == rid
    val pending = status == "pending"
    val flying = phase == "flying" && round.lng("flyAt") > 0
    val live = if (flying) jetMult(growth, now - round.lng("flyAt")) else 1.0
    val bettingOpen = phase == "betting" && round.lng("bettingEndsAt") > now
    val canCashOut = pending && inRound && flying
    val canCancel = pending && (queued || (inRound && bettingOpen))
    val locked = pending

    data class Btn(val label: String, val sub: String?, val bg: List<Color>, val fg: Color, val onClick: (() -> Unit)?)
    val btn: Btn = when {
        canCashOut -> Btn("CASH OUT", inr(min(maxWin, floor(active!!.optDouble("amount") * live * 100) / 100)), listOf(Color(0xFFFFB547), JetOrange), Color(0xFF1A0F06)) {
            act("/api/games/jet/cashout", JSONObject()) { d -> "Bet $slot: cashed out at ${fmtX(d.dbl("x"))} · won ${inr(d.optDouble("win", 0.0))}" }
        }
        canCancel -> Btn("CANCEL", if (queued) "waiting for next round" else "${inr(active!!.optDouble("amount"))} placed", listOf(JetRed, GameColors.CardRed), Color.White) {
            act("/api/games/jet/cancel", JSONObject()) { "Bet $slot cancelled · ${inr(active!!.optDouble("amount"))} refunded" }
        }
        pending && inRound && !flying -> Btn("WAITING", "take-off", listOf(Color(0xFF4B5563), Color(0xFF374151)), Color.White, null)
        !cfg.optBoolean("enabled", true) || phase == "paused" -> Btn("PAUSED", null, listOf(Color(0xFF4B5563), Color(0xFF374151)), Color.White, null)
        else -> Btn("BET ${inr(amount.toDouble())}", if (bettingOpen) null else "next round", listOf(GameColors.Emerald, Color(0xFF1E9C68)), Color(0xFF04140C)) {
            val target = if (mode == "auto") auto.toDoubleOrNull() else null
            when {
                amount < minBet -> onError("Minimum bet is ${inr(minBet.toDouble())}")
                amount > balance + 0.001 -> onError("Not enough balance. You need ${inr(amount.toDouble())}.")
                mode == "auto" && (target == null || target < minCashout) -> onError("Auto cash-out must be at least ${fmtX(minCashout)}")
                else -> {
                    val body = JSONObject().put("amount", amount)
                    if (target != null) body.put("autoCashout", target)
                    act("/api/games/jet/bet", body) { d -> if (d.optBoolean("queued")) "Bet $slot: ${inr(amount.toDouble())} placed for the next round" else "Bet $slot: ${inr(amount.toDouble())} placed" }
                }
            }
        }
    }

    fun setAmt(v: Int) {
        amount = v.coerceIn(0, maxBet)
        amountText = amount.toString()
    }

    Column(
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(Color(0xFF0C1712)).border(1.dp, GameColors.Border, RoundedCornerShape(16.dp)).padding(12.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Row(modifier = Modifier.clip(RoundedCornerShape(50)).background(GameColors.Deep).border(1.dp, Color(0xFF1F2937), RoundedCornerShape(50)).padding(2.dp)) {
                listOf("bet" to "Bet", "auto" to "Auto").forEach { (k, label) ->
                    Text(
                        label, color = if (mode == k) Color.White else Color(0xFF9CA3AF), fontSize = 11.sp, fontWeight = FontWeight.ExtraBold,
                        modifier = Modifier.clip(RoundedCornerShape(50)).background(if (mode == k) Color(0xFF1E8A6E) else Color.Transparent)
                            .clickable(enabled = !locked) { mode = k }.padding(horizontal = 12.dp, vertical = 4.dp)
                    )
                }
            }
            Spacer(Modifier.weight(1f))
            when {
                status == "won" && inRound -> Text("Won ${inr(active!!.optDouble("win", 0.0))} at ${fmtX(active.dbl("cashout"))}", color = GameColors.Emerald, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold)
                status == "lost" && inRound -> Text("Lost ${inr(active!!.optDouble("amount", 0.0))}", color = Color(0xFF6B7280), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                else -> Text("Bet $slot", color = Color(0xFF6B7280), fontSize = 10.sp, fontWeight = FontWeight.Bold)
            }
        }
        Spacer(Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth().height(38.dp).clip(RoundedCornerShape(50)).background(GameColors.Deep).border(1.dp, Color(0xFF374151), RoundedCornerShape(50)),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("−", color = Color(0xFFD1D5DB), fontSize = 18.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center,
                        modifier = Modifier.width(36.dp).clickable(enabled = !locked) { setAmt(max(minBet, amount - 10)) })
                    BasicTextField(
                        value = amountText, enabled = !locked,
                        onValueChange = { v -> val clean = v.filter { it.isDigit() }.take(7); amountText = clean; amount = (clean.toIntOrNull() ?: 0).coerceAtMost(maxBet) },
                        singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        textStyle = TextStyle(color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, fontFamily = FontFamily.Monospace, textAlign = TextAlign.Center),
                        cursorBrush = SolidColor(GameColors.Gold), modifier = Modifier.weight(1f)
                    )
                    Text("+", color = Color(0xFFD1D5DB), fontSize = 18.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center,
                        modifier = Modifier.width(36.dp).clickable(enabled = !locked) { setAmt(min(maxBet, amount + 10)) })
                }
                Spacer(Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    listOf(10, 50, 100, 500).filter { it in minBet..maxBet }.forEach { v ->
                        Text(
                            "₹$v", color = if (amount == v) GameColors.Deep else Color(0xFFD1D5DB), fontSize = 10.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center,
                            modifier = Modifier.weight(1f).clip(RoundedCornerShape(6.dp)).background(if (amount == v) GameColors.Gold else Color.White.copy(alpha = 0.05f))
                                .clickable(enabled = !locked) { setAmt(v) }.padding(vertical = 4.dp)
                        )
                    }
                }
                if (mode == "auto") {
                    Spacer(Modifier.height(6.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Auto cash-out", color = Color(0xFF9CA3AF), fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                        Row(
                            modifier = Modifier.clip(RoundedCornerShape(6.dp)).background(GameColors.Deep).border(1.dp, Color(0xFF374151), RoundedCornerShape(6.dp)).padding(horizontal = 8.dp, vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            BasicTextField(
                                value = auto, enabled = !locked, onValueChange = { v -> auto = v.filter { it.isDigit() || it == '.' }.take(7) },
                                singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                                textStyle = TextStyle(color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, fontFamily = FontFamily.Monospace, textAlign = TextAlign.End),
                                cursorBrush = SolidColor(GameColors.Gold), modifier = Modifier.width(52.dp)
                            )
                            Text("x", color = Color(0xFF6B7280), fontSize = 12.sp)
                        }
                    }
                }
            }
            Spacer(Modifier.width(10.dp))
            Column(
                modifier = Modifier.width(132.dp).height(if (mode == "auto") 108.dp else 76.dp).clip(RoundedCornerShape(14.dp))
                    .background(Brush.verticalGradient(btn.bg)).then(if (btn.onClick != null && !busy) Modifier.clickable { btn.onClick.invoke() } else Modifier)
                    .padding(6.dp),
                horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center
            ) {
                Text(if (busy) "…" else btn.label, color = btn.fg, fontSize = 14.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp, textAlign = TextAlign.Center, maxLines = 1)
                if (btn.sub != null) Text(btn.sub, color = btn.fg.copy(alpha = 0.9f), fontSize = 12.sp, fontWeight = FontWeight.ExtraBold, fontFamily = FontFamily.Monospace, textAlign = TextAlign.Center, maxLines = 1)
                if (pending && active?.dbl("auto") != null) Text("auto at ${fmtX(active.dbl("auto"))}", color = btn.fg.copy(alpha = 0.8f), fontSize = 10.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

// Lobby helper for the home box
fun jetLobbyStatus(lobby: JSONObject?, now: Long): Triple<String, Boolean, Boolean> {
    val j = lobby?.optJSONObject("jet") ?: return Triple(if (lobby == null) "Loading…" else "Paused for now", false, lobby == null)
    if (!j.optBoolean("enabled", true)) return Triple("Paused for now", false, false)
    val lp = j.dbl("lastPoint")
    val last = if (lp != null) " · last ${fmtX(lp)}" else ""
    val r = j.optJSONObject("round") ?: JSONObject()
    return when (r.str("phase")) {
        "flying" -> Triple("Flying now$last · up to 2000x", true, true)
        "betting" -> Triple("Next take-off in ${max(0L, (r.lng("bettingEndsAt") - now + 999) / 1000)}s$last", true, true)
        else -> Triple("Rounds every few seconds$last · up to 2000x", true, true)
    }
}
