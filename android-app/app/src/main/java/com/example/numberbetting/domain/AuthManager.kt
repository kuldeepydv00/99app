package com.example.numberbetting.domain

import android.content.Context
import android.content.SharedPreferences

object AuthManager {
    private const val PREF_NAME = "matka99x_auth_prefs"
    private const val KEY_IS_LOGGED_IN = "is_logged_in"
    private const val KEY_USER_NAME = "user_name"
    private const val KEY_USER_PHONE = "user_phone"

    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
    }

    fun isLoggedIn(context: Context): Boolean {
        return getPrefs(context).getBoolean(KEY_IS_LOGGED_IN, false)
    }

    fun saveUserSession(context: Context, name: String, phone: String) {
        getPrefs(context).edit().apply {
            putBoolean(KEY_IS_LOGGED_IN, true)
            putString(KEY_USER_NAME, name)
            putString(KEY_USER_PHONE, phone)
            apply()
        }
    }

    fun getUserName(context: Context): String {
        return getPrefs(context).getString(KEY_USER_NAME, "Amit Rao") ?: "Amit Rao"
    }

    fun getUserPhone(context: Context): String {
        return getPrefs(context).getString(KEY_USER_PHONE, "8398988077") ?: "8398988077"
    }

    fun logout(context: Context) {
        getPrefs(context).edit().apply {
            putBoolean(KEY_IS_LOGGED_IN, false)
            apply()
        }
    }

    fun clearUserSession(context: Context) {
        logout(context)
    }
}
