package com.econetvision.erp.ui.employees

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.econetvision.erp.data.model.Employee
import com.econetvision.erp.data.repository.EmployeeRepository
import com.econetvision.erp.util.Event
import com.econetvision.erp.util.emit
import kotlinx.coroutines.launch

class EmployeesViewModel : ViewModel() {
    private val repository = EmployeeRepository()

    private val _employees = MutableLiveData<List<Employee>>()
    val employees: LiveData<List<Employee>> = _employees

    private val _isLoading = MutableLiveData(false)
    val isLoading: LiveData<Boolean> = _isLoading

    private val _error = MutableLiveData<Event<String>>()
    val error: LiveData<Event<String>> = _error

    fun loadEmployees() {
        _isLoading.value = true
        viewModelScope.launch {
            val result = repository.getEmployees()
            if (result.isSuccess) {
                _employees.value = result.getOrNull()?.items ?: emptyList()
            } else {
                _error.emit(result.exceptionOrNull()?.message ?: "Failed to load employees")
            }
            _isLoading.value = false
        }
    }
}
