package com.econetvision.erp.data.model

import com.google.gson.annotations.SerializedName

data class LoginRequest(
    val username: String,
    val password: String
)

data class TokenResponse(
    @SerializedName("access_token") val accessToken: String,
    @SerializedName("token_type") val tokenType: String,
    val role: String,
    val username: String,
    @SerializedName("employee_id") val employeeId: Int?,
    val email: String?,
    @SerializedName("display_name") val displayName: String?,
    @SerializedName("lock_timeout") val lockTimeout: Int?,
    @SerializedName("has_pin") val hasPin: Boolean?,
    @SerializedName("theme_preference") val themePreference: Map<String, Any>?
)

data class User(
    val id: Int,
    val username: String,
    val role: String,
    @SerializedName("employee_id") val employeeId: Int?,
    val email: String?,
    @SerializedName("display_name") val displayName: String?,
    val phone: String?,
    @SerializedName("photo_path") val photoPath: String?,
    @SerializedName("lock_timeout") val lockTimeout: Int?,
    @SerializedName("theme_preference") val themePreference: Map<String, Any>?
)

data class UserUpdate(
    @SerializedName("display_name") val displayName: String?,
    val email: String?,
    val phone: String?,
    @SerializedName("lock_timeout") val lockTimeout: Int? = null,
    @SerializedName("theme_preference") val themePreference: Map<String, Any>? = null
)

data class PasswordChangeRequest(
    @SerializedName("current_password") val currentPassword: String,
    @SerializedName("new_password") val newPassword: String
)
