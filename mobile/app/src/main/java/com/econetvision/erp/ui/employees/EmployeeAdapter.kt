package com.econetvision.erp.ui.employees

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.econetvision.erp.data.model.Employee
import com.econetvision.erp.databinding.ItemEmployeeBinding

class EmployeeAdapter(private var employees: List<Employee>) :
    RecyclerView.Adapter<EmployeeAdapter.ViewHolder>() {

    class ViewHolder(val binding: ItemEmployeeBinding) : RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemEmployeeBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val employee = employees[position]
        holder.binding.tvName.text = employee.name
        holder.binding.tvLocation.text = employee.workLocationName ?: "No location assigned"
        holder.binding.tvShift.text = employee.shift ?: "—"
    }

    override fun getItemCount() = employees.size

    fun updateData(newEmployees: List<Employee>) {
        employees = newEmployees
        notifyDataSetChanged()
    }
}
