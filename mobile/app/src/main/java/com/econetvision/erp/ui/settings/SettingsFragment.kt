package com.econetvision.erp.ui.settings

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.ViewModelProvider
import androidx.navigation.fragment.findNavController
import com.econetvision.erp.R
import com.econetvision.erp.data.local.SessionManager
import com.econetvision.erp.databinding.FragmentSettingsBinding
import com.econetvision.erp.ui.auth.LoginActivity
import com.econetvision.erp.util.BiometricCredentialStore

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
        // Profile is (re)loaded in onResume so edits made on the Edit Profile screen reflect here.

        return binding.root
    }

    private fun setupUI() {
        binding.tvUsername.text = "Username: ${session.getUsername() ?: "—"}"
        binding.tvRole.text = "Role: ${session.getRole() ?: "—"}"

        renderProfile(session.getDisplayName(), session.getEmail(), session.getPhone())

        binding.btnEditProfile.setOnClickListener {
            findNavController().navigate(R.id.action_settingsFragment_to_editProfileFragment)
        }

        binding.btnLogout.setOnClickListener {
            session.clear()
            BiometricCredentialStore.clearCredentials(requireContext())
            startActivity(Intent(requireContext(), LoginActivity::class.java))
            requireActivity().finish()
        }

        binding.cardManagement.visibility = if (session.canManage()) View.VISIBLE else View.GONE

        binding.btnManageEmployees.setOnClickListener {
            findNavController().navigate(R.id.action_settingsFragment_to_employeesFragment)
        }

        binding.btnManageLocations.setOnClickListener {
            findNavController().navigate(R.id.action_settingsFragment_to_workLocationsFragment)
        }

        binding.btnManageUsers.setOnClickListener {
            findNavController().navigate(R.id.action_settingsFragment_to_usersFragment)
        }
    }

    private fun renderProfile(displayName: String?, email: String?, phone: String?) {
        binding.tvDisplayName.text = if (displayName.isNullOrBlank()) "—" else displayName
        binding.tvEmail.text = if (email.isNullOrBlank()) "—" else email
        binding.tvPhone.text = if (phone.isNullOrBlank()) "—" else phone
    }

    private fun observeViewModel() {
        viewModel.user.observe(viewLifecycleOwner) { user ->
            renderProfile(user.displayName, user.email, user.phone)
            session.saveUser(user)
        }

        viewModel.isLoading.observe(viewLifecycleOwner) { isLoading ->
            binding.progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
        }
    }

    override fun onResume() {
        super.onResume()
        // Reflect edits made on the Edit Profile screen.
        viewModel.loadUserProfile()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
