package com.econetvision.erp.ui.settings

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.econetvision.erp.data.model.User
import com.econetvision.erp.data.repository.AuthRepository
import com.econetvision.erp.util.Event
import com.econetvision.erp.util.emit
import kotlinx.coroutines.launch

class SettingsViewModel : ViewModel() {
    private val repository = AuthRepository()

    private val _user = MutableLiveData<User>()
    val user: LiveData<User> = _user

    // One-shot: otherwise returning to Edit Profile re-toasts the previous save and
    // re-clears the password fields.
    private val _updateResult = MutableLiveData<Event<Result<User>>>()
    val updateResult: LiveData<Event<Result<User>>> = _updateResult

    private val _passwordResult = MutableLiveData<Event<Result<String>>>()
    val passwordResult: LiveData<Event<Result<String>>> = _passwordResult

    private val _isLoading = MutableLiveData(false)
    val isLoading: LiveData<Boolean> = _isLoading

    fun loadUserProfile() {
        _isLoading.value = true
        viewModelScope.launch {
            val result = repository.getMe()
            if (result.isSuccess) {
                _user.value = result.getOrNull()
            }
            _isLoading.value = false
        }
    }

    fun updateProfile(displayName: String?, email: String?, phone: String?) {
        _isLoading.value = true
        viewModelScope.launch {
            val result = repository.updateProfile(displayName, email, phone)
            _updateResult.emit(result)
            if (result.isSuccess) {
                _user.value = result.getOrNull()
            }
            _isLoading.value = false
        }
    }

    fun changePassword(currentPassword: String, newPassword: String) {
        _isLoading.value = true
        viewModelScope.launch {
            _passwordResult.emit(repository.changePassword(currentPassword, newPassword))
            _isLoading.value = false
        }
    }
}
