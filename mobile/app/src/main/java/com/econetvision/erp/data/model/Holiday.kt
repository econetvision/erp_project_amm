package com.econetvision.erp.data.model

import com.google.gson.annotations.SerializedName

data class Holiday(
    val id: Int,
    val date: String,
    val name: String,
    @SerializedName("holiday_type") val holidayType: String,
    @SerializedName("is_optional") val isOptional: Boolean,
    @SerializedName("created_at") val createdAt: String
)
