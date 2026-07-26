package com.econetvision.erp.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.location.Location
import android.content.pm.ServiceInfo
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import com.econetvision.erp.data.repository.TrackingRepository
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class VehicleTrackingService : Service() {

    companion object {
        const val EXTRA_VEHICLE_ID = "vehicle_id"
        const val EXTRA_REG_NUMBER = "reg_number"
        const val ACTION_STOP = "com.econetvision.erp.action.STOP_TRACKING"
        private const val CHANNEL_ID = "vehicle_tracking"
        private const val NOTIFICATION_ID = 4201
        private const val UPDATE_INTERVAL_MS = 20_000L
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val repository = TrackingRepository()
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private var vehicleId: Int = -1
    private var regNumber: String = ""

    private val locationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            val location: Location = result.lastLocation ?: return
            if (vehicleId == -1) return
            scope.launch {
                repository.pushLocation(
                    vehicleId = vehicleId,
                    latitude = location.latitude,
                    longitude = location.longitude,
                    speed = if (location.hasSpeed()) (location.speed * 3.6).toDouble() else null
                )
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopTracking()
            return START_NOT_STICKY
        }

        vehicleId = intent?.getIntExtra(EXTRA_VEHICLE_ID, -1) ?: -1
        regNumber = intent?.getStringExtra(EXTRA_REG_NUMBER) ?: ""
        if (vehicleId == -1) {
            stopSelf()
            return START_NOT_STICKY
        }

        // Android 14+ requires the foreground service type to be declared at
        // startForeground() time, and throws if the app is no longer allowed to
        // start a location FGS (e.g. it was backgrounded during the permission flow).
        try {
            ServiceCompat.startForeground(
                this,
                NOTIFICATION_ID,
                buildNotification(),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION,
            )
        } catch (e: Exception) {
            stopSelf()
            return START_NOT_STICKY
        }
        startLocationUpdates()
        // The tracked vehicle id lives only in the start intent, so a redelivery
        // without it could not resume tracking anyway.
        return START_NOT_STICKY
    }

    private fun startLocationUpdates() {
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, UPDATE_INTERVAL_MS)
            .setMinUpdateIntervalMillis(UPDATE_INTERVAL_MS / 2)
            .build()
        try {
            fusedLocationClient.requestLocationUpdates(request, locationCallback, mainLooper)
        } catch (e: SecurityException) {
            stopSelf()
        }
    }

    private fun stopTracking() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun createNotificationChannel() {
        // minSdk is 26, so notification channels are always available.
        val channel = NotificationChannel(
            CHANNEL_ID, "Vehicle Tracking", NotificationManager.IMPORTANCE_LOW
        ).apply { description = "Shows when vehicle trip tracking is active" }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        val stopIntent = Intent(this, VehicleTrackingService::class.java).apply { action = ACTION_STOP }
        val stopPendingIntent = PendingIntent.getService(
            this, 0, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Vehicle tracking active")
            .setContentText(if (regNumber.isNotBlank()) "Tracking $regNumber" else "Tracking your vehicle")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", stopPendingIntent)
            .build()
    }

    override fun onDestroy() {
        super.onDestroy()
        fusedLocationClient.removeLocationUpdates(locationCallback)
        // Without this the scope's SupervisorJob keeps any in-flight location
        // uploads (and the service instance they capture) alive after teardown.
        scope.cancel()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
