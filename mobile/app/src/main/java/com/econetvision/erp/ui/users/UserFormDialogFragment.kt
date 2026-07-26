package com.econetvision.erp.ui.users

import android.app.Dialog
import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.Toast
import android.os.Build
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.ViewModelProvider
import com.econetvision.erp.data.model.AdminUser
import com.econetvision.erp.data.model.AdminUserCreate
import com.econetvision.erp.data.model.AdminUserUpdate
import com.econetvision.erp.data.local.SessionManager
import com.econetvision.erp.databinding.DialogUserFormBinding
import com.econetvision.erp.util.observeEvent

class UserFormDialogFragment : DialogFragment() {

    companion object {
        private const val ARG_USER = "arg_user"
        private val ASSIGNABLE_ROLES = listOf("admin", "supervisor", "worker")
        // Only a master may create or grant the master role — the backend rejects
        // it from anyone else, so offering it to an admin is a dead option.
        private val MASTER_ASSIGNABLE_ROLES = listOf("master") + ASSIGNABLE_ROLES

        fun newInstance(user: AdminUser? = null): UserFormDialogFragment {
            val fragment = UserFormDialogFragment()
            val args = Bundle()
            args.putSerializable(ARG_USER, user as? java.io.Serializable)
            fragment.arguments = args
            return fragment
        }
    }

    private var _binding: DialogUserFormBinding? = null
    private val binding get() = _binding!!
    private lateinit var viewModel: UsersViewModel
    private var editingUser: AdminUser? = null
    var onSaved: (() -> Unit)? = null

    /** Roles this caller is actually permitted to assign, per the backend guards. */
    private val roles: List<String> by lazy {
        if (SessionManager(requireContext()).isMaster()) MASTER_ASSIGNABLE_ROLES else ASSIGNABLE_ROLES
    }

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        _binding = DialogUserFormBinding.inflate(layoutInflater)
        viewModel = ViewModelProvider(requireParentFragment())[UsersViewModel::class.java]
        editingUser = arguments?.adminUser(ARG_USER)

        setupForm()
        observeViewModel()

        return android.app.AlertDialog.Builder(requireContext())
            .setView(binding.root)
            .create()
    }

    private fun setupForm() {
        val roleAdapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_dropdown_item, roles)
        binding.spinnerRole.adapter = roleAdapter

        val user = editingUser
        if (user != null) {
            binding.tvDialogTitle.text = "Edit User"
            binding.etUsername.setText(user.username)
            binding.etUsername.isEnabled = false
            binding.etPassword.hint = "Leave blank to keep current"
            binding.etDisplayName.setText(user.displayName)
            binding.etEmail.setText(user.email)
            binding.etPhone.setText(user.phone)
            val roleIndex = roles.indexOf(user.role)
            if (roleIndex >= 0) binding.spinnerRole.setSelection(roleIndex)
        } else {
            binding.tvDialogTitle.text = "Add User"
        }

        binding.btnCancel.setOnClickListener {
            dismiss()
        }

        binding.btnSubmit.setOnClickListener {
            submitForm()
        }
    }

    private fun submitForm() {
        val username = binding.etUsername.text.toString().trim()
        val password = binding.etPassword.text.toString().trim()
        val displayName = binding.etDisplayName.text.toString().trim().ifBlank { null }
        val email = binding.etEmail.text.toString().trim().ifBlank { null }
        val phone = binding.etPhone.text.toString().trim().ifBlank { null }
        val role = roles[binding.spinnerRole.selectedItemPosition]

        val user = editingUser
        if (user == null) {
            if (username.isBlank() || password.isBlank()) {
                Toast.makeText(requireContext(), "Username and password are required", Toast.LENGTH_SHORT).show()
                return
            }
            viewModel.createUser(
                AdminUserCreate(
                    username = username,
                    password = password,
                    role = role,
                    email = email,
                    displayName = displayName,
                    phone = phone
                )
            )
        } else {
            viewModel.updateUser(
                user.id,
                AdminUserUpdate(
                    displayName = displayName,
                    email = email,
                    phone = phone,
                    role = role,
                    password = password.ifBlank { null }
                )
            )
        }
    }

    private fun observeViewModel() {
        // The ViewModel is scoped to the parent fragment, so it outlives this dialog.
        // Results must therefore be one-shot events — a replayed success would dismiss
        // the dialog the moment it is reopened. Observers are bound to the fragment
        // (not view) lifecycle because onCreateDialog leaves no view lifecycle owner,
        // so every binding access is null-guarded against the onDestroyView window.
        viewModel.saveResult.observeEvent(this) { result ->
            if (result.isSuccess) {
                Toast.makeText(requireContext(), "User saved", Toast.LENGTH_SHORT).show()
                onSaved?.invoke()
                dismiss()
            } else {
                Toast.makeText(requireContext(), "Error: ${result.exceptionOrNull()?.message}", Toast.LENGTH_LONG).show()
            }
        }

        viewModel.isLoading.observe(this) { isLoading ->
            val b = _binding ?: return@observe
            b.progressBar.visibility = if (isLoading) android.view.View.VISIBLE else android.view.View.GONE
            b.btnSubmit.isEnabled = !isLoading
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}

/**
 * Type-safe [AdminUser] read from a bundle. The single-argument
 * `getSerializable` is deprecated from API 33; androidx `BundleCompat` only grew
 * a Serializable overload in core 1.13, which this module is not on yet.
 */
private fun Bundle.adminUser(key: String): AdminUser? =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        getSerializable(key, AdminUser::class.java)
    } else {
        @Suppress("DEPRECATION")
        getSerializable(key) as? AdminUser
    }
