package com.econetvision.erp.data.repository

import com.econetvision.erp.data.api.RetrofitClient
import com.econetvision.erp.data.model.DeviceTokenDeleteRequest
import com.econetvision.erp.data.model.DeviceTokenRequest
import com.econetvision.erp.data.model.GeofencePingRequest
import com.econetvision.erp.data.model.GeofencePingResponse

class GeofenceRepository {
    private val api = RetrofitClient.instance

    /**
     * Report the current position. On HTTP 401 the auth interceptor already
     * cleared the session; the caller treats any failure as "keep trying"
     * unless [unauthorized] is set, in which case it should stop.
     */
    sealed class PingOutcome {
        data class Ok(val response: GeofencePingResponse) : PingOutcome()
        object Unauthorized : PingOutcome()
        data class Error(val message: String) : PingOutcome()
    }

    suspend fun ping(latitude: Double, longitude: Double, accuracyM: Double?): PingOutcome {
        return try {
            val response = api.geofencePing(GeofencePingRequest(latitude, longitude, accuracyM))
            when {
                response.isSuccessful && response.body() != null -> PingOutcome.Ok(response.body()!!)
                response.code() == 401 -> PingOutcome.Unauthorized
                else -> PingOutcome.Error(response.errorBody()?.string() ?: "Ping failed (${response.code()})")
            }
        } catch (e: Exception) {
            PingOutcome.Error(e.message ?: "Ping failed")
        }
    }

    suspend fun registerDeviceToken(token: String): Result<Unit> {
        return try {
            val response = api.registerDeviceToken(DeviceTokenRequest(token))
            if (response.isSuccessful) Result.success(Unit)
            else Result.failure(Exception(response.errorBody()?.string() ?: "Token registration failed"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun unregisterDeviceToken(token: String): Result<Unit> {
        return try {
            val response = api.unregisterDeviceToken(DeviceTokenDeleteRequest(token))
            if (response.isSuccessful) Result.success(Unit)
            else Result.failure(Exception(response.errorBody()?.string() ?: "Token removal failed"))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}
