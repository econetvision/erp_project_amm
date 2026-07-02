package com.econetvision.erp.ui.attendance

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.location.Location
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.Base64
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.exifinterface.media.ExifInterface
import androidx.fragment.app.Fragment
import androidx.lifecycle.ViewModelProvider
import com.econetvision.erp.R
import com.econetvision.erp.data.local.SessionManager
import com.econetvision.erp.data.model.MyAssignment
import com.econetvision.erp.data.model.MyWorkLocation
import com.econetvision.erp.databinding.FragmentAttendanceBinding
import com.econetvision.erp.service.VehicleTrackingService
import com.econetvision.erp.util.Constants
import com.econetvision.erp.util.ToastType
import com.econetvision.erp.util.showToast
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.GoogleMap
import com.google.android.gms.maps.model.BitmapDescriptorFactory
import com.google.android.gms.maps.model.CircleOptions
import com.google.android.gms.maps.model.LatLng
import com.google.android.gms.maps.model.LatLngBounds
import com.google.android.gms.maps.model.MarkerOptions
import com.google.android.gms.tasks.CancellationTokenSource
import java.io.ByteArrayOutputStream
import java.io.File

class AttendanceFragment : Fragment() {
    private var _binding: FragmentAttendanceBinding? = null
    private val binding get() = _binding!!
    private lateinit var viewModel: AttendanceViewModel
    private var currentAttendanceId: Int? = null
    private var canClockOut = false
    private var pendingAction: String? = null // "clock_in", "clock_out", "face_scan", "clock_in_manual", "clock_out_manual"
    private var capturedImage: String? = null
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private var lastKnownLocation: Location? = null
    private var currentAssignment: MyAssignment? = null
    private var isTrackingTrip = false
    private var googleMap: GoogleMap? = null
    private var photoUri: Uri? = null
    private var photoFile: File? = null

    private val trackingPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val backgroundGranted = permissions[Manifest.permission.ACCESS_BACKGROUND_LOCATION] != false
        if (backgroundGranted) {
            startVehicleTracking()
        } else {
            showToast("Background location permission is required for trip tracking", ToastType.WARNING, longDuration = true)
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
            showToast("Camera permission is required for face verification", ToastType.ERROR, longDuration = true)
        }
        if (!locationGranted) {
            showToast("Location permission denied — attendance will be recorded without location", ToastType.WARNING)
        }
    }

    private val manualLocationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ ->
        // Proceed regardless: submit with location if granted, otherwise without.
        doFetchLocationAndSubmitManual()
    }

    private val takePictureLauncher = registerForActivityResult(
        ActivityResultContracts.TakePicture()
    ) { success: Boolean ->
        if (success && photoFile?.exists() == true) {
            val bitmap = loadAndResizeBitmap(photoFile!!, 640)
            if (bitmap != null) {
                capturedImage = bitmapToBase64(bitmap)
                fetchLocationAndSubmit()
            } else {
                showToast("Failed to process image", ToastType.ERROR)
            }
            // Clean up temp file
            photoFile?.delete()
        } else {
            showToast("Photo capture cancelled", ToastType.WARNING)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(requireActivity())
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentAttendanceBinding.inflate(inflater, container, false)
        viewModel = ViewModelProvider(this)[AttendanceViewModel::class.java]

        binding.mapView.onCreate(savedInstanceState)
        binding.mapView.getMapAsync { map ->
            googleMap = map
            map.uiSettings.isMapToolbarEnabled = false
            enableMyLocationLayer()
            updateMap()
        }

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

        binding.btnManual.setOnClickListener {
            when {
                currentAttendanceId == null -> {
                    pendingAction = "clock_in_manual"
                    fetchLocationAndSubmitManual()
                }
                canClockOut -> {
                    pendingAction = "clock_out_manual"
                    fetchLocationAndSubmitManual()
                }
                else -> showToast("Already clocked out today", ToastType.INFO)
            }
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
            showToast("Location permission is required to start tracking", ToastType.WARNING, longDuration = true)
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
            updateMap()
        }
    }

    @SuppressLint("MissingPermission")
    private fun enableMyLocationLayer() {
        if (hasLocationPermission()) {
            googleMap?.isMyLocationEnabled = true
        }
    }

    /**
     * Redraws the attendance map: assigned work location(s) with their geofence radius,
     * the device's last-known position, and any recorded clock-in / clock-out pins.
     * Safe to call before the map is ready — it no-ops until [googleMap] is set.
     */
    private fun updateMap() {
        val map = googleMap ?: return
        map.clear()

        val boundsBuilder = LatLngBounds.Builder()
        var pointCount = 0
        var lastPoint: LatLng? = null

        viewModel.myLocations.value?.forEach { loc ->
            val pos = LatLng(loc.latitude, loc.longitude)
            map.addMarker(
                MarkerOptions()
                    .position(pos)
                    .title(loc.locationName)
                    .icon(BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_AZURE))
            )
            map.addCircle(
                CircleOptions()
                    .center(pos)
                    .radius(loc.allowedRadiusM)
                    .strokeWidth(3f)
                    .strokeColor(0x552196F3)
                    .fillColor(0x222196F3)
            )
            boundsBuilder.include(pos); lastPoint = pos; pointCount++
        }

        lastKnownLocation?.let {
            val pos = LatLng(it.latitude, it.longitude)
            boundsBuilder.include(pos); lastPoint = pos; pointCount++
        }

        val att = viewModel.attendanceStatus.value
        val inLat = att?.clockInLatitude
        val inLng = att?.clockInLongitude
        if (inLat != null && inLng != null) {
            val pos = LatLng(inLat, inLng)
            map.addMarker(
                MarkerOptions()
                    .position(pos)
                    .title("Clock-in")
                    .icon(BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_GREEN))
            )
            boundsBuilder.include(pos); lastPoint = pos; pointCount++
        }
        val outLat = att?.clockOutLatitude
        val outLng = att?.clockOutLongitude
        if (outLat != null && outLng != null) {
            val pos = LatLng(outLat, outLng)
            map.addMarker(
                MarkerOptions()
                    .position(pos)
                    .title("Clock-out")
                    .icon(BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_RED))
            )
            boundsBuilder.include(pos); lastPoint = pos; pointCount++
        }

        when {
            pointCount == 0 -> Unit
            pointCount == 1 -> map.moveCamera(CameraUpdateFactory.newLatLngZoom(lastPoint!!, 16f))
            else -> try {
                map.moveCamera(CameraUpdateFactory.newLatLngBounds(boundsBuilder.build(), 120))
            } catch (e: Exception) {
                // Map not yet laid out (common in lite mode) — fall back to a single-point zoom.
                map.moveCamera(CameraUpdateFactory.newLatLngZoom(lastPoint!!, 15f))
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
        val cacheDir = File(requireContext().cacheDir, "face_captures")
        if (!cacheDir.exists()) cacheDir.mkdirs()
        photoFile = File(cacheDir, "face_${System.currentTimeMillis()}.jpg")
        photoUri = FileProvider.getUriForFile(
            requireContext(),
            "${requireContext().packageName}.fileprovider",
            photoFile!!
        )
        takePictureLauncher.launch(photoUri)
    }

    /**
     * Enforce the assigned-work-location geofence and surface the result as a toast.
     * Returns true if attendance may proceed (inside the allowed radius + tolerance,
     * no assigned location, or location unknown), false if the user is outside range
     * (in which case submission is blocked).
     */
    private fun passesGeofence(location: Location?): Boolean {
        if (location == null) {
            if (!viewModel.myLocations.value.isNullOrEmpty()) {
                showToast("Location unavailable — attendance may be rejected", ToastType.WARNING, longDuration = true)
            }
            return true
        }
        return when (val geo = viewModel.evaluateGeofence(
            location.latitude, location.longitude, Constants.GEOFENCE_BUFFER_M
        )) {
            is AttendanceViewModel.GeofenceResult.NoAssignment -> true
            is AttendanceViewModel.GeofenceResult.Inside -> {
                showToast("Within ${geo.location.locationName} • ${geo.distance.toInt()} m", ToastType.SUCCESS)
                true
            }
            is AttendanceViewModel.GeofenceResult.Outside -> {
                showToast(
                    "You are ${geo.distance.toInt()} m from ${geo.location.locationName}. " +
                        "Move within ${geo.effectiveRadius.toInt()} m to mark attendance.",
                    ToastType.ERROR, longDuration = true,
                )
                false
            }
        }
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
                updateMap()
                if (!passesGeofence(location)) {
                    binding.tvLocationStatus.text = "Outside work location range — not submitted"
                    pendingAction = null
                    capturedImage = null
                    return@fetchCurrentLocation
                }
                submitAttendance(image, location.latitude, location.longitude)
            } else {
                binding.tvLocationStatus.text = "Location unavailable"
                passesGeofence(null)
                submitAttendance(image, null, null)
            }
        }
    }

    private fun fetchLocationAndSubmitManual() {
        if (hasLocationPermission()) {
            doFetchLocationAndSubmitManual()
        } else {
            manualLocationPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        }
    }

    private fun doFetchLocationAndSubmitManual() {
        if (!hasLocationPermission()) {
            submitManual(null, null)
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
                if (!passesGeofence(location)) {
                    binding.tvLocationStatus.text = "Outside work location range — not submitted"
                    pendingAction = null
                    return@fetchCurrentLocation
                }
                submitManual(location.latitude, location.longitude)
            } else {
                binding.tvLocationStatus.text = "Location unavailable"
                passesGeofence(null)
                submitManual(null, null)
            }
        }
    }

    private fun submitManual(latitude: Double?, longitude: Double?) {
        val session = SessionManager(requireContext())
        val empId = session.getEmployeeId()
        when (pendingAction) {
            "clock_in_manual" -> if (empId != -1) viewModel.clockInManual(empId, latitude, longitude)
            "clock_out_manual" -> currentAttendanceId?.let { id -> viewModel.clockOutManual(id, latitude, longitude) }
        }
        pendingAction = null
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

    /**
     * Load image from file and resize to target width while maintaining aspect ratio.
     * Also applies EXIF rotation correction for front camera images.
     */
    private fun loadAndResizeBitmap(file: File, targetWidth: Int): Bitmap? {
        return try {
            // First decode bounds only
            val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(file.absolutePath, options)

            // Calculate sample size for efficient loading
            val scale = (options.outWidth.toFloat() / targetWidth).toInt().coerceAtLeast(1)
            options.inJustDecodeBounds = false
            options.inSampleSize = scale

            var bitmap = BitmapFactory.decodeFile(file.absolutePath, options) ?: return null

            // Apply EXIF rotation
            val exif = ExifInterface(file.absolutePath)
            val orientation = exif.getAttributeInt(
                ExifInterface.TAG_ORIENTATION,
                ExifInterface.ORIENTATION_NORMAL
            )
            val matrix = Matrix()
            when (orientation) {
                ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
                ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
                ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
                ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> matrix.postScale(-1f, 1f)
                ExifInterface.ORIENTATION_FLIP_VERTICAL -> matrix.postScale(1f, -1f)
            }
            if (!matrix.isIdentity) {
                bitmap = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
            }

            // Scale to target width
            val ratio = targetWidth.toFloat() / bitmap.width
            val newHeight = (bitmap.height * ratio).toInt()
            Bitmap.createScaledBitmap(bitmap, targetWidth, newHeight, true)
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    private fun observeViewModel() {
        viewModel.myLocations.observe(viewLifecycleOwner) { locations ->
            renderWorkLocationCard(locations)
            updateMap()
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
                canClockOut = false
            } else {
                currentAttendanceId = attendance.id
                if (attendance.exitTime == null) {
                    binding.tvStatus.text = "Status: Clocked In"
                    binding.btnClockIn.visibility = View.GONE
                    binding.btnClockOut.visibility = View.VISIBLE
                    canClockOut = true
                } else {
                    binding.tvStatus.text = "Status: Clocked Out"
                    binding.btnClockIn.visibility = View.GONE
                    binding.btnClockOut.visibility = View.GONE
                    canClockOut = false
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
            updateMap()
        }

        viewModel.clockInOutResult.observe(viewLifecycleOwner) { result ->
            if (result.isSuccess) {
                showToast("Attendance recorded successfully", ToastType.SUCCESS)
            } else {
                showToast(
                    result.exceptionOrNull()?.message ?: "Could not record attendance",
                    ToastType.ERROR, longDuration = true,
                )
            }
        }

        viewModel.faceScanResult.observe(viewLifecycleOwner) { result ->
            if (result.isSuccess) {
                val response = result.getOrNull()
                val action = if (response?.action == "clock_in") "Clocked In" else "Clocked Out"
                showToast("$action: ${response?.employeeName}", ToastType.SUCCESS)
            } else {
                showToast(
                    result.exceptionOrNull()?.message ?: "Face scan failed",
                    ToastType.ERROR, longDuration = true,
                )
            }
        }

        viewModel.isLoading.observe(viewLifecycleOwner) { isLoading ->
            binding.progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
            binding.btnClockIn.isEnabled = !isLoading
            binding.btnClockOut.isEnabled = !isLoading
            binding.btnFaceScan.isEnabled = !isLoading
            binding.btnManual.isEnabled = !isLoading
        }
    }

    override fun onResume() {
        super.onResume()
        _binding?.mapView?.onResume()
    }

    override fun onPause() {
        _binding?.mapView?.onPause()
        super.onPause()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        _binding?.mapView?.onSaveInstanceState(outState)
    }

    override fun onLowMemory() {
        super.onLowMemory()
        _binding?.mapView?.onLowMemory()
    }

    override fun onDestroyView() {
        binding.mapView.onDestroy()
        googleMap = null
        super.onDestroyView()
        _binding = null
    }
}
