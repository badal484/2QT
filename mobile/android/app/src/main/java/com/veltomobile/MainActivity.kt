package com.veltomobile

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.os.Bundle

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
    createNotificationChannels()
  }

  private fun createNotificationChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    listOf(
      Triple("order_updates",  "Order Updates",  "Order confirmations, status updates and delivery notifications"),
      Triple("promotions",     "Promotions",     "Offers, campaigns and special deals"),
      Triple("account",        "Account",        "Wallet, loyalty and subscription alerts"),
    ).forEach { (id, name, desc) ->
      if (nm.getNotificationChannel(id) == null) {
        val ch = NotificationChannel(id, name, NotificationManager.IMPORTANCE_HIGH).apply {
          description = desc
          enableVibration(true)
          enableLights(true)
        }
        nm.createNotificationChannel(ch)
      }
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "VeltoMobile"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
