package com.veltomobile

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

private const val TAG = "LocationFgService"

class LocationForegroundService : Service() {

    private lateinit var locationManager: LocationManager
    private var authToken: String = ""
    private var apiUrl: String = ""
    private val executor = Executors.newSingleThreadExecutor()

    private val locationListener = object : LocationListener {
        override fun onLocationChanged(location: Location) {
            Log.d(TAG, "GPS update: ${location.latitude}, ${location.longitude} (provider=${location.provider})")
            sendLocation(location.latitude, location.longitude)
        }
        @Deprecated("Deprecated in API 29")
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
        override fun onProviderEnabled(provider: String) {}
        override fun onProviderDisabled(provider: String) {}
    }

    override fun onCreate() {
        super.onCreate()
        locationManager = getSystemService(LOCATION_SERVICE) as LocationManager
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        authToken = intent?.getStringExtra("token") ?: ""
        apiUrl = intent?.getStringExtra("apiUrl") ?: ""

        Log.d(TAG, "Service starting — token length=${authToken.length}, apiUrl=$apiUrl")
        startForeground(NOTIF_ID, buildNotification())

        // Remove any stale listeners before re-registering (handles multiple onStartCommand calls)
        try { locationManager.removeUpdates(locationListener) } catch (_: Exception) {}

        var registered = false
        // minDistance=0f → callbacks fire on time interval alone, regardless of movement
        try {
            locationManager.requestLocationUpdates(
                LocationManager.GPS_PROVIDER, 4000L, 0f,
                locationListener, Looper.getMainLooper()
            )
            registered = true
            Log.d(TAG, "GPS_PROVIDER registered (0m threshold)")
        } catch (e: SecurityException) { Log.w(TAG, "GPS permission denied: $e") }

        try {
            locationManager.requestLocationUpdates(
                LocationManager.NETWORK_PROVIDER, 4000L, 0f,
                locationListener, Looper.getMainLooper()
            )
            registered = true
            Log.d(TAG, "NETWORK_PROVIDER registered (0m threshold)")
        } catch (e: SecurityException) { Log.w(TAG, "Network location permission denied: $e") }

        if (!registered) Log.e(TAG, "No location provider registered — check permissions")

        // Send last known location immediately so map shows rider before first GPS interval fires
        executor.submit {
            try {
                for (provider in listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)) {
                    @Suppress("MissingPermission")
                    val last = locationManager.getLastKnownLocation(provider)
                    if (last != null) {
                        Log.d(TAG, "Sending last known location from $provider: ${last.latitude}, ${last.longitude}")
                        sendLocation(last.latitude, last.longitude)
                        break
                    }
                }
            } catch (e: Exception) { Log.w(TAG, "getLastKnownLocation failed: $e") }
        }

        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        try { locationManager.removeUpdates(locationListener) } catch (_: Exception) {}
        executor.shutdownNow()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun sendLocation(lat: Double, lng: Double) {
        if (authToken.isEmpty() || apiUrl.isEmpty()) return
        executor.submit {
            try {
                val url = URL("$apiUrl/riders/location")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("Authorization", "Bearer $authToken")
                conn.doOutput = true
                conn.connectTimeout = 8000
                conn.readTimeout = 8000

                val body = JSONObject().apply {
                    put("lat", lat)
                    put("lng", lng)
                }.toString().toByteArray()

                val os: OutputStream = conn.outputStream
                os.write(body)
                os.close()
                val code = conn.responseCode
                Log.d(TAG, "POST /riders/location → HTTP $code")
                conn.disconnect()
            } catch (e: Exception) {
                Log.e(TAG, "sendLocation failed: $e")
            }
        }
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Delivery Tracking",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Live location tracking during delivery"
            setShowBadge(false)
        }
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Delivery in progress")
            .setContentText("Your location is being shared with the customer")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()

    companion object {
        const val CHANNEL_ID = "rider_location_tracking"
        const val NOTIF_ID = 9001
    }
}
