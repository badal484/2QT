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

  private fun createNativeNotificationChannels() {
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
      val notificationManager = getSystemService(android.content.Context.NOTIFICATION_SERVICE) as android.app.NotificationManager

      val promoChannel = android.app.NotificationChannel(
        "promotions_v5",
        "Promotions & Offers",
        android.app.NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Promotions & Broadcast Announcements"
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 500, 250, 500)
        enableLights(true)
      }

      val orderChannel = android.app.NotificationChannel(
        "order_updates_v5",
        "Order Updates",
        android.app.NotificationManager.IMPORTANCE_HIGH
      ).apply {
        description = "Order Status Updates"
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 500, 250, 500)
        enableLights(true)
      }

      notificationManager.createNotificationChannel(promoChannel)
      notificationManager.createNotificationChannel(orderChannel)
    }
  }
}
