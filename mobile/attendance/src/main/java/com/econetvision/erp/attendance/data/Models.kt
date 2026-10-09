package com.econetvision.erp.attendance.data

import com.google.gson.annotations.SerializedName

data class LoginRequest(
    val username: String,
    val password: String,
    // Lets the backend enforce the first-login-from-browser rule for supervisors.
    val client: String = "android",
)

data class TokenResponse(
    @SerializedName("access_token") val accessToken: String,
    val role: String,
    val username: String,
    @SerializedName("display_name") val displayName: String?,
    @SerializedName("physical_attendance_site_id") val physicalAttendanceSiteId: Int?,
)

data class Site(
    val id: Int,
    @SerializedName("location_name") val locationName: String,
)

data class ScanRequest(
    val image: String,
    val latitude: Double?,
    val longitude: Double?,
)

data class ScanResponse(
    @SerializedName("employee_id") val employeeId: Int,
    @SerializedName("employee_name") val employeeName: String,
    @SerializedName("employee_code") val employeeCode: String?,
    val action: String, // "clock_in" or "clock_out"
    val time: String,   // "HH:MM:SS"
)

data class TodayEntry(
    @SerializedName("employee_id") val employeeId: Int,
    val name: String,
    @SerializedName("employee_code") val employeeCode: String?,
    @SerializedName("entry_time") val entryTime: String,
    @SerializedName("exit_time") val exitTime: String?,
)

data class TodayResponse(
    @SerializedName("site_name") val siteName: String,
    val date: String,
    @SerializedName("present_count") val presentCount: Int,
    val entries: List<TodayEntry>,
)
