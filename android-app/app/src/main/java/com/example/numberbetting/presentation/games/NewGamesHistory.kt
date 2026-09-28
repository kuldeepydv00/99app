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
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import org.json.JSONArray
import org.json.JSONObject

/** "Matka | 99x & Trading" switch shown at the top of My Bets. */
@Composable
fun GamesModeToggle(showNewGames: Boolean, onChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(GameColors.Deep).border(1.dp, Color(0xFF1F2937), RoundedCornerShape(12.dp)).padding(4.dp)
    ) {
        listOf(false to "Matka", true to "99x & Trading").forEach { (value, label) ->
            val sel = showNewGames == value
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(9.dp))
                    .background(if (sel) GameColors.Gold else Color.Transparent)
                    .clickable { onChange(value) }
                    .padding(vertical = 9.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(label, color = if (sel) GameColors.Deep else GameColors.Muted, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold)
            }
        }
    }
}

/** All of this player's 99x Matka and trading bets, with per-game filter chips. */
@Composable
fun NewGamesBetsList(mobile: String, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    var bets by remember { mutableStateOf<List<JSONObject>?>(null) }
    var filter by remember { mutableStateOf("all") }

    LaunchedEffect(mobile) {
        while (true) {
            bets = try {
                val d = GamesApi.get(context, "/api/games/my-bets?mobile=$mobile")
                val arr = d.optJSONArray("bets") ?: JSONArray()
                (0 until arr.length()).map { arr.getJSONObject(it) }
            } catch (e: Exception) {
                bets ?: emptyList()
            }
            delay(15000L)
        }
    }

    Column(modifier = modifier.fillMaxWidth()) {
        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("all" to "All", "matka99" to "99x Matka", "number" to "Number", "card" to "Card", "colour" to "Colour").forEach { (key, label) ->
                val sel = filter == key
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(50))
                        .background(if (sel) GameColors.Gold else GameColors.Surface2)
                        .clickable { filter = key }
                        .padding(horizontal = 14.dp, vertical = 7.dp)
                ) {
                    Text(label, color = if (sel) GameColors.Deep else Color(0xFFD1D5DB), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
        Spacer(Modifier.height(12.dp))

        val all = bets
        val list = all?.filter { filter == "all" || it.optString("game") == filter } ?: emptyList()
        if (all == null) {
            Text("Loading…", color = GameColors.Muted, fontSize = 12.sp, modifier = Modifier.fillMaxWidth().padding(20.dp), textAlign = TextAlign.Center)
        } else if (list.isEmpty()) {
            Text("No bets here yet.", color = GameColors.Muted, fontSize = 12.sp, modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(GameColors.Surface).padding(24.dp), textAlign = TextAlign.Center)
        } else {
            Column(
                modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).clip(RoundedCornerShape(16.dp)).background(GameColors.Deep).border(1.dp, Color(0xFF1F2937), RoundedCornerShape(16.dp))
            ) {
                list.forEach { b ->
                    val game = b.optString("game")
                    val tagGame = if (game == "matka99") "number" else game
                    val title = when (game) {
                        "matka99" -> b.optString("marketName")
                        "number" -> "Number"
                        "card" -> "Card"
                        else -> "Colour"
                    }
                    val sub = if (game == "matka99") b.optString("dateKey") else b.optString("roundId")
                    Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                        OptionTag(tagGame, b.optString("option"))
                        Spacer(Modifier.width(10.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text("$title · ${inr(b.optDouble("amount", 0.0))}", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            Text(sub, color = Color(0xFF6B7280), fontSize = 10.sp, fontFamily = FontFamily.Monospace)
                        }
                        when (b.optString("status")) {
                            "won" -> Text("+" + inr(b.optDouble("win_amount", 0.0)), color = GameColors.Emerald, fontSize = 12.sp, fontWeight = FontWeight.ExtraBold)
                            "lost" -> Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("Result ", color = Color(0xFF6B7280), fontSize = 10.sp)
                                OptionTag(tagGame, b.optString("result"))
                            }
                            else -> Text("Pending", color = GameColors.Amber, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

/** Date × market grid of declared 99x Matka results. */
@Composable
fun Matka99ChartScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    var chart by remember { mutableStateOf<JSONObject?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(Unit) {
        try {
            chart = GamesApi.get(context, "/api/games/matka99/chart?days=60")
        } catch (e: Exception) {
            error = e.message
        }
    }
    Column(modifier = Modifier.fillMaxSize().background(GameColors.Bg)) {
        Row(modifier = Modifier.fillMaxWidth().background(GameColors.Deep).padding(horizontal = 8.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) {
                Text("←", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold)
            }
            Text("99x Matka Chart", color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.Black)
        }
        val data = chart
        val marketsArr = data?.optJSONArray("markets") ?: JSONArray()
        val rowsArr = data?.optJSONArray("rows") ?: JSONArray()
        if (data == null) {
            Text(error ?: "Loading…", color = GameColors.Muted, fontSize = 12.sp, modifier = Modifier.fillMaxWidth().padding(24.dp), textAlign = TextAlign.Center)
        } else if (rowsArr.length() == 0) {
            Text("No 99x Matka results declared yet.", color = GameColors.Muted, fontSize = 12.sp, modifier = Modifier.fillMaxWidth().padding(24.dp), textAlign = TextAlign.Center)
        } else Column(modifier = Modifier.fillMaxSize().padding(12.dp).verticalScroll(rememberScrollState())) {
            Column(
                modifier = Modifier.horizontalScroll(rememberScrollState()).clip(RoundedCornerShape(14.dp)).border(1.dp, GameColors.Rose.copy(alpha = 0.3f), RoundedCornerShape(14.dp))
            ) {
                Row(modifier = Modifier.background(Color(0xFF1A2A22)).padding(vertical = 10.dp)) {
                    Text("DATE", color = GameColors.Ivory, fontSize = 10.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(64.dp).padding(start = 12.dp))
                    for (i in 0 until marketsArr.length()) {
                        Text(marketsArr.getJSONObject(i).optString("name").uppercase(), color = GameColors.Ivory, fontSize = 9.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center, modifier = Modifier.width(82.dp))
                    }
                }
                for (r in 0 until rowsArr.length()) {
                    val row = rowsArr.getJSONObject(r)
                    val date = row.optString("date")
                    val results = row.optJSONObject("results") ?: JSONObject()
                    Row(modifier = Modifier.background(GameColors.Deep).padding(vertical = 9.dp)) {
                        Text(if (date.length >= 10) "${date.substring(8, 10)}/${date.substring(5, 7)}" else date, color = Color(0xFFD1D5DB), fontSize = 11.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.width(64.dp).padding(start = 12.dp))
                        for (i in 0 until marketsArr.length()) {
                            val key = marketsArr.getJSONObject(i).optString("key")
                            val v = results.optString(key, "")
                            Text(if (v.isEmpty() || v == "null") "--" else v, color = if (v.isEmpty() || v == "null") Color(0xFF374151) else GameColors.Champagne, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, fontFamily = FontFamily.Monospace, textAlign = TextAlign.Center, modifier = Modifier.width(82.dp))
                        }
                    }
                }
            }
        }
    }
}
