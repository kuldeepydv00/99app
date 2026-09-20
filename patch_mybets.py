import re

file_path = "android-app/app/src/main/java/com/example/numberbetting/presentation/history/MyBetsScreen.kt"
with open(file_path, "r") as f:
    code = f.read()

# Make sure TextOverflow is imported
if "import androidx.compose.ui.text.style.TextOverflow" not in code:
    code = "import androidx.compose.ui.text.style.TextOverflow\n" + code

old_column = """            // Details
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = bet.gameName,
                        color = Color.White,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = multiplierTag,
                        color = AccentEmerald,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = if (isHaroof) "$ts  •  Bet: ₹$safeStake" else "Bet: ₹$safeStake  •  Payout: ₹$safePayout",
                    color = TextSecondary,
                    fontSize = 12.sp
                )
            }"""

new_column = """            // Details
            Column(
                modifier = Modifier
                    .weight(1f)
                    .padding(end = 8.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = bet.gameName,
                        color = Color.White,
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = multiplierTag,
                        color = AccentEmerald,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        softWrap = false,
                        maxLines = 1
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = if (isHaroof) "$ts  •  Bet: ₹$safeStake" else "Bet: ₹$safeStake  •  Payout: ₹$safePayout",
                    color = TextSecondary,
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }"""

if old_column in code:
    code = code.replace(old_column, new_column)
    with open(file_path, "w") as f:
        f.write(code)
    print("Patched MyBetsScreen.kt successfully!")
else:
    print("Could not match old_column block!")
