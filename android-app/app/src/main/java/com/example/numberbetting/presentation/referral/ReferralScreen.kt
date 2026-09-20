package com.example.numberbetting.presentation.referral

import android.app.DatePickerDialog
import android.content.Intent
import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.numberbetting.data.ApiConfig
import com.example.numberbetting.domain.AuthManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

import androidx.compose.material.ExperimentalMaterialApi
import androidx.compose.material.pullrefresh.PullRefreshIndicator
import androidx.compose.material.pullrefresh.pullRefresh
import androidx.compose.material.pullrefresh.rememberPullRefreshState

data class ReferredUserItem(
    val id: String,
    val name: String,
    val mobile: String,
    val date: String,
    val bonus: Int,
    val betCommission: Double,
    val totalEarned: Double
)

@OptIn(ExperimentalMaterial3Api::class, ExperimentalMaterialApi::class)
@Composable
fun ReferralScreen(
    userBalance: Double = 0.00,
    onOpenDrawer: () -> Unit = {},
    onNavigateToWallet: () -> Unit = {},
    onNavigateToHome: () -> Unit = {}
) {
    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current
    val scope = rememberCoroutineScope()

    val calendar = remember { Calendar.getInstance() }
    val dateFormat = remember { SimpleDateFormat("yyyy-MM-dd", Locale.getDefault()) }
    val displayDateFormat = remember { SimpleDateFormat("dd MMM", Locale.getDefault()) }

    var selectedFilterType by remember { mutableStateOf("all") } // "all", "today", "yesterday", "custom"
    var selectedDateStr by remember { mutableStateOf("all") }
    var selectedDateLabel by remember { mutableStateOf("All Time") }

    val savedPhone = remember { AuthManager.getUserPhone(context) }
    var referralCode by remember { mutableStateOf(if (savedPhone.isNotEmpty()) savedPhone.replace("[^0-9]".toRegex(), "").takeLast(10) else "7206561420") }
    var totalCommission by remember { mutableStateOf(0.0) }
    var referralsCount by remember { mutableStateOf(0) }
    var referredUsersList by remember { mutableStateOf<List<ReferredUserItem>>(emptyList()) }
    var isLoading by remember { mutableStateOf(false) }
    var commissionBalance by remember { mutableStateOf(0.0) }

    val fetchReferralData: (String) -> Unit = { filterDate ->
        if (savedPhone.isNotEmpty()) {
            isLoading = true
            scope.launch(Dispatchers.IO) {
                var foundRef = referralCode
                var foundComm = 0.0
                var foundCount = referralsCount
                val tempList = mutableListOf<ReferredUserItem>()

                for (baseUrl in ApiConfig.getWorkingUrls()) {
                    try {
                        val cleanPhone = savedPhone.replace("[^0-9]".toRegex(), "").takeLast(10)
                        val queryParam = if (filterDate != "all") "&date=$filterDate" else ""
                        val url = URL("$baseUrl/api/user/referral-details?mobile=$cleanPhone$queryParam")
                        val conn = url.openConnection() as HttpURLConnection
                        conn.requestMethod = "GET"
                        conn.setRequestProperty("Bypass-Tunnel-Reminder", "true")
                        conn.setRequestProperty("Cache-Control", "no-cache")
                        conn.connectTimeout = 3000

                        if (conn.responseCode in 200..299) {
                            val text = conn.inputStream.bufferedReader().readText()
                            if (text.trim().startsWith("{")) {
                                val jsonObj = JSONObject(text)
                                foundRef = jsonObj.optString("referral_code", foundRef).replace("REF", "")
                                foundCount = jsonObj.optInt("referralsCount", foundCount)
                                foundComm = jsonObj.optDouble("totalCommission", 0.0)
                                val liveCommBal = jsonObj.optDouble("commissionBalance", foundComm)

                                val arr = jsonObj.optJSONArray("referredUsers")
                                if (arr != null) {
                                    for (i in 0 until arr.length()) {
                                        val obj = arr.getJSONObject(i)
                                        val signupBonus = obj.optInt("bonus", 0)
                                        val betComm = obj.optDouble("betCommission", 0.0)
                                        val totalEarnedVal = obj.optDouble("totalEarned", betComm)

                                        tempList.add(
                                            ReferredUserItem(
                                                id = obj.optString("id", "$i"),
                                                name = obj.optString("name", "Invited Player"),
                                                mobile = obj.optString("mobile", "****"),
                                                date = obj.optString("date", "Recently"),
                                                bonus = signupBonus,
                                                betCommission = betComm,
                                                totalEarned = totalEarnedVal
                                            )
                                        )
                                    }
                                }
                                withContext(Dispatchers.Main) {
                                    referralCode = foundRef
                                    totalCommission = foundComm
                                    commissionBalance = liveCommBal
                                    referralsCount = foundCount
                                    referredUsersList = tempList
                                    isLoading = false
                                }
                            }
                            ApiConfig.cachedWorkingUrl = baseUrl
                            break
                        }
                    } catch (e: Exception) { }
                }
            }
        }
    }

    val pullRefreshState = rememberPullRefreshState(
        refreshing = isLoading,
        onRefresh = { fetchReferralData(selectedDateStr) }
    )

    LaunchedEffect(Unit) {
        fetchReferralData("all")
    }

    val datePickerDialog = remember {
        DatePickerDialog(
            context,
            { _, year, month, dayOfMonth ->
                val cal = Calendar.getInstance()
                cal.set(year, month, dayOfMonth)
                val dStr = dateFormat.format(cal.time)
                selectedFilterType = "custom"
                selectedDateStr = dStr
                selectedDateLabel = displayDateFormat.format(cal.time)
                fetchReferralData(dStr)
            },
            calendar.get(Calendar.YEAR),
            calendar.get(Calendar.MONTH),
            calendar.get(Calendar.DAY_OF_MONTH)
        )
    }

    val shareText = "Play 99xmatka & Win 95X! 👑\nUse my Referral Code: $referralCode on signup!\nPlay online: https://newmatkadomain.com"

    Scaffold(
        topBar = {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                color = Color(0xFF0F172A),
                shadowElevation = 4.dp
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = onOpenDrawer) {
                            Text("≡", color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.Bold)
                        }
                        Spacer(modifier = Modifier.width(4.dp))
                        Column {
                            Text(
                                text = "Referral",
                                color = Color(0xFFF3D079),
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Black
                            )
                            Text(
                                text = "Play Smart • Play Safe • Win Big",
                                color = Color(0xFF94A3B8),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }

                    // Balance Badge with Plus Button
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .background(Color(0xFF00C853))
                            .clickable { onNavigateToWallet() }
                            .padding(horizontal = 10.dp, vertical = 5.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(7.dp)
                                .clip(CircleShape)
                                .background(Color.White)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "₹" + String.format("%.2f", userBalance),
                            color = Color.White,
                            fontWeight = FontWeight.Black,
                            fontSize = 13.sp,
                            fontFamily = FontFamily.Monospace
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Box(
                            modifier = Modifier
                                .size(20.dp)
                                .clip(CircleShape)
                                .background(Color.White),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("+", color = Color(0xFF00C853), fontWeight = FontWeight.Black, fontSize = 14.sp)
                        }
                    }
                }
            }
        },
        containerColor = Color(0xFF0F172A)
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .pullRefresh(pullRefreshState)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
            // DATE FILTER ROW
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Filter: All Time
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (selectedFilterType == "all") Color(0xFF2A374A) else Color(0xFF1E293B))
                        .border(1.dp, if (selectedFilterType == "all") Color(0xFFF3D079) else Color(0xFF334155), RoundedCornerShape(10.dp))
                        .clickable {
                            selectedFilterType = "all"
                            selectedDateStr = "all"
                            selectedDateLabel = "All Time"
                            fetchReferralData("all")
                        }
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "All Time",
                        color = if (selectedFilterType == "all") Color(0xFFF3D079) else Color(0xFF94A3B8),
                        fontSize = 11.sp,
                        fontWeight = if (selectedFilterType == "all") FontWeight.Bold else FontWeight.Medium
                    )
                }

                // Filter: Today
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (selectedFilterType == "today") Color(0xFF2A374A) else Color(0xFF1E293B))
                        .border(1.dp, if (selectedFilterType == "today") Color(0xFFF3D079) else Color(0xFF334155), RoundedCornerShape(10.dp))
                        .clickable {
                            val todayStr = dateFormat.format(Calendar.getInstance().time)
                            selectedFilterType = "today"
                            selectedDateStr = todayStr
                            selectedDateLabel = "Today"
                            fetchReferralData(todayStr)
                        }
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Today",
                        color = if (selectedFilterType == "today") Color(0xFFF3D079) else Color(0xFF94A3B8),
                        fontSize = 11.sp,
                        fontWeight = if (selectedFilterType == "today") FontWeight.Bold else FontWeight.Medium
                    )
                }

                // Filter: Yesterday
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (selectedFilterType == "yesterday") Color(0xFF2A374A) else Color(0xFF1E293B))
                        .border(1.dp, if (selectedFilterType == "yesterday") Color(0xFFF3D079) else Color(0xFF334155), RoundedCornerShape(10.dp))
                        .clickable {
                            val yestCal = Calendar.getInstance().apply { add(Calendar.DAY_OF_YEAR, -1) }
                            val yestStr = dateFormat.format(yestCal.time)
                            selectedFilterType = "yesterday"
                            selectedDateStr = yestStr
                            selectedDateLabel = "Yesterday"
                            fetchReferralData(yestStr)
                        }
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Yesterday",
                        color = if (selectedFilterType == "yesterday") Color(0xFFF3D079) else Color(0xFF94A3B8),
                        fontSize = 11.sp,
                        fontWeight = if (selectedFilterType == "yesterday") FontWeight.Bold else FontWeight.Medium
                    )
                }

                // Filter: Calendar Picker
                Box(
                    modifier = Modifier
                        .weight(1.2f)
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (selectedFilterType == "custom") Color(0xFF2A374A) else Color(0xFF1E293B))
                        .border(1.dp, if (selectedFilterType == "custom") Color(0xFFF3D079) else Color(0xFF334155), RoundedCornerShape(10.dp))
                        .clickable {
                            datePickerDialog.show()
                        }
                        .padding(vertical = 8.dp, horizontal = 4.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("📅", fontSize = 11.sp)
                        Spacer(modifier = Modifier.width(3.dp))
                        Text(
                            text = if (selectedFilterType == "custom") selectedDateLabel else "Pick Date",
                            color = if (selectedFilterType == "custom") Color(0xFFF3D079) else Color(0xFF94A3B8),
                            fontSize = 11.sp,
                            fontWeight = if (selectedFilterType == "custom") FontWeight.Bold else FontWeight.Medium,
                            maxLines = 1
                        )
                    }
                }
            }

            // CARD 1: TOTAL COMMISSION
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF334155)),
                elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    // Dark Header Bar
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF162238))
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("🎟️", fontSize = 14.sp)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = if (selectedFilterType == "all") "TOTAL COMMISSION" else "COMMISSION ($selectedDateLabel)",
                                color = Color.White,
                                fontWeight = FontWeight.Black,
                                fontSize = 12.sp,
                                letterSpacing = 0.5.sp
                            )
                        }
                        Text(
                            text = "🔄",
                            fontSize = 14.sp,
                            modifier = Modifier
                                .clickable { fetchReferralData(selectedDateStr) }
                                .padding(4.dp)
                        )
                    }

                    // Gold Display Box
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(14.dp))
                                .background(Color(0xFF0F172A))
                                .border(1.5.dp, Color(0xFFF3D079), RoundedCornerShape(14.dp))
                                .padding(vertical = 20.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    text = if (selectedFilterType == "all") "Lifetime Commission Earned" else "Commission Earned ($selectedDateLabel)",
                                    color = Color(0xFF94A3B8),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 0.5.sp
                                )
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    text = "₹" + (if (totalCommission % 1.0 == 0.0) totalCommission.toInt().toString() else String.format("%.2f", totalCommission)) + "/-",
                                    color = Color(0xFFF3D079),
                                    fontWeight = FontWeight.Black,
                                    fontSize = 30.sp,
                                    fontFamily = FontFamily.Monospace
                                )
                            }
                        }
                    }
                }
            }


            // CARD 2: YOUR REFERRAL CODE
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF334155)),
                elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    // Bright Green Header Bar
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF00873E))
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text("🎁", fontSize = 14.sp)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "YOUR REFERRAL CODE",
                            color = Color.White,
                            fontWeight = FontWeight.Black,
                            fontSize = 12.sp,
                            letterSpacing = 0.5.sp
                        )
                    }

                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        // Single-Line Gold Code Box
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(14.dp))
                                .background(Color(0xFF0F172A))
                                .border(1.5.dp, Color(0xFFF3D079), RoundedCornerShape(14.dp))
                                .padding(vertical = 14.dp, horizontal = 8.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = referralCode,
                                color = Color(0xFFF3D079),
                                fontWeight = FontWeight.Black,
                                fontSize = 20.sp,
                                fontFamily = FontFamily.Monospace,
                                letterSpacing = 3.sp,
                                maxLines = 1
                            )
                        }

                        Spacer(modifier = Modifier.height(8.dp))



                        Spacer(modifier = Modifier.height(14.dp))

                        // Side-by-Side Action Buttons (Copy Code & Share)
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            // Copy Code Button (Solid Green)
                            Button(
                                onClick = {
                                    clipboardManager.setText(AnnotatedString(referralCode))
                                    Toast.makeText(context, "✅ Referral Code $referralCode Copied!", Toast.LENGTH_SHORT).show()
                                },
                                modifier = Modifier
                                    .weight(1f)
                                    .height(44.dp),
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00873E))
                            ) {
                                Text("📋", fontSize = 14.sp)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Copy Code", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                            }

                            // Share Button (Solid Gold)
                            Button(
                                onClick = {
                                    try {
                                        val intent = Intent(Intent.ACTION_SEND).apply {
                                            type = "text/plain"
                                            putExtra(Intent.EXTRA_TEXT, shareText)
                                        }
                                        context.startActivity(Intent.createChooser(intent, "Share Referral Code"))
                                    } catch (e: Exception) { }
                                },
                                modifier = Modifier
                                    .weight(1f)
                                    .height(44.dp),
                                shape = RoundedCornerShape(10.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF59E0B))
                            ) {
                                Text("🔀", fontSize = 14.sp)
                                Spacer(modifier = Modifier.width(6.dp))
                                Text("Share", color = Color(0xFF0F172A), fontWeight = FontWeight.Black, fontSize = 13.sp)
                            }
                        }

                        Spacer(modifier = Modifier.height(18.dp))

                        // 3-Step Process Indicator
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceAround
                        ) {
                            // Step 1
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Box(
                                    modifier = Modifier
                                        .size(30.dp)
                                        .clip(CircleShape)
                                        .background(Color(0xFF0F172A))
                                        .border(1.dp, Color(0xFFF3D079), CircleShape),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("1", color = Color(0xFFF3D079), fontWeight = FontWeight.Black, fontSize = 13.sp)
                                }
                                Spacer(modifier = Modifier.height(4.dp))
                                Text("Share your code", color = Color(0xFF94A3B8), fontSize = 11.sp, fontWeight = FontWeight.Medium)
                            }

                            // Step 2
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Box(
                                    modifier = Modifier
                                        .size(30.dp)
                                        .clip(CircleShape)
                                        .background(Color(0xFF0F172A))
                                        .border(1.dp, Color(0xFFF3D079), CircleShape),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("2", color = Color(0xFFF3D079), fontWeight = FontWeight.Black, fontSize = 13.sp)
                                }
                                Spacer(modifier = Modifier.height(4.dp))
                                Text("They sign up", color = Color(0xFF94A3B8), fontSize = 11.sp, fontWeight = FontWeight.Medium)
                            }

                            // Step 3
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Box(
                                    modifier = Modifier
                                        .size(30.dp)
                                        .clip(CircleShape)
                                        .background(Color(0xFF0F172A))
                                        .border(1.dp, Color(0xFFF3D079), CircleShape),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("3", color = Color(0xFFF3D079), fontWeight = FontWeight.Black, fontSize = 13.sp)
                                }
                                Spacer(modifier = Modifier.height(4.dp))
                                Text("You earn", color = Color(0xFF94A3B8), fontSize = 11.sp, fontWeight = FontWeight.Medium)
                            }
                        }
                    }
                }
            }

            // CARD 3: TOTAL REFERRALS
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF334155)),
                elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
            ) {
                Column(modifier = Modifier.fillMaxWidth()) {
                    // Dark Header Bar with Count Badge
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF162238))
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("👥", fontSize = 14.sp)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                text = "TOTAL REFERRALS",
                                color = Color.White,
                                fontWeight = FontWeight.Black,
                                fontSize = 12.sp,
                                letterSpacing = 0.5.sp
                            )
                        }

                        // Gold Pill Count Badge
                        Row(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFF0F172A))
                                .border(1.dp, Color(0xFFF3D079), RoundedCornerShape(12.dp))
                                .padding(horizontal = 10.dp, vertical = 3.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text("👤", fontSize = 11.sp)
                            Spacer(modifier = Modifier.width(4.dp))
                            Text(
                                text = "$referralsCount",
                                color = Color(0xFFF3D079),
                                fontWeight = FontWeight.Black,
                                fontSize = 12.sp
                            )
                        }
                    }

                    // Card Content: Empty State or Referred List
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        if (referredUsersList.isEmpty()) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                modifier = Modifier.padding(24.dp)
                            ) {
                                Text("👥", fontSize = 36.sp)
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    text = "No referrals yet",
                                    color = Color(0xFF94A3B8),
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        } else {
                            Column(
                                modifier = Modifier.fillMaxWidth(),
                                verticalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                referredUsersList.forEach { refItem ->
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(12.dp))
                                            .background(Color(0xFF0F172A))
                                            .border(1.dp, Color(0xFF334155), RoundedCornerShape(12.dp))
                                            .padding(12.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column {
                                            Text(
                                                text = refItem.name,
                                                color = Color.White,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 14.sp
                                            )
                                            Spacer(modifier = Modifier.height(2.dp))
                                            Text(
                                                text = "${refItem.mobile} • ${refItem.date}",
                                                color = Color(0xFF94A3B8),
                                                fontSize = 11.sp
                                            )
                                            Spacer(modifier = Modifier.height(2.dp))
                                            Text(
                                                text = "Bet Commission: ₹" + String.format("%.2f", refItem.betCommission),
                                                color = Color(0xFFF3D079),
                                                fontSize = 10.sp,
                                                fontWeight = FontWeight.Bold
                                            )
                                        }
                                        Text(
                                            text = "+₹" + String.format("%.2f", refItem.totalEarned),
                                            color = Color(0xFF00C853),
                                            fontWeight = FontWeight.Black,
                                            fontSize = 15.sp,
                                            fontFamily = FontFamily.Monospace
                                        )
                                    }
                                }
                            }
                        }
                    }
                }
            }
            }

            PullRefreshIndicator(
                refreshing = isLoading,
                state = pullRefreshState,
                modifier = Modifier.align(Alignment.TopCenter),
                backgroundColor = Color(0xFF1E293B),
                contentColor = Color(0xFFF3D079)
            )
        }
    }
}
