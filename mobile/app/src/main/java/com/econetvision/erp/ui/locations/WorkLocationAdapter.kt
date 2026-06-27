package com.econetvision.erp.ui.locations

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.econetvision.erp.data.model.WorkLocation
import com.econetvision.erp.databinding.ItemWorkLocationBinding
import java.util.Locale

class WorkLocationAdapter(private var locations: List<WorkLocation>) :
    RecyclerView.Adapter<WorkLocationAdapter.ViewHolder>() {

    class ViewHolder(val binding: ItemWorkLocationBinding) : RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemWorkLocationBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val location = locations[position]
        holder.binding.tvName.text = location.locationName
        holder.binding.tvAddress.text = listOfNotNull(location.address, location.city)
            .joinToString(", ")
            .ifBlank { "—" }
        holder.binding.tvRadius.text = location.allowedRadiusM?.let {
            String.format(Locale.getDefault(), "Radius: %.0f m", it)
        } ?: "Radius: —"
        holder.binding.tvEmployeeCount.text = "Employees: ${location.employeeCount ?: 0}"
    }

    override fun getItemCount() = locations.size

    fun updateData(newLocations: List<WorkLocation>) {
        locations = newLocations
        notifyDataSetChanged()
    }
}
