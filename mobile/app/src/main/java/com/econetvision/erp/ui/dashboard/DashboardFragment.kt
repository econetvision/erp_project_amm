package com.econetvision.erp.ui.dashboard

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.ViewModelProvider
import androidx.recyclerview.widget.LinearLayoutManager
import com.econetvision.erp.data.local.SessionManager
import com.econetvision.erp.databinding.FragmentDashboardBinding
import com.econetvision.erp.ui.attendance.AttendanceAdapter
import com.econetvision.erp.util.observeEvent
import java.util.Locale

class DashboardFragment : Fragment() {
    private var _binding: FragmentDashboardBinding? = null
    private val binding get() = _binding!!
    private lateinit var viewModel: DashboardViewModel
    private lateinit var adapter: AttendanceAdapter

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentDashboardBinding.inflate(inflater, container, false)
        viewModel = ViewModelProvider(this)[DashboardViewModel::class.java]

        setupRecyclerView()
        observeViewModel()

        val session = SessionManager(requireContext())
        val empId = session.getEmployeeId()
        // display_name is optional on the backend — fall back to the username rather
        // than rendering "Welcome back, null!".
        val displayName = session.getDisplayName()?.takeIf { it.isNotBlank() }
            ?: session.getUsername()?.takeIf { it.isNotBlank() }

        binding.tvWelcome.text = if (displayName != null) "Welcome back, $displayName!" else "Welcome back!"

        if (empId != -1) {
            viewModel.loadDashboardData(empId)
        }

        viewModel.loadHolidays()

        return binding.root
    }

    private fun setupRecyclerView() {
        adapter = AttendanceAdapter(emptyList())
        binding.rvRecentAttendance.layoutManager = LinearLayoutManager(requireContext())
        binding.rvRecentAttendance.adapter = adapter
    }

    private fun observeViewModel() {
        viewModel.monthlyReport.observe(viewLifecycleOwner) { report ->
            binding.tvDaysWorked.text = report.totalDays.toString()
            binding.tvHoursWorked.text = String.format(Locale.getDefault(), "%.1f", report.totalHours)
            adapter.updateData(report.records.takeLast(5).reversed())
        }

        viewModel.holidays.observe(viewLifecycleOwner) { holidays ->
            if (holidays.isNotEmpty()) {
                binding.cardHolidays.visibility = View.VISIBLE
                binding.tvHolidaysList.text = holidays.joinToString("\n") { h ->
                    val typeLabel = when (h.holidayType) {
                        "optional" -> " (Optional)"
                        "company" -> " (Company)"
                        else -> ""
                    }
                    "${h.date}  •  ${h.name}$typeLabel"
                }
            } else {
                binding.cardHolidays.visibility = View.GONE
            }
        }

        viewModel.isLoading.observe(viewLifecycleOwner) { isLoading ->
            binding.progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
        }

        viewModel.error.observeEvent(viewLifecycleOwner) { error ->
            Toast.makeText(requireContext(), error, Toast.LENGTH_LONG).show()
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
