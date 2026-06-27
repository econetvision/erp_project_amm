package com.econetvision.erp.data.repository

import com.econetvision.erp.data.api.RetrofitClient
import com.econetvision.erp.data.model.WorkLocation

class LocationRepository {
    private val api = RetrofitClient.instance

    suspend fun getWorkLocations(query: String? = null): Result<List<WorkLocation>> {
        return try {
            val response = api.getWorkLocations(query = query)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Failed to load work locations"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
