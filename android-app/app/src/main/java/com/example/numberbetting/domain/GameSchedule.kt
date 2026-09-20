package com.example.numberbetting.domain

import androidx.compose.runtime.mutableStateMapOf
import java.util.Calendar
import java.util.TimeZone

data class GameScheduleInfo(
    val gameName: String,
    val openTimeStr: String,
    val closeTimeStr: String,
    val resultTimeStr: String,
    val openHour: Int,
    val openMinute: Int,
    val closeHour: Int,
    val closeMinute: Int,
    val resultHour: Int,
    val resultMinute: Int,
    val isEnabled: Boolean = true
)

object GameScheduleManager {
    val istTimeZone: TimeZone = TimeZone.getTimeZone("Asia/Kolkata")

    val schedules = mutableStateMapOf(
        "Shiv Parwati" to GameScheduleInfo(
            gameName = "Shiv Parwati",
            openTimeStr = "04:00 AM IST",
            closeTimeStr = "12:00 PM IST",
            resultTimeStr = "12:40 PM IST",
            openHour = 4, openMinute = 0,
            closeHour = 12, closeMinute = 0,
            resultHour = 12, resultMinute = 40,
            isEnabled = true
        ),
        "Delhi Bazar" to GameScheduleInfo(
            gameName = "Delhi Bazar",
            openTimeStr = "04:00 AM IST",
            closeTimeStr = "02:45 PM IST",
            resultTimeStr = "03:20 PM IST",
            openHour = 4, openMinute = 0,
            closeHour = 14, closeMinute = 45,
            resultHour = 15, resultMinute = 20,
            isEnabled = true
        ),
        "Dubai Market" to GameScheduleInfo(
            gameName = "Dubai Market",
            openTimeStr = "04:00 AM IST",
            closeTimeStr = "04:00 PM IST",
            resultTimeStr = "04:00 PM IST",
            openHour = 4, openMinute = 0,
            closeHour = 16, closeMinute = 0,
            resultHour = 16, resultMinute = 0,
            isEnabled = true
        ),
        "Shree Ganesh" to GameScheduleInfo(
            gameName = "Shree Ganesh",
            openTimeStr = "04:00 AM IST",
            closeTimeStr = "04:30 PM IST",
            resultTimeStr = "04:50 PM IST",
            openHour = 4, openMinute = 0,
            closeHour = 16, closeMinute = 30,
            resultHour = 16, resultMinute = 50,
            isEnabled = true
        ),
        "Faridabad" to GameScheduleInfo(
            gameName = "Faridabad",
            openTimeStr = "04:00 AM IST",
            closeTimeStr = "05:40 PM IST",
            resultTimeStr = "06:20 PM IST",
            openHour = 4, openMinute = 0,
            closeHour = 17, closeMinute = 40,
            resultHour = 18, resultMinute = 20,
            isEnabled = true
        ),
        "Ghaziabad" to GameScheduleInfo(
            gameName = "Ghaziabad",
            openTimeStr = "04:00 AM IST",
            closeTimeStr = "09:30 PM IST",
            resultTimeStr = "10:10 PM IST",
            openHour = 4, openMinute = 0,
            closeHour = 21, closeMinute = 30,
            resultHour = 22, resultMinute = 10,
            isEnabled = true
        ),
        "Gali" to GameScheduleInfo(
            gameName = "Gali",
            openTimeStr = "04:00 AM IST",
            closeTimeStr = "11:30 PM IST",
            resultTimeStr = "11:59 PM IST",
            openHour = 4, openMinute = 0,
            closeHour = 23, closeMinute = 30,
            resultHour = 23, resultMinute = 59,
            isEnabled = true
        ),
        "Desawar" to GameScheduleInfo(
            gameName = "Desawar",
            openTimeStr = "12:00 PM IST",
            closeTimeStr = "04:00 AM IST",
            resultTimeStr = "06:00 AM IST",
            openHour = 12, openMinute = 0,
            closeHour = 4, closeMinute = 0,
            resultHour = 6, resultMinute = 0,
            isEnabled = true
        )
    )

    fun updateDynamicSchedule(name: String, openStr: String, closeStr: String, resultStr: String, isEnabled: Boolean = true) {
        val resolvedKey = when(name) {
            "Disawer" -> "Desawar"
            "Shri Ganesh" -> "Shree Ganesh"
            else -> name
        }
        val targetKey = if (schedules.containsKey(resolvedKey)) resolvedKey else name
        val existing = schedules[targetKey] ?: return
        
        fun parseTimeMinutes(timeStr: String): Pair<Int, Int> {
            val regex = Regex("""(\d{1,2}):(\d{2})\s*(AM|PM)""", RegexOption.IGNORE_CASE)
            val match = regex.find(timeStr) ?: return Pair(0, 0)
            var h = match.groupValues[1].toInt()
            val m = match.groupValues[2].toInt()
            val ampm = match.groupValues[3].uppercase()
            if (ampm == "PM" && h < 12) h += 12
            if (ampm == "AM" && h == 12) h = 0
            return Pair(h, m)
        }

        val openTime = parseTimeMinutes(openStr)
        val closeTime = parseTimeMinutes(closeStr)
        val resultTime = parseTimeMinutes(resultStr)

        schedules[targetKey] = existing.copy(
            openTimeStr = openStr,
            closeTimeStr = closeStr,
            resultTimeStr = resultStr,
            openHour = openTime.first, openMinute = openTime.second,
            closeHour = closeTime.first, closeMinute = closeTime.second,
            resultHour = resultTime.first, resultMinute = resultTime.second,
            isEnabled = isEnabled
        )
    }

    enum class GameState {
        OPEN,             // Betting active
        CLOSED_PENDING,   // Closed, result to be announced soon
        RESULT_DECLARED   // Result uploaded by admin
    }

    fun getGameState(gameName: String, declaredResults: Map<String, Int?>): GameState {
        val resolvedKey = when(gameName) {
            "Disawer" -> "Desawar"
            "Shri Ganesh" -> "Shree Ganesh"
            else -> gameName
        }
        val sched = schedules[resolvedKey] ?: schedules[gameName] ?: return GameState.CLOSED_PENDING
        
        // If manually disabled by Admin, mark as CLOSED immediately
        if (!sched.isEnabled) {
            return GameState.CLOSED_PENDING
        }

        // Always evaluate using Indian Standard Time (Asia/Kolkata)
        val cal = Calendar.getInstance(istTimeZone)
        val currentMinutes = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE)

        val openMinutes = sched.openHour * 60 + sched.openMinute
        val closeMinutes = sched.closeHour * 60 + sched.closeMinute

        val isOpenWindow = if (sched.gameName == "Desawar" || sched.gameName == "Disawer" || closeMinutes < openMinutes) {
            currentMinutes >= openMinutes || currentMinutes < closeMinutes
        } else {
            currentMinutes in openMinutes until closeMinutes
        }

        // 1. If currently in Open Betting Window, the market is OPEN for new bets!
        if (isOpenWindow) {
            return GameState.OPEN
        }

        // 2. If betting window closed, check if Admin declared result
        val altKey = when(gameName) {
            "Desawar" -> "Disawer"
            "Disawer" -> "Desawar"
            "Shree Ganesh" -> "Shri Ganesh"
            "Shri Ganesh" -> "Shree Ganesh"
            else -> gameName
        }
        val hasDeclaredResult = (declaredResults.containsKey(gameName) && declaredResults[gameName] != null) ||
                (declaredResults.containsKey(altKey) && declaredResults[altKey] != null)

        if (hasDeclaredResult) {
            return GameState.RESULT_DECLARED
        }

        // 3. Closed and waiting for Admin to declare result
        return GameState.CLOSED_PENDING
    }

    fun getRemainingMinutesToClose(gameName: String): Int {
        val resolvedKey = when(gameName) {
            "Disawer" -> "Desawar"
            "Shri Ganesh" -> "Shree Ganesh"
            else -> gameName
        }
        val sched = schedules[resolvedKey] ?: schedules[gameName] ?: return -1
        if (!sched.isEnabled) return -1

        val cal = Calendar.getInstance(istTimeZone)
        val currentMinutes = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE)

        val closeMinutes = sched.closeHour * 60 + sched.closeMinute

        var diff = closeMinutes - currentMinutes
        if (diff < 0) {
            diff += 1440
        }
        return diff
    }
}
