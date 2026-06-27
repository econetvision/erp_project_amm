package com.econetvision.erp.data.model

import com.google.gson.annotations.SerializedName

data class WorkLocation(
    val id: Int,
    @SerializedName("location_name") val locationName: String,
    @SerializedName("location_code") val locationCode: String?,
    val address: String?,
    val city: String?,
    val state: String?,
    val pincode: String?,
    val latitude: Double?,
    val longitude: Double?,
    @SerializedName("allowed_radius_m") val allowedRadiusM: Double?,
    @SerializedName("work_type") val workType: String?,
    @SerializedName("supervisor_id") val supervisorId: Int?,
    @SerializedName("is_active") val isActive: Boolean?,
    @SerializedName("created_by") val createdBy: Int?,
    @SerializedName("employee_count") val employeeCount: Int?,
    @SerializedName("created_at") val createdAt: String?,
    @SerializedName("updated_at") val updatedAt: String?
)

data class MyWorkLocation(
    @SerializedName("location_name") val locationName: String,
    val address: String?,
    val city: String?,
    val latitude: Double,
    val longitude: Double,
    @SerializedName("allowed_radius_m") val allowedRadiusM: Double,
    @SerializedName("is_primary") val isPrimary: Boolean
)
