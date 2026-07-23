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
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
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
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .build()

        Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(ApiService::class.java)
    }
}
