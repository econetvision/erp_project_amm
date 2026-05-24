package com.econetvision.erp.ui.notifications

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.econetvision.erp.data.model.Notification
import com.econetvision.erp.data.repository.NotificationRepository
import kotlinx.coroutines.launch

class NotificationsViewModel : ViewModel() {
    private val repository = NotificationRepository()

    private val _notifications = MutableLiveData<List<Notification>>()
    val notifications: LiveData<List<Notification>> = _notifications

    private val _unreadCount = MutableLiveData(0)
    val unreadCount: LiveData<Int> = _unreadCount

    private val _isLoading = MutableLiveData(false)
    val isLoading: LiveData<Boolean> = _isLoading

    private val _error = MutableLiveData<String?>()
    val error: LiveData<String?> = _error

    fun loadNotifications() {
        _isLoading.value = true
        _error.value = null
        viewModelScope.launch {
            val result = repository.getNotifications()
            if (result.isSuccess) {
                _notifications.value = result.getOrNull() ?: emptyList()
            } else {
                _error.value = result.exceptionOrNull()?.message
            }
            _isLoading.value = false
        }
    }

    fun loadUnreadCount() {
        viewModelScope.launch {
            val result = repository.getUnreadCount()
            _unreadCount.value = result.getOrDefault(0)
        }
    }

    fun markAsRead(notificationId: Int) {
        viewModelScope.launch {
            val result = repository.markAsRead(notificationId)
            if (result.isSuccess) {
                // Update local list
                _notifications.value = _notifications.value?.map { n ->
                    if (n.id == notificationId) n.copy(isRead = true) else n
                }
                loadUnreadCount()
            }
        }
    }

    fun markAllAsRead() {
        viewModelScope.launch {
            val result = repository.markAllAsRead()
            if (result.isSuccess) {
                _notifications.value = _notifications.value?.map { it.copy(isRead = true) }
                _unreadCount.value = 0
            }
        }
    }
}
