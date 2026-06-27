package com.econetvision.erp.ui.employees

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.ViewModelProvider
import androidx.recyclerview.widget.LinearLayoutManager
import com.econetvision.erp.databinding.FragmentEmployeesBinding

class EmployeesFragment : Fragment() {
    private var _binding: FragmentEmployeesBinding? = null
    private val binding get() = _binding!!
    private lateinit var viewModel: EmployeesViewModel
    private lateinit var adapter: EmployeeAdapter

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentEmployeesBinding.inflate(inflater, container, false)
        viewModel = ViewModelProvider(this)[EmployeesViewModel::class.java]

        setupRecyclerView()
        observeViewModel()

        viewModel.loadEmployees()

        return binding.root
    }

    private fun setupRecyclerView() {
        adapter = EmployeeAdapter(emptyList())
        binding.rvEmployees.layoutManager = LinearLayoutManager(requireContext())
        binding.rvEmployees.adapter = adapter
    }

    private fun observeViewModel() {
        viewModel.employees.observe(viewLifecycleOwner) { employees ->
            adapter.updateData(employees)
            binding.tvEmpty.visibility = if (employees.isEmpty()) View.VISIBLE else View.GONE
        }

        viewModel.isLoading.observe(viewLifecycleOwner) { isLoading ->
            binding.progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
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
