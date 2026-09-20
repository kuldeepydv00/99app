package com.example.numberbetting.presentation.navigation

import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.animation.Crossfade
import androidx.compose.ui.platform.LocalContext
import androidx.activity.compose.BackHandler
import android.content.Context
import com.example.numberbetting.domain.NotificationHelper
import com.example.numberbetting.data.ApiConfig
import com.example.numberbetting.domain.AuthManager
import com.example.numberbetting.domain.GameScheduleManager
import com.example.numberbetting.presentation.auth.LoginScreen
import com.example.numberbetting.presentation.auth.RegisterScreen
import com.example.numberbetting.presentation.auth.OtpScreen
import com.example.numberbetting.presentation.home.HomeScreen
import com.example.numberbetting.presentation.betting.BettingScreen
import com.example.numberbetting.presentation.wallet.WalletScreen
import com.example.numberbetting.presentation.history.MyBetsScreen
import com.example.numberbetting.presentation.history.BetItemData
import com.example.numberbetting.presentation.splash.SplashScreen
import com.example.numberbetting.presentation.components.RulesAndRatesDialog
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONArray
import org.json.JSONObject

@Composable
fun AppNavigation() {
    val context = LocalContext.current
    
    var currentScreen by remember { mutableStateOf("splash") }
    var selectedGameTitle by remember { mutableStateOf("Gali") }
    var showRulesDialog by remember { mutableStateOf(false) }
    
    // User credentials state
    var currentUserName by remember { mutableStateOf(AuthManager.getUserName(context)) }
    var currentUserPhone by remember { mutableStateOf(AuthManager.getUserPhone(context)) }
    var tempRegPhone by remember { mutableStateOf("") }

    // Central single-source-of-truth live wallet balance, bonus, commission & declared results
    var userBalance by remember { mutableStateOf(0.00) }
    var userBonus by remember { mutableStateOf(200.00) }
    var userCommission by remember { mutableStateOf(0.00) }
    var isAccountBlocked by remember { mutableStateOf(false) }
    var isAccountDeleted by remember { mutableStateOf(false) }
    var liveWhatsAppNumber by remember { mutableStateOf("917206561420") }
    var declaredResultsMap by remember { mutableStateOf<Map<String, Int?>>(emptyMap()) }
    var livePlayersMap by remember { mutableStateOf<Map<String, Int>>(emptyMap()) }

    // In-App Auto-Update States (Option B)
    var showUpdateDialog by remember { mutableStateOf(false) }
    var updateApkUrl by remember { mutableStateOf("https://newmatkadomain.com/99xmatka.apk") }
    var updateMsg by remember { mutableStateOf("🚀 A new performance update is available! Tap Update now to get the latest features.") }
    var isForceUpdate by remember { mutableStateOf(false) }
    val currentAppVersionCode = try {
        context.packageManager.getPackageInfo(context.packageName, 0).versionCode
    } catch (e: Exception) {
        25
    }
    
    // Shared state list for all placed bets across the app session
    val placedBets = remember {
        mutableStateListOf<BetItemData>()
    }

    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()

    // Intercept mobile system Back button (◁) securely
    val activity = (context as? android.app.Activity)
    BackHandler(enabled = true) {
        if (drawerState.isOpen || drawerState.targetValue == DrawerValue.Open) {
            scope.launch { drawerState.close() }
        } else {
            when (currentScreen) {
                "game" -> activity?.finish()
                "login" -> activity?.finish()
                "register" -> currentScreen = "login"
                "otp" -> currentScreen = "login"
                "splash" -> activity?.finish()
                else -> currentScreen = "game"
            }
        }
    }

    // One-time registration heartbeat on app launch / login session
    LaunchedEffect(currentUserPhone) {
        if (currentUserPhone.length == 10) {
            withContext(Dispatchers.IO) {
                for (baseUrl in ApiConfig.getWorkingUrls()) {
                    try {
                        val regUrl = URL("$baseUrl/api/user/register")
                        val connReg = regUrl.openConnection() as HttpURLConnection
                        connReg.requestMethod = "POST"
                        connReg.setRequestProperty("Content-Type", "application/json")
                        connReg.setRequestProperty("Bypass-Tunnel-Reminder", "true")
                        connReg.connectTimeout = 2000
                        connReg.doOutput = true

                        val rBody = JSONObject().apply {
                            put("name", if (currentUserName.isNotEmpty()) currentUserName else "User")
                            put("mobile", currentUserPhone)
                            put("password", "123")
                        }
                        connReg.outputStream.use { it.write(rBody.toString().toByteArray()) }
                        if (connReg.responseCode in 200..299) {
                            ApiConfig.cachedWorkingUrl = baseUrl
                            break
                        }
                    } catch (e: Exception) { }
                }
            }
        }
    }

    // Live continuous polling for wallet balance & declared results (optimized for smooth 120 FPS)
    LaunchedEffect(Unit) {
        // One-time App Version Update Check on Launch
        withContext(Dispatchers.IO) {
            for (baseUrl in ApiConfig.getWorkingUrls()) {
                try {
                    val vUrl = URL("$baseUrl/api/app/version")
                    val vConn = vUrl.openConnection() as HttpURLConnection
                    vConn.requestMethod = "GET"
                    vConn.setRequestProperty("Bypass-Tunnel-Reminder", "true")
                    vConn.connectTimeout = 2000
                    if (vConn.responseCode == 200) {
                        val vText = vConn.inputStream.bufferedReader().readText()
                        val vObj = JSONObject(vText)
                        val latestCode = vObj.optInt("latestVersionCode", 1)
                        val apk = vObj.optString("apkUrl", "https://newmatkadomain.com/99xmatka.apk")
                        val msg = vObj.optString("updateMessage", "🚀 A new performance update is available! Tap Update now to get the latest features.")
                        val force = vObj.optBoolean("forceUpdate", false)

                        if (latestCode > currentAppVersionCode) {
                            withContext(Dispatchers.Main) {
                                updateApkUrl = apk
                                updateMsg = msg
                                isForceUpdate = force
                                showUpdateDialog = true
                            }
                        }
                        break
                    }
                } catch (e: Exception) { }
            }
        }

        while (true) {
            try {
                withContext(Dispatchers.IO) {
                    // Poll declared results
                    for (baseUrl in ApiConfig.getWorkingUrls()) {
                        try {
                            val resUrl = URL("$baseUrl/api/admin/declared-results")
                            val connRes = resUrl.openConnection() as HttpURLConnection
                            connRes.requestMethod = "GET"
                            connRes.setRequestProperty("Bypass-Tunnel-Reminder", "true")
                            connRes.connectTimeout = 1500
                            if (connRes.responseCode == 200) {
                                ApiConfig.cachedWorkingUrl = baseUrl
                                val resText = connRes.inputStream.bufferedReader().readText()
                                if (resText.trim().startsWith("{")) {
                                    val resJson = JSONObject(resText)
                                    val resultMap = mutableMapOf<String, Int?>()
                                    val keys = resJson.keys()
                                    while (keys.hasNext()) {
                                        val k = keys.next()
                                        resultMap[k] = resJson.optInt(k)
                                    }
                                    withContext(Dispatchers.Main) {
                                        if (declaredResultsMap != resultMap) {
                                            declaredResultsMap = resultMap
                                        }
                                    }
                                    break
                                }
                            }
                        } catch (e: Exception) { }
                    }

                    // Poll game schedules
                    for (baseUrl in ApiConfig.getWorkingUrls()) {
                        try {
                            val schedUrl = URL("$baseUrl/api/admin/schedules")
                            val connSched = schedUrl.openConnection() as HttpURLConnection
                            connSched.requestMethod = "GET"
                            connSched.setRequestProperty("Bypass-Tunnel-Reminder", "true")
                            connSched.connectTimeout = 1500
                            if (connSched.responseCode == 200) {
                                val resText = connSched.inputStream.bufferedReader().readText()
                                if (resText.trim().startsWith("{")) {
                                    val schedJson = org.json.JSONObject(resText)
                                    val keys = schedJson.keys()
                                    while (keys.hasNext()) {
                                        val k = keys.next()
                                        val obj = schedJson.optJSONObject(k)
                                        if (obj != null) {
                                            val o = obj.optString("open", "")
                                            val c = obj.optString("close", "")
                                            val r = obj.optString("result", "")
                                            val isEnabled = obj.optBoolean("enabled", true)
                                            if (o.isNotEmpty() && c.isNotEmpty() && r.isNotEmpty()) {
                                                withContext(Dispatchers.Main) {
                                                    com.example.numberbetting.domain.GameScheduleManager.updateDynamicSchedule(k, o, c, r, isEnabled)
                                                }
                                            }
                                        }
                                    }
                                    break
                                }
                            }
                        } catch (e: Exception) { }
                    }

                    // Poll live players count
                    for (baseUrl in ApiConfig.getWorkingUrls()) {
                        try {
                            val lpUrl = URL("$baseUrl/api/game/live-players")
                            val connLp = lpUrl.openConnection() as HttpURLConnection
                            connLp.requestMethod = "GET"
                            connLp.setRequestProperty("Bypass-Tunnel-Reminder", "true")
                            connLp.connectTimeout = 1500
                            if (connLp.responseCode == 200) {
                                val resText = connLp.inputStream.bufferedReader().readText()
                                if (resText.trim().startsWith("{")) {
                                    val lpJson = JSONObject(resText)
                                    if (lpJson.optBoolean("success") && lpJson.has("data")) {
                                        val dataObj = lpJson.getJSONObject("data")
                                        val map = mutableMapOf<String, Int>()
                                        val keys = dataObj.keys()
                                        while (keys.hasNext()) {
                                            val k = keys.next()
                                            map[k] = dataObj.optInt(k)
                                        }
                                        withContext(Dispatchers.Main) {
                                            livePlayersMap = map
                                        }
                                        break
                                    }
                                }
                            }
                        } catch (e: Exception) { }
                    }

                    // Poll App Settings (WhatsApp number, etc.)
                    for (baseUrl in ApiConfig.getWorkingUrls()) {
                        try {
                            val setUrl = URL("$baseUrl/api/app/settings")
                            val connSet = setUrl.openConnection() as HttpURLConnection
                            connSet.requestMethod = "GET"
                            connSet.setRequestProperty("Bypass-Tunnel-Reminder", "true")
                            connSet.connectTimeout = 1500
                            if (connSet.responseCode == 200) {
                                val resText = connSet.inputStream.bufferedReader().readText()
                                if (resText.trim().startsWith("{")) {
                                    val setJson = JSONObject(resText)
                                    val waNum = setJson.optString("whatsapp_number", "")
                                    if (waNum.isNotEmpty()) {
                                        val cleanWa = waNum.replace("+", "").replace(" ", "").replace("-", "")
                                        withContext(Dispatchers.Main) {
                                            liveWhatsAppNumber = cleanWa
                                        }
                                    }
                                    break
                                }
                            }
                        } catch (e: Exception) { }
                    }

                    // Poll wallet balance & live user name
                    if (currentUserPhone.length >= 10) {
                        for (baseUrl in ApiConfig.getWorkingUrls()) {
                            try {
                                val url = URL("$baseUrl/api/user/wallet/balance?mobile=$currentUserPhone")
                            val conn = url.openConnection() as HttpURLConnection
                            conn.requestMethod = "GET"
                            conn.setRequestProperty("Bypass-Tunnel-Reminder", "true")
                            conn.connectTimeout = 1500
                            if (conn.responseCode == 200) {
                                ApiConfig.cachedWorkingUrl = baseUrl
                                val text = conn.inputStream.bufferedReader().readText()
                                if (text.trim().startsWith("{")) {
                                    val jsonObj = JSONObject(text)
                                    val bal = jsonObj.optDouble("balance", userBalance)
                                    val bon = jsonObj.optDouble("bonus_balance", 0.0)
                                    val comm = jsonObj.optDouble("commission_balance", 0.0)
                                    val serverName = jsonObj.optString("name", "")
                                    val blockedStatus = jsonObj.optBoolean("is_blocked", false) || jsonObj.optBoolean("isBlocked", false)
                                    val deletedStatus = jsonObj.optBoolean("is_deleted", false) || jsonObj.optBoolean("isDeleted", false) || (jsonObj.optString("message", "") == "No Authentication")
                                    withContext(Dispatchers.Main) {
                                        userBalance = bal
                                        userBonus = bon
                                        userCommission = comm
                                        isAccountBlocked = blockedStatus
                                        isAccountDeleted = deletedStatus
                                        if (deletedStatus) {
                                            AuthManager.logout(context)
                                        }
                                        if (serverName.isNotEmpty() && serverName != "User" && currentUserName != serverName) {
                                            currentUserName = serverName
                                            AuthManager.saveUserSession(context, serverName, currentUserPhone)
                                        }
                                    }
                                    break
                                }
                            }
                        } catch (e: Exception) { }
                    }
                    }

                    // Poll user bets history from live cloud server
                    if (currentUserPhone.length >= 10) {
                        for (baseUrl in ApiConfig.getWorkingUrls()) {
                            try {
                                val url = URL("$baseUrl/api/game/my-bets?mobile=$currentUserPhone")
                                val conn = url.openConnection() as HttpURLConnection
                                conn.requestMethod = "GET"
                                conn.setRequestProperty("Bypass-Tunnel-Reminder", "true")
                                conn.connectTimeout = 1500
                                if (conn.responseCode == 200) {
                                    val text = conn.inputStream.bufferedReader().readText()
                                    if (text.trim().startsWith("[")) {
                                        val jsonArr = org.json.JSONArray(text)
                                        val fetchedList = mutableListOf<com.example.numberbetting.presentation.history.BetItemData>()
                                        for (i in 0 until jsonArr.length()) {
                                            val obj = jsonArr.getJSONObject(i)
                                            val rawBType = obj.optString("bet_type", "Jodi")
                                            val rawGame = obj.optString("game_name", "Game")
                                            val cleanGame = rawGame
                                                .replace(" (Jodi)", "")
                                                .replace(" (Crossing)", "")
                                                .replace(" (Ander)", "")
                                                .replace(" (Bahar)", "")
                                                .trim()

                                            val isHaroof = rawBType.contains("HAR", ignoreCase = true) ||
                                                           rawBType.contains("ANDER", ignoreCase = true) ||
                                                           rawBType.contains("BAHAR", ignoreCase = true)

                                            val gName = if (isHaroof) {
                                                if (rawBType.contains("BAHAR", ignoreCase = true) || rawBType.contains("HAROOF_B", ignoreCase = true)) {
                                                    "$cleanGame (Bahar)"
                                                } else {
                                                    "$cleanGame (Ander)"
                                                }
                                            } else if (rawBType.contains("CROSS", ignoreCase = true)) {
                                                "$cleanGame (Crossing)"
                                            } else {
                                                "$cleanGame (Jodi)"
                                            }

                                            fetchedList.add(
                                                com.example.numberbetting.presentation.history.BetItemData(
                                                    id = obj.optString("_id", "bet_$i"),
                                                    gameName = gName,
                                                    number = obj.optInt("number", 0),
                                                    stakeAmount = obj.optDouble("bet_amount", 0.0),
                                                    potentialPayout = obj.optDouble("potential_payout", 0.0),
                                                    status = obj.optString("status", "pending"),
                                                    winAmount = obj.optDouble("win_amount", 0.0),
                                                    timestamp = obj.optString("created_at", "Today")
                                                )
                                            )
                                        }
                                        withContext(Dispatchers.Main) {
                                            placedBets.clear()
                                            placedBets.addAll(fetchedList)
                                        }
                                        break
                                    }
                                }
                            } catch (e: Exception) { }
                        }
                    }

                    // Poll Server Notifications & Declared Results for Instant Push Alerts
                    for (baseUrl in ApiConfig.getWorkingUrls()) {
                        try {
                            val url = URL("$baseUrl/api/notifications")
                            val conn = url.openConnection() as HttpURLConnection
                            conn.requestMethod = "GET"
                            conn.setRequestProperty("Bypass-Tunnel-Reminder", "true")
                            conn.connectTimeout = 1500
                            if (conn.responseCode == 200) {
                                val text = conn.inputStream.bufferedReader().readText()
                                if (text.trim().startsWith("[")) {
                                    val notifArr = JSONArray(text)
                                    val prefs = context.getSharedPreferences("99x_notifications_store", Context.MODE_PRIVATE)
                                    val isInitialized = prefs.getBoolean("is_initialized", false)
                                    val seenSet = prefs.getStringSet("seen_ids", emptySet())?.toMutableSet() ?: mutableSetOf()

                                    if (!isInitialized) {
                                        // On initial launch, mark existing notifications as seen so we don't spam old notifications
                                        for (idx in 0 until notifArr.length()) {
                                            val nObj = notifArr.getJSONObject(idx)
                                            val nId = nObj.optString("id", nObj.optString("_id", ""))
                                            if (nId.isNotEmpty()) seenSet.add(nId)
                                        }
                                        prefs.edit().putStringSet("seen_ids", seenSet).putBoolean("is_initialized", true).apply()
                                    } else {
                                        // Trigger system push notifications for any new announcements
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
                                                    context = context,
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
                        } catch (e: Exception) { }
                    }
                }
            } catch (e: Exception) { }
            delay(4000)
        }
    }

    // Render Splash Screen
    if (currentScreen == "splash") {
        SplashScreen(
            onSplashFinished = {
                val loggedIn = AuthManager.isLoggedIn(context)
                currentScreen = if (loggedIn) "game" else "login"
            }
        )
        return
    }

    // Render Auth Flow without Drawer (Mobile Input -> OTP -> Main Game if old user / Register Info if new user)
    if (currentScreen == "login" || currentScreen == "register" || currentScreen == "otp") {
        when (currentScreen) {
            "login" -> LoginScreen(
                onNavigateToOtp = { phone ->
                    tempRegPhone = phone
                    currentScreen = "otp"
                }
            )
            "otp" -> OtpScreen(
                phone = tempRegPhone,
                onVerifyOtpSuccess = {
                    // Check if mobile number is already registered
                    scope.launch(Dispatchers.IO) {
                        var userExists = false
                        var foundName = ""
                        var foundBal = 0.00
                        val cleanPhone = tempRegPhone.replace("[^0-9]".toRegex(), "").takeLast(10)

                        for (baseUrl in ApiConfig.getWorkingUrls()) {
                            try {
                                val url = URL("$baseUrl/api/user/check?mobile=$cleanPhone")
                                val conn = url.openConnection() as HttpURLConnection
                                conn.requestMethod = "GET"
                                conn.setRequestProperty("Bypass-Tunnel-Reminder", "true")
                                conn.connectTimeout = 10000
                                conn.readTimeout = 10000

                                if (conn.responseCode in 200..299) {
                                    val text = conn.inputStream.bufferedReader().readText()
                                    if (text.trim().startsWith("{")) {
                                        val jsonObj = JSONObject(text)
                                        userExists = jsonObj.optBoolean("exists", false)
                                        val uObj = jsonObj.optJSONObject("user")
                                        if (uObj != null) {
                                            foundName = uObj.optString("name", "")
                                            foundBal = uObj.optDouble("balance", 0.00)
                                        }
                                    }
                                    ApiConfig.cachedWorkingUrl = baseUrl
                                    break
                                }
                            } catch (e: Exception) { }
                        }

                        withContext(Dispatchers.Main) {
                            if (userExists && foundName.isNotEmpty() && !foundName.startsWith("User ")) {
                                // Registered User -> Redirect directly to main game!
                                userBalance = foundBal
                                currentUserName = foundName
                                currentUserPhone = cleanPhone
                                placedBets.clear()
                                AuthManager.saveUserSession(context, foundName, cleanPhone)
                                currentScreen = "game"
                            } else {
                                // New User -> Route to Registration Screen to enter Full Name & Referral Code!
                                currentScreen = "register"
                            }
                        }
                    }
                },
                onBack = { currentScreen = "login" }
            )
            "register" -> RegisterScreen(
                phone = tempRegPhone,
                onRegisterSuccess = { name, email, state, referralCode ->
                    val finalName = if (name.isNotEmpty()) name else "User"
                    currentUserName = finalName
                    currentUserPhone = tempRegPhone
                    placedBets.clear()
                    AuthManager.saveUserSession(context, finalName, tempRegPhone)

                    // Register user on backend (retry up to 3 times with 10s timeout)
                    scope.launch(Dispatchers.IO) {
                        var registered = false
                        repeat(3) { attempt ->
                            if (registered) return@repeat
                            for (baseUrl in ApiConfig.getWorkingUrls()) {
                                if (registered) break
                                try {
                                val regUrl = URL("$baseUrl/api/user/register")
                                val connReg = regUrl.openConnection() as HttpURLConnection
                                connReg.requestMethod = "POST"
                                connReg.setRequestProperty("Content-Type", "application/json")
                                connReg.setRequestProperty("Bypass-Tunnel-Reminder", "true")
                                connReg.connectTimeout = 10000
                                connReg.readTimeout = 10000
                                connReg.doOutput = true

                                val rBody = JSONObject().apply {
                                    put("name", finalName)
                                    put("mobile", tempRegPhone)
                                    put("email", email)
                                    put("state", state)
                                    put("password", "123")
                                    put("referral_code", referralCode)
                                }
                                connReg.outputStream.use { it.write(rBody.toString().toByteArray()) }
                                if (connReg.responseCode in 200..299) {
                                    ApiConfig.cachedWorkingUrl = baseUrl
                                    registered = true
                                    break
                                }
                            } catch (e: Exception) { }
                            }
                        }
                    }

                    currentScreen = "game"
                },
                onBack = { currentScreen = "login" }
            )
        }
        return
    }
    val triggerManualRefresh: () -> Unit = {
        scope.launch(Dispatchers.IO) {
            for (baseUrl in ApiConfig.getWorkingUrls()) {
                try {
                    val url = URL("$baseUrl/api/user/wallet/balance?mobile=$currentUserPhone")
                    val conn = url.openConnection() as HttpURLConnection
                    conn.requestMethod = "GET"
                    conn.setRequestProperty("Bypass-Tunnel-Reminder", "true")
                    conn.connectTimeout = 1500
                    if (conn.responseCode == 200) {
                        ApiConfig.cachedWorkingUrl = baseUrl
                        val text = conn.inputStream.bufferedReader().readText()
                        if (text.trim().startsWith("{")) {
                            val jsonObj = JSONObject(text)
                            val bal = jsonObj.optDouble("balance", userBalance)
                            withContext(Dispatchers.Main) { userBalance = bal }
                            break
                        }
                    }
                } catch (e: Exception) { }
            }
        }
    }

    // Main App Flow with Drawer
    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet(
                drawerContainerColor = androidx.compose.ui.graphics.Color.Transparent
            ) {
                AppDrawerContent(
                    currentRoute = currentScreen,
                    balance = userBalance,
                    userName = currentUserName,
                    userPhone = currentUserPhone,
                    whatsappNumber = liveWhatsAppNumber,
                    onNavigate = { route ->
                        currentScreen = route
                        scope.launch { drawerState.close() }
                    },
                    onOpenRulesDialog = {
                        showRulesDialog = true
                    },
                    onLogout = {
                        AuthManager.clearUserSession(context)
                        currentUserName = ""
                        currentUserPhone = ""
                        userBalance = 0.00
                        placedBets.clear()
                        currentScreen = "login"
                        scope.launch { drawerState.close() }
                    },
                    onCloseDrawer = {
                        scope.launch { drawerState.close() }
                    }
                )
            }
        }
    ) {
        Crossfade(
            targetState = currentScreen,
            modifier = Modifier.fillMaxSize()
        ) { targetScreen ->
            when (targetScreen) {
                "game" -> HomeScreen(
                    balance = userBalance,
                    declaredResults = declaredResultsMap,
                    livePlayers = livePlayersMap,
                    whatsappNumber = liveWhatsAppNumber,
                    onNavigateToBetting = { gameName ->
                        selectedGameTitle = gameName
                        currentScreen = "betting"
                    },
                    onNavigateToWallet = { currentScreen = "wallet" },
                    onNavigateToMyBets = { currentScreen = "my_bets" },
                    onNavigateToChart = { currentScreen = "chart" },
                    onNavigateToReferral = { currentScreen = "referral" },
                    onMenuClick = { scope.launch { drawerState.open() } },
                    onRefresh = triggerManualRefresh
                )
                "betting" -> BettingScreen(
                    gameTitle = selectedGameTitle,
                    userBalance = userBalance,
                    placedBetsList = placedBets,
                    onDeductBalance = { amount ->
                        if (userBalance >= amount) {
                            userBalance -= amount
                        }
                    },
                    onNavigateToWallet = { currentScreen = "wallet" },
                    onBetPlaced = { newBets ->
                        placedBets.addAll(0, newBets)

                        if (newBets.isNotEmpty()) {
                            val betsArray = JSONArray()
                            for (betItem in newBets) {
                                var bType = "Jodi"
                                val fullGName = betItem.gameName
                                if (fullGName.contains("(Jodi)")) {
                                    bType = "Jodi"
                                } else if (fullGName.contains("(Crossing)")) {
                                    bType = "Crossing"
                                } else if (fullGName.contains("(Ander)")) {
                                    bType = "Haroof Ander"
                                } else if (fullGName.contains("(Bahar)")) {
                                    bType = "Haroof Bahar"
                                }

                                val betObj = JSONObject().apply {
                                    put("number", betItem.number)
                                    put("bet_amount", betItem.stakeAmount.toInt())
                                    put("bet_type", bType)
                                }
                                betsArray.put(betObj)
                            }

                            var cleanGameName = newBets.first().gameName
                            cleanGameName = cleanGameName
                                .replace(" (Jodi)", "")
                                .replace(" (Crossing)", "")
                                .replace(" (Ander)", "")
                                .replace(" (Bahar)", "")
                                .trim()

                            val bObj = JSONObject().apply {
                                put("game_name", cleanGameName)
                                put("mobile", currentUserPhone)
                                put("userPhone", currentUserPhone)
                                put("bets", betsArray)
                            }

                            scope.launch(Dispatchers.IO) {
                                for (baseUrl in ApiConfig.getWorkingUrls()) {
                                    try {
                                        val url = URL("$baseUrl/api/game/bet")
                                        val conn = url.openConnection() as HttpURLConnection
                                        conn.requestMethod = "POST"
                                        conn.setRequestProperty("Content-Type", "application/json")
                                        conn.setRequestProperty("Bypass-Tunnel-Reminder", "true")
                                        conn.setRequestProperty("User-Agent", "Mozilla/5.0")
                                        conn.connectTimeout = 5000
                                        conn.readTimeout = 5000
                                        conn.doOutput = true

                                        conn.outputStream.use { it.write(bObj.toString().toByteArray()) }

                                        if (conn.responseCode in 200..299) {
                                            ApiConfig.cachedWorkingUrl = baseUrl
                                            val resText = conn.inputStream.bufferedReader().readText()
                                            if (resText.trim().startsWith("{")) {
                                                val resObj = JSONObject(resText)
                                                val updatedBal = resObj.optDouble("newBalance", -1.0)
                                                if (updatedBal >= 0) {
                                                    withContext(Dispatchers.Main) {
                                                        userBalance = updatedBal
                                                    }
                                                }
                                            }
                                            break
                                        }
                                    } catch (e: Exception) { }
                                }
                            }
                        }
                    },
                    onBack = {
                        currentScreen = "game"
                    }
                )
                "wallet" -> WalletScreen(
                    currentBalance = userBalance,
                    userName = currentUserName,
                    userPhone = currentUserPhone,
                    commission = userCommission,
                    bonus = userBonus,
                    onBalanceChange = { newBal ->
                        userBalance = newBal
                        // Sync balance change to backend store
                        scope.launch(Dispatchers.IO) {
                            for (baseUrl in ApiConfig.getWorkingUrls()) {
                                try {
                                    val url = URL("$baseUrl/api/user/wallet/balance")
                                    val conn = url.openConnection() as HttpURLConnection
                                    conn.requestMethod = "POST"
                                    conn.setRequestProperty("Content-Type", "application/json")
                                    conn.setRequestProperty("Bypass-Tunnel-Reminder", "true")
                                    conn.setRequestProperty("User-Agent", "Mozilla/5.0")
                                    conn.connectTimeout = 1500
                                    conn.doOutput = true
                                    val body = JSONObject().apply {
                                        put("amount", newBal)
                                        put("mobile", currentUserPhone)
                                    }
                                    conn.outputStream.use { it.write(body.toString().toByteArray()) }
                                    if (conn.responseCode in 200..299) {
                                        ApiConfig.cachedWorkingUrl = baseUrl
                                        break
                                    }
                                } catch (e: Exception) { }
                            }
                        }
                    },
                    onBack = { currentScreen = "game" },
                    onRefresh = triggerManualRefresh
                )
                "referral", "refer", "share" -> com.example.numberbetting.presentation.referral.ReferralScreen(
                    userBalance = userBalance,
                    onOpenDrawer = { scope.launch { drawerState.open() } },
                    onNavigateToWallet = { currentScreen = "wallet" },
                    onNavigateToHome = { currentScreen = "game" }
                )
                "history", "my_bets", "profile" -> MyBetsScreen(
                    placedBetsList = placedBets.toList(),
                    onBack = { currentScreen = "game" },
                    onRefresh = triggerManualRefresh
                )
                "chart" -> com.example.numberbetting.presentation.chart.ChartsScreen(
                    onNavigateToHome = { currentScreen = "game" },
                    onNavigateToBetting = { gameName ->
                        selectedGameTitle = gameName
                        currentScreen = "betting"
                    },
                    onNavigateToWallet = { currentScreen = "wallet" },
                    onNavigateToMyBets = { currentScreen = "my_bets" },
                    onNavigateToReferral = { currentScreen = "referral" },
                    whatsappNumber = liveWhatsAppNumber,
                    onBack = { currentScreen = "game" }
                )
                else -> HomeScreen(
                    balance = userBalance,
                    declaredResults = declaredResultsMap,
                    livePlayers = livePlayersMap,
                    whatsappNumber = liveWhatsAppNumber,
                    onNavigateToBetting = { gameName ->
                        selectedGameTitle = gameName
                        currentScreen = "betting"
                    },
                    onNavigateToWallet = { currentScreen = "wallet" },
                    onNavigateToMyBets = { currentScreen = "my_bets" },
                    onNavigateToChart = { currentScreen = "chart" },
                    onMenuClick = { scope.launch { drawerState.open() } },
                    onRefresh = triggerManualRefresh
                )
            }
        }

        // In-App Auto-Update Popup (Option B)
        if (showUpdateDialog) {
            AlertDialog(
                onDismissRequest = { if (!isForceUpdate) showUpdateDialog = false },
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("🚀 ", fontSize = 22.sp)
                        Text("App Update Available", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    }
                },
                text = {
                    Text(updateMsg, color = Color.LightGray, fontSize = 14.sp)
                },
                confirmButton = {
                    Button(
                        onClick = {
                            try {
                                val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(updateApkUrl))
                                intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                                context.startActivity(intent)
                            } catch (e: Exception) { }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4F46E5))
                    ) {
                        Text("UPDATE NOW 📥", color = Color.White, fontWeight = FontWeight.Bold)
                    }
                },
                dismissButton = {
                    if (!isForceUpdate) {
                        TextButton(onClick = { showUpdateDialog = false }) {
                            Text("Later", color = Color.Gray)
                        }
                    }
                },
                containerColor = Color(0xFF1E2638),
                shape = RoundedCornerShape(20.dp)
            )
        }

        // Full-screen "No Authentication" view when account is deleted
        if (isAccountDeleted) {
            Surface(
                modifier = Modifier.fillMaxSize(),
                color = Color(0xFF0F172A)
            ) {
                Box(
                    modifier = Modifier.fillMaxSize().padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Text(
                            text = "🔐",
                            fontSize = 64.sp
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "No Authentication",
                            color = Color.White,
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "Your account has been deleted or unauthenticated. All historical data was wiped clean. Please register or log in with a new ID to start fresh.",
                            color = Color(0xFF94A3B8),
                            fontSize = 14.sp,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                            lineHeight = 20.sp
                        )
                        Spacer(modifier = Modifier.height(28.dp))
                        Button(
                            onClick = {
                                AuthManager.logout(context)
                                isAccountDeleted = false
                                isAccountBlocked = false
                                currentUserName = ""
                                currentUserPhone = ""
                                userBalance = 0.0
                                userBonus = 200.0
                                userCommission = 0.0
                                currentScreen = "login"
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFDC2626)),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("Re-Register / Log In", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        }
                    }
                }
            }
        }

        // Full-screen "No Internet Connection" overlay when user is blocked
        if (isAccountBlocked && !isAccountDeleted) {
            Surface(
                modifier = Modifier.fillMaxSize(),
                color = Color(0xFF0F172A)
            ) {
                Box(
                    modifier = Modifier.fillMaxSize().padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Text(
                            text = "📡",
                            fontSize = 64.sp
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "No Internet Connection",
                            color = Color.White,
                            fontSize = 24.sp,
                            fontWeight = FontWeight.Bold,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Text(
                            text = "Please check your network connection and try again. Retrying connection automatically...",
                            color = Color(0xFF94A3B8),
                            fontSize = 14.sp,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                            lineHeight = 20.sp
                        )
                        Spacer(modifier = Modifier.height(24.dp))
                        CircularProgressIndicator(
                            color = Color(0xFF38BDF8),
                            modifier = Modifier.size(36.dp)
                        )
                    }
                }
            }
        }

        // Rules & Payout Rates Modal Dialog
        if (showRulesDialog) {
            RulesAndRatesDialog(
                onDismiss = { showRulesDialog = false }
            )
        }
    }
}
