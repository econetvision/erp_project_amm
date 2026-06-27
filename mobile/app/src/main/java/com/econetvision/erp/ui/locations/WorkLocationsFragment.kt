package com.econetvision.erp.ui.locations

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.ViewModelProvider
import androidx.recyclerview.widget.LinearLayoutManager
import com.econetvision.erp.databinding.FragmentWorkLocationsBinding

class WorkLocationsFragment : Fragment() {
    private var _binding: FragmentWorkLocationsBinding? = null
    private val binding get() = _binding!!
    private lateinit var viewModel: WorkLocationsViewModel
    private lateinit var adapter: WorkLocationAdapter

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentWorkLocationsBinding.inflate(inflater, container, false)
        viewModel = ViewModelProvider(this)[WorkLocationsViewModel::class.java]

        setupRecyclerView()
        observeViewModel()

        viewModel.loadWorkLocations()

        return binding.root
    }

    private fun setupRecyclerView() {
        adapter = WorkLocationAdapter(emptyList())
        binding.rvLocations.layoutManager = LinearLayoutManager(requireContext())
        binding.rvLocations.adapter = adapter
    }

    private fun observeViewModel() {
        viewModel.locations.observe(viewLifecycleOwner) { locations ->
            adapter.updateData(locations)
            binding.tvEmpty.visibility = if (locations.isEmpty()) View.VISIBLE else View.GONE
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
