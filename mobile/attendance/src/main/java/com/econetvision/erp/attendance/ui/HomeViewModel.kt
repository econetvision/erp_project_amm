package com.econetvision.erp.attendance.ui

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.econetvision.erp.attendance.data.ApiException
import com.econetvision.erp.attendance.data.AttendanceRepository
import com.econetvision.erp.attendance.data.ScanResponse
import com.econetvision.erp.attendance.data.Site
import com.econetvision.erp.attendance.data.TodayResponse
import kotlinx.coroutines.launch

/** Outcome of one scan, shown once in a dialog. */
sealed class ScanOutcome {
    data class Marked(val response: ScanResponse) : ScanOutcome()
    data class Failed(val message: String) : ScanOutcome()
}

class HomeViewModel : ViewModel() {

    private val repository = AttendanceRepository()

    private val _site = MutableLiveData<Site?>()
    val site: LiveData<Site?> = _site

    private val _today = MutableLiveData<TodayResponse?>()
    val today: LiveData<TodayResponse?> = _today

    private val _refreshing = MutableLiveData(false)
    val refreshing: LiveData<Boolean> = _refreshing

    private val _scanning = MutableLiveData(false)
    val scanning: LiveData<Boolean> = _scanning

    // One-shot values: the activity shows them and then calls the matching consume*().
    private val _scanOutcome = MutableLiveData<ScanOutcome?>()
    val scanOutcome: LiveData<ScanOutcome?> = _scanOutcome

    private val _notice = MutableLiveData<String?>()
    val notice: LiveData<String?> = _notice

    // Non-null when the session must end (signed out, disabled by the admin).
    private val _sessionEnded = MutableLiveData<String?>()
    val sessionEnded: LiveData<String?> = _sessionEnded

    fun refresh() {
        if (_refreshing.value == true) return
        _refreshing.value = true
        viewModelScope.launch {
            val siteResult = repository.mySite()
            val siteError = siteResult.exceptionOrNull()
            if (siteError != null) {
                // 401: token no longer valid. 403 here comes only from the access
                // guard: the admin disabled physical attendance for this account.
                if (siteError is ApiException && (siteError.code == 401 || siteError.code == 403)) {
                    _sessionEnded.value = siteError.message
                } else {
                    _notice.value = siteError.message
                }
                _refreshing.value = false
                return@launch
            }
            _site.value = siteResult.getOrNull()

            repository.today().fold(
                onSuccess = { _today.value = it },
                onFailure = { _notice.value = it.message },
            )
            _refreshing.value = false
        }
    }

    fun submitScan(imageBase64: String, latitude: Double, longitude: Double) {
        if (_scanning.value == true) return
        _scanning.value = true
        viewModelScope.launch {
            repository.scan(imageBase64, latitude, longitude).fold(
                onSuccess = { _scanOutcome.value = ScanOutcome.Marked(it) },
                onFailure = { error ->
                    if (error is ApiException && error.code == 401) {
                        _sessionEnded.value = error.message
                    } else {
                        // Includes 403 "You are N m from <site>…": shown, session kept.
                        _scanOutcome.value = ScanOutcome.Failed(error.message ?: "")
                    }
                },
            )
            _scanning.value = false
            refresh()
        }
    }

    fun setScanning(value: Boolean) {
        _scanning.value = value
    }

    fun consumeScanOutcome() {
        _scanOutcome.value = null
    }

    fun consumeNotice() {
        _notice.value = null
    }
}
