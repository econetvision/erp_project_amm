package com.econetvision.erp.data.api

import com.econetvision.erp.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object RetrofitClient {
    private var authInterceptor: AuthInterceptor? = null

    // Set by MainActivity to clear the session and redirect to login on 401.
    var onUnauthorized: (() -> Unit)? = null

    fun init(interceptor: AuthInterceptor) {
        authInterceptor = interceptor
    }

    val instance: ApiService by lazy {
        // BODY logging writes the bearer token, login passwords and the base64
        // face images straight into logcat, which any app with READ_LOGS (or
        // anyone with adb) can read. Keep full bodies for debug builds only.
        val logging = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BODY
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        }

        val client = OkHttpClient.Builder()
            .addInterceptor(authInterceptor ?: AuthInterceptor { null })
            .addInterceptor { chain ->
                val response = chain.proceed(chain.request())
                if (response.code == 401) {
                    onUnauthorized?.invoke()
                }
                response
            }
            .addInterceptor(logging)
            .connectTimeout(20, TimeUnit.SECONDS)
            // Face clock-in/out uploads a base64 JPEG and the backend then runs
            // face recognition on it — 15s round-trips were timing out on mobile
            // data. The write timeout matters as much as the read one here.
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
