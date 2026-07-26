package com.econetvision.erp.ui.users

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.econetvision.erp.data.model.AdminUser
import com.econetvision.erp.data.model.AdminUserCreate
import com.econetvision.erp.data.model.AdminUserUpdate
import com.econetvision.erp.data.repository.UserRepository
import com.econetvision.erp.util.Event
import com.econetvision.erp.util.emit
import kotlinx.coroutines.launch

class UsersViewModel : ViewModel() {
    private val repository = UserRepository()

    private val _users = MutableLiveData<List<AdminUser>>()
    val users: LiveData<List<AdminUser>> = _users

    private val _isLoading = MutableLiveData(false)
    val isLoading: LiveData<Boolean> = _isLoading

    private val _error = MutableLiveData<Event<String>>()
    val error: LiveData<Event<String>> = _error

    private val _saveResult = MutableLiveData<Event<Result<AdminUser>>>()
    val saveResult: LiveData<Event<Result<AdminUser>>> = _saveResult

    private val _deleteResult = MutableLiveData<Event<Result<Unit>>>()
    val deleteResult: LiveData<Event<Result<Unit>>> = _deleteResult

    fun loadUsers() {
        _isLoading.value = true
        viewModelScope.launch {
            val result = repository.getUsers()
            if (result.isSuccess) {
                _users.value = result.getOrNull()?.items ?: emptyList()
            } else {
                _error.emit(result.exceptionOrNull()?.message ?: "Failed to load users")
            }
            _isLoading.value = false
        }
    }

    fun createUser(request: AdminUserCreate) {
        _isLoading.value = true
        viewModelScope.launch {
            _saveResult.emit(repository.createUser(request))
            _isLoading.value = false
        }
    }

    fun updateUser(id: Int, request: AdminUserUpdate) {
        _isLoading.value = true
        viewModelScope.launch {
            _saveResult.emit(repository.updateUser(id, request))
            _isLoading.value = false
        }
    }

    fun deleteUser(id: Int) {
        _isLoading.value = true
        viewModelScope.launch {
            _deleteResult.emit(repository.deleteUser(id))
            _isLoading.value = false
        }
    }
}
