package com.econetvision.erp.attendance

import android.app.Application
import com.econetvision.erp.attendance.data.AuthInterceptor
import com.econetvision.erp.attendance.data.RetrofitClient
import com.econetvision.erp.attendance.data.SessionManager

class AttendanceApp : Application() {
    override fun onCreate() {
        super.onCreate()
        val session = SessionManager(this)
        RetrofitClient.init(AuthInterceptor { session.getToken() })
    }
}
