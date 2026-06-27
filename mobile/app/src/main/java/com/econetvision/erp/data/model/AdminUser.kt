package com.econetvision.erp.data.model

import com.google.gson.annotations.SerializedName

data class AdminUser(
    val id: Int,
    val username: String,
    val role: String,
    @SerializedName("company_id") val companyId: Int?,
    val email: String?,
    @SerializedName("display_name") val displayName: String?,
    val phone: String?,
    @SerializedName("photo_path") val photoPath: String?,
    val name: String?,
    @SerializedName("has_pin") val hasPin: Boolean?,
    @SerializedName("lock_timeout") val lockTimeout: Int?,
    @SerializedName("theme_preference") val themePreference: Map<String, Any>?,
    @SerializedName("is_active") val isActive: Boolean?,
    @SerializedName("created_at") val createdAt: String?,
    @SerializedName("updated_at") val updatedAt: String?
) : java.io.Serializable

data class PaginatedUsers(
    val items: List<AdminUser>,
    val total: Int,
    val page: Int,
    @SerializedName("per_page") val perPage: Int,
    val pages: Int
)

data class AdminUserCreate(
    val username: String,
    val password: String,
    val role: String,
    @SerializedName("company_id") val companyId: Int? = null,
    val email: String? = null,
    @SerializedName("display_name") val displayName: String? = null,
    val phone: String? = null
)

data class AdminUserUpdate(
    @SerializedName("display_name") val displayName: String? = null,
    val email: String? = null,
    val phone: String? = null,
    val role: String? = null,
    @SerializedName("company_id") val companyId: Int? = null,
    val password: String? = null
)
