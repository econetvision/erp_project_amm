package com.econetvision.erp.data.repository

import com.econetvision.erp.data.api.RetrofitClient
import com.econetvision.erp.data.model.Notification
import com.econetvision.erp.data.model.UnreadCount

class NotificationRepository {
    private val api = RetrofitClient.instance

    suspend fun getNotifications(limit: Int = 50, unreadOnly: Boolean = false): Result<List<Notification>> {
        return try {
            val response = api.getNotifications(limit, unreadOnly)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Failed to load notifications"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getUnreadCount(): Result<Int> {
        return try {
            val response = api.getUnreadCount()
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!.count)
            } else {
                Result.success(0)
            }
        } catch (e: Exception) {
            Result.success(0)
        }
    }

    suspend fun markAsRead(id: Int): Result<Notification> {
        return try {
            val response = api.markNotificationRead(id)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Failed to mark notification as read"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun markAllAsRead(): Result<String> {
        return try {
            val response = api.markAllNotificationsRead()
            if (response.isSuccessful) {
                Result.success("All notifications marked as read")
            } else {
                Result.failure(Exception("Failed to mark all as read"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
