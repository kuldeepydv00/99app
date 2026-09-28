package com.example.numberbetting.domain

import android.content.Context
import android.content.SharedPreferences

object AuthManager {
    private const val PREF_NAME = "matka99x_auth_prefs"
    private const val KEY_IS_LOGGED_IN = "is_logged_in"
    private const val KEY_USER_NAME = "user_name"
    private const val KEY_USER_PHONE = "user_phone"
    private const val KEY_AUTH_TOKEN = "auth_token"

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

    // Saved the moment OTP verification succeeds on the server; sent as the Bearer
    // token on every protected API call (wallet, deposits, withdrawals, profile, etc.)
    fun saveAuthToken(context: Context, token: String) {
        getPrefs(context).edit().apply {
            putString(KEY_AUTH_TOKEN, token)
            apply()
        }
    }

    fun getAuthToken(context: Context): String? {
        return getPrefs(context).getString(KEY_AUTH_TOKEN, null)
    }

    fun logout(context: Context) {
        getPrefs(context).edit().apply {
            putBoolean(KEY_IS_LOGGED_IN, false)
            remove(KEY_AUTH_TOKEN)
            apply()
        }
    }

    fun clearUserSession(context: Context) {
        logout(context)
    }
}
