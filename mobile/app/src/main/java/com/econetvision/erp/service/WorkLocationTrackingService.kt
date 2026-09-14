package com.econetvision.erp.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.econetvision.erp.data.local.SessionManager
import com.econetvision.erp.data.repository.GeofenceRepository
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

/**
 * Foreground location service that reports the employee's position to
 * `/api/geofence/ping` while they are clocked in, so the backend can alert
 * their supervisor when they leave the assigned work location.
 *
 * Runs only between clock-in and clock-out: the backend answers
 * `tracking=false` once the employee has clocked out (or was never clocked
 * in today) and the service stops itself on that response.
 */
class WorkLocationTrackingService : Service() {

    companion object {
        private const val TAG = "WorkLocationTracking"
        const val ACTION_STOP = "com.econetvision.erp.action.STOP_WORK_LOCATION_TRACKING"
        private const val CHANNEL_ID = "work_location_tracking"
        private const val NOTIFICATION_ID = 4202
        private const val DEFAULT_INTERVAL_MS = 60_000L

        @Volatile
        var isRunning: Boolean = false
            private set

        fun start(context: Context) {
            if (isRunning) return
            ContextCompat.startForegroundService(context, Intent(context, WorkLocationTrackingService::class.java))
        }

        fun stop(context: Context) {
            if (!isRunning) return
            context.startService(Intent(context, WorkLocationTrackingService::class.java).apply { action = ACTION_STOP })
        }
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val repository = GeofenceRepository()
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var session: SessionManager
    private var intervalMs = DEFAULT_INTERVAL_MS
    private var statusText: String = "Sharing location with your supervisor"

    private val locationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            val location: Location = result.lastLocation ?: return
            if (!session.isLoggedIn()) {
                stopTracking()
                return
            }
            scope.launch {
                when (val outcome = repository.ping(
                    latitude = location.latitude,
                    longitude = location.longitude,
                    accuracyM = if (location.hasAccuracy()) location.accuracy.toDouble() else null,
                )) {
                    is GeofenceRepository.PingOutcome.Ok -> handleResponse(outcome)
                    GeofenceRepository.PingOutcome.Unauthorized -> stopTracking()
                    is GeofenceRepository.PingOutcome.Error -> Log.w(TAG, "Ping failed: ${outcome.message}")
                }
            }
        }
    }

    private fun handleResponse(outcome: GeofenceRepository.PingOutcome.Ok) {
        val r = outcome.response
        if (!r.tracking) {
            Log.i(TAG, "Backend reports not clocked in; stopping")
            stopTracking()
            return
        }
        val wanted = r.pingIntervalS * 1000L
        if (wanted in 15_000L..600_000L && wanted != intervalMs) {
            intervalMs = wanted
            restartLocationUpdates()
        }
        val newStatus = when {
            r.nearestLocation == null -> "Sharing location with your supervisor"
            r.inside -> "At ${r.nearestLocation}"
            else -> "${r.distanceM?.let { "%.0f m".format(it) } ?: "Away"} from ${r.nearestLocation}"
        }
        if (newStatus != statusText) {
            statusText = newStatus
            getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification())
        }
    }

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        session = SessionManager(this)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopTracking()
            return START_NOT_STICKY
        }
        if (!session.isLoggedIn()) {
            stopSelf()
            return START_NOT_STICKY
        }
        try {
            ServiceCompat.startForeground(
                this,
                NOTIFICATION_ID,
                buildNotification(),
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION,
            )
        } catch (e: Exception) {
            Log.w(TAG, "Cannot start foreground service: ${e.message}")
            stopSelf()
            return START_NOT_STICKY
        }
        isRunning = true
        startLocationUpdates()
        // If the OS kills us mid-shift, come back: the backend tells us whether
        // the employee is still clocked in on the first ping.
        return START_STICKY
    }

    private fun startLocationUpdates() {
        val request = LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, intervalMs)
            .setMinUpdateIntervalMillis(intervalMs / 2)
            .setMaxUpdateDelayMillis(intervalMs)
            .build()
        try {
            fusedLocationClient.requestLocationUpdates(request, locationCallback, mainLooper)
        } catch (e: SecurityException) {
            Log.w(TAG, "Location permission missing; stopping")
            stopTracking()
        }
    }

    private fun restartLocationUpdates() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
        startLocationUpdates()
    }

    private fun stopTracking() {
        isRunning = false
        fusedLocationClient.removeLocationUpdates(locationCallback)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID, "Work location tracking", NotificationManager.IMPORTANCE_LOW
        ).apply { description = "Shows while your location is shared during a shift" }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Clocked in")
            .setContentText(statusText)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()
    }

    override fun onDestroy() {
        isRunning = false
        fusedLocationClient.removeLocationUpdates(locationCallback)
        scope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
