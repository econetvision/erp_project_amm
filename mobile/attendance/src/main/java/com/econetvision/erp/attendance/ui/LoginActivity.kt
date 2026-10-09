package com.econetvision.erp.attendance.ui

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.view.inputmethod.EditorInfo
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.econetvision.erp.attendance.R
import com.econetvision.erp.attendance.data.AccessPolicy
import com.econetvision.erp.attendance.data.AttendanceRepository
import com.econetvision.erp.attendance.data.SessionManager
import com.econetvision.erp.attendance.databinding.ActivityLoginBinding
import kotlinx.coroutines.launch

class LoginActivity : AppCompatActivity() {

    private lateinit var binding: ActivityLoginBinding
    private lateinit var session: SessionManager
    private val repository = AttendanceRepository()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        session = SessionManager(this)
        if (session.isLoggedIn()) {
            goHome()
            return
        }

        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // HomeActivity passes the reason when it ends the session (disabled, expired).
        intent.getStringExtra(EXTRA_MESSAGE)?.let { showError(it) }

        binding.btnLogin.setOnClickListener { submit() }
        binding.etPassword.setOnEditorActionListener { _, actionId, _ ->
            if (actionId == EditorInfo.IME_ACTION_DONE) {
                submit()
                true
            } else {
                false
            }
        }
    }

    private fun submit() {
        val username = binding.etUsername.text?.toString()?.trim().orEmpty()
        val password = binding.etPassword.text?.toString().orEmpty()
        if (username.isEmpty() || password.isEmpty()) {
            showError(getString(R.string.login_missing_fields))
            return
        }

        setLoading(true)
        lifecycleScope.launch {
            val result = repository.login(username, password)
            setLoading(false)
            result.fold(
                onSuccess = { token ->
                    if (AccessPolicy.canUse(token.role, token.physicalAttendanceSiteId)) {
                        session.save(token)
                        goHome()
                    } else {
                        showError(getString(R.string.not_enabled))
                    }
                },
                onFailure = { showError(it.message ?: getString(R.string.login_missing_fields)) },
            )
        }
    }

    private fun setLoading(loading: Boolean) {
        binding.progress.visibility = if (loading) View.VISIBLE else View.GONE
        binding.btnLogin.isEnabled = !loading
        if (loading) binding.tvError.visibility = View.GONE
    }

    private fun showError(message: String) {
        binding.tvError.text = message
        binding.tvError.visibility = View.VISIBLE
    }

    private fun goHome() {
        startActivity(Intent(this, HomeActivity::class.java))
        finish()
    }

    companion object {
        const val EXTRA_MESSAGE = "extra_message"
    }
}
