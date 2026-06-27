package com.econetvision.erp.ui.employees

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.econetvision.erp.data.model.Employee
import com.econetvision.erp.data.repository.EmployeeRepository
import kotlinx.coroutines.launch

class EmployeesViewModel : ViewModel() {
    private val repository = EmployeeRepository()

    private val _employees = MutableLiveData<List<Employee>>()
    val employees: LiveData<List<Employee>> = _employees

    private val _isLoading = MutableLiveData(false)
    val isLoading: LiveData<Boolean> = _isLoading

    private val _error = MutableLiveData<String?>()
    val error: LiveData<String?> = _error

    fun loadEmployees() {
        _isLoading.value = true
        _error.value = null
        viewModelScope.launch {
            val result = repository.getEmployees()
            if (result.isSuccess) {
                _employees.value = result.getOrNull()?.items ?: emptyList()
            } else {
                _error.value = result.exceptionOrNull()?.message
            }
            _isLoading.value = false
        }
    }
}
