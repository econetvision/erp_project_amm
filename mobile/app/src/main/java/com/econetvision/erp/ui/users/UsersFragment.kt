package com.econetvision.erp.ui.users

import android.app.AlertDialog
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.ViewModelProvider
import androidx.recyclerview.widget.LinearLayoutManager
import com.econetvision.erp.data.model.AdminUser
import com.econetvision.erp.databinding.FragmentUsersBinding

class UsersFragment : Fragment() {
    private var _binding: FragmentUsersBinding? = null
    private val binding get() = _binding!!
    private lateinit var viewModel: UsersViewModel
    private lateinit var adapter: UserAdapter

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentUsersBinding.inflate(inflater, container, false)
        viewModel = ViewModelProvider(this)[UsersViewModel::class.java]

        setupRecyclerView()
        observeViewModel()

        binding.btnAddUser.setOnClickListener {
            showUserForm(null)
        }

        viewModel.loadUsers()

        return binding.root
    }

    private fun setupRecyclerView() {
        adapter = UserAdapter(
            emptyList(),
            onEdit = { user -> showUserForm(user) },
            onDelete = { user -> confirmDelete(user) }
        )
        binding.rvUsers.layoutManager = LinearLayoutManager(requireContext())
        binding.rvUsers.adapter = adapter
    }

    private fun showUserForm(user: AdminUser?) {
        val dialog = UserFormDialogFragment.newInstance(user)
        dialog.onSaved = { viewModel.loadUsers() }
        dialog.show(childFragmentManager, "user_form")
    }

    private fun confirmDelete(user: AdminUser) {
        AlertDialog.Builder(requireContext())
            .setTitle("Delete User")
            .setMessage("Are you sure you want to delete \"${user.username}\"?")
            .setPositiveButton("Delete") { _, _ ->
                viewModel.deleteUser(user.id)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun observeViewModel() {
        viewModel.users.observe(viewLifecycleOwner) { users ->
            adapter.updateData(users)
            binding.tvEmpty.visibility = if (users.isEmpty()) View.VISIBLE else View.GONE
        }

        viewModel.isLoading.observe(viewLifecycleOwner) { isLoading ->
            binding.progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
        }

        viewModel.error.observe(viewLifecycleOwner) { error ->
            error?.let {
                Toast.makeText(requireContext(), it, Toast.LENGTH_LONG).show()
            }
        }

        viewModel.deleteResult.observe(viewLifecycleOwner) { result ->
            if (result.isSuccess) {
                Toast.makeText(requireContext(), "User deleted", Toast.LENGTH_SHORT).show()
                viewModel.loadUsers()
            } else {
                Toast.makeText(requireContext(), "Error: ${result.exceptionOrNull()?.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
