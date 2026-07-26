package com.econetvision.erp.ui.locations

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.econetvision.erp.data.model.WorkLocation
import com.econetvision.erp.data.repository.LocationRepository
import com.econetvision.erp.util.Event
import com.econetvision.erp.util.emit
import kotlinx.coroutines.launch

class WorkLocationsViewModel : ViewModel() {
    private val repository = LocationRepository()

    private val _locations = MutableLiveData<List<WorkLocation>>()
    val locations: LiveData<List<WorkLocation>> = _locations

    private val _isLoading = MutableLiveData(false)
    val isLoading: LiveData<Boolean> = _isLoading

    private val _error = MutableLiveData<Event<String>>()
    val error: LiveData<Event<String>> = _error

    fun loadWorkLocations() {
        _isLoading.value = true
        viewModelScope.launch {
            val result = repository.getWorkLocations()
            if (result.isSuccess) {
                _locations.value = result.getOrNull() ?: emptyList()
            } else {
                _error.emit(result.exceptionOrNull()?.message ?: "Failed to load work locations")
            }
            _isLoading.value = false
        }
    }
}
