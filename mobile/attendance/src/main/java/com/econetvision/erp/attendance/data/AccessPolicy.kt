package com.econetvision.erp.attendance.data

/**
 * Who may use this app. The backend enforces the same rule on every request
 * (`require_physical_attendance`); this check only gives a clear message at login.
 */
object AccessPolicy {
    fun canUse(role: String?, siteId: Int?): Boolean = role == "supervisor" && siteId != null
}
