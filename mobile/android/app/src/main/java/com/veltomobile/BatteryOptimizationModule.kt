package com.veltomobile

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class BatteryOptimizationModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "BatteryOptimization"

    @ReactMethod
    fun isIgnoringBatteryOptimizations(promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            promise.resolve(true)
            return
        }
        val pm = reactContext.getSystemService(Context.POWER_SERVICE) as PowerManager
        promise.resolve(pm.isIgnoringBatteryOptimizations(reactContext.packageName))
    }

    // Must set the intent's data URI (package:<name>) — this is the one Android permission
    // dialog apps are allowed to trigger directly; Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS
    // (the bare settings list, no data URI) is the fallback if the direct request fails.
    @ReactMethod
    fun requestIgnoreBatteryOptimizations() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return
        try {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:${reactContext.packageName}")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactContext.startActivity(intent)
        } catch (e: Exception) {
            val fallback = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactContext.startActivity(fallback)
        }
    }
}
