package com.econetvision.erp.data.model

import com.google.gson.annotations.SerializedName

data class Employee(
    val id: Int,
    val name: String,
    val gender: String?,
    @SerializedName("date_of_birth") val dateOfBirth: String?,
    @SerializedName("blood_group") val bloodGroup: String?,
    @SerializedName("marital_status") val maritalStatus: String?,
    @SerializedName("emergency_contact") val emergencyContact: String?,
    @SerializedName("emergency_name") val emergencyName: String?,
    val address: String?,
    @SerializedName("aadhar_number") val aadharNumber: String?,
    @SerializedName("bank_account_number") val bankAccountNumber: String?,
    @SerializedName("ifsc_code") val ifscCode: String?,
    @SerializedName("bank_name") val bankName: String?,
    @SerializedName("kyc_status") val kycStatus: String?,
    @SerializedName("hourly_rate") val hourlyRate: Double?,
    val shift: String?,
    val photo: String?,
    @SerializedName("work_location_name") val workLocationName: String?,
    @SerializedName("work_latitude") val workLatitude: Double?,
    @SerializedName("work_longitude") val workLongitude: Double?,
    @SerializedName("attendance_radius_m") val attendanceRadiusM: Double?,
    @SerializedName("created_at") val createdAt: String,
    @SerializedName("updated_at") val updatedAt: String
)

data class PaginatedEmployees(
    val items: List<Employee>,
    val total: Int,
    val page: Int,
    @SerializedName("per_page") val perPage: Int,
    val pages: Int
)
