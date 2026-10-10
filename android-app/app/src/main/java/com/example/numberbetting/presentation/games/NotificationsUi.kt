package com.example.numberbetting.presentation.games

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.example.numberbetting.domain.NotificationPoller
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

private val NBg = Color(0xFF1A2C38)
private val NRow = Color(0xFF0F212E)
private val NRowNew = Color(0xFF213443)
private val NText = Color(0xFFB1BAD3)
private val NDim = Color(0xFF5F7487)
private val NBlue = Color(0xFF2B7FF5)

private fun iconFor(type: String): String = when (type) {
    "deposit" -> "💰"
    "withdrawal" -> "🏦"
    "refund" -> "↩️"
    "win" -> "🏆"
    "wallet" -> "👛"
    "admin", "CUSTOM_BROADCAST" -> "📣"
    "RESULT_ANNOUNCED" -> "🎯"
    else -> "🔔"
}

private fun whenText(iso: String): String {
    return try {
        val inFmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
        val d = inFmt.parse(iso.take(19)) ?: return ""
        SimpleDateFormat("d MMM, h:mm a", Locale("en", "IN")).apply { timeZone = TimeZone.getTimeZone("Asia/Kolkata") }.format(d)
    } catch (e: Exception) { "" }
}

/** The player's notifications (opened from the menu). Opening it marks everything as read. */
@Composable
fun NotificationsDialog(onDismiss: () -> Unit) {
    val context = LocalContext.current
    var res by remember { mutableStateOf<NotificationPoller.Result?>(null) }
    var loading by remember { mutableStateOf(true) }
    LaunchedEffect(Unit) {
        val r = withContext(Dispatchers.IO) { NotificationPoller.fetch(context, 60) }
        res = r
        loading = false
        if (r != null && r.personal && r.unread > 0) withContext(Dispatchers.IO) { NotificationPoller.markSeen(context) }
    }
    Dialog(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(18.dp))
                .background(NBg)
                .padding(16.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("🔔", fontSize = 18.sp)
                Spacer(Modifier.width(8.dp))
                Text("Notifications", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                Text("✕", color = NText, fontSize = 18.sp, modifier = Modifier.clickable { onDismiss() }.padding(6.dp))
            }
            Spacer(Modifier.width(1.dp))
            val items = res?.items.orEmpty()
            when {
                loading -> Text("Loading…", color = NText, fontSize = 13.sp, modifier = Modifier.padding(vertical = 28.dp).align(Alignment.CenterHorizontally))
                items.isEmpty() -> Text(
                    "No notifications yet. Deposits, withdrawals, wins and announcements will show here.",
                    color = NText, fontSize = 13.sp, modifier = Modifier.padding(vertical = 28.dp)
                )
                else -> LazyColumn(
                    modifier = Modifier.heightIn(max = 520.dp).padding(top = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(items, key = { it.id }) { n ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (n.unread) NRowNew else NRow)
                                .padding(12.dp)
                        ) {
                            Box(
                                modifier = Modifier.size(34.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.08f)),
                                contentAlignment = Alignment.Center
                            ) { Text(iconFor(n.type), fontSize = 16.sp) }
                            Spacer(Modifier.width(10.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Text(n.title, color = Color.White, fontSize = 13.5.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                                    if (n.unread) Box(Modifier.size(8.dp).clip(CircleShape).background(NBlue))
                                }
                                if (n.body.isNotEmpty()) Text(n.body, color = NText, fontSize = 12.5.sp, lineHeight = 17.sp, modifier = Modifier.padding(top = 2.dp))
                                Text(
                                    whenText(n.createdAt) + if (!n.personal && res?.personal == true) " · For everyone" else "",
                                    color = NDim, fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
