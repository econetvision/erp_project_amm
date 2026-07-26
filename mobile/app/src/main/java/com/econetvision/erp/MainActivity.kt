package com.econetvision.erp

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.navigation.fragment.NavHostFragment
import androidx.navigation.ui.setupWithNavController
import com.econetvision.erp.data.api.RetrofitClient
import com.econetvision.erp.data.local.SessionManager
import com.econetvision.erp.databinding.ActivityMainBinding
import com.econetvision.erp.ui.auth.LoginActivity

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val navHostFragment = supportFragmentManager
            .findFragmentById(R.id.nav_host_fragment) as NavHostFragment
        val navController = navHostFragment.navController

        binding.bottomNav.setupWithNavController(navController)

        val session = SessionManager(this)
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

    override fun onDestroy() {
        // Revert to the base handler so a stale Activity reference isn't held.
        val session = SessionManager(this)
        RetrofitClient.onUnauthorized = { session.clear() }
        super.onDestroy()
    }
}
