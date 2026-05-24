package com.econetvision.erp.data.repository

import com.econetvision.erp.data.api.RetrofitClient
import com.econetvision.erp.data.model.*

class AuthRepository {
    private val api = RetrofitClient.instance

    suspend fun login(username: String, password: String): Result<TokenResponse> {
        return try {
            val response = api.login(LoginRequest(username, password))
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Login failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateProfile(displayName: String?, email: String?, phone: String?): Result<User> {
        return try {
            val response = api.updateProfile(UserUpdate(displayName, email, phone))
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Update failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun changePassword(currentPassword: String, newPassword: String): Result<String> {
        return try {
            val response = api.changePassword(PasswordChangeRequest(currentPassword, newPassword))
            if (response.isSuccessful) {
                Result.success(response.body()?.get("detail") ?: "Password changed")
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Password change failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getMe(): Result<User> {
        return try {
            val response = api.getMe()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Failed to get user info"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
