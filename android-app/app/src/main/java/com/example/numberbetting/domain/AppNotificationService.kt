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
                    // The player's own messages (deposits, withdrawals, wins, refunds) + announcements
                    NotificationPoller.pollAndNotify(applicationContext)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
                delay(8000) // Poll every 8 seconds
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
    }
}
