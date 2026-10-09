package com.econetvision.erp.attendance.data

import com.econetvision.erp.attendance.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object RetrofitClient {
    private var authInterceptor: AuthInterceptor? = null

    fun init(interceptor: AuthInterceptor) {
        authInterceptor = interceptor
    }

    val instance: ApiService by lazy {
        // BODY logging writes the bearer token, passwords and the base64 face
        // images into logcat. Keep full bodies for debug builds only.
        val logging = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BODY
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        }

        val client = OkHttpClient.Builder()
            .addInterceptor(authInterceptor ?: AuthInterceptor { null })
            .addInterceptor(logging)
            .connectTimeout(20, TimeUnit.SECONDS)
            // A scan uploads a base64 JPEG and the backend then runs face
            // recognition on it; short timeouts fail on mobile data.
            .writeTimeout(45, TimeUnit.SECONDS)
            .readTimeout(45, TimeUnit.SECONDS)
            .build()

        Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ApiService::class.java)
    }
}
