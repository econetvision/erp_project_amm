package com.econetvision.erp.attendance.data

import android.content.Context
import android.content.SharedPreferences

class SessionManager(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("erp_attendance_session", Context.MODE_PRIVATE)

    fun save(token: TokenResponse) {
        prefs.edit().apply {
            putString("access_token", token.accessToken)
            putString("username", token.username)
            putString("display_name", token.displayName)
            apply()
        }
    }

    fun getToken(): String? = prefs.getString("access_token", null)
    fun getDisplayName(): String? =
        prefs.getString("display_name", null) ?: prefs.getString("username", null)

    fun isLoggedIn(): Boolean = getToken() != null

    fun clear() {
        prefs.edit().clear().apply()
    }
}
