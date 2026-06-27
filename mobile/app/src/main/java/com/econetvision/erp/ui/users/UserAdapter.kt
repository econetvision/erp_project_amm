package com.econetvision.erp.ui.users

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.econetvision.erp.data.model.AdminUser
import com.econetvision.erp.databinding.ItemUserBinding

class UserAdapter(
    private var users: List<AdminUser>,
    private val onEdit: (AdminUser) -> Unit,
    private val onDelete: (AdminUser) -> Unit
) : RecyclerView.Adapter<UserAdapter.ViewHolder>() {

    class ViewHolder(val binding: ItemUserBinding) : RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemUserBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val user = users[position]
        holder.binding.tvUsername.text = user.username
        holder.binding.tvRole.text = user.role
        holder.binding.tvDisplayName.text = user.displayName ?: "—"
        holder.binding.tvEmail.text = user.email ?: "—"

        val isActive = user.isActive != false
        holder.binding.tvActiveStatus.text = if (isActive) "Active" else "Inactive"

        holder.binding.btnEdit.setOnClickListener { onEdit(user) }
        holder.binding.btnDelete.setOnClickListener { onDelete(user) }
    }

    override fun getItemCount() = users.size

    fun updateData(newUsers: List<AdminUser>) {
        users = newUsers
        notifyDataSetChanged()
    }
}
