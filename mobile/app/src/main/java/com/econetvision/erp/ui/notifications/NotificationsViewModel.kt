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

    // Full list fetched from the server; the displayed list is filtered from this.
    private val _allNotifications = MutableLiveData<List<Notification>>(emptyList())

    private val _notifications = MutableLiveData<List<Notification>>()
    val notifications: LiveData<List<Notification>> = _notifications

    // false = Active (unread), true = Archive (read/completed)
    private val _showArchive = MutableLiveData(false)
    val showArchive: LiveData<Boolean> = _showArchive

    private val _unreadCount = MutableLiveData(0)
    val unreadCount: LiveData<Int> = _unreadCount

    private val _isLoading = MutableLiveData(false)
    val isLoading: LiveData<Boolean> = _isLoading

    private val _error = MutableLiveData<String?>()
    val error: LiveData<String?> = _error

    fun setArchiveMode(archive: Boolean) {
        _showArchive.value = archive
        applyFilter()
    }

    private fun applyFilter() {
        val all = _allNotifications.value ?: emptyList()
        val archive = _showArchive.value ?: false
        // Active shows unread; Archive shows read (marked-as-read) notifications.
        _notifications.value = all.filter { if (archive) it.isRead else !it.isRead }
    }

    fun loadNotifications() {
        _isLoading.value = true
        _error.value = null
        viewModelScope.launch {
            val result = repository.getNotifications()
            if (result.isSuccess) {
                _allNotifications.value = result.getOrNull() ?: emptyList()
                applyFilter()
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
                // Mark in the full list, then re-filter so it leaves Active and enters Archive.
                _allNotifications.value = _allNotifications.value?.map { n ->
                    if (n.id == notificationId) n.copy(isRead = true) else n
                }
                applyFilter()
                loadUnreadCount()
            }
        }
    }

    fun markAllAsRead() {
        viewModelScope.launch {
            val result = repository.markAllAsRead()
            if (result.isSuccess) {
                // All move to Archive.
                _allNotifications.value = _allNotifications.value?.map { it.copy(isRead = true) }
                applyFilter()
                _unreadCount.value = 0
            }
        }
    }
}
