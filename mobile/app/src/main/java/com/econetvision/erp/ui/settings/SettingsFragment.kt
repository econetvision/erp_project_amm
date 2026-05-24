package com.econetvision.erp.ui.settings

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.ViewModelProvider
import com.econetvision.erp.data.local.SessionManager
import com.econetvision.erp.databinding.FragmentSettingsBinding
import com.econetvision.erp.ui.auth.LoginActivity

class SettingsFragment : Fragment() {
    private var _binding: FragmentSettingsBinding? = null
    private val binding get() = _binding!!
    private lateinit var viewModel: SettingsViewModel
    private lateinit var session: SessionManager

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentSettingsBinding.inflate(inflater, container, false)
        viewModel = ViewModelProvider(this)[SettingsViewModel::class.java]
        session = SessionManager(requireContext())

        setupUI()
        observeViewModel()

        viewModel.loadUserProfile()

        return binding.root
    }

    private fun setupUI() {
        binding.tvUsername.text = "Username: ${session.getUsername() ?: "—"}"
        binding.tvRole.text = "Role: ${session.getRole() ?: "—"}"

        binding.etDisplayName.setText(session.getDisplayName())
        binding.etEmail.setText(session.getEmail())
        binding.etPhone.setText(session.getPhone())

        binding.btnSave.setOnClickListener {
            val displayName = binding.etDisplayName.text.toString()
            val email = binding.etEmail.text.toString()
            val phone = binding.etPhone.text.toString()
            viewModel.updateProfile(displayName, email, phone)
        }

        binding.btnChangePassword.setOnClickListener {
            val currentPw = binding.etCurrentPassword.text.toString()
            val newPw = binding.etNewPassword.text.toString()
            val confirmPw = binding.etConfirmPassword.text.toString()

            if (currentPw.isBlank() || newPw.isBlank()) {
                Toast.makeText(requireContext(), "Please fill in all password fields", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            if (newPw != confirmPw) {
                Toast.makeText(requireContext(), "New passwords do not match", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            if (newPw.length < 6) {
                Toast.makeText(requireContext(), "New password must be at least 6 characters", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            viewModel.changePassword(currentPw, newPw)
        }

        binding.btnLogout.setOnClickListener {
            session.clear()
            startActivity(Intent(requireContext(), LoginActivity::class.java))
            requireActivity().finish()
        }
    }

    private fun observeViewModel() {
        viewModel.user.observe(viewLifecycleOwner) { user ->
            binding.etDisplayName.setText(user.displayName)
            binding.etEmail.setText(user.email)
            binding.etPhone.setText(user.phone)
            session.saveUser(user)
        }

        viewModel.updateResult.observe(viewLifecycleOwner) { result ->
            if (result.isSuccess) {
                Toast.makeText(requireContext(), "Profile updated", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(requireContext(), "Error: ${result.exceptionOrNull()?.message}", Toast.LENGTH_LONG).show()
            }
        }

        viewModel.passwordResult.observe(viewLifecycleOwner) { result ->
            if (result.isSuccess) {
                Toast.makeText(requireContext(), "Password changed successfully", Toast.LENGTH_SHORT).show()
                binding.etCurrentPassword.text?.clear()
                binding.etNewPassword.text?.clear()
                binding.etConfirmPassword.text?.clear()
            } else {
                Toast.makeText(requireContext(), "Error: ${result.exceptionOrNull()?.message}", Toast.LENGTH_LONG).show()
            }
        }

        viewModel.isLoading.observe(viewLifecycleOwner) { isLoading ->
            binding.progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
            binding.btnSave.isEnabled = !isLoading
            binding.btnChangePassword.isEnabled = !isLoading
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
