package com.econetvision.erp.data.repository

import com.econetvision.erp.data.api.RetrofitClient
import com.econetvision.erp.data.model.AdminUser
import com.econetvision.erp.data.model.AdminUserCreate
import com.econetvision.erp.data.model.AdminUserUpdate
import com.econetvision.erp.data.model.PaginatedUsers

class UserRepository {
    private val api = RetrofitClient.instance

    suspend fun getUsers(page: Int = 1, query: String? = null): Result<PaginatedUsers> {
        return try {
            val response = api.getUsers(page = page, query = query)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Failed to load users"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun createUser(request: AdminUserCreate): Result<AdminUser> {
        return try {
            val response = api.createUser(request)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Failed to create user"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun updateUser(id: Int, request: AdminUserUpdate): Result<AdminUser> {
        return try {
            val response = api.updateUser(id, request)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Failed to update user"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun deleteUser(id: Int): Result<Unit> {
        return try {
            val response = api.deleteUser(id)
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Failed to delete user"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
