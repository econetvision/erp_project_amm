package com.econetvision.erp

import android.app.Application
import com.econetvision.erp.data.api.AuthInterceptor
import com.econetvision.erp.data.api.RetrofitClient
import com.econetvision.erp.data.local.SessionManager

class ErpApplication : Application() {

    lateinit var sessionManager: SessionManager
        private set

    override fun onCreate() {
        super.onCreate()

        // Initialize SessionManager first
        sessionManager = SessionManager(this)

        // Initialize Retrofit with auth interceptor EARLY
        // This ensures the token provider is set before any API call
        RetrofitClient.init(AuthInterceptor { sessionManager.getToken() })
    }
}
