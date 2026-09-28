package com.example.numberbetting.presentation.games

import android.content.Context
import com.example.numberbetting.data.ApiConfig
import com.example.numberbetting.domain.AuthManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class GamesApiException(message: String) : Exception(message)

/** Calls to the /api/games endpoints (99x Matka + Number / Card / Colour Trading). Sends the login token on every call. */
object GamesApi {

    suspend fun get(context: Context, path: String): JSONObject =
        withContext(Dispatchers.IO) { request(context, "GET", path, null) }

    suspend fun post(context: Context, path: String, body: JSONObject): JSONObject =
        withContext(Dispatchers.IO) { request(context, "POST", path, body) }

    private fun request(context: Context, method: String, path: String, body: JSONObject?): JSONObject {
        for (base in ApiConfig.getWorkingUrls()) {
            try {
                val conn = URL(base + path).openConnection() as HttpURLConnection
                conn.requestMethod = method
                conn.connectTimeout = 6000
                conn.readTimeout = 8000
                conn.setRequestProperty("Accept", "application/json")
                conn.setRequestProperty("Bypass-Tunnel-Reminder", "true")
                conn.setRequestProperty("User-Agent", "Mozilla/5.0")
                val token = AuthManager.getAuthToken(context)
                if (token != null) conn.setRequestProperty("Authorization", "Bearer $token")
                if (body != null) {
                    conn.doOutput = true
                    conn.setRequestProperty("Content-Type", "application/json")
                    conn.outputStream.use { it.write(body.toString().toByteArray()) }
                }
                val code = conn.responseCode
                val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                val text = stream?.bufferedReader()?.readText() ?: ""
                val json = if (text.trim().startsWith("{")) JSONObject(text) else JSONObject()
                if (code == 401) throw GamesApiException("Please log in again to place bets.")
                if (code !in 200..299 || !json.optBoolean("success", true)) {
                    throw GamesApiException(json.optString("message", "Request failed ($code)"))
                }
                ApiConfig.cachedWorkingUrl = base
                return json
            } catch (e: GamesApiException) {
                throw e
            } catch (e: Exception) {
                // network problem with this base URL: try the next one
            }
        }
        throw GamesApiException("Network error. Check your connection.")
    }
}

/** Keeps countdowns in step with the server clock (phone clocks can be minutes off). */
object ServerClock {
    @Volatile
    var offsetMs: Long = 0L

    fun sync(serverTime: Long) {
        if (serverTime > 0) offsetMs = serverTime - System.currentTimeMillis()
    }

    fun now(): Long = System.currentTimeMillis() + offsetMs
}
