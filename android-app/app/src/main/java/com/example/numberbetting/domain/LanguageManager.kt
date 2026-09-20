package com.example.numberbetting.domain

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue

object LanguageManager {
    var currentLanguage by mutableStateOf("English") // "English" or "Hindi"

    fun isHindi(): Boolean = currentLanguage == "Hindi"

    fun getText(en: String, hi: String): String {
        return if (isHindi()) hi else en
    }
}
