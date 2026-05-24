package com.econetvision.erp.data.repository

import com.econetvision.erp.data.api.RetrofitClient
import com.econetvision.erp.data.model.*

class AttendanceRepository {
    private val api = RetrofitClient.instance

    suspend fun clockIn(
        employeeId: Int,
        date: String,
        entryTime: String,
        image: String,
        latitude: Double? = null,
        longitude: Double? = null
    ): Result<Attendance> {
        return try {
            val request = ClockInRequest(
                employeeId = employeeId,
                date = date,
                entryTime = entryTime,
                image = image,
                latitude = latitude,
                longitude = longitude
            )
            val response = api.clockIn(request)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Clock-in failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun clockOut(
        attendanceId: Int,
        exitTime: String,
        image: String,
        latitude: Double? = null,
        longitude: Double? = null
    ): Result<Attendance> {
        return try {
            val request = ClockOutRequest(
                exitTime = exitTime,
                image = image,
                latitude = latitude,
                longitude = longitude
            )
            val response = api.clockOut(attendanceId, request)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Clock-out failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun faceScan(image: String, latitude: Double? = null, longitude: Double? = null): Result<FaceScanResponse> {
        return try {
            val response = api.faceScan(FaceScanRequest(image = image, latitude = latitude, longitude = longitude))
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Face scan failed"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getTodayStatus(employeeId: Int): Result<Attendance?> {
        return try {
            val response = api.getTodayStatus(employeeId)
            if (response.isSuccessful) {
                Result.success(response.body())
            } else if (response.code() == 404) {
                Result.success(null)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Failed to get today's status"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun getMonthlyReport(employeeId: Int, month: Int, year: Int): Result<MonthlyReport> {
        return try {
            val response = api.getMonthlyReport(employeeId, month, year)
            if (response.isSuccessful && response.body() != null) {
                Result.success(response.body()!!)
            } else {
                Result.failure(Exception(response.errorBody()?.string() ?: "Failed to get monthly report"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
