package com.econetvision.erp.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.econetvision.erp.MainActivity
import com.econetvision.erp.R
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Receives FCM pushes from the backend (e.g. "employee left work location")
 * and shows them on the high-importance "alerts" channel.
 *
 * Only runs when the app is built with `google-services.json`; otherwise
 * Firebase never starts this service.
 */
class ErpFirebaseMessagingService : FirebaseMessagingService() {

    companion object {
        const val CHANNEL_ALERTS = "alerts"

        /** Idempotent; safe to call from Application.onCreate on every launch. */
        fun ensureAlertsChannel(context: Context) {
            val channel = NotificationChannel(
                CHANNEL_ALERTS, "Alerts", NotificationManager.IMPORTANCE_HIGH
            ).apply { description = "Attendance and work-location alerts" }
            context.getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    override fun onNewToken(token: String) {
        PushTokenManager.onNewToken(applicationContext, token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        // Notification-type messages are shown by the system automatically while
        // the app is in the background; when it is in the foreground (or the
        // backend sent a data-only message) we build the notification ourselves.
        val title = message.notification?.title ?: message.data["title"] ?: return
        val body = message.notification?.body ?: message.data["body"] ?: ""
        ensureAlertsChannel(this)

        val openIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("open_notifications", true)
            message.data["kind"]?.let { putExtra("kind", it) }
        }
        val pending = PendingIntent.getActivity(
            this, (System.currentTimeMillis() % Int.MAX_VALUE).toInt(), openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(this, CHANNEL_ALERTS)
            .setSmallIcon(R.drawable.ic_logo_ev)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .build()
        val id = (message.messageId?.hashCode() ?: System.currentTimeMillis().toInt())
        getSystemService(NotificationManager::class.java).notify(id, notification)
    }
}
