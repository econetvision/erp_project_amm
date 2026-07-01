package com.econetvision.erp.ui.notifications

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.ViewModelProvider
import androidx.recyclerview.widget.LinearLayoutManager
import com.econetvision.erp.databinding.FragmentNotificationsBinding

class NotificationsFragment : Fragment() {
    private var _binding: FragmentNotificationsBinding? = null
    private val binding get() = _binding!!
    private lateinit var viewModel: NotificationsViewModel
    private lateinit var adapter: NotificationAdapter

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentNotificationsBinding.inflate(inflater, container, false)
        viewModel = ViewModelProvider(this)[NotificationsViewModel::class.java]

        setupRecyclerView()
        observeViewModel()

        binding.btnMarkAllRead.setOnClickListener {
            viewModel.markAllAsRead()
        }

        binding.toggleView.addOnButtonCheckedListener { _, checkedId, isChecked ->
            if (isChecked) {
                viewModel.setArchiveMode(checkedId == binding.btnArchive.id)
            }
        }
        binding.toggleView.check(binding.btnActive.id)

        binding.swipeRefresh.setOnRefreshListener {
            viewModel.loadNotifications()
        }

        viewModel.loadNotifications()

        return binding.root
    }

    private fun setupRecyclerView() {
        adapter = NotificationAdapter(emptyList()) { notification ->
            if (!notification.isRead) {
                viewModel.markAsRead(notification.id)
            }
        }
        binding.rvNotifications.layoutManager = LinearLayoutManager(requireContext())
        binding.rvNotifications.adapter = adapter
    }

    private fun observeViewModel() {
        viewModel.notifications.observe(viewLifecycleOwner) { notifications ->
            adapter.updateData(notifications)
            binding.tvEmpty.visibility = if (notifications.isEmpty()) View.VISIBLE else View.GONE
            binding.swipeRefresh.isRefreshing = false
        }

        viewModel.showArchive.observe(viewLifecycleOwner) { archive ->
            binding.tvEmpty.text = if (archive) "No archived notifications" else "No active notifications"
            // Mark-all-read only applies to active (unread) notifications.
            binding.btnMarkAllRead.visibility = if (archive) View.GONE else View.VISIBLE
        }

        viewModel.isLoading.observe(viewLifecycleOwner) { isLoading ->
            if (!binding.swipeRefresh.isRefreshing) {
                binding.progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
            }
        }

        viewModel.error.observe(viewLifecycleOwner) { error ->
            error?.let {
                Toast.makeText(requireContext(), it, Toast.LENGTH_LONG).show()
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
