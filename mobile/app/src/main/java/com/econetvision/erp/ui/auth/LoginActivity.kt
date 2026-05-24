package com.econetvision.erp.ui.auth

import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.ViewModelProvider
import com.econetvision.erp.MainActivity
import com.econetvision.erp.data.api.AuthInterceptor
import com.econetvision.erp.data.api.RetrofitClient
import com.econetvision.erp.data.local.SessionManager
import com.econetvision.erp.databinding.ActivityLoginBinding
import com.econetvision.erp.ui.SecurityActivity
import com.econetvision.erp.util.SecurityUtils

class LoginActivity : AppCompatActivity() {
    private lateinit var binding: ActivityLoginBinding
    private lateinit var viewModel: LoginViewModel
    private lateinit var sessionManager: SessionManager

    override fun onCreate(savedInstanceState: Bundle?) {
        val splashScreen = installSplashScreen()
        super.onCreate(savedInstanceState)

        // Security Check: Developer Options
        if (SecurityUtils.isDeveloperOptionsEnabled(this)) {
            startActivity(Intent(this, SecurityActivity::class.java))
            finish()
            return
        }

        sessionManager = SessionManager(this)

        // Initialize Retrofit with auth interceptor
        RetrofitClient.init(AuthInterceptor { sessionManager.getToken() })

        // Already logged in?
        if (sessionManager.isLoggedIn()) {
            navigateToMain()
            return
        }

        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        viewModel = ViewModelProvider(this)[LoginViewModel::class.java]

        binding.btnLogin.setOnClickListener {
            val username = binding.etUsername.text.toString().trim()
            val password = binding.etPassword.text.toString().trim()
            if (username.isBlank() || password.isBlank()) {
                Toast.makeText(this, "Please enter username and password", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            viewModel.login(username, password)
        }

        viewModel.loginResult.observe(this) { result ->
            result.onSuccess { token ->
                sessionManager.saveToken(token)
                navigateToMain()
            }.onFailure { error ->
                Toast.makeText(this, error.message ?: "Login failed", Toast.LENGTH_LONG).show()
            }
        }

        viewModel.isLoading.observe(this) { loading ->
            binding.btnLogin.isEnabled = !loading
            binding.btnLogin.text = if (loading) "Signing in…" else "Sign In"
        }
    }

    private fun navigateToMain() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}
