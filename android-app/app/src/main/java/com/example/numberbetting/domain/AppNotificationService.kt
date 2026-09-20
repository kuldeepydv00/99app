package com.example.numberbetting.domain

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.example.numberbetting.R
import com.example.numberbetting.data.ApiConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONArray
import java.net.HttpURLConnection
import java.net.URL

class AppNotificationService : Service() {

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val SERVICE_NOTIF_ID = 95001
    private val SERVICE_CHANNEL_ID = "app_service_channel_v1"

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    override fun onCreate() {
        super.onCreate()
        createForegroundChannel()
        startServiceForeground()
        startPollingLoop()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startServiceForeground()
        return START_STICKY
    }

    private fun createForegroundChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                SERVICE_CHANNEL_ID,
                "99xmatka Background Service",
                NotificationManager.IMPORTANCE_MIN
            ).apply {
                description = "Keeps background notification service running for instant result alerts"
                setShowBadge(false)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            manager?.createNotificationChannel(channel)
        }
    }

    private fun startServiceForeground() {
        val builder = NotificationCompat.Builder(this, SERVICE_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle("99xmatka")
            .setContentText("Live Notification Service Active")
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setOngoing(true)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(SERVICE_NOTIF_ID, builder.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
            } else {
                startForeground(SERVICE_NOTIF_ID, builder.build())
            }
        } else {
            startForeground(SERVICE_NOTIF_ID, builder.build())
        }
    }

    private fun startPollingLoop() {
        serviceScope.launch {
            while (isActive) {
                try {
                    for (baseUrl in ApiConfig.getWorkingUrls()) {
                        try {
                            val url = URL("$baseUrl/api/notifications")
                            val conn = url.openConnection() as HttpURLConnection
                            conn.requestMethod = "GET"
                            conn.setRequestProperty("Bypass-Tunnel-Reminder", "true")
                            conn.connectTimeout = 3000
                            conn.readTimeout = 3000

                            if (conn.responseCode == 200) {
                                val text = conn.inputStream.bufferedReader().readText()
                                if (text.trim().startsWith("[")) {
                                    val notifArr = JSONArray(text)
                                    val prefs = getSharedPreferences("99x_notifications_store", Context.MODE_PRIVATE)
                                    val isInitialized = prefs.getBoolean("is_initialized", false)
                                    val seenSet = prefs.getStringSet("seen_ids", emptySet())?.toMutableSet() ?: mutableSetOf()

                                    if (!isInitialized) {
                                        for (idx in 0 until notifArr.length()) {
                                            val nObj = notifArr.getJSONObject(idx)
                                            val nId = nObj.optString("id", nObj.optString("_id", ""))
                                            if (nId.isNotEmpty()) seenSet.add(nId)
                                        }
                                        prefs.edit().putStringSet("seen_ids", seenSet).putBoolean("is_initialized", true).apply()
                                    } else {
                                        var hasNew = false
                                        for (idx in 0 until notifArr.length()) {
                                            val nObj = notifArr.getJSONObject(idx)
                                            val nId = nObj.optString("id", nObj.optString("_id", ""))
                                            val nTitle = nObj.optString("title", "🚀 Game Result Announced!")
                                            val nBody = nObj.optString("body", "")

                                            if (nId.isNotEmpty() && !seenSet.contains(nId)) {
                                                seenSet.add(nId)
                                                hasNew = true
                                                val intNotifId = (Math.abs(nId.hashCode()) % 90000) + 1000
                                                NotificationHelper.showNotification(
                                                    context = applicationContext,
                                                    notifId = intNotifId,
                                                    title = nTitle,
                                                    message = nBody
                                                )
                                            }
                                        }
                                        if (hasNew) {
                                            prefs.edit().putStringSet("seen_ids", seenSet).apply()
                                        }
                                    }
                                    break
                                }
                            }
                        } catch (e: Exception) {
                            // Try next fallback url if needed
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
                delay(5000) // Poll every 5 seconds
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
    }
}
