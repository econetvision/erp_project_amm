package com.econetvision.erp.ui.attendance

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.location.Location
import android.os.Build
import android.os.Bundle
import android.util.Base64
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.ViewModelProvider
import com.econetvision.erp.R
import com.econetvision.erp.data.local.SessionManager
import com.econetvision.erp.data.model.MyAssignment
import com.econetvision.erp.data.model.MyWorkLocation
import com.econetvision.erp.databinding.FragmentAttendanceBinding
import com.econetvision.erp.service.VehicleTrackingService
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import java.io.ByteArrayOutputStream

class AttendanceFragment : Fragment() {
    private var _binding: FragmentAttendanceBinding? = null
    private val binding get() = _binding!!
    private lateinit var viewModel: AttendanceViewModel
    private var currentAttendanceId: Int? = null
    private var pendingAction: String? = null // "clock_in", "clock_out", "face_scan"
    private var capturedImage: String? = null
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private var lastKnownLocation: Location? = null
    private var currentAssignment: MyAssignment? = null
    private var isTrackingTrip = false

    private val trackingPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val backgroundGranted = permissions[Manifest.permission.ACCESS_BACKGROUND_LOCATION] != false
        if (backgroundGranted) {
            startVehicleTracking()
        } else {
            Toast.makeText(
                requireContext(),
                "Background location permission is required for trip tracking",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val cameraGranted = permissions[Manifest.permission.CAMERA] == true
        val locationGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                permissions[Manifest.permission.ACCESS_COARSE_LOCATION] == true

        if (cameraGranted) {
            launchCamera()
        } else {
            Toast.makeText(requireContext(), "Camera permission is required for face verification", Toast.LENGTH_LONG).show()
        }
        if (!locationGranted) {
            Toast.makeText(requireContext(), "Location permission denied — attendance will be recorded without location", Toast.LENGTH_SHORT).show()
        }
    }

    private val takePictureLauncher = registerForActivityResult(
        ActivityResultContracts.TakePicturePreview()
    ) { bitmap: Bitmap? ->
        if (bitmap != null) {
            capturedImage = bitmapToBase64(bitmap)
            // After capturing photo, get location then submit
            fetchLocationAndSubmit()
        } else {
            Toast.makeText(requireContext(), "Photo capture cancelled", Toast.LENGTH_SHORT).show()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(requireActivity())
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentAttendanceBinding.inflate(inflater, container, false)
        viewModel = ViewModelProvider(this)[AttendanceViewModel::class.java]

        val session = SessionManager(requireContext())
        val empId = session.getEmployeeId()

        if (empId != -1) {
            viewModel.getTodayStatus(empId)
        }
        viewModel.loadMyLocations()
        viewModel.loadMyAssignment()

        observeViewModel()
        refreshWorkLocationStatus()

        binding.btnClockIn.setOnClickListener {
            pendingAction = "clock_in"
            checkPermissionsAndCapture()
        }

        binding.btnClockOut.setOnClickListener {
            pendingAction = "clock_out"
            checkPermissionsAndCapture()
        }

        binding.btnFaceScan.setOnClickListener {
            pendingAction = "face_scan"
            checkPermissionsAndCapture()
        }

        binding.btnRefreshLocation.setOnClickListener {
            refreshWorkLocationStatus()
        }

        binding.btnToggleTracking.setOnClickListener {
            if (isTrackingTrip) stopVehicleTracking() else requestTrackingPermissionsAndStart()
        }

        return binding.root
    }

    private fun requestTrackingPermissionsAndStart() {
        val fineGranted = ContextCompat.checkSelfPermission(
            requireContext(), Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        if (!fineGranted) {
            Toast.makeText(requireContext(), "Location permission is required to start tracking", Toast.LENGTH_LONG).show()
            return
        }

        val permissionsNeeded = mutableListOf<String>()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            permissionsNeeded.add(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissionsNeeded.add(Manifest.permission.POST_NOTIFICATIONS)
        }
        if (permissionsNeeded.isEmpty()) {
            startVehicleTracking()
        } else {
            trackingPermissionLauncher.launch(permissionsNeeded.toTypedArray())
        }
    }

    private fun startVehicleTracking() {
        val assignment = currentAssignment ?: return
        val intent = Intent(requireContext(), VehicleTrackingService::class.java).apply {
            putExtra(VehicleTrackingService.EXTRA_VEHICLE_ID, assignment.vehicleId)
            putExtra(VehicleTrackingService.EXTRA_REG_NUMBER, assignment.regNumber)
        }
        ContextCompat.startForegroundService(requireContext(), intent)
        isTrackingTrip = true
        binding.btnToggleTracking.text = "Stop Trip Tracking"
    }

    private fun stopVehicleTracking() {
        val intent = Intent(requireContext(), VehicleTrackingService::class.java).apply {
            action = VehicleTrackingService.ACTION_STOP
        }
        requireContext().startService(intent)
        isTrackingTrip = false
        binding.btnToggleTracking.text = "Start Trip Tracking"
    }

    private fun hasLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            requireContext(), Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED || ContextCompat.checkSelfPermission(
            requireContext(), Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }

    @SuppressLint("MissingPermission")
    private fun fetchCurrentLocation(onResult: (Location?) -> Unit) {
        if (!hasLocationPermission()) {
            onResult(null)
            return
        }
        val cts = CancellationTokenSource()
        fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.token)
            .addOnSuccessListener { location: Location? -> onResult(location) }
            .addOnFailureListener { onResult(null) }
    }

    private fun refreshWorkLocationStatus() {
        fetchCurrentLocation { location ->
            lastKnownLocation = location
            if (location != null) {
                viewModel.updateCurrentDistance(location.latitude, location.longitude)
            }
        }
    }

    private fun renderWorkLocationCard(locations: List<MyWorkLocation>) {
        if (locations.isEmpty()) {
            binding.cardWorkLocation.visibility = View.GONE
            return
        }
        binding.cardWorkLocation.visibility = View.VISIBLE

        val status = viewModel.currentDistanceStatus.value
        if (status == null) {
            val fallback = locations.firstOrNull { it.isPrimary } ?: locations.first()
            binding.tvWorkLocationName.text = "📍 ${fallback.locationName}"
            binding.tvWorkLocationStatus.text = if (lastKnownLocation == null) {
                "Locating…"
            } else {
                "Distance unavailable"
            }
            binding.tvWorkLocationStatus.setTextColor(
                ContextCompat.getColor(requireContext(), R.color.warning)
            )
            return
        }

        val (location, distance) = status
        binding.tvWorkLocationName.text = "📍 ${location.locationName}"
        if (distance <= location.allowedRadiusM) {
            binding.tvWorkLocationStatus.text = "✅ Within range (${distance.toInt()} m)"
            binding.tvWorkLocationStatus.setTextColor(
                ContextCompat.getColor(requireContext(), R.color.success)
            )
        } else {
            binding.tvWorkLocationStatus.text =
                "⚠️ ${distance.toInt()} m away — must be within ${location.allowedRadiusM.toInt()} m"
            binding.tvWorkLocationStatus.setTextColor(
                ContextCompat.getColor(requireContext(), R.color.danger)
            )
        }
    }

    private fun checkPermissionsAndCapture() {
        val cameraGranted = ContextCompat.checkSelfPermission(requireContext(), Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
        val locationGranted = ContextCompat.checkSelfPermission(requireContext(), Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

        if (cameraGranted && locationGranted) {
            launchCamera()
        } else {
            val permissions = mutableListOf<String>()
            if (!cameraGranted) permissions.add(Manifest.permission.CAMERA)
            if (!locationGranted) {
                permissions.add(Manifest.permission.ACCESS_FINE_LOCATION)
                permissions.add(Manifest.permission.ACCESS_COARSE_LOCATION)
            }
            permissionLauncher.launch(permissions.toTypedArray())
        }
    }

    private fun launchCamera() {
        takePictureLauncher.launch(null)
    }

    private fun fetchLocationAndSubmit() {
        val image = capturedImage ?: return

        if (!hasLocationPermission()) {
            submitAttendance(image, null, null)
            return
        }

        binding.tvLocationStatus.visibility = View.VISIBLE
        binding.tvLocationStatus.text = "Fetching location…"

        fetchCurrentLocation { location ->
            lastKnownLocation = location
            if (location != null) {
                binding.tvLocationStatus.text = String.format(
                    "Location: %.6f, %.6f", location.latitude, location.longitude
                )
                viewModel.updateCurrentDistance(location.latitude, location.longitude)
                submitAttendance(image, location.latitude, location.longitude)
            } else {
                binding.tvLocationStatus.text = "Location unavailable"
                submitAttendance(image, null, null)
            }
        }
    }

    private fun submitAttendance(image: String, latitude: Double?, longitude: Double?) {
        val session = SessionManager(requireContext())
        val empId = session.getEmployeeId()

        when (pendingAction) {
            "clock_in" -> {
                if (empId != -1) {
                    viewModel.clockIn(empId, image, latitude, longitude)
                }
            }
            "clock_out" -> {
                currentAttendanceId?.let { id ->
                    viewModel.clockOut(id, image, latitude, longitude)
                }
            }
            "face_scan" -> {
                viewModel.faceScan(image, latitude, longitude)
            }
        }
        pendingAction = null
        capturedImage = null
    }

    private fun bitmapToBase64(bitmap: Bitmap): String {
        val stream = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.JPEG, 85, stream)
        val byteArray = stream.toByteArray()
        return Base64.encodeToString(byteArray, Base64.NO_WRAP)
    }

    private fun observeViewModel() {
        viewModel.myLocations.observe(viewLifecycleOwner) { locations ->
            renderWorkLocationCard(locations)
        }

        viewModel.currentDistanceStatus.observe(viewLifecycleOwner) {
            viewModel.myLocations.value?.let { renderWorkLocationCard(it) }
        }

        viewModel.myAssignment.observe(viewLifecycleOwner) { assignment ->
            currentAssignment = assignment
            if (assignment == null) {
                binding.cardVehicleTrip.visibility = View.GONE
            } else {
                binding.cardVehicleTrip.visibility = View.VISIBLE
                binding.tvVehicleReg.text = "🚛 Vehicle: ${assignment.regNumber}"
            }
        }

        viewModel.attendanceStatus.observe(viewLifecycleOwner) { attendance ->
            if (attendance == null) {
                binding.tvStatus.text = "Status: Not Clocked In"
                binding.tvLastEntry.text = "Last Entry: —"
                binding.btnClockIn.visibility = View.VISIBLE
                binding.btnClockOut.visibility = View.GONE
                binding.tvLogDetails.text = "No records yet today."
                binding.tvLocationStatus.visibility = View.GONE
                currentAttendanceId = null
            } else {
                currentAttendanceId = attendance.id
                if (attendance.exitTime == null) {
                    binding.tvStatus.text = "Status: Clocked In"
                    binding.btnClockIn.visibility = View.GONE
                    binding.btnClockOut.visibility = View.VISIBLE
                } else {
                    binding.tvStatus.text = "Status: Clocked Out"
                    binding.btnClockIn.visibility = View.GONE
                    binding.btnClockOut.visibility = View.GONE
                }
                binding.tvLastEntry.text = "Entry: ${attendance.entryTime}"

                val locationInfo = buildString {
                    append("Entry: ${attendance.entryTime}\nExit: ${attendance.exitTime ?: "—"}\nHours: ${attendance.hoursWorked ?: "—"}")
                    if (attendance.clockInLatitude != null && attendance.clockInLongitude != null) {
                        append("\nClock-in location: ${String.format("%.4f", attendance.clockInLatitude)}, ${String.format("%.4f", attendance.clockInLongitude)}")
                    }
                    if (attendance.clockOutLatitude != null && attendance.clockOutLongitude != null) {
                        append("\nClock-out location: ${String.format("%.4f", attendance.clockOutLatitude)}, ${String.format("%.4f", attendance.clockOutLongitude)}")
                    }
                }
                binding.tvLogDetails.text = locationInfo
            }
        }

        viewModel.clockInOutResult.observe(viewLifecycleOwner) { result ->
            if (result.isSuccess) {
                Toast.makeText(requireContext(), "Success!", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(requireContext(), "Error: ${result.exceptionOrNull()?.message}", Toast.LENGTH_LONG).show()
            }
        }

        viewModel.faceScanResult.observe(viewLifecycleOwner) { result ->
            if (result.isSuccess) {
                val response = result.getOrNull()
                val action = if (response?.action == "clock_in") "Clocked In" else "Clocked Out"
                Toast.makeText(requireContext(), "$action: ${response?.employeeName}", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(requireContext(), "Error: ${result.exceptionOrNull()?.message}", Toast.LENGTH_LONG).show()
            }
        }

        viewModel.isLoading.observe(viewLifecycleOwner) { isLoading ->
            binding.progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
            binding.btnClockIn.isEnabled = !isLoading
            binding.btnClockOut.isEnabled = !isLoading
            binding.btnFaceScan.isEnabled = !isLoading
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
