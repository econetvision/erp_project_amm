package com.econetvision.erp.attendance.ui

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.os.Build
import android.os.Bundle
import android.util.Base64
import android.view.View
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.LinearLayoutManager
import com.econetvision.erp.attendance.R
import com.econetvision.erp.attendance.data.SessionManager
import com.econetvision.erp.attendance.databinding.ActivityHomeBinding
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import java.io.File

class HomeActivity : AppCompatActivity() {

    private lateinit var binding: ActivityHomeBinding
    private lateinit var session: SessionManager
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private val viewModel: HomeViewModel by viewModels()
    private val adapter = TodayAdapter()

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        if (hasCameraPermission() && hasLocationPermission()) {
            launchCapture()
        } else {
            showDialog(getString(R.string.permission_needed_title), getString(R.string.permission_needed_body))
        }
    }

    private val captureLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode != RESULT_OK) return@registerForActivityResult
        val path = result.data?.getStringExtra(FaceCaptureActivity.EXTRA_IMAGE_PATH)
        val image = path?.let { readAndDelete(it) }
        if (image == null) {
            showDialog(getString(R.string.scan_failed_title), getString(R.string.capture_failed))
            return@registerForActivityResult
        }
        submitWithLocation(image)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        session = SessionManager(this)
        if (!session.isLoggedIn()) {
            endSession(null)
            return
        }

        binding = ActivityHomeBinding.inflate(layoutInflater)
        setContentView(binding.root)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        binding.tvSubtitle.text = session.getDisplayName().orEmpty()
        binding.rvToday.layoutManager = LinearLayoutManager(this)
        binding.rvToday.adapter = adapter

        binding.btnScan.setOnClickListener { startScan() }
        binding.btnLogout.setOnClickListener { endSession(null) }
        binding.swipe.setOnRefreshListener { viewModel.refresh() }

        viewModel.site.observe(this) { site ->
            binding.tvSite.text = site?.locationName.orEmpty()
        }
        viewModel.today.observe(this) { today ->
            val entries = today?.entries.orEmpty()
            adapter.submitList(entries)
            binding.tvCount.text = getString(R.string.home_present_count, today?.presentCount ?: 0)
            binding.tvEmpty.visibility = if (today != null && entries.isEmpty()) View.VISIBLE else View.GONE
        }
        viewModel.refreshing.observe(this) { binding.swipe.isRefreshing = it == true }
        viewModel.scanning.observe(this) { scanning ->
            binding.busyRow.visibility = if (scanning == true) View.VISIBLE else View.GONE
            binding.btnScan.isEnabled = scanning != true
        }
        viewModel.scanOutcome.observe(this) { outcome ->
            when (outcome) {
                is ScanOutcome.Marked -> {
                    val title = if (outcome.response.action == "clock_in") {
                        getString(R.string.scan_clocked_in_title)
                    } else {
                        getString(R.string.scan_clocked_out_title)
                    }
                    val body = getString(
                        R.string.scan_result,
                        outcome.response.employeeName,
                        TodayAdapter.shortTime(outcome.response.time),
                    )
                    showDialog(title, body)
                    viewModel.consumeScanOutcome()
                }
                is ScanOutcome.Failed -> {
                    showDialog(getString(R.string.scan_failed_title), outcome.message)
                    viewModel.consumeScanOutcome()
                }
                null -> Unit
            }
        }
        viewModel.notice.observe(this) { notice ->
            if (notice != null) {
                showDialog(getString(R.string.app_name), notice)
                viewModel.consumeNotice()
            }
        }
        viewModel.sessionEnded.observe(this) { reason ->
            if (reason != null) endSession(reason)
        }
    }

    override fun onResume() {
        super.onResume()
        if (session.isLoggedIn()) viewModel.refresh()
    }

    private fun startScan() {
        if (hasCameraPermission() && hasLocationPermission()) {
            launchCapture()
        } else {
            permissionLauncher.launch(
                arrayOf(
                    Manifest.permission.CAMERA,
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                )
            )
        }
    }

    private fun launchCapture() {
        captureLauncher.launch(Intent(this, FaceCaptureActivity::class.java))
    }

    /** The server accepts a scan only at the site, so a fresh GPS fix is required. */
    @SuppressLint("MissingPermission")
    private fun submitWithLocation(imageBase64: String) {
        if (!hasLocationPermission()) {
            showDialog(getString(R.string.permission_needed_title), getString(R.string.permission_needed_body))
            return
        }
        viewModel.setScanning(true)
        val cts = CancellationTokenSource()
        // Activity-scoped listeners: they are dropped if the activity is destroyed
        // before the fix arrives, so no dialog is shown on a dead window.
        fusedLocationClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, cts.token)
            .addOnSuccessListener(this) { location: Location? ->
                viewModel.setScanning(false)
                when {
                    location == null ->
                        showDialog(getString(R.string.scan_failed_title), getString(R.string.location_unavailable))
                    isMockLocation(location) ->
                        showDialog(getString(R.string.scan_failed_title), getString(R.string.location_mock))
                    else -> viewModel.submitScan(imageBase64, location.latitude, location.longitude)
                }
            }
            .addOnFailureListener(this) {
                viewModel.setScanning(false)
                showDialog(getString(R.string.scan_failed_title), getString(R.string.location_unavailable))
            }
    }

    /** Positions from a mock-location app are refused: attendance is location-only. */
    private fun isMockLocation(location: Location): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            location.isMock
        } else {
            @Suppress("DEPRECATION")
            location.isFromMockProvider
        }

    /** Reads the captured JPEG as base64 and removes it; a worker's photo is not kept on the phone. */
    private fun readAndDelete(path: String): String? {
        val file = File(path)
        return try {
            if (!file.exists()) null else Base64.encodeToString(file.readBytes(), Base64.NO_WRAP)
        } catch (e: Exception) {
            null
        } finally {
            file.delete()
        }
    }

    private fun hasCameraPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED

    private fun hasLocationPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    private fun showDialog(title: String, body: String) {
        if (isFinishing) return
        MaterialAlertDialogBuilder(this)
            .setTitle(title)
            .setMessage(body)
            .setPositiveButton(R.string.scan_ok, null)
            .show()
    }

    private fun endSession(reason: String?) {
        session.clear()
        val intent = Intent(this, LoginActivity::class.java)
        if (reason != null) intent.putExtra(LoginActivity.EXTRA_MESSAGE, reason)
        startActivity(intent)
        finish()
    }
}
