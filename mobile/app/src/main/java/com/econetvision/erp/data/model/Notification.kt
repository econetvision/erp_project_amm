package com.econetvision.erp.data.model

import com.google.gson.annotations.SerializedName

data class Notification(
    val id: Int,
    @SerializedName("user_id") val userId: Int,
    val title: String,
    val body: String?,
    val type: String,
    @SerializedName("is_read") val isRead: Boolean,
    @SerializedName("created_at") val createdAt: String
)

data class UnreadCount(
    val count: Int
)
