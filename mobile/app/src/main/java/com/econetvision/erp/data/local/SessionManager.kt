package com.econetvision.erp.data.local

import android.content.Context
import android.content.SharedPreferences
import com.econetvision.erp.data.model.TokenResponse

class SessionManager(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("erp_session", Context.MODE_PRIVATE)

    fun saveToken(token: TokenResponse) {
        prefs.edit().apply {
            putString("access_token", token.accessToken)
            putString("role", token.role)
            putString("username", token.username)
            token.employeeId?.let { putInt("employee_id", it) }
            token.email?.let { putString("email", it) }
            token.displayName?.let { putString("display_name", it) }
            apply()
        }
    }

    fun getToken(): String? = prefs.getString("access_token", null)
    fun getRole(): String? = prefs.getString("role", null)
    fun getUsername(): String? = prefs.getString("username", null)
    fun getEmployeeId(): Int = prefs.getInt("employee_id", -1)
    fun getDisplayName(): String? = prefs.getString("display_name", null)
    fun getEmail(): String? = prefs.getString("email", null)
    fun getPhone(): String? = prefs.getString("phone", null)

    fun saveUser(user: com.econetvision.erp.data.model.User) {
        prefs.edit().apply {
            putString("display_name", user.displayName)
            putString("email", user.email)
            putString("phone", user.phone)
            apply()
        }
    }

    fun isLoggedIn(): Boolean = getToken() != null

    fun isMaster(): Boolean = getRole() == "master"

    /**
     * Employee and work-location screens: the backend guards these with
     * `require_admin_or_supervisor`.
     */
    fun canManage(): Boolean = getRole() in setOf("master", "admin", "supervisor")

    /**
     * User administration: every /api/auth/users endpoint is guarded by
     * `require_admin`, which excludes supervisors. Gating this with [canManage]
     * showed supervisors a screen where every call came back 403.
     */
    fun canManageUsers(): Boolean = getRole() in setOf("master", "admin")

    fun clear() {
        prefs.edit().clear().apply()
    }
}
