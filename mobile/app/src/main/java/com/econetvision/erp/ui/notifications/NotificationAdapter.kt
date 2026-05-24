package com.econetvision.erp.ui.notifications

import android.graphics.Typeface
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import com.econetvision.erp.R
import com.econetvision.erp.data.model.Notification
import com.econetvision.erp.databinding.ItemNotificationBinding

class NotificationAdapter(
    private var notifications: List<Notification>,
    private val onItemClick: (Notification) -> Unit
) : RecyclerView.Adapter<NotificationAdapter.ViewHolder>() {

    class ViewHolder(val binding: ItemNotificationBinding) : RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemNotificationBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val notification = notifications[position]
        holder.binding.tvTitle.text = notification.title
        holder.binding.tvBody.text = notification.body ?: ""
        holder.binding.tvTime.text = formatTime(notification.createdAt)

        // Style based on read status
        if (!notification.isRead) {
            holder.binding.tvTitle.setTypeface(null, Typeface.BOLD)
            holder.binding.root.setCardBackgroundColor(
                ContextCompat.getColor(holder.binding.root.context, R.color.notification_unread)
            )
        } else {
            holder.binding.tvTitle.setTypeface(null, Typeface.NORMAL)
            holder.binding.root.setCardBackgroundColor(
                ContextCompat.getColor(holder.binding.root.context, R.color.white)
            )
        }

        // Type indicator color
        val typeColor = when (notification.type) {
            "warning" -> R.color.warning
            "alert" -> R.color.danger
            else -> R.color.primary
        }
        holder.binding.viewTypeIndicator.setBackgroundColor(
            ContextCompat.getColor(holder.binding.root.context, typeColor)
        )

        holder.binding.root.setOnClickListener { onItemClick(notification) }
    }

    override fun getItemCount() = notifications.size

    fun updateData(newNotifications: List<Notification>) {
        notifications = newNotifications
        notifyDataSetChanged()
    }

    private fun formatTime(dateStr: String): String {
        return try {
            // Extract date part for display
            if (dateStr.contains("T")) {
                val parts = dateStr.split("T")
                val datePart = parts[0]
                val timePart = parts[1].substring(0, 5)
                "$datePart $timePart"
            } else {
                dateStr
            }
        } catch (e: Exception) {
            dateStr
        }
    }
}
