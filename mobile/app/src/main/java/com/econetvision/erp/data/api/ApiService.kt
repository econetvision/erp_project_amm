package com.econetvision.erp.data.api

import com.econetvision.erp.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    // Auth
    @POST("/api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<TokenResponse>

    @GET("/api/auth/me")
    suspend fun getMe(): Response<User>

    @PUT("/api/auth/me")
    suspend fun updateProfile(@Body request: UserUpdate): Response<User>

    @PUT("/api/auth/me/password")
    suspend fun changePassword(@Body request: PasswordChangeRequest): Response<Map<String, String>>

    // Employees
    @GET("/api/employees")
    suspend fun getEmployees(
        @Query("page") page: Int = 1,
        @Query("per_page") perPage: Int = 50,
        @Query("q") query: String? = null
    ): Response<PaginatedEmployees>

    @GET("/api/employees/{id}")
    suspend fun getEmployee(@Path("id") id: Int): Response<Employee>

    // Attendance
    @POST("/api/attendance/clock-in")
    suspend fun clockIn(@Body data: ClockInRequest): Response<Attendance>

    @PATCH("/api/attendance/{id}/clock-out")
    suspend fun clockOut(@Path("id") id: Int, @Body data: ClockOutRequest): Response<Attendance>

    @POST("/api/attendance/face-scan")
    suspend fun faceScan(@Body data: FaceScanRequest): Response<FaceScanResponse>

    @GET("/api/attendance/{empId}/today")
    suspend fun getTodayStatus(@Path("empId") empId: Int): Response<Attendance>

    @GET("/api/attendance/{empId}/monthly")
    suspend fun getMonthlyReport(
        @Path("empId") empId: Int,
        @Query("month") month: Int,
        @Query("year") year: Int
    ): Response<MonthlyReport>

    // Notifications
    @GET("/api/notifications")
    suspend fun getNotifications(
        @Query("limit") limit: Int = 50,
        @Query("unread_only") unreadOnly: Boolean = false
    ): Response<List<Notification>>

    @GET("/api/notifications/unread-count")
    suspend fun getUnreadCount(): Response<UnreadCount>

    @PATCH("/api/notifications/{id}/read")
    suspend fun markNotificationRead(@Path("id") id: Int): Response<Notification>

    @PATCH("/api/notifications/read-all")
    suspend fun markAllNotificationsRead(): Response<Map<String, String>>

    // Holidays
    @GET("/api/holidays")
    suspend fun getHolidays(@Query("year") year: Int? = null): Response<List<Holiday>>
}
