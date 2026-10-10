package com.example.numberbetting.domain

import android.content.Context
import com.example.numberbetting.data.ApiConfig
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Notifications from the server: the logged-in player's own messages (deposits, withdrawals, wins,
 * refunds, admin messages) plus announcements for everyone. Logged out: announcements only.
 * New ones are shown as phone notifications. Every function here does network work: call it off the main thread.
 */
object NotificationPoller {
    private const val PREFS = "99x_notifications_store"
    @Volatile private var lastPollAt = 0L

    data class Item(
        val id: String, val type: String, val title: String, val body: String,
        val createdAt: String, val unread: Boolean, val personal: Boolean
    )
    data class Result(val items: List<Item>, val unread: Int, val personal: Boolean)

    private fun phoneOf(context: Context): String = AuthManager.getUserPhone(context).filter { it.isDigit() }.takeLast(10)

    private fun loggedIn(context: Context): Boolean =
        phoneOf(context).length == 10 && !AuthManager.getAuthToken(context).isNullOrEmpty()

    private fun request(context: Context, path: String, auth: Boolean, post: Boolean = false): String? {
        for (baseUrl in ApiConfig.getWorkingUrls()) {
            try {
                val conn = URL("$baseUrl$path").openConnection() as HttpURLConnection
                conn.requestMethod = if (post) "POST" else "GET"
                conn.setRequestProperty("Bypass-Tunnel-Reminder", "true")
                if (auth) AuthManager.getAuthToken(context)?.let { conn.setRequestProperty("Authorization", "Bearer $it") }
                conn.connectTimeout = 3000
                conn.readTimeout = 4000
                if (post) {
                    conn.doOutput = true
                    conn.setRequestProperty("Content-Type", "application/json")
                    conn.outputStream.use { it.write("{}".toByteArray()) }
                }
                val code = conn.responseCode
                if (code == 200) return conn.inputStream.bufferedReader().readText()
                if (code == 401 || code == 403) return null
            } catch (e: Exception) { }
        }
        return null
    }

    private fun parse(arr: JSONArray, personalList: Boolean): List<Item> {
        val out = ArrayList<Item>()
        for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            val id = o.optString("id", o.optString("_id", ""))
            if (id.isEmpty()) continue
            out.add(
                Item(
                    id = id,
                    type = o.optString("type", "info"),
                    title = o.optString("title", "Notification"),
                    body = o.optString("body", o.optString("message", "")),
                    createdAt = o.optString("createdAt", ""),
                    unread = personalList && o.optBoolean("unread", false),
                    personal = o.optBoolean("personal", false)
                )
            )
        }
        return out
    }

    /** The list: the player's own + announcements when logged in, announcements only otherwise. */
    fun fetch(context: Context, limit: Int = 50): Result? {
        val text = (if (loggedIn(context)) request(context, "/api/user/notifications?limit=$limit", true) else null)
            ?: request(context, "/api/notifications", false) ?: return null
        val t = text.trim()
        return try {
            when {
                t.startsWith("{") -> {
                    val obj = JSONObject(t)
                    Result(parse(obj.optJSONArray("notifications") ?: JSONArray(), true), obj.optInt("unread", 0), true)
                }
                t.startsWith("[") -> Result(parse(JSONArray(t), false).sortedByDescending { it.createdAt }.take(limit), 0, false)
                else -> null
            }
        } catch (e: Exception) { null }
    }

    /** The player opened the list: everything so far counts as read. */
    fun markSeen(context: Context) {
        if (loggedIn(context)) request(context, "/api/user/notifications/seen", true, post = true)
    }

    /** Shows a phone notification for every message not shown before (at most once every 4 seconds). */
    fun pollAndNotify(context: Context) {
        val now = System.currentTimeMillis()
        if (now - lastPollAt < 4000) return
        lastPollAt = now
        val res = fetch(context, 30) ?: return
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        // First time for this list (new install, or just logged in): don't pop up old messages
        val initKey = if (res.personal) "init_user_${phoneOf(context)}" else "is_initialized"
        val seen = prefs.getStringSet("seen_ids", emptySet())?.toMutableSet() ?: mutableSetOf()
        if (!prefs.getBoolean(initKey, false)) {
            res.items.forEach { seen.add(it.id) }
            prefs.edit().putStringSet("seen_ids", seen).putBoolean(initKey, true).apply()
            return
        }
        var changed = false
        for (n in res.items.reversed()) {
            if (seen.contains(n.id)) continue
            seen.add(n.id)
            changed = true
            NotificationHelper.showNotification(
                context = context,
                notifId = (Math.abs(n.id.hashCode()) % 90000) + 1000,
                title = n.title,
                message = n.body
            )
        }
        if (changed) {
            if (seen.size > 800) seen.retainAll(res.items.map { it.id }.toSet())
            prefs.edit().putStringSet("seen_ids", seen).apply()
        }
    }
}
