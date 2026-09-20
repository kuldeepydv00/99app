file_path = "android-app/app/src/main/java/com/example/numberbetting/presentation/history/MyBetsScreen.kt"
with open(file_path, "r") as f:
    code = f.read()

code = code.replace("import androidx.compose.ui.text.style.TextOverflow\npackage com.example.numberbetting.presentation.history", "package com.example.numberbetting.presentation.history\n\nimport androidx.compose.ui.text.style.TextOverflow")
with open(file_path, "w") as f:
    f.write(code)
print("Fixed package order!")
