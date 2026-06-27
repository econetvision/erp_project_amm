package com.econetvision.erp.data.repository

import com.econetvision.erp.data.api.RetrofitClient
import com.econetvision.erp.data.model.LocationPushRequest
import com.econetvision.erp.data.model.MyAssignment

class TrackingRepository {
    private val api = RetrofitClient.instance

    suspend fun getMyAssignment(): Result<MyAssignment?> {
        return try {
            val response = api.getMyAssignment()
            if (response.isSuccessful) {
                Result.success(response.body())
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Failed to load vehicle assignment"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun pushLocation(vehicleId: Int, latitude: Double, longitude: Double, speed: Double?): Result<Unit> {
        return try {
            val response = api.pushLocation(LocationPushRequest(vehicleId, latitude, longitude, speed))
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Location push failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
