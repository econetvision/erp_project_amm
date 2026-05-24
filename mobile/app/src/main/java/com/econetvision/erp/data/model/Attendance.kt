package com.econetvision.erp.data.model

import com.google.gson.annotations.SerializedName

data class Attendance(
    val id: Int,
    @SerializedName("employee_id") val employeeId: Int,
    val date: String,
    @SerializedName("entry_time") val entryTime: String,
    @SerializedName("exit_time") val exitTime: String?,
    @SerializedName("hours_worked") val hoursWorked: Double?,
    @SerializedName("clock_in_latitude") val clockInLatitude: Double?,
    @SerializedName("clock_in_longitude") val clockInLongitude: Double?,
    @SerializedName("clock_out_latitude") val clockOutLatitude: Double?,
    @SerializedName("clock_out_longitude") val clockOutLongitude: Double?
)

data class ClockInRequest(
    @SerializedName("employee_id") val employeeId: Int,
    val date: String,
    @SerializedName("entry_time") val entryTime: String,
    val image: String,
    val latitude: Double? = null,
    val longitude: Double? = null
)

data class ClockOutRequest(
    @SerializedName("exit_time") val exitTime: String,
    val image: String,
    val latitude: Double? = null,
    val longitude: Double? = null
)

data class FaceScanRequest(
    val image: String,
    val latitude: Double? = null,
    val longitude: Double? = null
)

data class FaceScanResponse(
    @SerializedName("employee_id") val employeeId: Int,
    @SerializedName("employee_name") val employeeName: String,
    val action: String,
    val attendance: Attendance
)

data class MonthlyReport(
    @SerializedName("employee_id") val employeeId: Int,
    @SerializedName("employee_name") val employeeName: String,
    val month: Int,
    val year: Int,
    @SerializedName("total_days") val totalDays: Int,
    @SerializedName("total_hours") val totalHours: Double,
    val records: List<Attendance>
)
