package com.econetvision.erp.ui.users

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.econetvision.erp.data.model.AdminUser
import com.econetvision.erp.data.model.AdminUserCreate
import com.econetvision.erp.data.model.AdminUserUpdate
import com.econetvision.erp.data.repository.UserRepository
import kotlinx.coroutines.launch

class UsersViewModel : ViewModel() {
    private val repository = UserRepository()

    private val _users = MutableLiveData<List<AdminUser>>()
    val users: LiveData<List<AdminUser>> = _users

    private val _isLoading = MutableLiveData(false)
    val isLoading: LiveData<Boolean> = _isLoading

    private val _error = MutableLiveData<String?>()
    val error: LiveData<String?> = _error

    private val _saveResult = MutableLiveData<Result<AdminUser>>()
    val saveResult: LiveData<Result<AdminUser>> = _saveResult

    private val _deleteResult = MutableLiveData<Result<Unit>>()
    val deleteResult: LiveData<Result<Unit>> = _deleteResult

    fun loadUsers() {
        _isLoading.value = true
        _error.value = null
        viewModelScope.launch {
            val result = repository.getUsers()
            if (result.isSuccess) {
                _users.value = result.getOrNull()?.items ?: emptyList()
            } else {
                _error.value = result.exceptionOrNull()?.message
            }
            _isLoading.value = false
        }
    }

    fun createUser(request: AdminUserCreate) {
        _isLoading.value = true
        viewModelScope.launch {
            _saveResult.value = repository.createUser(request)
            _isLoading.value = false
        }
    }

    fun updateUser(id: Int, request: AdminUserUpdate) {
        _isLoading.value = true
        viewModelScope.launch {
            _saveResult.value = repository.updateUser(id, request)
            _isLoading.value = false
        }
    }

    fun deleteUser(id: Int) {
        _isLoading.value = true
        viewModelScope.launch {
            _deleteResult.value = repository.deleteUser(id)
            _isLoading.value = false
        }
    }
}
