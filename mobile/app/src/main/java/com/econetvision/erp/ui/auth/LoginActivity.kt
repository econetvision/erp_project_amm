package com.econetvision.erp.ui.auth

import android.Manifest
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.os.Bundle
import android.util.Base64
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.lifecycle.ViewModelProvider
import com.econetvision.erp.MainActivity
import com.econetvision.erp.data.api.AuthInterceptor
import com.econetvision.erp.data.api.RetrofitClient
import com.econetvision.erp.data.local.SessionManager
import com.econetvision.erp.databinding.ActivityLoginBinding
import com.econetvision.erp.ui.SecurityActivity
import com.econetvision.erp.util.BiometricCredentialStore
import com.econetvision.erp.util.SecurityUtils
import java.io.ByteArrayOutputStream

class LoginActivity : AppCompatActivity() {
    private lateinit var binding: ActivityLoginBinding
    private lateinit var viewModel: LoginViewModel
    private lateinit var sessionManager: SessionManager
    private lateinit var biometricStore: BiometricCredentialStore
    private var pendingLoginUsername: String? = null
    private var pendingLoginPassword: String? = null

    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        if (permissions[Manifest.permission.CAMERA] == true) {
            takePictureLauncher.launch(null)
        } else {
            Toast.makeText(this, "Camera permission is required for face login", Toast.LENGTH_LONG).show()
        }
    }

    private val takePictureLauncher = registerForActivityResult(
        ActivityResultContracts.TakePicturePreview()
    ) { bitmap: Bitmap? ->
        if (bitmap != null) {
            val base64Image = bitmapToBase64(bitmap)
            viewModel.faceLogin(base64Image)
        } else {
            Toast.makeText(this, "Photo capture cancelled", Toast.LENGTH_SHORT).show()
        }
    }

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
        biometricStore = BiometricCredentialStore()

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
            pendingLoginUsername = username
            pendingLoginPassword = password
            viewModel.login(username, password)
        }

        binding.btnFaceLogin.setOnClickListener {
            checkCameraPermissionAndCapture()
        }

        if (BiometricCredentialStore.hasSavedCredentials(this) && isBiometricAvailable()) {
            binding.btnFingerprintLogin.visibility = android.view.View.VISIBLE
        }

        binding.btnFingerprintLogin.setOnClickListener {
            startFingerprintLogin()
        }

        viewModel.loginResult.observe(this) { result ->
            result.onSuccess { token ->
                sessionManager.saveToken(token)
                maybeOfferFingerprintEnrollment()
            }.onFailure { error ->
                Toast.makeText(this, error.message ?: "Login failed", Toast.LENGTH_LONG).show()
            }
        }

        viewModel.faceLoginResult.observe(this) { result ->
            result.onSuccess { token ->
                sessionManager.saveToken(token)
                navigateToMain()
            }.onFailure {
                Toast.makeText(
                    this,
                    "Face not recognized. Please log in with your username and password.",
                    Toast.LENGTH_LONG
                ).show()
            }
        }

        viewModel.isLoading.observe(this) { loading ->
            binding.btnLogin.isEnabled = !loading
            binding.btnLogin.text = if (loading) "Signing in…" else "Sign In"
            binding.btnFaceLogin.isEnabled = !loading
        }
    }

    private fun checkCameraPermissionAndCapture() {
        val cameraGranted = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        if (cameraGranted) {
            takePictureLauncher.launch(null)
        } else {
            cameraPermissionLauncher.launch(arrayOf(Manifest.permission.CAMERA))
        }
    }

    private fun bitmapToBase64(bitmap: Bitmap): String {
        val stream = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.JPEG, 85, stream)
        val byteArray = stream.toByteArray()
        return Base64.encodeToString(byteArray, Base64.NO_WRAP)
    }

    private fun isBiometricAvailable(): Boolean {
        val biometricManager = BiometricManager.from(this)
        return biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) ==
            BiometricManager.BIOMETRIC_SUCCESS
    }

    private fun maybeOfferFingerprintEnrollment() {
        val username = pendingLoginUsername
        val password = pendingLoginPassword
        if (username == null || password == null || !isBiometricAvailable() ||
            BiometricCredentialStore.hasSavedCredentials(this)
        ) {
            navigateToMain()
            return
        }

        AlertDialog.Builder(this)
            .setTitle("Enable fingerprint login?")
            .setMessage("Use your fingerprint to log in faster next time.")
            .setPositiveButton("Yes") { _, _ ->
                showEnrollBiometricPrompt(username, password)
            }
            .setNegativeButton("No") { _, _ ->
                navigateToMain()
            }
            .setOnCancelListener {
                navigateToMain()
            }
            .show()
    }

    private fun showEnrollBiometricPrompt(username: String, password: String) {
        val executor = ContextCompat.getMainExecutor(this)
        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                super.onAuthenticationSucceeded(result)
                val cipher = result.cryptoObject?.cipher
                if (cipher != null) {
                    biometricStore.saveCredentials(this@LoginActivity, username, password, cipher)
                    Toast.makeText(this@LoginActivity, "Fingerprint login enabled", Toast.LENGTH_SHORT).show()
                }
                navigateToMain()
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                super.onAuthenticationError(errorCode, errString)
                Toast.makeText(this@LoginActivity, "Fingerprint setup skipped: $errString", Toast.LENGTH_SHORT).show()
                navigateToMain()
            }

            override fun onAuthenticationFailed() {
                super.onAuthenticationFailed()
                Toast.makeText(this@LoginActivity, "Fingerprint not recognized", Toast.LENGTH_SHORT).show()
            }
        }

        val biometricPrompt = BiometricPrompt(this, executor, callback)
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Enable Fingerprint Login")
            .setSubtitle("Confirm your fingerprint to save credentials securely")
            .setNegativeButtonText("Skip")
            .build()

        try {
            val cipher = biometricStore.getEncryptCipher()
            biometricPrompt.authenticate(promptInfo, BiometricPrompt.CryptoObject(cipher))
        } catch (e: Exception) {
            Toast.makeText(this, "Fingerprint setup unavailable", Toast.LENGTH_SHORT).show()
            navigateToMain()
        }
    }

    private fun startFingerprintLogin() {
        val iv = BiometricCredentialStore.getSavedIv(this)
        if (iv == null) {
            Toast.makeText(this, "No saved fingerprint credentials", Toast.LENGTH_SHORT).show()
            return
        }

        val executor = ContextCompat.getMainExecutor(this)
        val callback = object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                super.onAuthenticationSucceeded(result)
                val cipher = result.cryptoObject?.cipher
                if (cipher == null) {
                    Toast.makeText(this@LoginActivity, "Fingerprint login failed", Toast.LENGTH_SHORT).show()
                    return
                }
                val credentials = biometricStore.loadCredentials(this@LoginActivity, cipher)
                if (credentials == null) {
                    Toast.makeText(this@LoginActivity, "Could not read saved credentials", Toast.LENGTH_SHORT).show()
                    return
                }
                val (username, password) = credentials
                viewModel.login(username, password)
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                super.onAuthenticationError(errorCode, errString)
                Toast.makeText(this@LoginActivity, "Fingerprint error: $errString", Toast.LENGTH_SHORT).show()
            }

            override fun onAuthenticationFailed() {
                super.onAuthenticationFailed()
                Toast.makeText(this@LoginActivity, "Fingerprint not recognized", Toast.LENGTH_SHORT).show()
            }
        }

        val biometricPrompt = BiometricPrompt(this, executor, callback)
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Fingerprint Login")
            .setSubtitle("Use your fingerprint to sign in")
            .setNegativeButtonText("Cancel")
            .build()

        try {
            val cipher = biometricStore.getDecryptCipher(iv)
            biometricPrompt.authenticate(promptInfo, BiometricPrompt.CryptoObject(cipher))
        } catch (e: Exception) {
            Toast.makeText(this, "Fingerprint login unavailable, please log in manually", Toast.LENGTH_LONG).show()
        }
    }

    private fun navigateToMain() {
        startActivity(Intent(this, MainActivity::class.java))
        finish()
    }
}
