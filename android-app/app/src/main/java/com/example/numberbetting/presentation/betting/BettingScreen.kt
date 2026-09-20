package com.example.numberbetting.presentation.betting

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.numberbetting.domain.GameScheduleManager
import com.example.numberbetting.presentation.components.MoneyDoodleBackground
import com.example.numberbetting.presentation.history.BetItemData
import com.example.numberbetting.presentation.theme.*

fun formatJodiDisplay(num: Int): String {
    val valNum = num % 100
    return if (valNum == 0) "00" else if (valNum < 10) "0$valNum" else "$valNum"
}

fun generateCrossingJodis(digitsStr: String, withJora: Boolean): List<Int> {
    val uniqueDigits = digitsStr.filter { it.isDigit() }.map { it.toString().toInt() }
    if (uniqueDigits.isEmpty()) return emptyList()

    val resultList = mutableListOf<Int>()
    for (d1 in uniqueDigits) {
        for (d2 in uniqueDigits) {
            if (!withJora && d1 == d2) continue
            val jodiNum = if (d1 == 0 && d2 == 0) 100 else d1 * 10 + d2
            resultList.add(jodiNum)
        }
    }
    return resultList.distinct()
}

data class ParsedJodiBet(
    val jodiStr: String,
    val numKey: Int,
    val amount: Int,
    val isPalat: Boolean = false
)

private fun processKotlinTokenGroup(
    tokens: List<String>,
    mainAmount: Int,
    palatAmount: Int,
    hasDotNotation: Boolean,
    withPalat: Boolean,
    results: MutableList<ParsedJodiBet>
) {
    val generatedJodis = mutableListOf<String>()

    for (token in tokens) {
        val cleanDigits = token.replace(Regex("[^0-9]"), "")
        if (cleanDigits.isEmpty()) continue

        if (cleanDigits.length == 1) {
            // Single digit rule: prefix zero (e.g. 3 -> 03)
            generatedJodis.add("0$cleanDigits")
        } else if (cleanDigits.length == 2) {
            generatedJodis.add(cleanDigits)
        } else {
            // Continuous String Rule: split every 2 digits
            var i = 0
            while (i < cleanDigits.length) {
                var chunk = if (i + 2 <= cleanDigits.length) cleanDigits.substring(i, i + 2) else cleanDigits.substring(i)
                if (chunk.length == 1) {
                    // Odd Number Rule: prefix zero to final single digit
                    chunk = "0$chunk"
                }
                generatedJodis.add(chunk)
                i += 2
            }
        }
    }

    for (jodiStr in generatedJodis) {
        val numVal = jodiStr.toIntOrNull() ?: 0
        val numKey = if (numVal == 0) 100 else numVal
        results.add(ParsedJodiBet(jodiStr, numKey, mainAmount))

        val shouldDoPalat = withPalat || (hasDotNotation && palatAmount > 0)
        if (shouldDoPalat) {
            val d1 = jodiStr[0]
            val d2 = jodiStr[1]
            if (d1 != d2) {
                val palatJodiStr = "$d2$d1"
                val palatNumVal = palatJodiStr.toIntOrNull() ?: 0
                val palatNumKey = if (palatNumVal == 0) 100 else palatNumVal
                val pAmt = if (hasDotNotation && palatAmount > 0) palatAmount else mainAmount
                results.add(ParsedJodiBet(palatJodiStr, palatNumKey, pAmt, isPalat = true))
            }
        }
    }
}

private data class KotlinAmountMatch(
    val startIndex: Int,
    val endIndex: Int,
    val mainAmount: Int,
    val palatAmount: Int,
    val hasDotNotation: Boolean,
    val fullMatchText: String
)

fun parseCopyPasteTextKotlin(rawText: String, withPalat: Boolean): List<ParsedJodiBet> {
    if (rawText.isBlank()) return emptyList()

    // RULE 1: Completely ignore and exclude any numbers inside bracketed timestamp formats
    val timestampRegex = Regex("\\[\\d{1,2}/\\d{1,2}(?:/\\d{2,4})?,\\s*\\d{1,2}:\\d{2}(?::\\d{2})?\\s*(?:AM|PM|am|pm|a\\.m\\.|p\\.m\\.)?\\]", RegexOption.IGNORE_CASE)
    val cleanedText = rawText.replace(timestampRegex, " ")

    val results = mutableListOf<ParsedJodiBet>()
    val lines = cleanedText.split(Regex("[\\r\\n;]+"))
    val accumulatedTokens = mutableListOf<String>()

    val amountRegex = Regex("(?:([\\(\\[\\{]\\s*\\d+(?:\\.\\d+)?\\s*[\\.\\,]\\s*\\d+(?:\\.\\d+)?\\s*[\\)\\]\\}])|([\\(\\[\\{]\\s*\\d+(?:\\.\\d+)?\\s*[\\)\\]\\}])|([@%₹#$=]\\s*\\d+(?:\\.\\d+)?)|((?:into|intu|\\*|×|x)\\s*\\d+(?:\\.\\d+)?))", RegexOption.IGNORE_CASE)

    for (rawLine in lines) {
        val line = rawLine.trim()
        if (line.isEmpty()) continue

        val matches = mutableListOf<KotlinAmountMatch>()
        val foundMatches = amountRegex.findAll(line)

        for (m in foundMatches) {
            val fullMatchStr = m.value
            var mainAmt = 0
            var palatAmt = 0
            var hasDot = false

            // Check dot notation
            val dotSub = Regex("[\\(\\[\\{]\\s*(\\d+(?:\\.\\d+)?)\\s*[\\.\\,]\\s*(\\d+(?:\\.\\d+)?)\\s*[\\)\\]\\}]").find(fullMatchStr)
            if (dotSub != null) {
                mainAmt = dotSub.groupValues[1].toDoubleOrNull()?.toInt() ?: 0
                palatAmt = dotSub.groupValues[2].toDoubleOrNull()?.toInt() ?: 0
                hasDot = true
            } else {
                // Check bracket
                val brkSub = Regex("[\\(\\[\\{]\\s*(\\d+(?:\\.\\d+)?)\\s*[\\)\\]\\}]").find(fullMatchStr)
                if (brkSub != null) {
                    mainAmt = brkSub.groupValues[1].toDoubleOrNull()?.toInt() ?: 0
                } else {
                    // Check symbol
                    val symSub = Regex("([@%₹#$=])\\s*(\\d+(?:\\.\\d+)?)").find(fullMatchStr)
                    if (symSub != null) {
                        mainAmt = symSub.groupValues[2].toDoubleOrNull()?.toInt() ?: 0
                    } else {
                        // Check text indicator
                        val txtSub = Regex("(?:into|intu|\\*|×|x)\\s*(\\d+(?:\\.\\d+)?)", RegexOption.IGNORE_CASE).find(fullMatchStr)
                        if (txtSub != null) {
                            mainAmt = txtSub.groupValues[1].toDoubleOrNull()?.toInt() ?: 0
                        }
                    }
                }
            }

            if (mainAmt > 0) {
                matches.add(
                    KotlinAmountMatch(
                        startIndex = m.range.first,
                        endIndex = m.range.last + 1,
                        mainAmount = mainAmt,
                        palatAmount = palatAmt,
                        hasDotNotation = hasDot,
                        fullMatchText = fullMatchStr
                    )
                )
            }
        }

        if (matches.isNotEmpty()) {
            var lastPos = 0
            for (m in matches) {
                val precedingText = line.substring(lastPos, m.startIndex)
                lastPos = m.endIndex

                val lineTokens = precedingText.split(Regex("[\\s,:\\-\\/\\\\]+")).filter { it.trim().isNotEmpty() }
                accumulatedTokens.addAll(lineTokens)

                if (accumulatedTokens.isNotEmpty()) {
                    processKotlinTokenGroup(accumulatedTokens, m.mainAmount, m.palatAmount, m.hasDotNotation, withPalat, results)
                    accumulatedTokens.clear()
                }
            }

            val remainingText = line.substring(lastPos)
            val remainingTokens = remainingText.split(Regex("[\\s,:\\-\\/\\\\]+")).filter { it.trim().isNotEmpty() }
            if (remainingTokens.isNotEmpty()) {
                accumulatedTokens.addAll(remainingTokens)
            }
        } else {
            // Fallback check for trailing amount on line
            val trailingMatch = Regex("(?:^|\\s)(?:=|\\s)?(\\d+)\\s*$").find(line)
            if (trailingMatch != null) {
                val possibleAmt = trailingMatch.groupValues[1].toIntOrNull() ?: 0
                val textBeforeTrailing = line.substring(0, line.lastIndexOf(trailingMatch.value))
                val lineTokens = textBeforeTrailing.split(Regex("[\\s,:\\-\\/\\\\]+")).filter { it.trim().isNotEmpty() }

                accumulatedTokens.addAll(lineTokens)

                if (possibleAmt > 0 && accumulatedTokens.isNotEmpty()) {
                    processKotlinTokenGroup(accumulatedTokens, possibleAmt, 0, false, withPalat, results)
                    accumulatedTokens.clear()
                }
            } else {
                val lineTokens = line.split(Regex("[\\s,:\\-\\/\\\\]+")).filter { it.trim().isNotEmpty() }
                accumulatedTokens.addAll(lineTokens)
            }
        }
    }

    return results
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BettingScreen(
    gameTitle: String = "Gali",
    userBalance: Double = 0.00,
    placedBetsList: List<BetItemData> = emptyList(),
    onDeductBalance: (Double) -> Unit = {},
    onNavigateToWallet: () -> Unit = {},
    onBetPlaced: (List<BetItemData>) -> Unit = {},
    onBack: () -> Unit
) {
    var selectedTab by remember { mutableStateOf("JODI") } // JODI, PASTE, CROSSING, HAROOF
    
    // Jodi Tab State (Multi-Number Selection Map)
    val jodiStakesMap = remember { mutableStateMapOf<Int, String>() }
    var dialogNumberTarget by remember { mutableStateOf<Int?>(null) }
    var dialogStakeInput by remember { mutableStateOf("10") }

    // Copy-Paste Auto-Parser State
    var copyPasteInputText by remember { mutableStateOf("") }
    var copyPasteWithPalat by remember { mutableStateOf(false) }
    var copyPasteParsedList by remember { mutableStateOf<List<ParsedJodiBet>>(emptyList()) }
    var showFormatsDialog by remember { mutableStateOf(false) }
    
    // Crossing Tab State
    var crossingDigitsInput by remember { mutableStateOf("") }
    var crossingWithJora by remember { mutableStateOf(true) }
    var crossingStakeInput by remember { mutableStateOf("10") }

    // Haroof Tab State (Individual maps for Ander A0-A9 and Bahar B0-B9)
    val harufAnderStakesMap = remember { mutableStateMapOf<Int, String>() }
    val harufBaharStakesMap = remember { mutableStateMapOf<Int, String>() }
    var harufQuickASelected by remember { mutableStateOf(true) }
    var harufQuickBSelected by remember { mutableStateOf(false) }
    var harufQuickDigitsInput by remember { mutableStateOf("") }
    var harufQuickAmountInput by remember { mutableStateOf("") }

    var showSuccessToast by remember { mutableStateOf(false) }
    var successToastMsg by remember { mutableStateOf("") }
    var showInsufficientBalanceDialog by remember { mutableStateOf(false) }
    var minBetErrorMsg by remember { mutableStateOf("") }

    val schedule = GameScheduleManager.schedules[gameTitle]
    val gameState = GameScheduleManager.getGameState(gameTitle, emptyMap())
    val isOpen = gameState == GameScheduleManager.GameState.OPEN

    // Calculate total active stakes & count dynamically based on active tab
    val crossingGeneratedJodis = remember(crossingDigitsInput, crossingWithJora) {
        generateCrossingJodis(crossingDigitsInput, crossingWithJora)
    }
    val perCrossingStake = crossingStakeInput.toIntOrNull() ?: 0
    val totalCrossingStakeSum = crossingGeneratedJodis.size * perCrossingStake

    val totalHaroofStakeSum = remember(harufAnderStakesMap.toMap(), harufBaharStakesMap.toMap()) {
        harufAnderStakesMap.values.sumOf { it.toIntOrNull() ?: 0 } +
        harufBaharStakesMap.values.sumOf { it.toIntOrNull() ?: 0 }
    }

    val totalJodiStakeSum = remember(jodiStakesMap.toMap()) {
        jodiStakesMap.values.sumOf { it.toIntOrNull() ?: 0 }
    }

    val totalPasteStakeSum = remember(copyPasteParsedList) {
        copyPasteParsedList.sumOf { it.amount }
    }

    val currentTotalStakeSum = when (selectedTab) {
        "JODI" -> totalJodiStakeSum
        "PASTE" -> if (copyPasteParsedList.isNotEmpty()) totalPasteStakeSum else totalJodiStakeSum
        "CROSSING" -> totalCrossingStakeSum
        "HAROOF" -> totalHaroofStakeSum
        else -> 0
    }

    val activeSelectedCount = when (selectedTab) {
        "JODI" -> jodiStakesMap.values.count { (it.toIntOrNull() ?: 0) > 0 }
        "PASTE" -> copyPasteParsedList.size
        "CROSSING" -> crossingGeneratedJodis.size
        "HAROOF" -> (harufAnderStakesMap.values.count { (it.toIntOrNull() ?: 0) > 0 } + harufBaharStakesMap.values.count { (it.toIntOrNull() ?: 0) > 0 })
        else -> 0
    }

    Scaffold(
        bottomBar = {
            if (isOpen) {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = Color(0xFF0B101D),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF1E293B))
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        // Delete / Clear All Button on Left (100% Copy of Website UI)
                        Box(
                            modifier = Modifier
                                .height(48.dp)
                                .width(56.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFF182234))
                                .border(1.dp, Color(0xFF334155), RoundedCornerShape(12.dp))
                                .clickable {
                                    if (selectedTab == "JODI") jodiStakesMap.clear()
                                    else if (selectedTab == "CROSSING") {
                                        crossingDigitsInput = ""
                                        jodiStakesMap.clear()
                                    } else if (selectedTab == "HAROOF") {
                                        harufAnderStakesMap.clear()
                                        harufBaharStakesMap.clear()
                                    }
                                    minBetErrorMsg = ""
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.Center
                            ) {
                                Text("🗑️", fontSize = 15.sp)
                                Spacer(modifier = Modifier.width(3.dp))
                                Text(
                                    text = "$activeSelectedCount",
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp
                                )
                            }
                        }

                        // Bright Green Full-Width PLACE BET Button (100% Copy of Website UI)
                        Button(
                            onClick = {
                                minBetErrorMsg = ""
                                if (selectedTab == "JODI") {
                                    val validBets = jodiStakesMap.filter { (it.value.toIntOrNull() ?: 0) >= 1 }
                                    if (validBets.isEmpty()) {
                                        minBetErrorMsg = "Please enter stake amount on at least 1 number"
                                        return@Button
                                    }
                                    val totalReq = validBets.values.sumOf { it.toInt() }.toDouble()
                                    if (totalReq > userBalance) {
                                        showInsufficientBalanceDialog = true
                                    } else {
                                        onDeductBalance(totalReq)
                                        val currentTs = java.text.SimpleDateFormat("dd MMM, hh:mm a", java.util.Locale.getDefault()).format(java.util.Date())
                                        val newBetsList = validBets.map { (num, amtStr) ->
                                            val amt = amtStr.toInt().toDouble()
                                            BetItemData(
                                                id = "bet_" + System.currentTimeMillis() + "_" + num,
                                                gameName = "$gameTitle (Jodi)",
                                                number = num,
                                                stakeAmount = amt,
                                                potentialPayout = amt * 95,
                                                status = "pending",
                                                winAmount = 0.0,
                                                timestamp = currentTs
                                            )
                                        }
                                        onBetPlaced(newBetsList)
                                        jodiStakesMap.clear()
                                        successToastMsg = "🎉 ${newBetsList.size} Bets placed successfully for ₹${totalReq.toInt()}!"
                                        showSuccessToast = true
                                    }
                                } else if (selectedTab == "PASTE") {
                                    val activeList = if (copyPasteParsedList.isNotEmpty()) {
                                        copyPasteParsedList
                                    } else {
                                        parseCopyPasteTextKotlin(copyPasteInputText, copyPasteWithPalat).also {
                                            copyPasteParsedList = it
                                        }
                                    }
                                    if (activeList.isEmpty()) {
                                        minBetErrorMsg = "Paste valid numbers with amount e.g. 12 34 @20"
                                        return@Button
                                    }
                                    val totalReq = activeList.sumOf { it.amount }.toDouble()
                                    if (totalReq > userBalance) {
                                        showInsufficientBalanceDialog = true
                                    } else {
                                        onDeductBalance(totalReq)
                                        val currentTs = java.text.SimpleDateFormat("dd MMM, hh:mm a", java.util.Locale.getDefault()).format(java.util.Date())
                                        val newBetsList = activeList.map { item ->
                                            BetItemData(
                                                id = "bet_cp_" + System.currentTimeMillis() + "_" + item.numKey + "_" + (100..999).random(),
                                                gameName = "$gameTitle (Jodi)",
                                                number = item.numKey,
                                                stakeAmount = item.amount.toDouble(),
                                                potentialPayout = item.amount.toDouble() * 95,
                                                status = "pending",
                                                winAmount = 0.0,
                                                timestamp = currentTs
                                            )
                                        }
                                        onBetPlaced(newBetsList)
                                        copyPasteInputText = ""
                                        copyPasteParsedList = emptyList()
                                        successToastMsg = "🎉 ${newBetsList.size} Copy-Paste Bets placed for ₹${totalReq.toInt()}!"
                                        showSuccessToast = true
                                    }
                                } else if (selectedTab == "CROSSING") {
                                    if (crossingGeneratedJodis.isEmpty() || perCrossingStake < 1) {
                                        minBetErrorMsg = "Enter digits (e.g. 123) and minimum ₹1 stake per Jodi"
                                        return@Button
                                    }
                                    val totalReq = totalCrossingStakeSum.toDouble()
                                    if (totalReq > userBalance) {
                                        showInsufficientBalanceDialog = true
                                    } else {
                                        onDeductBalance(totalReq)
                                        val currentTs = java.text.SimpleDateFormat("dd MMM, hh:mm a", java.util.Locale.getDefault()).format(java.util.Date())
                                        val newBetsList = crossingGeneratedJodis.map { num ->
                                            BetItemData(
                                                id = "bet_" + System.currentTimeMillis() + "_" + num,
                                                gameName = "$gameTitle (Crossing)",
                                                number = num,
                                                stakeAmount = perCrossingStake.toDouble(),
                                                potentialPayout = perCrossingStake.toDouble() * 95,
                                                status = "pending",
                                                winAmount = 0.0,
                                                timestamp = currentTs
                                            )
                                        }
                                        onBetPlaced(newBetsList)
                                        crossingDigitsInput = ""
                                        jodiStakesMap.clear()
                                        successToastMsg = "🎉 ${crossingGeneratedJodis.size} Crossing Bets placed for ₹${totalReq.toInt()}!"
                                        showSuccessToast = true
                                    }
                                } else if (selectedTab == "HAROOF") {
                                    if (totalHaroofStakeSum < 1) {
                                        minBetErrorMsg = "Enter amount on at least one Haroof number"
                                        return@Button
                                    }
                                    val totalReq = totalHaroofStakeSum.toDouble()
                                    if (totalReq > userBalance) {
                                        showInsufficientBalanceDialog = true
                                    } else {
                                        onDeductBalance(totalReq)
                                        val currentTs = java.text.SimpleDateFormat("dd MMM, hh:mm a", java.util.Locale.getDefault()).format(java.util.Date())
                                        val newBetsList = mutableListOf<BetItemData>()
                                        harufAnderStakesMap.forEach { (digit, valStr) ->
                                            val amt = valStr.toDoubleOrNull() ?: 0.0
                                            if (amt > 0) {
                                                newBetsList.add(
                                                    BetItemData(
                                                        id = "har_a_" + System.currentTimeMillis() + "_" + digit,
                                                        gameName = "$gameTitle (Ander)",
                                                        number = digit,
                                                        stakeAmount = amt,
                                                        potentialPayout = amt * 9.5,
                                                        status = "pending",
                                                        winAmount = 0.0,
                                                        timestamp = currentTs
                                                    )
                                                )
                                            }
                                        }
                                        harufBaharStakesMap.forEach { (digit, valStr) ->
                                            val amt = valStr.toDoubleOrNull() ?: 0.0
                                            if (amt > 0) {
                                                newBetsList.add(
                                                    BetItemData(
                                                        id = "har_b_" + System.currentTimeMillis() + "_" + digit,
                                                        gameName = "$gameTitle (Bahar)",
                                                        number = digit,
                                                        stakeAmount = amt,
                                                        potentialPayout = amt * 9.5,
                                                        status = "pending",
                                                        winAmount = 0.0,
                                                        timestamp = currentTs
                                                    )
                                                )
                                            }
                                        }
                                        onBetPlaced(newBetsList)
                                        harufAnderStakesMap.clear()
                                        harufBaharStakesMap.clear()
                                        successToastMsg = "🎉 ${newBetsList.size} Haroof Bets placed for ₹${totalReq.toInt()}!"
                                        showSuccessToast = true
                                    }
                                }
                            },
                            modifier = Modifier
                                .weight(1f)
                                .height(48.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00C853))
                        ) {
                            Text(
                                text = "PLACE BET • ₹$currentTotalStakeSum",
                                color = Color.White,
                                fontWeight = FontWeight.Black,
                                fontSize = 15.sp,
                                letterSpacing = 0.5.sp
                            )
                        }
                    }
                }
            } else {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    color = Color(0xFF182234)
                ) {
                    Text(
                        text = "⏳ Result Pending for $gameTitle",
                        color = Color(0xFFF59E0B),
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                }
            }
        },
        containerColor = Color(0xFF0B101D)
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .background(Color(0xFF0B101D))
                .padding(horizontal = 10.dp)
        ) {
            // Top Header (100% Copy of Website Dark Header)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 8.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.weight(1f, fill = false)
                ) {
                    IconButton(onClick = onBack) {
                        Text("←", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                    }
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = gameTitle,
                        color = Color.White,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Black,
                        maxLines = 1
                    )
                }

                Spacer(modifier = Modifier.width(12.dp))

                // Balance Badge (100% Copy of Website Gold Badge)
                Row(
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFF0F172A))
                        .border(1.dp, Color(0xFFF3D079), RoundedCornerShape(12.dp))
                        .clickable { onNavigateToWallet() }
                        .padding(horizontal = 10.dp, vertical = 5.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("💳", fontSize = 12.sp)
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "₹ " + String.format("%.2f", userBalance),
                        color = Color(0xFFF3D079),
                        fontWeight = FontWeight.Black,
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("+", color = Color(0xFF00C853), fontWeight = FontWeight.Black, fontSize = 15.sp)
                }
            }

            // Sub Header Tabs (JODI | PASTE | CROSSING | HAROOF)
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.SpaceAround
            ) {
                listOf("JODI", "PASTE", "CROSSING", "HAROOF").forEach { tab ->
                    val isSelected = selectedTab == tab
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier
                            .clickable { selectedTab = tab }
                            .padding(horizontal = 8.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = tab,
                            color = if (isSelected) Color(0xFFF3D079) else Color(0xFF94A3B8),
                            fontWeight = if (isSelected) FontWeight.Black else FontWeight.Bold,
                            fontSize = 12.sp,
                            letterSpacing = 0.5.sp
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Box(
                            modifier = Modifier
                                .height(2.dp)
                                .width(32.dp)
                                .background(if (isSelected) Color(0xFFF3D079) else Color.Transparent)
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            if (!isOpen) {
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 6.dp),
                    color = Color(0xFFF59E0B).copy(alpha = 0.15f),
                    border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFF59E0B)),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text(
                        text = "⏳ RESULT PENDING FOR THIS MARKET",
                        color = Color(0xFFF59E0B),
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(vertical = 8.dp),
                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                    )
                }
            }

            when (selectedTab) {
                "JODI" -> {
                    Column(modifier = Modifier.fillMaxSize()) {
                        // Top Pill Controls Row (Paste | Type | Formats) matching reference image media_1789228099608.png!
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 4.dp, vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(20.dp))
                                    .background(Color(0xFF1E293B))
                                    .border(1.dp, Color(0xFF334155), RoundedCornerShape(20.dp))
                                    .padding(2.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(18.dp))
                                        .clickable { selectedTab = "PASTE" }
                                        .padding(horizontal = 14.dp, vertical = 6.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("Paste", color = Color(0xFF94A3B8), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                }
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(18.dp))
                                        .background(Color(0xFF00897B))
                                        .padding(horizontal = 14.dp, vertical = 6.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("Type", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                }
                            }

                            // Formats Badge Button
                            Row(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(20.dp))
                                    .border(1.dp, Color(0xFF00BFA5), RoundedCornerShape(20.dp))
                                    .clickable { showFormatsDialog = true }
                                    .padding(horizontal = 12.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("⚙️ Formats ", color = Color(0xFF00BFA5), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                Box(
                                    modifier = Modifier
                                        .clip(CircleShape)
                                        .background(Color(0xFF00897B))
                                        .padding(horizontal = 6.dp, vertical = 1.dp)
                                ) {
                                    Text("1", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 10.sp)
                                }
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("▼", color = Color(0xFF00BFA5), fontSize = 10.sp)
                            }
                        }

                        // Header bar inside Jodi Matrix
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 4.dp, vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "JODI MATRIX (01 - 00)",
                                color = Color(0xFF94A3B8),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp
                            )

                            Text(
                                text = "Clear All",
                                color = Color(0xFFF3D079),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Black,
                                modifier = Modifier
                                    .clickable { jodiStakesMap.clear() }
                                    .padding(4.dp)
                            )
                        }

                        if (minBetErrorMsg.isNotEmpty()) {
                            Text(
                                text = minBetErrorMsg,
                                color = Color(0xFFEF4444),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 4.dp, vertical = 2.dp)
                            )
                        }

                        // Interactive Bidding Matrix Grid (100% Copy of Website 5-Col Grid)
                        LazyVerticalGrid(
                            columns = GridCells.Fixed(5),
                            contentPadding = PaddingValues(bottom = 90.dp),
                            modifier = Modifier.fillMaxSize()
                        ) {
                            items(100, key = { it }) { index ->
                                val number = (index + 1) % 100
                                val numKey = if (number == 0) 100 else number
                                val currentStake = jodiStakesMap[numKey] ?: ""

                                JodiMatrixCellWebsiteCopy(
                                    number = numKey,
                                    stakeValue = currentStake,
                                    isOpen = isOpen,
                                    onCellClick = {
                                        dialogNumberTarget = numKey
                                        dialogStakeInput = if (currentStake.isNotEmpty()) currentStake else "10"
                                    },
                                    onStakeChange = { newStake ->
                                        if (newStake.isEmpty() || newStake.all { it.isDigit() }) {
                                            if (newStake.isEmpty() || newStake == "0") {
                                                jodiStakesMap.remove(numKey)
                                            } else {
                                                jodiStakesMap[numKey] = newStake
                                            }
                                        }
                                    }
                                )
                            }
                        }
                    }
                }

                "PASTE" -> {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(bottom = 90.dp)
                    ) {
                        // Top Pill Controls Row (Paste | Type | Formats) matching media_1789228099608.png!
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(20.dp))
                                    .background(Color(0xFF1E293B))
                                    .border(1.dp, Color(0xFF334155), RoundedCornerShape(20.dp))
                                    .padding(2.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(18.dp))
                                        .background(Color(0xFF00897B))
                                        .padding(horizontal = 14.dp, vertical = 6.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("Paste", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                }
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(18.dp))
                                        .clickable { selectedTab = "JODI" }
                                        .padding(horizontal = 14.dp, vertical = 6.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text("Type", color = Color(0xFF94A3B8), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                }
                            }

                            // Formats Badge Button
                            Row(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(20.dp))
                                    .border(1.dp, Color(0xFF00BFA5), RoundedCornerShape(20.dp))
                                    .clickable { showFormatsDialog = true }
                                    .padding(horizontal = 12.dp, vertical = 6.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text("⚙️ Formats ", color = Color(0xFF00BFA5), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                                Box(
                                    modifier = Modifier
                                        .clip(CircleShape)
                                        .background(Color(0xFF00897B))
                                        .padding(horizontal = 6.dp, vertical = 1.dp)
                                ) {
                                    Text("1", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 10.sp)
                                }
                                Spacer(modifier = Modifier.width(4.dp))
                                Text("▼", color = Color(0xFF00BFA5), fontSize = 10.sp)
                            }
                        }

                        Spacer(modifier = Modifier.height(8.dp))

                        // Main Text Box + Right Action Buttons Card
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = Color(0xFF131B2A)),
                            border = androidx.compose.foundation.BorderStroke(1.5.dp, Color(0xFF263248))
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(12.dp),
                                horizontalArrangement = Arrangement.spacedBy(10.dp)
                            ) {
                                // Left Area: Multi-line TextField
                                Box(
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(150.dp)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(Color(0xFF0B101D))
                                        .border(1.dp, Color(0xFF263248), RoundedCornerShape(12.dp))
                                        .padding(10.dp)
                                ) {
                                    BasicTextField(
                                        value = copyPasteInputText,
                                        onValueChange = { copyPasteInputText = it },
                                        textStyle = TextStyle(color = Color.White, fontSize = 13.sp, fontFamily = FontFamily.Monospace),
                                        cursorBrush = SolidColor(Color(0xFF00C853)),
                                        modifier = Modifier.fillMaxSize()
                                    )
                                    if (copyPasteInputText.isEmpty()) {
                                        Column {
                                            Text("Paste your copied text here...", color = Color(0xFF64748B), fontSize = 12.sp, fontWeight = FontWeight.Medium)
                                            Spacer(modifier = Modifier.height(4.dp))
                                            Text("💡 Dot (.) Example: 10(50.10) ➔ 10=₹50 & Palat 01=₹10", color = Color(0xFF94A3B8), fontSize = 11.sp)
                                            Spacer(modifier = Modifier.height(2.dp))
                                            Text("Active Formats: (50), [50], {50}, @50, ₹50, into50, intu50", color = Color(0xFF64748B), fontSize = 10.sp)
                                        }
                                    }
                                }

                                // Right Column: DONE, With Palat, CLEAR
                                Column(
                                    modifier = Modifier.width(105.dp),
                                    verticalArrangement = Arrangement.spacedBy(8.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    // DONE Button
                                    Button(
                                        onClick = {
                                            copyPasteParsedList = parseCopyPasteTextKotlin(copyPasteInputText, copyPasteWithPalat)
                                        },
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(42.dp),
                                        shape = RoundedCornerShape(12.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00897B))
                                    ) {
                                        Text("DONE", color = Color.White, fontWeight = FontWeight.Black, fontSize = 13.sp)
                                    }

                                    // With Palat Checkbox
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(8.dp))
                                            .border(1.dp, Color(0xFF334155), RoundedCornerShape(8.dp))
                                            .clickable { copyPasteWithPalat = !copyPasteWithPalat }
                                            .padding(horizontal = 4.dp, vertical = 2.dp),
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Checkbox(
                                            checked = copyPasteWithPalat,
                                            onCheckedChange = { copyPasteWithPalat = it },
                                            colors = CheckboxDefaults.colors(
                                                checkedColor = Color(0xFF00897B),
                                                uncheckedColor = Color(0xFF64748B)
                                            ),
                                            modifier = Modifier.size(24.dp)
                                        )
                                        Spacer(modifier = Modifier.width(2.dp))
                                        Text("With Palat", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                    }

                                    // CLEAR Button
                                    Button(
                                        onClick = {
                                            copyPasteInputText = ""
                                            copyPasteParsedList = emptyList()
                                        },
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(42.dp),
                                        shape = RoundedCornerShape(12.dp),
                                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFE91E63))
                                    ) {
                                        Text("CLEAR", color = Color.White, fontWeight = FontWeight.Black, fontSize = 13.sp)
                                    }
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        // Hindi Notice Card (📌 जरूरी सूचना:)
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(containerColor = Color(0xFF162032)),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF2E3D56))
                        ) {
                            Column(modifier = Modifier.padding(14.dp)) {
                                Text(
                                    text = "📌 जरूरी सूचना:",
                                    color = Color(0xFFF3D079),
                                    fontWeight = FontWeight.Black,
                                    fontSize = 13.sp
                                )
                                Spacer(modifier = Modifier.height(6.dp))
                                 Text(
                                    text = "आपके दांव (bet) के पैसे सही तरीके से जुड़ें, इसके लिए नंबरों के आखिरी में अपनी पैसों की मात्रा (amount) नीचे दिए गए तरीकों में से किसी एक तरीके से जरूर लिखें:\n" +
                                           "(पैसे) या [पैसे] या {पैसे}\n" +
                                           "@पैसे, ₹पैसे, #पैसे, \$पैसे, %पैसे, =पैसे\n" +
                                           "intoपैसे, intuपैसे, *पैसे, ×पैसे\n" +
                                           "जैसे: 12 34 56 @20 या 123456789 (50)",
                                    color = Color(0xFFCBD5E1),
                                    fontSize = 11.sp,
                                    lineHeight = 16.sp,
                                    fontWeight = FontWeight.Medium
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "⚠️ एक बार आपके लगाए गये नम्बर चेक करले सही है या नहीं",
                                    color = Color(0xFF38BDF8),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        // Summary Review Table
                        if (copyPasteParsedList.isNotEmpty()) {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(14.dp),
                                colors = CardDefaults.cardColors(containerColor = Color(0xFF182234)),
                                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF00C853).copy(alpha = 0.5f))
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = "📋 GENERATED JODI BETS (${copyPasteParsedList.size})",
                                            color = Color(0xFF00C853),
                                            fontWeight = FontWeight.Black,
                                            fontSize = 13.sp
                                        )
                                        Text(
                                            text = "Total: ₹$totalPasteStakeSum",
                                            color = Color(0xFFF3D079),
                                            fontWeight = FontWeight.Black,
                                            fontSize = 13.sp
                                        )
                                    }

                                    Spacer(modifier = Modifier.height(8.dp))
                                    Divider(color = Color(0xFF263248))
                                    Spacer(modifier = Modifier.height(6.dp))

                                    copyPasteParsedList.forEachIndexed { idx, item ->
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(vertical = 4.dp),
                                            horizontalArrangement = Arrangement.SpaceBetween,
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                Text(
                                                    text = item.jodiStr,
                                                    color = Color.White,
                                                    fontWeight = FontWeight.Black,
                                                    fontSize = 16.sp,
                                                    fontFamily = FontFamily.Monospace
                                                )
                                                if (item.isPalat) {
                                                    Spacer(modifier = Modifier.width(6.dp))
                                                    Text(
                                                        text = "(Palat)",
                                                        color = Color(0xFFF59E0B),
                                                        fontSize = 10.sp,
                                                        fontWeight = FontWeight.Bold
                                                    )
                                                }
                                            }

                                            Row(verticalAlignment = Alignment.CenterVertically) {
                                                Text(
                                                    text = "₹${item.amount}",
                                                    color = Color(0xFF00C853),
                                                    fontWeight = FontWeight.Black,
                                                    fontSize = 14.sp
                                                )
                                                Spacer(modifier = Modifier.width(12.dp))
                                                Text(
                                                    text = "✕",
                                                    color = Color(0xFFEF4444),
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 14.sp,
                                                    modifier = Modifier
                                                        .clickable {
                                                            copyPasteParsedList = copyPasteParsedList.filterIndexed { i, _ -> i != idx }
                                                        }
                                                        .padding(4.dp)
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                "CROSSING" -> {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(bottom = 90.dp)
                    ) {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(16.dp),
                            colors = CardDefaults.cardColors(containerColor = Color(0xFF182234)),
                            border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF1E293B))
                        ) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(
                                        text = "🎲 CROSSING GENERATOR",
                                        color = Color(0xFFF3D079),
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Black
                                    )
                                    Text(
                                        text = "Clear All",
                                        color = Color(0xFFF3D079),
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.clickable {
                                            crossingDigitsInput = ""
                                        }
                                    )
                                }

                                Spacer(modifier = Modifier.height(10.dp))

                                OutlinedTextField(
                                    value = crossingDigitsInput,
                                    enabled = isOpen,
                                    onValueChange = { input ->
                                        val filtered = input.filter { it.isDigit() }
                                        if (filtered.length <= 10) {
                                            crossingDigitsInput = filtered
                                        }
                                    },
                                    placeholder = { Text("Enter Digits (e.g. 123)", color = Color(0xFF64748B)) },
                                    singleLine = true,
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedTextColor = Color.White,
                                        unfocusedTextColor = Color.White,
                                        focusedBorderColor = Color(0xFF00C853),
                                        unfocusedBorderColor = Color(0xFF334155),
                                        focusedContainerColor = Color(0xFF0F172A),
                                        unfocusedContainerColor = Color(0xFF0F172A),
                                        disabledTextColor = Color.Gray,
                                        disabledBorderColor = Color(0xFF1E293B),
                                        disabledContainerColor = Color(0xFF0B101D)
                                    )
                                )

                                Spacer(modifier = Modifier.height(12.dp))

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text("Joda Add", color = Color.White, fontSize = 13.sp)
                                    Switch(
                                        checked = crossingWithJora,
                                        enabled = isOpen,
                                        onCheckedChange = { crossingWithJora = it },
                                        colors = SwitchDefaults.colors(checkedThumbColor = Color(0xFF00C853))
                                    )
                                }

                                Spacer(modifier = Modifier.height(12.dp))

                                OutlinedTextField(
                                    value = crossingStakeInput,
                                    enabled = isOpen,
                                    onValueChange = { crossingStakeInput = it.filter { ch -> ch.isDigit() } },
                                    placeholder = { Text("Amount per Pair (₹)", color = Color(0xFF64748B)) },
                                    singleLine = true,
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedTextColor = Color.White,
                                        unfocusedTextColor = Color.White,
                                        focusedBorderColor = Color(0xFF00C853),
                                        unfocusedBorderColor = Color(0xFF334155),
                                        focusedContainerColor = Color(0xFF0F172A),
                                        unfocusedContainerColor = Color(0xFF0F172A),
                                        disabledTextColor = Color.Gray,
                                        disabledBorderColor = Color(0xFF1E293B),
                                        disabledContainerColor = Color(0xFF0B101D)
                                    )
                                )

                                if (crossingGeneratedJodis.isNotEmpty()) {
                                    Spacer(modifier = Modifier.height(12.dp))
                                    Text(
                                        text = "Generated ${crossingGeneratedJodis.size} Jodis • Total: ₹$totalCrossingStakeSum",
                                        color = Color(0xFF00C853),
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.sp
                                    )
                                    Spacer(modifier = Modifier.height(8.dp))

                                    // Display Generated Combination Cards Grid (100% Copy of Website)
                                    FlowRowLayout(
                                        jodiList = crossingGeneratedJodis,
                                        perJodiStake = perCrossingStake
                                    )
                                }
                            }
                        }
                    }
                }

                "HAROOF" -> {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(bottom = 90.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            // ANDER Column (Left Table)
                            Card(
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(containerColor = Color(0xFF182234)),
                                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF1E293B))
                            ) {
                                Column(modifier = Modifier.padding(10.dp)) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(Color(0xFF0F172A))
                                            .padding(vertical = 8.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = "ANDER",
                                            color = Color.White,
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.Black
                                        )
                                    }

                                    Spacer(modifier = Modifier.height(8.dp))

                                    (0..9).forEach { digit ->
                                        val amtStr = harufAnderStakesMap[digit] ?: ""
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(vertical = 3.dp)
                                                .clip(RoundedCornerShape(8.dp))
                                                .background(if (amtStr.isNotEmpty()) Color(0x99004D40) else Color(0xFF0F172A))
                                                .border(1.dp, if (amtStr.isNotEmpty()) Color(0xFF00C853) else Color(0xFF1E293B), RoundedCornerShape(8.dp))
                                                .padding(horizontal = 8.dp, vertical = 6.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Text(
                                                text = "A$digit",
                                                color = Color.White,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 13.sp
                                            )
                                            Row(
                                                verticalAlignment = Alignment.CenterVertically,
                                                modifier = Modifier
                                                    .width(64.dp)
                                                    .clip(RoundedCornerShape(6.dp))
                                                    .background(Color(0xFF182234))
                                                    .border(1.dp, Color(0xFF334155), RoundedCornerShape(6.dp))
                                                    .padding(horizontal = 4.dp, vertical = 2.dp)
                                            ) {
                                                Text("₹", color = Color.Gray, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                                androidx.compose.foundation.text.BasicTextField(
                                                    value = amtStr,
                                                    enabled = isOpen,
                                                    onValueChange = { input ->
                                                        val clean = input.filter { it.isDigit() }
                                                        if (clean.isEmpty() || (clean.toIntOrNull() ?: 0) <= 0) {
                                                            harufAnderStakesMap.remove(digit)
                                                        } else {
                                                            harufAnderStakesMap[digit] = clean
                                                        }
                                                    },
                                                    textStyle = androidx.compose.ui.text.TextStyle(
                                                        color = if (amtStr.isNotEmpty()) Color(0xFF69F0AE) else Color.White,
                                                        fontSize = 12.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                                                    ),
                                                    singleLine = true,
                                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                                    modifier = Modifier.fillMaxWidth()
                                                )
                                            }
                                        }
                                    }
                                }
                            }

                            // BAHAR Column (Right Table)
                            Card(
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(16.dp),
                                colors = CardDefaults.cardColors(containerColor = Color(0xFF182234)),
                                border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFF1E293B))
                            ) {
                                Column(modifier = Modifier.padding(10.dp)) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clip(RoundedCornerShape(10.dp))
                                            .background(Color(0xFF0F172A))
                                            .padding(vertical = 8.dp),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            text = "BAHAR",
                                            color = Color.White,
                                            fontSize = 13.sp,
                                            fontWeight = FontWeight.Black
                                        )
                                    }

                                    Spacer(modifier = Modifier.height(8.dp))

                                    (0..9).forEach { digit ->
                                        val amtStr = harufBaharStakesMap[digit] ?: ""
                                        Row(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .padding(vertical = 3.dp)
                                                .clip(RoundedCornerShape(8.dp))
                                                .background(if (amtStr.isNotEmpty()) Color(0x99004D40) else Color(0xFF0F172A))
                                                .border(1.dp, if (amtStr.isNotEmpty()) Color(0xFF00C853) else Color(0xFF1E293B), RoundedCornerShape(8.dp))
                                                .padding(horizontal = 8.dp, vertical = 6.dp),
                                            verticalAlignment = Alignment.CenterVertically,
                                            horizontalArrangement = Arrangement.SpaceBetween
                                        ) {
                                            Text(
                                                text = "B$digit",
                                                color = Color.White,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 13.sp
                                            )
                                            Row(
                                                verticalAlignment = Alignment.CenterVertically,
                                                modifier = Modifier
                                                    .width(64.dp)
                                                    .clip(RoundedCornerShape(6.dp))
                                                    .background(Color(0xFF182234))
                                                    .border(1.dp, Color(0xFF334155), RoundedCornerShape(6.dp))
                                                    .padding(horizontal = 4.dp, vertical = 2.dp)
                                            ) {
                                                Text("₹", color = Color.Gray, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                                androidx.compose.foundation.text.BasicTextField(
                                                    value = amtStr,
                                                    enabled = isOpen,
                                                    onValueChange = { input ->
                                                        val clean = input.filter { it.isDigit() }
                                                        if (clean.isEmpty() || (clean.toIntOrNull() ?: 0) <= 0) {
                                                            harufBaharStakesMap.remove(digit)
                                                        } else {
                                                            harufBaharStakesMap[digit] = clean
                                                        }
                                                    },
                                                    textStyle = androidx.compose.ui.text.TextStyle(
                                                        color = if (amtStr.isNotEmpty()) Color(0xFF69F0AE) else Color.White,
                                                        fontSize = 12.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        textAlign = androidx.compose.ui.text.style.TextAlign.Center
                                                    ),
                                                    singleLine = true,
                                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                                    modifier = Modifier.fillMaxWidth()
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        // Bottom Quick Input Bar (Matching media_1789405367655.jpg)
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFF182234))
                                .border(1.dp, Color(0xFF263248), RoundedCornerShape(12.dp))
                                .padding(8.dp),
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // A Button (Toggle)
                            Box(
                                modifier = Modifier
                                    .height(40.dp)
                                    .weight(0.8f)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (harufQuickASelected) Color(0xFF00897B) else Color(0xFF0F172A))
                                    .border(1.dp, if (harufQuickASelected) Color(0xFF00C853) else Color(0xFF334155), RoundedCornerShape(8.dp))
                                    .clickable { harufQuickASelected = !harufQuickASelected },
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "A",
                                    color = Color.White,
                                    fontWeight = FontWeight.Black,
                                    fontSize = 14.sp
                                )
                            }

                            // B Button (Toggle)
                            Box(
                                modifier = Modifier
                                    .height(40.dp)
                                    .weight(0.8f)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(if (harufQuickBSelected) Color(0xFF00897B) else Color(0xFF0F172A))
                                    .border(1.dp, if (harufQuickBSelected) Color(0xFF00C853) else Color(0xFF334155), RoundedCornerShape(8.dp))
                                    .clickable { harufQuickBSelected = !harufQuickBSelected },
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "B",
                                    color = Color.White,
                                    fontWeight = FontWeight.Black,
                                    fontSize = 14.sp
                                )
                            }

                            // Digits Input Field (Haroof)
                            Box(
                                modifier = Modifier
                                    .height(40.dp)
                                    .weight(1.3f)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Color(0xFF0F172A))
                                    .border(1.dp, Color(0xFF334155), RoundedCornerShape(8.dp))
                                    .padding(horizontal = 8.dp),
                                contentAlignment = Alignment.CenterStart
                            ) {
                                androidx.compose.foundation.text.BasicTextField(
                                    value = harufQuickDigitsInput,
                                    enabled = isOpen,
                                    onValueChange = { harufQuickDigitsInput = it.filter { ch -> ch.isDigit() } },
                                    textStyle = androidx.compose.ui.text.TextStyle(color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold),
                                    cursorBrush = androidx.compose.ui.graphics.SolidColor(Color(0xFF00C853)),
                                    singleLine = true,
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    modifier = Modifier.fillMaxWidth()
                                )
                                if (harufQuickDigitsInput.isEmpty()) {
                                    Text("Haroof", color = Color(0xFF64748B), fontSize = 12.sp)
                                }
                            }

                            // Amount Input Field
                            Box(
                                modifier = Modifier
                                    .height(40.dp)
                                    .weight(1.3f)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Color(0xFF0F172A))
                                    .border(1.dp, Color(0xFF334155), RoundedCornerShape(8.dp))
                                    .padding(horizontal = 8.dp),
                                contentAlignment = Alignment.CenterStart
                            ) {
                                androidx.compose.foundation.text.BasicTextField(
                                    value = harufQuickAmountInput,
                                    enabled = isOpen,
                                    onValueChange = { harufQuickAmountInput = it.filter { ch -> ch.isDigit() } },
                                    textStyle = androidx.compose.ui.text.TextStyle(color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold),
                                    cursorBrush = androidx.compose.ui.graphics.SolidColor(Color(0xFF00C853)),
                                    singleLine = true,
                                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                    modifier = Modifier.fillMaxWidth()
                                )
                                if (harufQuickAmountInput.isEmpty()) {
                                    Text("Amount", color = Color(0xFF64748B), fontSize = 12.sp)
                                }
                            }

                            // DONE Button
                            Button(
                                onClick = {
                                    if (!harufQuickASelected && !harufQuickBSelected) {
                                        minBetErrorMsg = "Select A (Ander) or B (Bahar)"
                                        return@Button
                                    }
                                    val addAmt = harufQuickAmountInput.toIntOrNull() ?: 0
                                    if (addAmt <= 0) {
                                        minBetErrorMsg = "Enter amount"
                                        return@Button
                                    }
                                    val digitsList = harufQuickDigitsInput.mapNotNull { ch -> ch.toString().toIntOrNull() }
                                    if (digitsList.isEmpty()) {
                                        minBetErrorMsg = "Enter Haroof numbers"
                                        return@Button
                                    }

                                    for (digit in digitsList) {
                                        if (harufQuickASelected) {
                                            val current = harufAnderStakesMap[digit]?.toIntOrNull() ?: 0
                                            val newVal = current + addAmt
                                            harufAnderStakesMap[digit] = newVal.toString()
                                        }
                                        if (harufQuickBSelected) {
                                            val current = harufBaharStakesMap[digit]?.toIntOrNull() ?: 0
                                            val newVal = current + addAmt
                                            harufBaharStakesMap[digit] = newVal.toString()
                                        }
                                    }

                                    harufQuickDigitsInput = ""
                                    harufQuickAmountInput = ""
                                    minBetErrorMsg = ""
                                },
                                enabled = isOpen,
                                modifier = Modifier
                                    .height(40.dp)
                                    .weight(1.4f),
                                shape = RoundedCornerShape(8.dp),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00897B))
                            ) {
                                Text("DONE", color = Color.White, fontWeight = FontWeight.Black, fontSize = 11.sp)
                            }
                        }
                    }
                }
            }
        }
    }

    // Quick Stake Tap Dialog for Mobile Screen
    if (dialogNumberTarget != null) {
        val targetNum = dialogNumberTarget!!
        val targetDisplay = formatJodiDisplay(targetNum)

        AlertDialog(
            onDismissRequest = { dialogNumberTarget = null },
            title = {
                Text(
                    text = "Enter Stake for Jodi $targetDisplay",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp
                )
            },
            text = {
                Column {
                    Text("Enter amount (₹) to bid on number $targetDisplay:", color = Color(0xFF94A3B8), fontSize = 13.sp)
                    Spacer(modifier = Modifier.height(10.dp))
                    OutlinedTextField(
                        value = dialogStakeInput,
                        onValueChange = { dialogStakeInput = it.filter { ch -> ch.isDigit() } },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.fillMaxWidth(),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedTextColor = Color.White,
                            unfocusedTextColor = Color.White,
                            focusedBorderColor = Color(0xFF00C853),
                            unfocusedBorderColor = Color(0xFF334155)
                        )
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        listOf(10, 50, 100, 500).forEach { preset ->
                            Box(
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Color(0xFF1E293B))
                                    .clickable { dialogStakeInput = preset.toString() }
                                    .padding(vertical = 8.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("+$preset", color = Color(0xFFF3D079), fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                        }
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val valInt = dialogStakeInput.toIntOrNull() ?: 0
                        if (valInt > 0) {
                            jodiStakesMap[targetNum] = valInt.toString()
                        } else {
                            jodiStakesMap.remove(targetNum)
                        }
                        dialogNumberTarget = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00C853))
                ) {
                    Text("Save Stake", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = {
                    jodiStakesMap.remove(targetNum)
                    dialogNumberTarget = null
                }) {
                    Text("Remove", color = Color(0xFFEF4444))
                }
            },
            containerColor = Color(0xFF0F172A)
        )
    }

    // Insufficient Balance Dialog
    if (showInsufficientBalanceDialog) {
        AlertDialog(
            onDismissRequest = { showInsufficientBalanceDialog = false },
            title = { Text("⚠️ Insufficient Wallet Balance", color = Color.White, fontWeight = FontWeight.Bold) },
            text = {
                Text(
                    text = "Your wallet balance (₹ ${String.format("%.2f", userBalance)}) is lower than the total bet amount. Please add cash to your wallet to continue.",
                    color = Color(0xFF94A3B8),
                    fontSize = 14.sp
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        showInsufficientBalanceDialog = false
                        onNavigateToWallet()
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00C853))
                ) {
                    Text("💵 Add Cash to Wallet", fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = {
                TextButton(onClick = { showInsufficientBalanceDialog = false }) {
                    Text("Cancel", color = Color.Gray)
                }
            },
            containerColor = Color(0xFF0F172A)
        )
    }

    // Success Dialog
    if (showSuccessToast) {
        AlertDialog(
            onDismissRequest = { showSuccessToast = false },
            title = { Text("🎉 Bet Placed Successfully!", color = Color.White, fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    Text("Game: $gameTitle", color = Color(0xFF94A3B8), fontSize = 14.sp)
                    Text(successToastMsg, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(6.dp))
                    Text("Remaining Balance: ₹ ${String.format("%.2f", userBalance)}", color = Color(0xFF00C853), fontSize = 14.sp)
                }
            },
            confirmButton = {
                Button(
                    onClick = { showSuccessToast = false },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00C853))
                ) {
                    Text("OK", fontWeight = FontWeight.Bold)
                }
            },
            containerColor = Color(0xFF0F172A)
        )
    }

    if (showFormatsDialog) {
        AlertDialog(
            onDismissRequest = { showFormatsDialog = false },
            title = { Text("💡 Supported Copy-Paste Formats", color = Color(0xFFF3D079), fontWeight = FontWeight.Bold, fontSize = 16.sp) },
            text = {
                Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                    Text("Format Examples:", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    Spacer(modifier = Modifier.height(6.dp))
                    val formats = listOf(
                        "12 34 56 @50" to "Jodis 12, 34, 56 for ₹50 each",
                        "123456789 (50)" to "Splits to 12, 34, 56, 78, 09 for ₹50 each",
                        "12 34 [100]" to "Jodis 12, 34 for ₹100 each",
                        "12{50}" to "Jodi 12 for ₹50",
                        "12 34 into 50" to "Jodis 12, 34 for ₹50 each",
                        "10(50.10)" to "Jodi 10 for ₹50, Palat 01 for ₹10"
                    )
                    formats.forEach { (ex, desc) ->
                        Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(ex, color = Color(0xFF00C853), fontWeight = FontWeight.Bold, fontSize = 12.sp, fontFamily = FontFamily.Monospace)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(desc, color = Color(0xFFCBD5E1), fontSize = 11.sp)
                        }
                        Divider(color = Color(0xFF1E293B))
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = { showFormatsDialog = false },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00897B))
                ) {
                    Text("OK, Got It", fontWeight = FontWeight.Bold)
                }
            },
            containerColor = Color(0xFF0F172A)
        )
    }
}

@Composable
fun FlowRowLayout(
    jodiList: List<Int>,
    perJodiStake: Int
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        val rows = jodiList.chunked(5)
        rows.forEach { rowItems ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 2.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                rowItems.forEach { num ->
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .height(42.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(Color(0xFF062C1E))
                            .border(1.dp, Color(0xFF00E676), RoundedCornerShape(8.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = formatJodiDisplay(num),
                                color = Color(0xFF00E676),
                                fontWeight = FontWeight.Black,
                                fontSize = 11.sp,
                                fontFamily = FontFamily.Monospace
                            )
                            Text(
                                text = "₹$perJodiStake",
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 9.sp
                            )
                        }
                    }
                }
                // Fill empty slots if row has fewer than 5 items
                for (i in 0 until (5 - rowItems.size)) {
                    Spacer(modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
fun JodiMatrixCellWebsiteCopy(
    number: Int,
    stakeValue: String,
    isOpen: Boolean,
    onCellClick: () -> Unit,
    onStakeChange: (String) -> Unit
) {
    val hasStake = stakeValue.isNotEmpty() && (stakeValue.toIntOrNull() ?: 0) > 0

    Box(
        modifier = Modifier
            .padding(3.dp)
            .height(58.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(if (hasStake) Color(0xFF062C1E) else Color(0xFF182234))
            .border(
                1.dp,
                if (hasStake) Color(0xFF00E676) else Color(0xFF222F43),
                RoundedCornerShape(12.dp)
            )
            .padding(horizontal = 4.dp, vertical = 6.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween,
            modifier = Modifier.fillMaxSize()
        ) {
            // Number Title (e.g. 01, 02, ... 00)
            Text(
                text = formatJodiDisplay(number),
                color = if (hasStake) Color(0xFF00E676) else Color(0xFFE2E8F0),
                fontWeight = FontWeight.Black,
                fontSize = 12.sp,
                fontFamily = FontFamily.Monospace
            )

            // Inner Input Capsule - Direct BasicTextField Typing without popup dialog!
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(26.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(Color(0xFF0F172A))
                    .border(1.dp, if (hasStake) Color(0xFF00E676) else Color(0xFF1E293B), RoundedCornerShape(6.dp))
                    .padding(horizontal = 2.dp),
                contentAlignment = Alignment.Center
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center,
                    modifier = Modifier.fillMaxSize()
                ) {
                    Text(
                        text = "₹",
                        color = Color(0xFF94A3B8),
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.width(1.dp))
                    BasicTextField(
                        value = stakeValue,
                        onValueChange = { onStakeChange(it) },
                        enabled = isOpen,
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Number
                        ),
                        textStyle = TextStyle(
                            color = if (hasStake) Color(0xFF00E676) else Color.White,
                            fontWeight = FontWeight.Black,
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            textAlign = TextAlign.Center
                        ),
                        cursorBrush = SolidColor(Color(0xFF00E676)),
                        modifier = Modifier.weight(1f)
                    )
                }
            }
        }
    }
}
