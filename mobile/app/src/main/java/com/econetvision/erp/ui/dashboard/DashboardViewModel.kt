package com.econetvision.erp.ui.dashboard

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.econetvision.erp.data.model.Holiday
import com.econetvision.erp.data.model.MonthlyReport
import com.econetvision.erp.data.repository.AttendanceRepository
import com.econetvision.erp.data.repository.HolidayRepository
import kotlinx.coroutines.launch
import java.util.*

class DashboardViewModel : ViewModel() {
    private val attendanceRepository = AttendanceRepository()
    private val holidayRepository = HolidayRepository()

    private val _monthlyReport = MutableLiveData<MonthlyReport>()
    val monthlyReport: LiveData<MonthlyReport> = _monthlyReport

    private val _holidays = MutableLiveData<List<Holiday>>()
    val holidays: LiveData<List<Holiday>> = _holidays

    private val _isLoading = MutableLiveData(false)
    val isLoading: LiveData<Boolean> = _isLoading

    private val _error = MutableLiveData<String?>()
    val error: LiveData<String?> = _error

    fun loadDashboardData(employeeId: Int) {
        _isLoading.value = true
        _error.value = null
        val calendar = Calendar.getInstance()
        val month = calendar.get(Calendar.MONTH) + 1
        val year = calendar.get(Calendar.YEAR)

        viewModelScope.launch {
            val result = attendanceRepository.getMonthlyReport(employeeId, month, year)
            if (result.isSuccess) {
                _monthlyReport.value = result.getOrNull()
            } else {
                _error.value = result.exceptionOrNull()?.message
            }
            _isLoading.value = false
        }
    }

    fun loadHolidays() {
        val year = Calendar.getInstance().get(Calendar.YEAR)
        viewModelScope.launch {
            val result = holidayRepository.getHolidays(year)
            if (result.isSuccess) {
                // Filter to show upcoming holidays only
                val today = Calendar.getInstance()
                val todayStr = String.format(
                    Locale.getDefault(), "%04d-%02d-%02d",
                    today.get(Calendar.YEAR), today.get(Calendar.MONTH) + 1, today.get(Calendar.DAY_OF_MONTH)
                )
                _holidays.value = result.getOrNull()
                    ?.filter { it.date >= todayStr }
                    ?.sortedBy { it.date }
                    ?.take(5) ?: emptyList()
            }
        }
    }
}
