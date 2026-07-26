package com.econetvision.erp.ui

import android.os.Bundle
import androidx.activity.addCallback
import androidx.appcompat.app.AppCompatActivity
import com.econetvision.erp.databinding.ActivitySecurityBinding
import kotlin.system.exitProcess

class SecurityActivity : AppCompatActivity() {
    private lateinit var binding: ActivitySecurityBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySecurityBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnExit.setOnClickListener { exitApp() }

        // Back must not fall through to the app behind this screen. The overridden
        // onBackPressed() this replaces is deprecated and is skipped entirely once
        // predictive back is enabled, which would have defeated the gate.
        onBackPressedDispatcher.addCallback(this) { exitApp() }
    }

    private fun exitApp() {
        finishAffinity()
        exitProcess(0)
    }
}
