package com.econetvision.erp.ui.attendance

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.econetvision.erp.data.model.Attendance
import com.econetvision.erp.databinding.ItemAttendanceBinding
import java.util.Locale

class AttendanceAdapter(private var records: List<Attendance>) :
    RecyclerView.Adapter<AttendanceAdapter.ViewHolder>() {

    class ViewHolder(val binding: ItemAttendanceBinding) : RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemAttendanceBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val record = records[position]
        holder.binding.tvDate.text = record.date
        holder.binding.tvTime.text = "${record.entryTime} - ${record.exitTime ?: "Present"}"
        holder.binding.tvHours.text = record.hoursWorked?.let { 
            String.format(Locale.getDefault(), "%.1f hrs", it) 
        } ?: ""
    }

    override fun getItemCount() = records.size

    fun updateData(newRecords: List<Attendance>) {
        records = newRecords
        notifyDataSetChanged()
    }
}
