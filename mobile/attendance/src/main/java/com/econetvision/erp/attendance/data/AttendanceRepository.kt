package com.econetvision.erp.attendance.data

import kotlinx.coroutines.CancellationException
import retrofit2.Response
import java.io.IOException

/** [code] is the HTTP status, or 0 when no response was received. */
class ApiException(val code: Int, message: String) : Exception(message)

class AttendanceRepository(private val api: ApiService = RetrofitClient.instance) {

    suspend fun login(username: String, password: String): Result<TokenResponse> =
        call("Sign in failed. Please try again.") { api.login(LoginRequest(username, password)) }

    suspend fun mySite(): Result<Site> =
        call("Could not load your site.") { api.mySite() }

    suspend fun scan(image: String, latitude: Double, longitude: Double): Result<ScanResponse> =
        call("Attendance could not be marked. Please try again.") {
            api.scan(ScanRequest(image, latitude, longitude))
        }

    suspend fun today(): Result<TodayResponse> =
        call("Could not load today's list.") { api.today() }

    private suspend fun <T> call(fallback: String, block: suspend () -> Response<T>): Result<T> =
        try {
            val response = block()
            val body = response.body()
            if (response.isSuccessful && body != null) {
                Result.success(body)
            } else {
                Result.failure(ApiException(response.code(), ApiError.parse(response.errorBody()?.string(), fallback)))
            }
        } catch (e: CancellationException) {
            throw e
        } catch (e: IOException) {
            Result.failure(ApiException(0, "Cannot reach the server. Check your internet connection and try again."))
        } catch (e: Exception) {
            Result.failure(ApiException(0, fallback))
        }
}
