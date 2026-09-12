package com.econetvision.erp.data.model

import com.google.gson.annotations.SerializedName

data class DeviceTokenRequest(
    val token: String,
    val platform: String = "android"
)

data class DeviceTokenDeleteRequest(
    val token: String
)

data class GeofencePingRequest(
    val latitude: Double,
    val longitude: Double,
    @SerializedName("accuracy_m") val accuracyM: Double? = null
)

data class GeofencePingResponse(
    /** False when the employee is not clocked in; the app should stop tracking. */
    val tracking: Boolean,
    val inside: Boolean,
    @SerializedName("distance_m") val distanceM: Double?,
    @SerializedName("nearest_location") val nearestLocation: String?,
    @SerializedName("ping_interval_s") val pingIntervalS: Int,
    /** "exit", "return" or null. */
    val event: String?
)
