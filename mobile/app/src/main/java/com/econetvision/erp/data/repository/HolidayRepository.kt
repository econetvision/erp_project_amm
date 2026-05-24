package com.econetvision.erp.data.repository

import com.econetvision.erp.data.api.RetrofitClient
import com.econetvision.erp.data.model.Holiday

class HolidayRepository {
    private val api = RetrofitClient.instance

    suspend fun getHolidays(year: Int? = null): Result<List<Holiday>> {
        return try {
            val response = api.getHolidays(year)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception("Failed to load holidays"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
