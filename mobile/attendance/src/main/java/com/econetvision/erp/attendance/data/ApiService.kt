package com.econetvision.erp.attendance.data

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface ApiService {
    @POST("/api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<TokenResponse>

    @GET("/api/physical-attendance/me")
    suspend fun mySite(): Response<Site>

    @POST("/api/physical-attendance/scan")
    suspend fun scan(@Body request: ScanRequest): Response<ScanResponse>

    @GET("/api/physical-attendance/today")
    suspend fun today(): Response<TodayResponse>
}
