package com.econetvision.erp.ui

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import com.econetvision.erp.databinding.ActivitySecurityBinding
import kotlin.system.exitProcess

class SecurityActivity : AppCompatActivity() {
    private lateinit var binding: ActivitySecurityBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivitySecurityBinding.inflate(layoutInflater)
        setContentView(binding.root)

        binding.btnExit.setOnClickListener {
            finishAffinity()
            exitProcess(0)
        }
    }

    override fun onBackPressed() {
        super.onBackPressed()
        finishAffinity()
        exitProcess(0)
    }
}
