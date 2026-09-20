package com.example.numberbetting.presentation.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.numberbetting.presentation.components.MoneyDoodleBackground

@Composable
fun RegisterScreen(
    phone: String,
    onRegisterSuccess: (name: String, email: String, state: String, referralCode: String) -> Unit,
    onBack: () -> Unit
) {
    var nameInput by remember { mutableStateOf("") }
    var referralInput by remember { mutableStateOf("") }
    var termsAccepted by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf("") }

    MoneyDoodleBackground {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
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
                    text = "Register & Play",
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
                    .height(130.dp),
                contentAlignment = Alignment.Center
            ) {
                androidx.compose.foundation.Image(
                    painter = androidx.compose.ui.res.painterResource(id = com.example.numberbetting.R.drawable.ic_95x_logo),
                    contentDescription = "Matka Gold Logo",
                    modifier = Modifier.size(100.dp)
                )
            }

            // Bottom Dark Sheet Card
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(topStart = 32.dp, topEnd = 32.dp))
                    .background(Color.Black)
                    .padding(24.dp)
            ) {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.Start
                ) {
                    Text(
                        text = "Register & Play",
                        color = Color.White,
                        fontSize = 24.sp,
                        fontWeight = FontWeight.ExtraBold
                    )

                    Spacer(modifier = Modifier.height(4.dp))

                    Text(
                        text = "Create account to continue!",
                        color = Color(0xFFA0A0A0),
                        fontSize = 14.sp
                    )

                    Spacer(modifier = Modifier.height(20.dp))

                    // Input 1: Name
                    OutlinedTextField(
                        value = nameInput,
                        onValueChange = { nameInput = it; errorMessage = "" },
                        placeholder = { Text("Name", color = Color(0xFF666666)) },
                        singleLine = true,
                        shape = RoundedCornerShape(50.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedContainerColor = Color(0xFF1F1F1F),
                            unfocusedContainerColor = Color(0xFF1F1F1F),
                            focusedBorderColor = Color(0xFFF3D079),
                            unfocusedBorderColor = Color(0xFF333333)
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(54.dp)
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    // Input 2: Referral code
                    OutlinedTextField(
                        value = referralInput,
                        onValueChange = { referralInput = it; errorMessage = "" },
                        placeholder = { Text("Referral code (Optional)", color = Color(0xFF666666)) },
                        singleLine = true,
                        shape = RoundedCornerShape(50.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedContainerColor = Color(0xFF1F1F1F),
                            unfocusedContainerColor = Color(0xFF1F1F1F),
                            focusedBorderColor = Color(0xFFF3D079),
                            unfocusedBorderColor = Color(0xFF333333)
                        ),
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(54.dp)
                    )

                    Spacer(modifier = Modifier.height(16.dp))

                    // Terms Checkbox Row
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Checkbox(
                            checked = termsAccepted,
                            onCheckedChange = { termsAccepted = it },
                            colors = CheckboxDefaults.colors(
                                checkedColor = Color(0xFFF3D079),
                                uncheckedColor = Color(0xFF666666)
                            )
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                        Text(
                            text = "By signing up you will agree to our Privacy Policy And Terms",
                            color = Color(0xFFF3D079),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }

                    if (errorMessage.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(errorMessage, color = Color(0xFFEF4444), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    // Gold Gradient SUBMIT & PLAY Button
                    Button(
                        onClick = {
                            val finalName = if (nameInput.trim().isNotEmpty()) nameInput.trim() else "User"
                            if (!termsAccepted) {
                                errorMessage = "Please accept terms & privacy policy to continue"
                            } else {
                                onRegisterSuccess(finalName, "", "", referralInput.trim())
                            }
                        },
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
                        Text(
                            text = "SUBMIT & PLAY",
                            color = Color(0xFF1A1A1A),
                            fontSize = 16.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                    }

                    Spacer(modifier = Modifier.height(14.dp))

                    // Toast Notification Capsule
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(48.dp)
                            .clip(RoundedCornerShape(50.dp))
                            .background(Color(0xFF2B2B2B)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "OTP verified successfully.",
                            color = Color.White,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))
                }
            }
        }
    }
}
