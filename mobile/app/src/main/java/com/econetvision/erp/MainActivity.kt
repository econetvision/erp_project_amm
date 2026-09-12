package com.econetvision.erp

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.navigation.fragment.NavHostFragment
import androidx.navigation.ui.setupWithNavController
import com.econetvision.erp.data.api.RetrofitClient
import com.econetvision.erp.data.local.SessionManager
import com.econetvision.erp.databinding.ActivityMainBinding
import com.econetvision.erp.push.PushTokenManager
import com.econetvision.erp.ui.auth.LoginActivity

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding

    // Android 13+ needs runtime consent before any push/alert is shown.
    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { /* result is informational; push registration proceeds either way */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val navHostFragment = supportFragmentManager
            .findFragmentById(R.id.nav_host_fragment) as NavHostFragment
        val navController = navHostFragment.navController

        binding.bottomNav.setupWithNavController(navController)

        val session = SessionManager(this)

        if (savedInstanceState == null) {
            requestNotificationPermissionIfNeeded()
            if (intent?.getBooleanExtra("open_notifications", false) == true) {
                runCatching { navController.navigate(R.id.notificationsFragment) }
            }
        }
        // Re-sync the FCM token on every cold start: the backend re-owns it if a
        // different user logged in on this device.
        PushTokenManager.registerIfLoggedIn(this)

        RetrofitClient.onUnauthorized = {
            session.clear()
            runOnUiThread {
                startActivity(
                    Intent(this, LoginActivity::class.java).apply {
                        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                    }
                )
            }
        }
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        val granted = ContextCompat.checkSelfPermission(
            this, Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED
        if (!granted) notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
    }

    override fun onDestroy() {
        // Revert to the base handler so a stale Activity reference isn't held.
        val session = SessionManager(this)
        RetrofitClient.onUnauthorized = { session.clear() }
        super.onDestroy()
    }
}
