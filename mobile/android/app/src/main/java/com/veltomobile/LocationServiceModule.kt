package com.veltomobile

import android.content.Intent
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class LocationServiceModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "LocationService"

    @ReactMethod
    fun start(token: String, apiUrl: String) {
        val intent = Intent(reactContext, LocationForegroundService::class.java).apply {
            putExtra("token", token)
            putExtra("apiUrl", apiUrl)
        }
        ContextCompat.startForegroundService(reactContext, intent)
    }

    @ReactMethod
    fun stop() {
        val intent = Intent(reactContext, LocationForegroundService::class.java)
        reactContext.stopService(intent)
    }
}
