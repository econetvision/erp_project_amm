package com.econetvision.erp.push

import android.content.Context
import android.util.Log
import com.econetvision.erp.data.local.SessionManager
import com.econetvision.erp.data.repository.GeofenceRepository
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

/**
 * Keeps the backend informed of this device's FCM token.
 *
 * Firebase is optional at build time: without `app/google-services.json` the
 * default FirebaseApp is never initialised and [FirebaseMessaging.getInstance]
 * throws. Every entry point here swallows that so the rest of the app is
 * unaffected — push simply stays off until the config file is added.
 */
object PushTokenManager {
    private const val TAG = "PushTokenManager"
    private const val PREF_LAST_REGISTERED = "fcm_last_registered_token"

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val repository by lazy { GeofenceRepository() }

    /** Fetch the current token and register it if a user is logged in. */
    fun registerIfLoggedIn(context: Context) {
        val session = SessionManager(context)
        if (!session.isLoggedIn()) return
        scope.launch {
            val token = currentToken() ?: return@launch
            register(context, token)
        }
    }

    /** Called from the messaging service when Firebase rotates the token. */
    fun onNewToken(context: Context, token: String) {
        val session = SessionManager(context)
        if (!session.isLoggedIn()) return
        scope.launch { register(context, token) }
    }

    /** Remove this device's token from the current user before the session is cleared. */
    fun unregisterBlocking(context: Context) {
        val prefs = context.getSharedPreferences("erp_push", Context.MODE_PRIVATE)
        val token = prefs.getString(PREF_LAST_REGISTERED, null) ?: return
        prefs.edit().remove(PREF_LAST_REGISTERED).apply()
        // Fire-and-forget: logout must not wait on the network. The backend also
        // re-owns the token on the next login from this device.
        scope.launch { repository.unregisterDeviceToken(token) }
    }

    private suspend fun register(context: Context, token: String) {
        val prefs = context.getSharedPreferences("erp_push", Context.MODE_PRIVATE)
        val result = repository.registerDeviceToken(token)
        if (result.isSuccess) {
            prefs.edit().putString(PREF_LAST_REGISTERED, token).apply()
            Log.d(TAG, "Device token registered")
        } else {
            Log.w(TAG, "Device token registration failed: ${result.exceptionOrNull()?.message}")
        }
    }

    private suspend fun currentToken(): String? {
        return try {
            FirebaseMessaging.getInstance().token.await()
        } catch (e: Exception) {
            // IllegalStateException when google-services.json is absent, or a
            // Play services error. Either way push is unavailable on this build/device.
            Log.i(TAG, "Push unavailable: ${e.message}")
            null
        }
    }
}
