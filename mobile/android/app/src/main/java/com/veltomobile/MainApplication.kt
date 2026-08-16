package com.veltomobile

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          add(RolePackage())
          add(LocationServicePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    createNativeNotificationChannels()
    loadReactNative(this)
  }

  // Single source of truth for notification channels. Runs in Application.onCreate(),
  // which fires before any Activity — including when the process is spun up headless
  // to handle a background/killed-state FCM message. Channels created only from JS
  // (Notifee, in index.js) or only in MainActivity.onCreate() are NOT guaranteed to
  // exist yet when a killed-app push arrives, and Android silently drops a notification
  // whose channelId doesn't exist. All four channel IDs referenced anywhere in the
  // FCM payload (backend fcm.service.ts / notification.service.ts) or in the JS-side
  // Notifee fallback (mobile/src/services/localNotif.ts) must stay listed here.
  private fun createNativeNotificationChannels() {
    if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.O) return
    val notificationManager = getSystemService(android.content.Context.NOTIFICATION_SERVICE) as android.app.NotificationManager

    fun channel(id: String, name: String, description: String, sound: String?): android.app.NotificationChannel {
      return android.app.NotificationChannel(id, name, android.app.NotificationManager.IMPORTANCE_HIGH).apply {
        this.description = description
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 500, 250, 500)
        enableLights(true)
        if (sound != null) {
          val uri = android.net.Uri.parse("android.resource://${packageName}/raw/$sound")
          val audioAttributes = android.media.AudioAttributes.Builder()
            .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()
          setSound(uri, audioAttributes)
        }
      }
    }

    notificationManager.createNotificationChannel(
      channel("order_dispatch_v2", "Order Dispatch Alerts", "High-priority order alerts and dispatch updates", "alert")
    )
    notificationManager.createNotificationChannel(
      channel("order_updates_v5", "Order Updates", "Order confirmations, status updates and delivery notifications", null)
    )
    notificationManager.createNotificationChannel(
      channel("promotions_v5", "Promotions & Offers", "Promotions & Broadcast Announcements", null)
    )
    notificationManager.createNotificationChannel(
      channel("account_v5", "Account & Wallet Alerts", "Wallet, loyalty and subscription alerts", null)
    )
  }
}
