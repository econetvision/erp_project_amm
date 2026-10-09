package com.econetvision.erp.attendance.ui

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.econetvision.erp.attendance.R
import com.econetvision.erp.attendance.data.TodayEntry
import com.econetvision.erp.attendance.databinding.ItemTodayBinding

class TodayAdapter : ListAdapter<TodayEntry, TodayAdapter.Holder>(Diff) {

    class Holder(val binding: ItemTodayBinding) : RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder =
        Holder(ItemTodayBinding.inflate(LayoutInflater.from(parent.context), parent, false))

    override fun onBindViewHolder(holder: Holder, position: Int) {
        val entry = getItem(position)
        val context = holder.binding.root.context
        holder.binding.tvName.text = entry.name
        holder.binding.tvCode.text = entry.employeeCode.orEmpty()
        holder.binding.tvIn.text = context.getString(R.string.home_in, shortTime(entry.entryTime))
        holder.binding.tvOut.text = entry.exitTime
            ?.let { context.getString(R.string.home_out, shortTime(it)) }
            ?: context.getString(R.string.home_out_pending)
    }

    private object Diff : DiffUtil.ItemCallback<TodayEntry>() {
        override fun areItemsTheSame(oldItem: TodayEntry, newItem: TodayEntry) =
            oldItem.employeeId == newItem.employeeId

        override fun areContentsTheSame(oldItem: TodayEntry, newItem: TodayEntry) = oldItem == newItem
    }

    companion object {
        /** The backend sends "HH:MM:SS"; the list shows "HH:MM". */
        fun shortTime(value: String): String = value.take(5)
    }
}
