package com.example.numberbetting.presentation.wallet

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.numberbetting.data.ApiConfig
import com.example.numberbetting.domain.LanguageManager
import com.example.numberbetting.presentation.theme.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject
import org.json.JSONArray

import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import kotlinx.coroutines.withContext
import com.example.numberbetting.presentation.components.MoneyDoodleBackground

import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState
import kotlinx.coroutines.delay

data class WalletTransaction(
    val id: String,
    val type: String,
    val title: String,
    val subtitle: String,
    val amount: Double,
    val isCredit: Boolean,
    val status: String,
    val date: String
)

fun generateQrCodeBitmap(content: String, size: Int = 512): android.graphics.Bitmap? {
    return try {
        if (content.isEmpty()) return null
        val hints = mapOf(com.google.zxing.EncodeHintType.MARGIN to 1)
        val bitMatrix = com.google.zxing.qrcode.QRCodeWriter().encode(
            content,
            com.google.zxing.BarcodeFormat.QR_CODE,
            size,
            size,
            hints
        )
        val width = bitMatrix.width
        val height = bitMatrix.height
        val bmp = android.graphics.Bitmap.createBitmap(width, height, android.graphics.Bitmap.Config.RGB_565)
        for (x in 0 until width) {
            for (y in 0 until height) {
                bmp.setPixel(x, y, if (bitMatrix.get(x, y)) android.graphics.Color.BLACK else android.graphics.Color.WHITE)
            }
        }
        bmp
    } catch (e: Exception) {
        null
    }
}

@OptIn(ExperimentalMaterialApi::class)
@Composable
fun WalletScreen(
    currentBalance: Double = 0.00,
    userName: String = "User",
    userPhone: String = "",
    onBalanceChange: (Double) -> Unit = {},
    commission: Double = 0.00,
    bonus: Double = 0.00,
    onBack: () -> Unit = {},
    onRefresh: () -> Unit = {}
) {
    var showDepositDialog by remember { mutableStateOf(false) }
    var showWithdrawDialog by remember { mutableStateOf(false) }
    var showSetupBankDialog by remember { mutableStateOf(false) }
    var isEditBankMode by remember { mutableStateOf(false) }
    var showConfirmWithdrawDialog by remember { mutableStateOf(false) }
    var pendingWithdrawAmount by remember { mutableStateOf(0.0) }
    var showAllTransactionsDialog by remember { mutableStateOf(false) }
    var depositError by remember { mutableStateOf("") }
    var withdrawError by remember { mutableStateOf("") }
    var setupBankError by remember { mutableStateOf("") }
    var statusNotification by remember { mutableStateOf("") }
    var transactions by remember { mutableStateOf<List<WalletTransaction>>(emptyList()) }
    var isRefreshing by remember { mutableStateOf(false) }

    // Saved Bank Account States
    var savedAccountName by remember { mutableStateOf("") }
    var savedAccountNumber by remember { mutableStateOf("") }
    var savedIfscCode by remember { mutableStateOf("") }
    var savedBankName by remember { mutableStateOf("Bank Account") }
    var hasSavedBankDetails by remember { mutableStateOf(false) }

    val scope = rememberCoroutineScope()
    val context = androidx.compose.ui.platform.LocalContext.current

    val fetchBankDetails: suspend () -> Unit = {
        if (userPhone.isNotEmpty()) {
            withContext(Dispatchers.IO) {
                try {
                    val mobile = userPhone.replace(Regex("[^0-9]"), "").takeLast(10)
                    for (baseUrl in ApiConfig.getWorkingUrls()) {
                        try {
                            val url = URL("$baseUrl/api/user/bank-details?mobile=$mobile")
                            val conn = url.openConnection() as HttpURLConnection
                            conn.requestMethod = "GET"
                            conn.connectTimeout = 3000
                            conn.setRequestProperty("Bypass-Tunnel-Reminder", "true")
                            conn.setRequestProperty("User-Agent", "Mozilla/5.0")
                            if (conn.responseCode in 200..299) {
                                val resp = conn.inputStream.bufferedReader().readText()
                                val json = JSONObject(resp)
                                if (json.optBoolean("has_saved_bank_details", false)) {
                                    val detailsObj = json.optJSONObject("bank_details")
                                    if (detailsObj != null) {
                                        val accName = detailsObj.optString("account_holder_name", "")
                                        val accNum = detailsObj.optString("account_number", "")
                                        val ifsc = detailsObj.optString("ifsc_code", "")
                                        val bName = detailsObj.optString("bank_name", "Bank Account")
                                        withContext(Dispatchers.Main) {
                                            savedAccountName = accName
                                            savedAccountNumber = accNum
                                            savedIfscCode = ifsc
                                            savedBankName = bName
                                            hasSavedBankDetails = true
                                        }
                                    }
                                }
                                break
                            }
                        } catch (_: Exception) { }
                    }
                } catch (_: Exception) { }
            }
        }
    }

    val fetchTransactions: suspend () -> Unit = {
        if (userPhone.isNotEmpty()) {
            withContext(Dispatchers.IO) {
                try {
                    val mobile = userPhone.replace(Regex("[^0-9]"), "").takeLast(10)
                    val url = URL("${ApiConfig.BASE_URL}/api/user/wallet/transactions?mobile=$mobile")
                    val conn = url.openConnection() as HttpURLConnection
                    conn.requestMethod = "GET"
                    conn.connectTimeout = 5000
                    val resp = conn.inputStream.bufferedReader().readText()
                    val arr = JSONArray(resp)
                    val list = mutableListOf<WalletTransaction>()
                    for (i in 0 until arr.length()) {
                        val o = arr.getJSONObject(i)
                        var dStr = o.optString("date", "")
                        if (dStr.isEmpty()) {
                            val ts = o.optLong("timestamp", 0L)
                            if (ts > 0) {
                                val outFmt = java.text.SimpleDateFormat("dd/MM/yyyy hh:mm a", java.util.Locale.getDefault()).apply {
                                    timeZone = java.util.TimeZone.getTimeZone("Asia/Kolkata")
                                }
                                dStr = outFmt.format(java.util.Date(ts))
                            }
                        }
                        list.add(WalletTransaction(
                            id = o.optString("id", "$i"),
                            type = o.optString("type", ""),
                            title = o.optString("title", ""),
                            subtitle = o.optString("subtitle", ""),
                            amount = o.optDouble("amount", 0.0),
                            isCredit = o.optBoolean("isCredit", true),
                            status = o.optString("status", ""),
                            date = dStr
                        ))
                    }
                    withContext(Dispatchers.Main) { transactions = list }
                } catch (e: Exception) { }
            }
        }
    }

    val pullRefreshState = rememberPullRefreshState(
        refreshing = isRefreshing,
        onRefresh = {
            isRefreshing = true
            onRefresh()
            scope.launch {
                fetchBankDetails()
                fetchTransactions()
                delay(1000)
                isRefreshing = false
            }
        }
    )

    // Fetch transactions & saved bank details on open
    LaunchedEffect(userPhone) {
        fetchBankDetails()
        fetchTransactions()
    }

    MoneyDoodleBackground {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .pullRefresh(pullRefreshState)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(18.dp)
            ) {
            // Top Bar Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) {
                    Text("←", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                }
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = LanguageManager.getText("Wallet", "वॉलेट"),
                    color = Color.White,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.5.sp
                )
            }
            IconButton(
                onClick = {
                    onRefresh()
                    android.widget.Toast.makeText(context, "Refreshing wallet balance...", android.widget.Toast.LENGTH_SHORT).show()
                }
            ) {
                Text("🔄", fontSize = 18.sp)
            }
        }

        if (statusNotification.isNotEmpty()) {
            Spacer(modifier = Modifier.height(10.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(AccentEmerald.copy(alpha = 0.15f), RoundedCornerShape(12.dp))
                    .border(1.dp, AccentEmerald, RoundedCornerShape(12.dp))
                    .padding(12.dp)
            ) {
                Text(statusNotification, color = AccentEmerald, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // Main Professional Wallet Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(24.dp),
            colors = CardDefaults.cardColors(containerColor = Color.Transparent)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(
                                Color(0xFF1E2638),
                                Color(0xFF131924)
                            )
                        )
                    )
                    .border(1.dp, SurfaceBorder, RoundedCornerShape(24.dp))
                    .padding(24.dp)
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Balance Text
                    val formattedWallet = if (currentBalance < 0) {
                        "-₹ " + String.format("%,.2f", Math.abs(currentBalance))
                    } else if (currentBalance >= 10000 && currentBalance % 1.0 == 0.0) {
                        "₹ " + String.format("%,d", currentBalance.toLong())
                    } else {
                        "₹ " + String.format("%,.2f", currentBalance)
                    }

                    Text(
                        text = formattedWallet,
                        color = if (currentBalance < 0) Color(0xFFFF6B6B) else Color.White,
                        fontSize = if (Math.abs(currentBalance) >= 100000) 28.sp else 34.sp,
                        fontWeight = FontWeight.ExtraBold,
                        fontFamily = FontFamily.Monospace,
                        maxLines = 1,
                        softWrap = false
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = if (currentBalance < 0) LanguageManager.getText("Negative Balance (Settles upon deposit)", "नेगेटिव बैलेंस (डिपॉजिट पर सेटल होगा)")
                               else LanguageManager.getText("Available Balance", "उपलब्ध बैलेंस"),
                        color = if (currentBalance < 0) Color(0xFFFF6B6B) else TextSecondary,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Medium
                    )

                    Spacer(modifier = Modifier.height(26.dp))

                    // Commission & Bonus Metrics Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceAround
                    ) {
                        // Commission
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = LanguageManager.getText("COMMISSION", "कमिशन"),
                                color = TextMuted,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "₹ ${String.format("%.2f", commission)}",
                                color = Color.White,
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace
                            )
                        }

                        // Divider
                        Box(
                            modifier = Modifier
                                .height(32.dp)
                                .width(1.dp)
                                .background(SurfaceBorder)
                        )

                        // Bonus
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = LanguageManager.getText("BONUS", "बोनस"),
                                color = TextMuted,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = "₹ ${String.format("%.2f", bonus)}",
                                color = AccentEmerald,
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }

                    var isTransferring by remember { mutableStateOf(false) }
                    var transferMsg by remember { mutableStateOf("") }

                    Spacer(modifier = Modifier.height(14.dp))
                    Button(
                        onClick = {
                            if (!isTransferring && userPhone.isNotEmpty()) {
                                if (commission <= 0) {
                                    transferMsg = "⚠️ No commission balance available to transfer."
                                    return@Button
                                }
                                isTransferring = true
                                transferMsg = ""
                                scope.launch(Dispatchers.IO) {
                                    try {
                                        val mobile = userPhone.replace(Regex("[^0-9]"), "").takeLast(10)
                                        val url = URL("${ApiConfig.BASE_URL}/api/user/commission/transfer")
                                        val conn = url.openConnection() as HttpURLConnection
                                        conn.requestMethod = "POST"
                                        conn.setRequestProperty("Content-Type", "application/json")
                                        conn.doOutput = true
                                        val body = JSONObject().apply { put("mobile", mobile) }
                                        conn.outputStream.use { it.write(body.toString().toByteArray()) }
                                        if (conn.responseCode == 200) {
                                            withContext(Dispatchers.Main) {
                                                transferMsg = "✅ Transferred to main wallet!"
                                                onRefresh()
                                            }
                                        } else {
                                            withContext(Dispatchers.Main) {
                                                transferMsg = "❌ Transfer failed."
                                            }
                                        }
                                    } catch (e: Exception) {
                                        withContext(Dispatchers.Main) {
                                            transferMsg = "❌ Error transferring commission."
                                        }
                                    } finally {
                                        withContext(Dispatchers.Main) { isTransferring = false }
                                    }
                                }
                            }
                        },
                        modifier = Modifier.fillMaxWidth().height(42.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF182234)),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFF3D079).copy(alpha = 0.8f))
                    ) {
                        Text(
                            text = if (isTransferring) "Transferring..." else "🔄 Transfer Commission to Main Wallet",
                            color = Color(0xFFF3D079),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    if (transferMsg.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            transferMsg, 
                            color = if (transferMsg.startsWith("✅")) Color(0xFF00C853) else if (transferMsg.startsWith("⚠️")) Color(0xFFF3D079) else Color.Red, 
                            fontSize = 11.sp, 
                            fontWeight = FontWeight.SemiBold
                        )
                    }

                    Spacer(modifier = Modifier.height(28.dp))

                    // Action Buttons Row
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        // WITHDRAW Button (Min ₹200)
                        OutlinedButton(
                            onClick = {
                                withdrawError = ""
                                setupBankError = ""
                                if (!hasSavedBankDetails) {
                                    isEditBankMode = false
                                    showSetupBankDialog = true
                                } else {
                                    showWithdrawDialog = true
                                }
                            },
                            modifier = Modifier
                                .weight(1f)
                                .height(50.dp),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.outlinedButtonColors(containerColor = Color(0xFFEF4444).copy(alpha = 0.1f)),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFEF4444).copy(alpha = 0.6f))
                        ) {
                            Text(
                                text = LanguageManager.getText("WITHDRAW", "निकासी"),
                                color = Color(0xFFEF4444),
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                letterSpacing = 0.5.sp
                            )
                        }

                        // ADD CASH Button (Min ₹100)
                        Button(
                            onClick = {
                                depositError = ""
                                showDepositDialog = true
                            },
                            modifier = Modifier
                                .weight(1f)
                                .height(50.dp),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = AccentIndigo)
                        ) {
                            Text(
                                text = LanguageManager.getText("ADD CASH", "कैश जोड़ें"),
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp,
                                letterSpacing = 0.5.sp
                            )
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(30.dp))

        // Recent Transactions Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "Recent Transactions",
                color = Color.White,
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.5.sp
            )
            Text(
                text = "See All",
                color = AccentIndigo,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.clickable { showAllTransactionsDialog = true }
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Dynamic Transactions List
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            if (transactions.isEmpty()) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A))
                    ) {
                        Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                            Text("No transactions yet", color = TextSecondary, fontSize = 14.sp)
                        }
                    }
                }
            } else {
                items(transactions, key = { it.id }) { tx ->
                    val emoji = when (tx.type) {
                        "BONUS" -> "🎁"
                        "DEPOSIT" -> "💰"
                        "WITHDRAW" -> "🏧"
                        "BET" -> "🎲"
                        "WINNING" -> "🏆"
                        else -> "💳"
                    }
                    val isRefund = tx.status == "REFUNDED"
                    val amountColor = if (tx.isCredit || isRefund) (if (isRefund) Color(0xFFF59E0B) else AccentEmerald) else Color(0xFFEF4444)
                    val amountPrefix = if (tx.isCredit || isRefund) "+" else "-"
                    val borderColor = if (tx.isCredit || isRefund) (if (isRefund) Color(0xFFF59E0B).copy(alpha = 0.4f) else AccentEmerald.copy(alpha = 0.3f)) else Color(0xFFEF4444).copy(alpha = 0.3f)
                    val statusColor = when (tx.status) {
                        "CREDITED", "WON", "APPROVED" -> AccentEmerald
                        "REFUNDED" -> Color(0xFFF59E0B)
                        "PENDING" -> Color(0xFFF59E0B)
                        "LOST", "REJECTED" -> Color(0xFFEF4444)
                        else -> TextSecondary
                    }

                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(16.dp),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
                        border = androidx.compose.foundation.BorderStroke(1.dp, borderColor)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(14.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.weight(1f)) {
                                Box(
                                    modifier = Modifier.size(40.dp)
                                        .background(amountColor.copy(alpha = 0.15f), RoundedCornerShape(10.dp)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(emoji, fontSize = 18.sp)
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Column {
                                    Text(tx.title, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(tx.subtitle, color = TextSecondary, fontSize = 11.sp, maxLines = 1)
                                    if (tx.date.isNotBlank()) {
                                        Spacer(modifier = Modifier.height(3.dp))
                                        Text(
                                            text = tx.date,
                                            color = Color(0xFF94A3B8),
                                            fontSize = 10.sp,
                                            fontWeight = FontWeight.Medium,
                                            fontFamily = FontFamily.Monospace
                                        )
                                    }
                                }
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text(
                                    text = "$amountPrefix₹${String.format("%.2f", tx.amount)}",
                                    color = amountColor,
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 14.sp,
                                    fontFamily = FontFamily.Monospace
                                )
                                Box(
                                    modifier = Modifier
                                        .background(statusColor.copy(alpha = 0.15f), RoundedCornerShape(8.dp))
                                        .padding(horizontal = 6.dp, vertical = 2.dp)
                                ) {
                                    Text(tx.status, color = statusColor, fontWeight = FontWeight.Bold, fontSize = 9.sp)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    PullRefreshIndicator(
        refreshing = isRefreshing,
        state = pullRefreshState,
        modifier = Modifier.align(Alignment.TopCenter),
        backgroundColor = Color(0xFF1E293B),
        contentColor = Color(0xFFF3D079)
    )
}
}

    // 2-Step 100% Automatic Instant UPI Gateway Deposit Dialog
    if (showDepositDialog) {
        var depositStep by remember { mutableStateOf(1) }
        var depositAmount by remember { mutableStateOf("") }

        var activeUpiId by remember { mutableStateOf("8930507940@ybl") }
        var activeMerchantName by remember { mutableStateOf("99xmatka") }

        var isGeneratingOrder by remember { mutableStateOf(false) }
        var isVerifyingNow by remember { mutableStateOf(false) }
        var ekqrClientTxnId by remember { mutableStateOf("") }
        var ekqrTxnDate by remember { mutableStateOf("") }
        var ekqrPaymentUrl by remember { mutableStateOf("") }
        var ekqrPhonepeLink by remember { mutableStateOf("") }
        var ekqrGpayLink by remember { mutableStateOf("") }
        var ekqrPaytmLink by remember { mutableStateOf("") }
        var ekqrBhimLink by remember { mutableStateOf("") }

        var depositCountdownSeconds by remember { mutableStateOf(300) }
        var paymentSuccessState by remember { mutableStateOf(false) }
        var creditedAmount by remember { mutableStateOf(0) }

        // 5-Minute Countdown Timer for Deposit Session
        LaunchedEffect(depositStep) {
            if (depositStep == 2) {
                depositCountdownSeconds = 300
                while (depositCountdownSeconds > 0 && showDepositDialog && !paymentSuccessState) {
                    delay(1000)
                    depositCountdownSeconds -= 1
                }
            }
        }

        LaunchedEffect(Unit) {
            withContext(Dispatchers.IO) {
                try {
                    val urls = listOf(
                        "https://newmatkadomain.com/api/payment-methods"
                    )
                    for (u in urls) {
                        try {
                            val conn = java.net.URL(u).openConnection() as java.net.HttpURLConnection
                            conn.connectTimeout = 4000
                            conn.readTimeout = 4000
                            if (conn.responseCode == 200) {
                                val text = conn.inputStream.bufferedReader().readText()
                                val arr = org.json.JSONArray(text)
                                var foundActive = false
                                for (i in 0 until arr.length()) {
                                    val obj = arr.getJSONObject(i)
                                    val st = obj.optString("status", "")
                                    if (st.equals("Active", ignoreCase = true)) {
                                        val upi = obj.optString("upi_id", obj.optString("upiId", ""))
                                        val mName = obj.optString("merchant_name", obj.optString("name", "99xmatka"))
                                        if (upi.isNotEmpty()) {
                                            activeUpiId = upi
                                            if (mName.isNotEmpty()) activeMerchantName = mName
                                            foundActive = true
                                            break
                                        }
                                    }
                                }
                                if (!foundActive && arr.length() > 0) {
                                    val obj = arr.getJSONObject(0)
                                    val upi = obj.optString("upi_id", obj.optString("upiId", ""))
                                    if (upi.isNotEmpty()) activeUpiId = upi
                                }
                                break
                            }
                        } catch (e: Exception) {}
                    }
                } catch (e: Exception) {}
            }
        }

        // Live Auto-Polling for EKQR Payment Status every 2.0 seconds with Automatic Redirect
        LaunchedEffect(depositStep, ekqrClientTxnId) {
            if (depositStep == 2 && ekqrClientTxnId.isNotEmpty()) {
                withContext(Dispatchers.IO) {
                    while (showDepositDialog && depositStep == 2 && ekqrClientTxnId.isNotEmpty() && !paymentSuccessState) {
                        delay(2000)
                        for (baseUrl in ApiConfig.getWorkingUrls()) {
                            try {
                                val url = URL("$baseUrl/api/payment/ekqr/check-status")
                                val conn = url.openConnection() as HttpURLConnection
                                conn.requestMethod = "POST"
                                conn.setRequestProperty("Content-Type", "application/json")
                                conn.setRequestProperty("Bypass-Tunnel-Reminder", "true")
                                conn.setRequestProperty("User-Agent", "Mozilla/5.0")
                                conn.connectTimeout = 2500
                                conn.doOutput = true
                                val jsonBody = JSONObject().apply {
                                    put("client_txn_id", ekqrClientTxnId)
                                    put("txn_date", ekqrTxnDate)
                                }
                                conn.outputStream.use { it.write(jsonBody.toString().toByteArray()) }
                                if (conn.responseCode in 200..299) {
                                    val resp = conn.inputStream.bufferedReader().readText()
                                    val json = JSONObject(resp)
                                    val isSuccess = json.optBoolean("is_approved", false) || json.optString("status") == "success"
                                    if (isSuccess) {
                                        val amt = depositAmount.toDoubleOrNull() ?: 100.0
                                        withContext(Dispatchers.Main) {
                                            paymentSuccessState = true
                                            creditedAmount = amt.toInt()
                                        }
                                        delay(1800) // Brief celebration before auto-redirect
                                        withContext(Dispatchers.Main) {
                                            statusNotification = "🎉 Payment of ₹${amt.toInt()} Successful! ₹${amt.toInt()} added to your wallet."
                                            showDepositDialog = false
                                            depositStep = 1
                                            paymentSuccessState = false
                                            onRefresh()
                                            fetchTransactions()
                                        }
                                        break
                                    }
                                }
                            } catch (e: Exception) {}
                        }
                    }
                }
            }
        }

        val upiId = activeUpiId
        val payeeName = activeMerchantName
        val currentAmt = depositAmount.toDoubleOrNull() ?: 0.0

        AlertDialog(
            onDismissRequest = {
                if (!paymentSuccessState) {
                    showDepositDialog = false
                    depositStep = 1
                }
            },
            title = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(if (paymentSuccessState) "🎉 " else "⚡ ", fontSize = 20.sp)
                    Text(
                        if (paymentSuccessState) "Payment Verified!"
                        else if (depositStep == 1) "Add Cash (Instant UPI)"
                        else "Pay ₹${currentAmt.toInt()} via Instant UPI",
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 17.sp
                    )
                }
            },
            text = {
                Column(modifier = Modifier.fillMaxWidth()) {
                    if (paymentSuccessState) {
                        // CELEBRATORY SUCCESS & AUTO-REDIRECT SCREEN
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center,
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 20.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(72.dp)
                                    .clip(CircleShape)
                                    .background(Color(0xFF10B981).copy(alpha = 0.15f))
                                    .border(2.dp, Color(0xFF10B981), CircleShape),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("✅", fontSize = 36.sp)
                            }
                            Spacer(modifier = Modifier.height(14.dp))
                            Text("Payment Successful!", color = Color(0xFF10B981), fontWeight = FontWeight.Bold, fontSize = 20.sp)
                            Spacer(modifier = Modifier.height(6.dp))
                            Text("₹$creditedAmount Added to Wallet", color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                            Spacer(modifier = Modifier.height(14.dp))
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                CircularProgressIndicator(modifier = Modifier.size(14.dp), color = AccentEmerald, strokeWidth = 2.dp)
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Redirecting to your wallet...", color = TextSecondary, fontSize = 12.sp)
                            }
                        }
                    } else if (depositStep == 1) {
                        Text("Select or enter amount to add to wallet:", color = TextSecondary, fontSize = 13.sp)
                        Text("Minimum Deposit: ₹ 100 • 100% Automatic Credit", color = AccentEmerald, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(10.dp))

                        OutlinedTextField(
                            value = depositAmount,
                            onValueChange = {
                                depositAmount = it
                                depositError = ""
                            },
                            placeholder = { Text("Enter amount (e.g. 500)", color = TextMuted) },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedBorderColor = AccentIndigo
                            ),
                            modifier = Modifier.fillMaxWidth()
                        )

                        Spacer(modifier = Modifier.height(12.dp))
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            listOf("100", "300", "500", "1000", "2000").forEach { quickAmt ->
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(if (depositAmount == quickAmt) AccentIndigo else Color(0xFF26324A))
                                        .border(1.dp, if (depositAmount == quickAmt) AccentIndigo else Color(0xFF3B4D6C), RoundedCornerShape(8.dp))
                                        .clickable {
                                            depositAmount = quickAmt
                                            depositError = ""
                                        }
                                        .padding(vertical = 8.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("₹$quickAmt", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                }
                            }
                        }

                        if (depositError.isNotEmpty()) {
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(depositError, color = Color(0xFFEF4444), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    } else {
                        // STEP 2: In-App Dynamic QR & 1-Click Instant UPI
                        val encodedPayee = try { java.net.URLEncoder.encode(payeeName.ifEmpty { "99xmatka" }, "UTF-8") } catch (e: Exception) { "95X%20MATKA" }
                        val qrTargetString = if (ekqrBhimLink.isNotEmpty() && ekqrBhimLink.startsWith("upi://")) {
                            ekqrBhimLink
                        } else {
                            "upi://pay?pa=$upiId&pn=$encodedPayee&am=${currentAmt.toInt()}&cu=INR"
                        }
                        val qrBitmap = remember(qrTargetString) { generateQrCodeBitmap(qrTargetString, 500) }
                        val timerMinutes = depositCountdownSeconds / 60
                        val timerSeconds = depositCountdownSeconds % 60
                        val timerText = String.format("%02d:%02d", timerMinutes, timerSeconds)

                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            // Session Timer Badge
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.Center,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (depositCountdownSeconds < 60) Color(0xFF7F1D1D) else Color(0xFF1E293B))
                                    .padding(vertical = 5.dp, horizontal = 10.dp)
                            ) {
                                Text("⏱️ Session Expires: ", color = TextSecondary, fontSize = 11.sp)
                                Text(timerText, color = if (depositCountdownSeconds < 60) Color(0xFFEF4444) else Color(0xFFF3D079), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }

                            Spacer(modifier = Modifier.height(12.dp))

                            // Dynamic QR Card
                            if (qrBitmap != null) {
                                Box(
                                    modifier = Modifier
                                        .size(220.dp)
                                        .clip(RoundedCornerShape(16.dp))
                                        .background(Color.White)
                                        .border(2.5.dp, Color(0xFFF3D079), RoundedCornerShape(16.dp))
                                        .padding(10.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    androidx.compose.foundation.Image(
                                        bitmap = qrBitmap.asImageBitmap(),
                                        contentDescription = "Instant UPI QR Code",
                                        modifier = Modifier.fillMaxSize()
                                    )
                                }
                                Spacer(modifier = Modifier.height(10.dp))
                                Text(
                                    "Scan with Any UPI App to Pay ₹${currentAmt.toInt()}",
                                    color = Color(0xFFF3D079),
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    "PhonePe • Google Pay • Paytm • BHIM",
                                    color = TextSecondary,
                                    fontSize = 11.sp
                                )
                                Spacer(modifier = Modifier.height(14.dp))
                            }

                            // Auto-verifying payment in background
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Color(0xFF064E3B).copy(alpha = 0.5f))
                                    .padding(vertical = 8.dp, horizontal = 10.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.Center
                            ) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(13.dp),
                                    color = Color(0xFF34D399),
                                    strokeWidth = 2.dp
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Auto-verifying payment in background...", color = Color(0xFF34D399), fontSize = 11.sp, fontWeight = FontWeight.Medium)
                            }
                        }
                    }
                }
            },
            confirmButton = {
                if (depositStep == 1 && !paymentSuccessState) {
                    Button(
                        onClick = {
                            val amt = depositAmount.toDoubleOrNull() ?: 0.0
                            if (amt < 100) {
                                depositError = "Minimum deposit amount is ₹ 100"
                            } else {
                                isGeneratingOrder = true
                                depositError = ""
                                // Call EKQR Create Order API
                                scope.launch(Dispatchers.IO) {
                                    for (baseUrl in ApiConfig.getWorkingUrls()) {
                                        try {
                                            val url = URL("$baseUrl/api/payment/ekqr/create-order")
                                            val conn = url.openConnection() as HttpURLConnection
                                            conn.requestMethod = "POST"
                                            conn.setRequestProperty("Content-Type", "application/json")
                                            conn.setRequestProperty("Bypass-Tunnel-Reminder", "true")
                                            conn.setRequestProperty("User-Agent", "Mozilla/5.0")
                                            conn.connectTimeout = 4000
                                            conn.readTimeout = 4000
                                            conn.doOutput = true
                                            val jsonBody = JSONObject().apply {
                                                val cleanMob = userPhone.replace(Regex("[^0-9]"), "").takeLast(10)
                                                put("amount", amt)
                                                put("mobile", if (cleanMob.isNotEmpty()) cleanMob else "9007724336")
                                                put("name", if (userName.isNotEmpty()) userName else "Player")
                                                put("email", "${cleanMob.ifEmpty { "player" }}@gmail.com")
                                                put("redirect_url", "https://newmatkadomain.com")
                                            }
                                            conn.outputStream.use { it.write(jsonBody.toString().toByteArray()) }
                                            if (conn.responseCode in 200..299) {
                                                val resp = conn.inputStream.bufferedReader().readText()
                                                val json = JSONObject(resp)
                                                if (json.optBoolean("success", false)) {
                                                    val intentObj = json.optJSONObject("upi_intent")
                                                    withContext(Dispatchers.Main) {
                                                        ekqrClientTxnId = json.optString("client_txn_id", "")
                                                        ekqrTxnDate = json.optString("txn_date", "")
                                                        ekqrPaymentUrl = json.optString("payment_url", "")
                                                        if (intentObj != null) {
                                                            ekqrPhonepeLink = intentObj.optString("phonepe_link", "")
                                                            ekqrGpayLink = intentObj.optString("gpay_link", "")
                                                            ekqrPaytmLink = intentObj.optString("paytm_link", "")
                                                            ekqrBhimLink = intentObj.optString("bhim_link", "")
                                                        }
                                                        depositStep = 2
                                                        isGeneratingOrder = false
                                                    }
                                                    break
                                                }
                                            }
                                        } catch (e: Exception) {}
                                    }
                                    withContext(Dispatchers.Main) {
                                        if (depositStep != 2) {
                                            depositStep = 2
                                            isGeneratingOrder = false
                                        }
                                    }
                                }
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = AccentIndigo),
                        enabled = !isGeneratingOrder
                    ) {
                        Text(if (isGeneratingOrder) "CONNECTING UPI..." else "PROCEED TO PAY ➔", fontWeight = FontWeight.Bold)
                    }
                }
            },
            dismissButton = {
                if (!paymentSuccessState) {
                    TextButton(onClick = {
                        if (depositStep == 2) {
                            depositStep = 1
                        } else {
                            showDepositDialog = false
                        }
                    }) {
                        Text(if (depositStep == 2) "← Cancel / Change Amount" else "Cancel", color = TextSecondary)
                    }
                }
            },
            containerColor = SurfaceCard
        )
    }

    // 1. Setup / Edit Bank Account Details Dialog
    if (showSetupBankDialog) {
        var inputAccountName by remember { mutableStateOf(if (isEditBankMode) savedAccountName else "") }
        var inputAccountNumber by remember { mutableStateOf(if (isEditBankMode) savedAccountNumber else "") }
        var inputIfscCode by remember { mutableStateOf(if (isEditBankMode) savedIfscCode else "") }
        var isSaving by remember { mutableStateOf(false) }

        AlertDialog(
            onDismissRequest = { showSetupBankDialog = false },
            title = {
                Text(
                    text = if (isEditBankMode) "Edit Bank Details" else "Bank Details Setup",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp
                )
            },
            text = {
                Column {
                    Text(
                        text = if (isEditBankMode) "Update your saved bank details below:" else "Enter your bank account details once. They will be saved securely for all future withdrawals.",
                        color = TextSecondary,
                        fontSize = 12.sp
                    )
                    Spacer(modifier = Modifier.height(14.dp))

                    Text("Account Holder Name:", color = TextSecondary, fontSize = 12.sp)
                    Spacer(modifier = Modifier.height(4.dp))
                    OutlinedTextField(
                        value = inputAccountName,
                        onValueChange = {
                            inputAccountName = it
                            setupBankError = ""
                        },
                        placeholder = { Text("Enter name", color = TextMuted) },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = AccentIndigo
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(10.dp))
                    Text("Bank Account Number:", color = TextSecondary, fontSize = 12.sp)
                    Spacer(modifier = Modifier.height(4.dp))
                    OutlinedTextField(
                        value = inputAccountNumber,
                        onValueChange = {
                            inputAccountNumber = it.filter { c -> c.isDigit() }
                            setupBankError = ""
                        },
                        placeholder = { Text("Enter account number", color = TextMuted) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = AccentIndigo
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    Spacer(modifier = Modifier.height(10.dp))
                    Text("IFSC Code:", color = TextSecondary, fontSize = 12.sp)
                    Spacer(modifier = Modifier.height(4.dp))
                    OutlinedTextField(
                        value = inputIfscCode,
                        onValueChange = {
                            inputIfscCode = it.uppercase()
                            setupBankError = ""
                        },
                        placeholder = { Text("Enter IFSC code", color = TextMuted) },
                        singleLine = true,
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = AccentIndigo
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    if (setupBankError.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(setupBankError, color = Color(0xFFEF4444), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val nameClean = inputAccountName.trim()
                        val numClean = inputAccountNumber.trim()
                        val ifscClean = inputIfscCode.trim().uppercase()

                        if (nameClean.isEmpty()) {
                            setupBankError = "Please enter Account Holder Name"
                        } else if (numClean.length < 8) {
                            setupBankError = "Please enter a valid Account Number (min 8 digits)"
                        } else if (ifscClean.length != 11) {
                            setupBankError = "Please enter a valid 11-character IFSC Code"
                        } else {
                            isSaving = true
                            scope.launch(Dispatchers.IO) {
                                try {
                                    val mobile = userPhone.replace(Regex("[^0-9]"), "").takeLast(10)
                                    for (baseUrl in ApiConfig.getWorkingUrls()) {
                                        try {
                                            val url = URL("$baseUrl/api/user/bank-details/save")
                                            val conn = url.openConnection() as HttpURLConnection
                                            conn.requestMethod = "POST"
                                            conn.setRequestProperty("Content-Type", "application/json")
                                            conn.setRequestProperty("Bypass-Tunnel-Reminder", "true")
                                            conn.setRequestProperty("User-Agent", "Mozilla/5.0")
                                            conn.connectTimeout = 3000
                                            conn.doOutput = true
                                            val body = JSONObject().apply {
                                                put("mobile", mobile)
                                                put("account_name", nameClean)
                                                put("account_number", numClean)
                                                put("ifsc_code", ifscClean)
                                            }
                                            conn.outputStream.use { it.write(body.toString().toByteArray()) }
                                            if (conn.responseCode in 200..299) {
                                                ApiConfig.cachedWorkingUrl = baseUrl
                                                break
                                            }
                                        } catch (_: Exception) { }
                                    }
                                } catch (_: Exception) { }

                                withContext(Dispatchers.Main) {
                                    savedAccountName = nameClean
                                    savedAccountNumber = numClean
                                    savedIfscCode = ifscClean
                                    hasSavedBankDetails = true
                                    showSetupBankDialog = false
                                    isSaving = false
                                    statusNotification = if (isEditBankMode) "Bank details updated successfully." else "Bank details saved successfully."
                                    // Transition directly to simplified withdrawal form
                                    showWithdrawDialog = true
                                }
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00C853)),
                    enabled = !isSaving
                ) {
                    Text(
                        text = if (isSaving) "Saving..." else if (isEditBankMode) "Save Changes" else "Save Bank Details",
                        fontWeight = FontWeight.Bold
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { showSetupBankDialog = false }) {
                    Text("Cancel", color = TextSecondary)
                }
            },
            containerColor = SurfaceCard
        )
    }

    // 2. Simplified Bank Withdrawal Dialog (With Compact Saved Bank Card)
    if (showWithdrawDialog) {
        var withdrawAmount by remember { mutableStateOf("") }

        val maskedAccNumber = if (savedAccountNumber.length >= 4) {
            "•••• •••• ${savedAccountNumber.takeLast(4)}"
        } else savedAccountNumber

        AlertDialog(
            onDismissRequest = { showWithdrawDialog = false },
            title = { Text("Bank Withdrawal", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp) },
            text = {
                Column {
                    // Compact Saved Bank Account Card
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color(0xFF0F172A))
                            .border(1.dp, Color(0xFFF3D079).copy(alpha = 0.4f), RoundedCornerShape(12.dp))
                            .padding(12.dp)
                    ) {
                        Column {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "🏦 Bank Account",
                                    color = Color(0xFFF3D079),
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp
                                )
                                Text(
                                    text = "Edit Bank Details",
                                    color = Color(0xFF60A5FA),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.clickable {
                                        showWithdrawDialog = false
                                        isEditBankMode = true
                                        showSetupBankDialog = true
                                    }
                                )
                            }
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "Account Holder: $savedAccountName",
                                color = Color.White,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.SemiBold
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "Account No.: $maskedAccNumber",
                                color = TextSecondary,
                                fontSize = 12.sp,
                                fontFamily = FontFamily.Monospace
                            )
                            Spacer(modifier = Modifier.height(2.dp))
                            Text(
                                text = "IFSC: $savedIfscCode",
                                color = TextSecondary,
                                fontSize = 12.sp,
                                fontFamily = FontFamily.Monospace
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Enter Amount to Withdraw (₹):", color = TextSecondary, fontSize = 12.sp)
                    Text("Minimum Withdrawal Limit: ₹ 200", color = Color(0xFFEF4444), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(4.dp))
                    OutlinedTextField(
                        value = withdrawAmount,
                        onValueChange = {
                            withdrawAmount = it
                            withdrawError = ""
                        },
                        placeholder = { Text("Enter amount", color = TextMuted) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = Color(0xFFEF4444)
                        ),
                        modifier = Modifier.fillMaxWidth()
                    )

                    if (withdrawError.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(withdrawError, color = Color(0xFFEF4444), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val amt = withdrawAmount.toDoubleOrNull() ?: 0.0
                        if (amt < 200) {
                            withdrawError = "Minimum withdrawal limit is ₹ 200"
                        } else if (amt > currentBalance) {
                            withdrawError = "Insufficient balance (Available: ₹${String.format("%.2f", currentBalance)})"
                        } else {
                            pendingWithdrawAmount = amt
                            showConfirmWithdrawDialog = true
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
                ) {
                    Text("Withdraw", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showWithdrawDialog = false }) {
                    Text("Cancel", color = TextSecondary)
                }
            },
            containerColor = SurfaceCard
        )
    }

    // 3. Confirmation Dialog
    if (showConfirmWithdrawDialog) {
        val last4 = if (savedAccountNumber.length >= 4) savedAccountNumber.takeLast(4) else savedAccountNumber
        AlertDialog(
            onDismissRequest = { showConfirmWithdrawDialog = false },
            title = { Text("Confirm Withdrawal", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp) },
            text = {
                Text(
                    text = "Withdraw ₹${pendingWithdrawAmount.toInt()} to Account ending $last4?",
                    color = Color.White,
                    fontSize = 14.sp
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        val amt = pendingWithdrawAmount
                        val updatedBal = currentBalance - amt
                        onBalanceChange(updatedBal)

                        showConfirmWithdrawDialog = false
                        showWithdrawDialog = false
                        statusNotification = "Withdrawal Request of ₹${amt.toInt()} Submitted! Pending Admin Approval."

                        val cleanMob = userPhone.replace(Regex("[^0-9]"), "").takeLast(10)
                        scope.launch(Dispatchers.IO) {
                            for (baseUrl in ApiConfig.getWorkingUrls()) {
                                try {
                                    val url = URL("$baseUrl/api/user/withdraw/request")
                                    val conn = url.openConnection() as HttpURLConnection
                                    conn.requestMethod = "POST"
                                    conn.setRequestProperty("Content-Type", "application/json")
                                    conn.setRequestProperty("Bypass-Tunnel-Reminder", "true")
                                    conn.setRequestProperty("User-Agent", "Mozilla/5.0")
                                    conn.connectTimeout = 3000
                                    conn.doOutput = true
                                    val body = JSONObject().apply {
                                        put("mobile", cleanMob)
                                        put("amount", amt)
                                        put("holder_name", savedAccountName)
                                        put("account_number", savedAccountNumber)
                                        put("ifsc_code", savedIfscCode)
                                        put("method", "Bank Transfer")
                                    }
                                    conn.outputStream.use { it.write(body.toString().toByteArray()) }
                                    if (conn.responseCode in 200..299) {
                                        ApiConfig.cachedWorkingUrl = baseUrl
                                        break
                                    }
                                } catch (_: Exception) { }
                            }
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
                ) {
                    Text("Confirm Withdrawal", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showConfirmWithdrawDialog = false }) {
                    Text("Cancel", color = TextSecondary)
                }
            },
            containerColor = SurfaceCard
        )
    }

    if (showAllTransactionsDialog) {
        androidx.compose.ui.window.Dialog(onDismissRequest = { showAllTransactionsDialog = false }) {
            var selectedFilter by remember { mutableStateOf("ALL") }
            val filteredTxns = remember(transactions, selectedFilter) {
                if (selectedFilter == "ALL") transactions
                else transactions.filter { it.type.equals(selectedFilter, ignoreCase = true) }
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .fillMaxHeight(0.85f)
                    .clip(RoundedCornerShape(24.dp))
                    .background(Color(0xFF0F172A))
                    .border(1.dp, Color(0xFFF3D079), RoundedCornerShape(24.dp))
                    .padding(18.dp)
            ) {
                Column(modifier = Modifier.fillMaxSize()) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("📜 ", fontSize = 20.sp)
                            Text(
                                "ALL TRANSACTIONS",
                                color = Color(0xFFF3D079),
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Black
                            )
                        }
                        IconButton(onClick = { showAllTransactionsDialog = false }, modifier = Modifier.size(32.dp)) {
                            Text("✕", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        listOf("ALL", "DEPOSIT", "WITHDRAW", "BET", "WINNING").forEach { f ->
                            val isSel = selectedFilter == f
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(if (isSel) Color(0xFFF3D079) else Color(0xFF1E293B))
                                    .clickable { selectedFilter = f }
                                    .padding(vertical = 6.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = f,
                                    color = if (isSel) Color.Black else Color.White,
                                    fontSize = 9.5.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(12.dp))

                    if (filteredTxns.isEmpty()) {
                        Box(
                            modifier = Modifier.fillMaxWidth().weight(1f),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("No $selectedFilter transactions found", color = TextSecondary, fontSize = 13.sp)
                        }
                    } else {
                        LazyColumn(
                            modifier = Modifier.fillMaxWidth().weight(1f),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            items(filteredTxns, key = { it.id }) { tx ->
                                val emoji = when (tx.type) {
                                    "BONUS" -> "🎁"
                                    "DEPOSIT" -> "💰"
                                    "WITHDRAW" -> "🏧"
                                    "BET" -> "🎲"
                                    "WINNING" -> "🏆"
                                    else -> "💳"
                                }
                                val isRefund = tx.status == "REFUNDED"
                                val amountColor = if (tx.isCredit || isRefund) (if (isRefund) Color(0xFFF59E0B) else AccentEmerald) else Color(0xFFEF4444)
                                val amountPrefix = if (tx.isCredit || isRefund) "+" else "-"
                                val borderColor = if (tx.isCredit || isRefund) (if (isRefund) Color(0xFFF59E0B).copy(alpha = 0.4f) else AccentEmerald.copy(alpha = 0.3f)) else Color(0xFFEF4444).copy(alpha = 0.3f)
                                val statusColor = when (tx.status) {
                                    "CREDITED", "WON", "APPROVED" -> AccentEmerald
                                    "REFUNDED" -> Color(0xFFF59E0B)
                                    "PENDING" -> Color(0xFFF59E0B)
                                    "LOST", "REJECTED" -> Color(0xFFEF4444)
                                    else -> TextSecondary
                                }

                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(14.dp),
                                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                                    border = androidx.compose.foundation.BorderStroke(1.dp, borderColor)
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth().padding(12.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Box(
                                                modifier = Modifier
                                                    .size(36.dp)
                                                    .clip(RoundedCornerShape(10.dp))
                                                    .background(Color(0xFF0F172A)),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Text(emoji, fontSize = 16.sp)
                                            }
                                            Spacer(modifier = Modifier.width(10.dp))
                                            Column {
                                                Text(tx.title, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                                Text(tx.subtitle, color = TextSecondary, fontSize = 10.5.sp)
                                                if (tx.date.isNotEmpty()) {
                                                    Text(tx.date, color = TextMuted, fontSize = 9.5.sp)
                                                }
                                            }
                                        }

                                        Column(horizontalAlignment = Alignment.End) {
                                            Text(
                                                text = "$amountPrefix₹${String.format("%.2f", tx.amount)}",
                                                color = amountColor,
                                                fontSize = 14.sp,
                                                fontWeight = FontWeight.ExtraBold,
                                                fontFamily = FontFamily.Monospace
                                            )
                                            Spacer(modifier = Modifier.height(2.dp))
                                            Box(
                                                modifier = Modifier
                                                    .clip(RoundedCornerShape(6.dp))
                                                    .background(statusColor.copy(alpha = 0.15f))
                                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                                            ) {
                                                Text(
                                                    text = tx.status,
                                                    color = statusColor,
                                                    fontSize = 9.sp,
                                                    fontWeight = FontWeight.Bold
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
