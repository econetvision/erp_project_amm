package com.econetvision.erp.ui.users

import android.app.Dialog
import android.os.Bundle
import android.view.LayoutInflater
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.fragment.app.DialogFragment
import androidx.lifecycle.ViewModelProvider
import com.econetvision.erp.data.model.AdminUser
import com.econetvision.erp.data.model.AdminUserCreate
import com.econetvision.erp.data.model.AdminUserUpdate
import com.econetvision.erp.databinding.DialogUserFormBinding

class UserFormDialogFragment : DialogFragment() {

    companion object {
        private const val ARG_USER = "arg_user"
        private val ROLES = listOf("master", "admin", "supervisor", "worker")

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

    override fun onCreateDialog(savedInstanceState: Bundle?): Dialog {
        _binding = DialogUserFormBinding.inflate(LayoutInflater.from(requireContext()))
        viewModel = ViewModelProvider(requireParentFragment())[UsersViewModel::class.java]
        editingUser = arguments?.getSerializable(ARG_USER) as? AdminUser

        setupForm()
        observeViewModel()

        return android.app.AlertDialog.Builder(requireContext())
            .setView(binding.root)
            .create()
    }

    private fun setupForm() {
        val roleAdapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_dropdown_item, ROLES)
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
            val roleIndex = ROLES.indexOf(user.role)
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
        val role = ROLES[binding.spinnerRole.selectedItemPosition]

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
        viewModel.saveResult.observe(this) { result ->
            if (result.isSuccess) {
                Toast.makeText(requireContext(), "User saved", Toast.LENGTH_SHORT).show()
                onSaved?.invoke()
                dismiss()
            } else {
                Toast.makeText(requireContext(), "Error: ${result.exceptionOrNull()?.message}", Toast.LENGTH_LONG).show()
            }
        }

        viewModel.isLoading.observe(this) { isLoading ->
            binding.progressBar.visibility = if (isLoading) android.view.View.VISIBLE else android.view.View.GONE
            binding.btnSubmit.isEnabled = !isLoading
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
