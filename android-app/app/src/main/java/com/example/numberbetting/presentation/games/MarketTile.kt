package com.example.numberbetting.presentation.games

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** What a market tile shows under its name. */
sealed class TileState {
    /** Betting open. [note] e.g. "Closes 5:40 PM". */
    data class Open(val note: String? = null) : TileState()
    /** Betting open and closing soon. [note] e.g. "12 min left". */
    data class Urgent(val note: String) : TileState()
    /** Betting closed. [result] is today's number if declared; [note] is the result time. */
    data class Closed(val result: String?, val note: String? = null) : TileState()
}

/** "05:40 PM IST" -> "5:40 PM" */
fun shortTime(t: String?): String =
    (t ?: "").replace(Regex("\\s*IST\\s*$", RegexOption.IGNORE_CASE), "").replace(Regex("^0(\\d:)"), "$1").trim()

/**
 * Lays [items] out as a grid of equal-height square-ish tiles, [columns] per row,
 * matching the Trading tiles. Short last rows keep their tile width.
 */
@Composable
fun <T> TileGrid(items: List<T>, columns: Int = 3, spacing: Dp = 10.dp, tile: @Composable (item: T, modifier: Modifier) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(spacing), modifier = Modifier.fillMaxWidth()) {
        items.chunked(columns).forEach { row ->
            Row(
                modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min),
                horizontalArrangement = Arrangement.spacedBy(spacing)
            ) {
                row.forEach { item -> tile(item, Modifier.weight(1f).fillMaxHeight()) }
                repeat(columns - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
}

/** One market box for the Matka and 99x Matka home grids. */
@Composable
fun MarketTile(
    icon: String,
    name: String,
    sub: String?,
    state: TileState,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    rose: Boolean = false,
    cta: String = "PLAY"
) {
    val closed = state is TileState.Closed
    val accent = if (rose) GameColors.Rose else GameColors.Gold
    val topTint = when {
        closed -> Color.White.copy(alpha = 0.04f)
        rose -> GameColors.Rose.copy(alpha = 0.20f)
        else -> Color(0xFF1E5C46).copy(alpha = 0.6f)
    }
    val shape = RoundedCornerShape(18.dp)

    Column(
        modifier = modifier
            .clip(shape)
            .background(Brush.verticalGradient(listOf(topTint, GameColors.Deep)))
            .border(1.dp, accent.copy(alpha = if (rose) 0.30f else 0.25f), shape)
            .clickable { onClick() }
            .padding(start = 7.dp, end = 7.dp, top = 13.dp, bottom = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // visual
        Box(
            modifier = Modifier
                .size(44.dp)
                .alpha(if (closed) 0.7f else 1f)
                .clip(RoundedCornerShape(12.dp))
                .background(Brush.linearGradient(if (rose) listOf(Color(0xFF2A2320), GameColors.Deep) else listOf(GameColors.Surface2, GameColors.Deep)))
                .border(1.dp, accent.copy(alpha = if (rose) 0.6f else 0.5f), RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center
        ) {
            if (rose) Text(icon, color = GameColors.Ivory, fontSize = 13.sp, fontWeight = FontWeight.Black)
            else Text(icon, fontSize = 20.sp)
        }

        // name in a fixed two-line box so every tile lines up
        Box(modifier = Modifier.fillMaxWidth().padding(top = 8.dp).height(32.dp), contentAlignment = Alignment.Center) {
            Text(
                name, color = Color.White, fontSize = 12.5.sp, fontWeight = FontWeight.ExtraBold,
                lineHeight = 14.sp, maxLines = 2, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center
            )
        }
        if (!sub.isNullOrEmpty()) {
            Text(sub, color = GameColors.Muted, fontSize = 9.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
        }

        // status
        Spacer(Modifier.height(6.dp))
        when (state) {
            is TileState.Open -> TilePill("OPEN", GameColors.Emerald, GameColors.Emerald.copy(alpha = 0.15f), dot = true)
            is TileState.Urgent -> TilePill(state.note.uppercase(), GameColors.Champagne, GameColors.Gold.copy(alpha = 0.2f), dot = true)
            is TileState.Closed -> TilePill("CLOSED", Color(0xFFD1D5DB), Color.White.copy(alpha = 0.1f), dot = false)
        }
        if (state is TileState.Open && !state.note.isNullOrEmpty()) {
            Text(state.note, color = GameColors.Muted, fontSize = 9.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 4.dp))
        }

        // footer, pinned to the bottom of the tile
        Spacer(Modifier.weight(1f))
        Spacer(Modifier.height(8.dp))
        val footer = Modifier.fillMaxWidth().height(28.dp).clip(RoundedCornerShape(9.dp))
        when (state) {
            is TileState.Closed -> if (!state.result.isNullOrEmpty()) {
                Row(
                    modifier = footer.background(GameColors.Deep).border(1.dp, GameColors.Gold.copy(alpha = 0.4f), RoundedCornerShape(9.dp)),
                    horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Result ", color = Color(0xFF9CA3AF), fontSize = 9.sp, fontWeight = FontWeight.Bold)
                    Text(state.result, color = GameColors.Champagne, fontSize = 14.sp, fontWeight = FontWeight.Black, fontFamily = FontFamily.Monospace)
                }
            } else {
                Box(
                    modifier = footer.background(GameColors.Amber.copy(alpha = 0.1f)).border(1.dp, GameColors.Amber.copy(alpha = 0.3f), RoundedCornerShape(9.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(if (state.note.isNullOrEmpty()) "PENDING" else "RESULT ${state.note}", color = GameColors.Amber, fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, maxLines = 1)
                }
            }
            else -> Box(modifier = footer.background(if (rose) RoseGradient else GoldGradient), contentAlignment = Alignment.Center) {
                Text("$cta →", color = GameColors.Deep, fontSize = 10.5.sp, fontWeight = FontWeight.Black, letterSpacing = 1.sp)
            }
        }
    }
}

@Composable
private fun TilePill(text: String, fg: Color, bg: Color, dot: Boolean) {
    Row(
        modifier = Modifier.clip(RoundedCornerShape(50)).background(bg).padding(horizontal = 7.dp, vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (dot) {
            Box(Modifier.size(5.dp).clip(CircleShape).background(fg))
            Spacer(Modifier.width(4.dp))
        }
        Text(text, color = fg, fontSize = 9.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.5.sp, maxLines = 1)
    }
}
