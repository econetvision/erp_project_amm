package com.econetvision.erp.data.model

import com.google.gson.annotations.SerializedName

data class LocationPushRequest(
    @SerializedName("vehicle_id") val vehicleId: Int,
    val latitude: Double,
    val longitude: Double,
    val speed: Double?
)

data class MyAssignment(
    @SerializedName("vehicle_id") val vehicleId: Int,
    @SerializedName("reg_number") val regNumber: String,
    val type: String,
    @SerializedName("assigned_at") val assignedAt: String
)
