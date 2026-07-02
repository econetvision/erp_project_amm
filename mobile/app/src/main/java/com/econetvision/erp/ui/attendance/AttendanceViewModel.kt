package com.econetvision.erp.ui.attendance

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import android.location.Location
import com.econetvision.erp.data.model.Attendance
import com.econetvision.erp.data.model.FaceScanResponse
import com.econetvision.erp.data.model.MyAssignment
import com.econetvision.erp.data.model.MyWorkLocation
import com.econetvision.erp.data.repository.AttendanceRepository
import com.econetvision.erp.data.repository.TrackingRepository
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class AttendanceViewModel : ViewModel() {
    private val repository = AttendanceRepository()
    private val trackingRepository = TrackingRepository()

    private val _myAssignment = MutableLiveData<MyAssignment?>()
    val myAssignment: LiveData<MyAssignment?> = _myAssignment

    fun loadMyAssignment() {
        viewModelScope.launch {
            _myAssignment.value = trackingRepository.getMyAssignment().getOrNull()
        }
    }

    private val _attendanceStatus = MutableLiveData<Attendance?>()
    val attendanceStatus: LiveData<Attendance?> = _attendanceStatus

    private val _clockInOutResult = MutableLiveData<Result<Attendance>>()
    val clockInOutResult: LiveData<Result<Attendance>> = _clockInOutResult

    private val _faceScanResult = MutableLiveData<Result<FaceScanResponse>>()
    val faceScanResult: LiveData<Result<FaceScanResponse>> = _faceScanResult

    private val _isLoading = MutableLiveData(false)
    val isLoading: LiveData<Boolean> = _isLoading

    private val _myLocations = MutableLiveData<List<MyWorkLocation>>()
    val myLocations: LiveData<List<MyWorkLocation>> = _myLocations

    private val _currentDistanceStatus = MutableLiveData<Pair<MyWorkLocation, Double>?>()
    val currentDistanceStatus: LiveData<Pair<MyWorkLocation, Double>?> = _currentDistanceStatus

    fun loadMyLocations() {
        viewModelScope.launch {
            val result = repository.getMyLocations()
            _myLocations.value = result.getOrNull() ?: emptyList()
        }
    }

    /** Result of checking the current position against assigned work location(s). */
    sealed class GeofenceResult {
        /** Employee has no assigned work location — geofence does not apply. */
        object NoAssignment : GeofenceResult()
        data class Inside(val location: MyWorkLocation, val distance: Double) : GeofenceResult()
        data class Outside(
            val location: MyWorkLocation,
            val distance: Double,
            val effectiveRadius: Double,
        ) : GeofenceResult()
    }

    /**
     * Check [currentLat]/[currentLng] against the nearest assigned work location,
     * allowing the location's radius plus [bufferM] of tolerance.
     */
    fun evaluateGeofence(currentLat: Double, currentLng: Double, bufferM: Double): GeofenceResult {
        val locations = _myLocations.value
        if (locations.isNullOrEmpty()) return GeofenceResult.NoAssignment

        var nearest: MyWorkLocation? = null
        var nearestDistance = Float.MAX_VALUE
        val results = FloatArray(1)
        for (loc in locations) {
            Location.distanceBetween(currentLat, currentLng, loc.latitude, loc.longitude, results)
            if (results[0] < nearestDistance) {
                nearestDistance = results[0]
                nearest = loc
            }
        }
        val loc = nearest ?: return GeofenceResult.NoAssignment
        val effective = loc.allowedRadiusM + bufferM
        val dist = nearestDistance.toDouble()
        return if (dist <= effective) {
            GeofenceResult.Inside(loc, dist)
        } else {
            GeofenceResult.Outside(loc, dist, effective)
        }
    }

    fun updateCurrentDistance(currentLat: Double, currentLng: Double) {
        val locations = _myLocations.value
        if (locations.isNullOrEmpty()) {
            _currentDistanceStatus.value = null
            return
        }
        var nearest: MyWorkLocation? = null
        var nearestDistance = Float.MAX_VALUE
        val results = FloatArray(2)
        for (loc in locations) {
            Location.distanceBetween(currentLat, currentLng, loc.latitude, loc.longitude, results)
            if (results[0] < nearestDistance) {
                nearestDistance = results[0]
                nearest = loc
            }
        }
        _currentDistanceStatus.value = nearest?.let { it to nearestDistance.toDouble() }
    }

    fun getTodayStatus(employeeId: Int) {
        _isLoading.value = true
        viewModelScope.launch {
            val result = repository.getTodayStatus(employeeId)
            _attendanceStatus.value = result.getOrNull()
            _isLoading.value = false
        }
    }

    fun clockIn(employeeId: Int, image: String, latitude: Double? = null, longitude: Double? = null) {
        _isLoading.value = true
        viewModelScope.launch {
            val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
            val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
            val now = Date()
            val result = repository.clockIn(
                employeeId = employeeId,
                date = dateFormat.format(now),
                entryTime = timeFormat.format(now),
                image = image,
                latitude = latitude,
                longitude = longitude
            )
            _clockInOutResult.value = result
            if (result.isSuccess) {
                _attendanceStatus.value = result.getOrNull()
            }
            _isLoading.value = false
        }
    }

    fun clockOut(attendanceId: Int, image: String, latitude: Double? = null, longitude: Double? = null) {
        _isLoading.value = true
        viewModelScope.launch {
            val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
            val result = repository.clockOut(
                attendanceId = attendanceId,
                exitTime = timeFormat.format(Date()),
                image = image,
                latitude = latitude,
                longitude = longitude
            )
            _clockInOutResult.value = result
            if (result.isSuccess) {
                _attendanceStatus.value = result.getOrNull()
            }
            _isLoading.value = false
        }
    }

    fun clockInManual(employeeId: Int, latitude: Double? = null, longitude: Double? = null) {
        _isLoading.value = true
        viewModelScope.launch {
            val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())
            val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
            val now = Date()
            val result = repository.clockInManual(
                employeeId = employeeId,
                date = dateFormat.format(now),
                entryTime = timeFormat.format(now),
                latitude = latitude,
                longitude = longitude
            )
            _clockInOutResult.value = result
            if (result.isSuccess) {
                _attendanceStatus.value = result.getOrNull()
            }
            _isLoading.value = false
        }
    }

    fun clockOutManual(attendanceId: Int, latitude: Double? = null, longitude: Double? = null) {
        _isLoading.value = true
        viewModelScope.launch {
            val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())
            val result = repository.clockOutManual(
                attendanceId = attendanceId,
                exitTime = timeFormat.format(Date()),
                latitude = latitude,
                longitude = longitude
            )
            _clockInOutResult.value = result
            if (result.isSuccess) {
                _attendanceStatus.value = result.getOrNull()
            }
            _isLoading.value = false
        }
    }

    fun faceScan(image: String, latitude: Double? = null, longitude: Double? = null) {
        _isLoading.value = true
        viewModelScope.launch {
            val result = repository.faceScan(image, latitude, longitude)
            _faceScanResult.value = result
            if (result.isSuccess) {
                _attendanceStatus.value = result.getOrNull()?.attendance
            }
            _isLoading.value = false
        }
    }
}
