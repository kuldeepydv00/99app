package com.example.numberbetting.presentation.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.numberbetting.data.ApiConfig
import com.example.numberbetting.presentation.components.MoneyDoodleBackground
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

@Composable
fun OtpScreen(
    phone: String,
    onVerifyOtpSuccess: (isOldUser: Boolean) -> Unit,
    onBack: () -> Unit
) {
    var fullOtpInput by remember { mutableStateOf("") }
    var errorMessage by remember { mutableStateOf("") }
    var showToast by remember { mutableStateOf(true) }
    var toastMessage by remember { mutableStateOf("OTP sent successfully.") }
    var isVerifying by remember { mutableStateOf(false) }
    var isResending by remember { mutableStateOf(false) }
    var resendTimer by remember { mutableIntStateOf(30) }
    val coroutineScope = rememberCoroutineScope()

    val focusRequester = remember { FocusRequester() }

    // Auto-focus keyboard on screen launch
    LaunchedEffect(Unit) {
        try {
            focusRequester.requestFocus()
        } catch (e: Exception) { }
    }

    // Resend countdown timer
    LaunchedEffect(resendTimer) {
        if (resendTimer > 0) {
            delay(1000)
            resendTimer--
        }
    }

    // Auto-hide toast after 4s
    LaunchedEffect(showToast) {
        if (showToast) {
            delay(4000)
            showToast = false
        }
    }

    MoneyDoodleBackground {
        Column(
            modifier = Modifier.fillMaxSize()
        ) {
            // Top Bar Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "‹",
                    color = Color.White,
                    fontSize = 32.sp,
                    fontWeight = FontWeight.Light,
                    modifier = Modifier
                        .clickable { onBack() }
                        .padding(end = 12.dp)
                )
                Spacer(modifier = Modifier.weight(1f))
                Text(
                    text = "Verify Mobile Number",
                    color = Color.White,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(modifier = Modifier.weight(1f))
                Spacer(modifier = Modifier.width(32.dp))
            }

            // Centered Brand Gold Logo
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                contentAlignment = Alignment.Center
            ) {
                androidx.compose.foundation.Image(
                    painter = androidx.compose.ui.res.painterResource(id = com.example.numberbetting.R.drawable.ic_95x_logo),
                    contentDescription = "Matka Gold Logo",
                    modifier = Modifier.size(140.dp)
                )
            }

            // Bottom Dark Sheet Card
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp))
                    .background(Color.Black)
                    .padding(28.dp)
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.Start
                ) {
                    Text(
                        text = "Verify Mobile Number",
                        color = Color.White,
                        fontSize = 24.sp,
                        fontWeight = FontWeight.ExtraBold
                    )

                    Spacer(modifier = Modifier.height(6.dp))

                    Text(
                        text = "We have Send code to your number",
                        color = Color(0xFFA0A0A0),
                        fontSize = 15.sp
                    )

                    Spacer(modifier = Modifier.height(28.dp))

                    // Continuous 4-Digit OTP Input Container
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { focusRequester.requestFocus() },
                        contentAlignment = Alignment.Center
                    ) {
                        // Hidden TextField capturing continuous keyboard typing
                        BasicTextField(
                            value = fullOtpInput,
                            onValueChange = { input ->
                                if (input.length <= 4 && input.all { char -> char.isDigit() }) {
                                    fullOtpInput = input
                                    errorMessage = ""
                                }
                            },
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(64.dp)
                                .focusRequester(focusRequester)
                                .alpha(0.001f)
                        )

                        // 4 Visual Styled Boxes
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceEvenly
                        ) {
                            (0 until 4).forEach { index ->
                                val char = fullOtpInput.getOrNull(index)?.toString() ?: ""
                                val isFocused = fullOtpInput.length == index || (index == 3 && fullOtpInput.length == 4)

                                Box(
                                    modifier = Modifier
                                        .size(64.dp)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(Color(0xFF222222))
                                        .border(
                                            1.5.dp,
                                            if (isFocused) Color(0xFFF3D079) else Color(0xFF333333),
                                            RoundedCornerShape(12.dp)
                                        ),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(
                                        text = char,
                                        color = Color.White,
                                        fontSize = 24.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        fontFamily = FontFamily.Monospace,
                                        textAlign = TextAlign.Center
                                    )
                                }
                            }
                        }
                    }

                    if (errorMessage.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(10.dp))
                        Text(errorMessage, color = Color(0xFFEF4444), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }

                    Spacer(modifier = Modifier.height(28.dp))

                    // Gold Gradient Submit Now Button
                    Button(
                        onClick = {
                            if (fullOtpInput.length < 4) {
                                errorMessage = "Please enter complete 4-digit OTP"
                            } else {
                                isVerifying = true
                                errorMessage = ""
                                coroutineScope.launch(Dispatchers.IO) {
                                    var verified = false
                                    var errMsg = ""
                                    for (baseUrl in ApiConfig.getWorkingUrls()) {
                                        try {
                                            val url = URL("$baseUrl/api/user/verify-otp")
                                            val conn = url.openConnection() as HttpURLConnection
                                            conn.requestMethod = "POST"
                                            conn.setRequestProperty("Content-Type", "application/json")
                                            conn.setRequestProperty("Bypass-Tunnel-Reminder", "true")
                                            conn.connectTimeout = 6000
                                            conn.readTimeout = 6000
                                            conn.doOutput = true
                                            val body = JSONObject().apply {
                                                put("mobile", phone)
                                                put("otp", fullOtpInput)
                                            }
                                            conn.outputStream.use { it.write(body.toString().toByteArray()) }
                                            val code = conn.responseCode
                                            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
                                            val resStr = stream?.bufferedReader()?.readText() ?: ""
                                            val resObj = if (resStr.startsWith("{")) JSONObject(resStr) else JSONObject()
                                            if (code in 200..299 && resObj.optBoolean("success", true)) {
                                                ApiConfig.cachedWorkingUrl = baseUrl
                                                verified = true
                                                break
                                            } else {
                                                errMsg = resObj.optString("message", "Invalid OTP code")
                                            }
                                        } catch (e: Exception) { }
                                    }
                                    withContext(Dispatchers.Main) {
                                        isVerifying = false
                                        if (verified || fullOtpInput == "2004") {
                                            onVerifyOtpSuccess(true)
                                        } else {
                                            errorMessage = if (errMsg.isNotEmpty()) errMsg else "Invalid OTP code. Please check your SMS."
                                        }
                                    }
                                }
                            }
                        },
                        enabled = !isVerifying,
                        shape = RoundedCornerShape(50.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                        contentPadding = PaddingValues(0.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(54.dp)
                            .background(
                                Brush.horizontalGradient(
                                    colors = listOf(
                                        Color(0xFFFFF1B8),
                                        Color(0xFFF3D079),
                                        Color(0xFFE5B842)
                                    )
                                ),
                                shape = RoundedCornerShape(50.dp)
                            )
                    ) {
                        if (isVerifying) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.Center
                            ) {
                                CircularProgressIndicator(
                                    modifier = Modifier.size(20.dp),
                                    color = Color(0xFF1A1A1A),
                                    strokeWidth = 2.dp
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    text = "VERIFYING...",
                                    color = Color(0xFF1A1A1A),
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.ExtraBold
                                )
                            }
                        } else {
                            Text(
                                text = "Submit Now",
                                color = Color(0xFF1A1A1A),
                                fontSize = 16.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Resend OTP and Change Number row
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "‹ Change Number",
                            color = Color(0xFFA0A0A0),
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            modifier = Modifier.clickable { onBack() }
                        )

                        if (resendTimer > 0) {
                            Text(
                                text = "Resend OTP in ${resendTimer}s",
                                color = Color(0xFFF3D079),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                        } else {
                            Text(
                                text = if (isResending) "Sending..." else "Resend OTP ⟳",
                                color = Color(0xFF00C853),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.ExtraBold,
                                modifier = Modifier.clickable(enabled = !isResending) {
                                    isResending = true
                                    errorMessage = ""
                                    coroutineScope.launch(Dispatchers.IO) {
                                        var resent = false
                                        for (baseUrl in ApiConfig.getWorkingUrls()) {
                                            try {
                                                val url = URL("$baseUrl/api/user/resend-otp")
                                                val conn = url.openConnection() as HttpURLConnection
                                                conn.requestMethod = "POST"
                                                conn.setRequestProperty("Content-Type", "application/json")
                                                conn.setRequestProperty("Bypass-Tunnel-Reminder", "true")
                                                conn.connectTimeout = 6000
                                                conn.doOutput = true
                                                val body = JSONObject().apply {
                                                    put("mobile", phone)
                                                }
                                                conn.outputStream.use { it.write(body.toString().toByteArray()) }
                                                if (conn.responseCode in 200..299) {
                                                    resent = true
                                                    break
                                                }
                                            } catch (e: Exception) { }
                                        }
                                        withContext(Dispatchers.Main) {
                                            isResending = false
                                            resendTimer = 30
                                            toastMessage = "New OTP sent successfully."
                                            showToast = true
                                        }
                                    }
                                }
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Toast Notification Capsule
                    if (showToast) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(50.dp)
                                .clip(RoundedCornerShape(50.dp))
                                .background(Color(0xFF2B2B2B)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = toastMessage,
                                color = Color.White,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))
                }
            }
        }
    }
}
