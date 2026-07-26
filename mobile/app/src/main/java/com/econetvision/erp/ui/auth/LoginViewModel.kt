package com.econetvision.erp.ui.auth

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.econetvision.erp.data.model.TokenResponse
import com.econetvision.erp.data.repository.AuthRepository
import com.econetvision.erp.util.Event
import com.econetvision.erp.util.emit
import kotlinx.coroutines.launch

class LoginViewModel : ViewModel() {
    private val repository = AuthRepository()

    // One-shot: on a configuration change a replayed result would re-run the whole
    // post-login flow (save token, offer fingerprint enrollment) or re-toast a
    // stale failure.
    private val _loginResult = MutableLiveData<Event<Result<TokenResponse>>>()
    val loginResult: LiveData<Event<Result<TokenResponse>>> = _loginResult

    private val _faceLoginResult = MutableLiveData<Event<Result<TokenResponse>>>()
    val faceLoginResult: LiveData<Event<Result<TokenResponse>>> = _faceLoginResult

    private val _isLoading = MutableLiveData(false)
    val isLoading: LiveData<Boolean> = _isLoading

    fun login(username: String, password: String) {
        _isLoading.value = true
        viewModelScope.launch {
            _loginResult.emit(repository.login(username, password))
            _isLoading.value = false
        }
    }

    fun faceLogin(image: String) {
        _isLoading.value = true
        viewModelScope.launch {
            _faceLoginResult.emit(repository.faceLogin(image))
            _isLoading.value = false
        }
    }
}
