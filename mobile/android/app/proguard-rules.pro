# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-rules.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.

# ─── React Native Core & Hermes ───────────────────────────────────────────────
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }
-dontwarn com.facebook.react.**
-dontwarn com.facebook.hermes.**

# ─── 2QT Native Modules & Services ───────────────────────────────────────────
-keep class com.veltomobile.LocationForegroundService { *; }
-keep class com.veltomobile.LocationServiceModule { *; }
-keep class com.veltomobile.LocationServicePackage { *; }
-keep class com.veltomobile.RoleModule { *; }
-keep class com.veltomobile.RolePackage { *; }
-keep class com.veltomobile.MainActivity { *; }
-keep class com.veltomobile.MainApplication { *; }

# ─── NitroModules & Fast Turbo Native Bindings ───────────────────────────────
-keep class com.margelo.nitro.** { *; }
-keep class com.margelo.nitro.image.** { *; }
-keep class com.mrousavy.camera.** { *; }
-dontwarn com.margelo.nitro.**
-dontwarn com.mrousavy.camera.**

# ─── React Native Reanimated ──────────────────────────────────────────────────
-keep class com.swmansion.reanimated.** { *; }
-dontwarn com.swmansion.reanimated.**

# ─── Sentry Error Monitoring ──────────────────────────────────────────────────
-keep class io.sentry.** { *; }
-dontwarn io.sentry.**

# ─── Notifee & Local Notifications ────────────────────────────────────────────
-keep class app.notifee.** { *; }
-dontwarn app.notifee.**

# ─── Razorpay Checkout ────────────────────────────────────────────────────────
-keep class com.razorpay.** { *; }
-dontwarn com.razorpay.**

# ─── Firebase & Play Services ──────────────────────────────────────────────────
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-keep class com.google.android.play.core.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**
-dontwarn com.google.android.play.core.**

# ─── OkHttp / Networking ──────────────────────────────────────────────────────
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# ─── Kotlin Reflection & Coroutines ───────────────────────────────────────────
-keep class kotlin.** { *; }
-keep class kotlin.Metadata { *; }
-dontwarn kotlin.**
-keepclassmembers class **$WhenMappings { <fields>; }
-keepclassmembers class kotlin.Lazy { *; }

# ─── Android Standard & Native Attributes ─────────────────────────────────────
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-keepattributes InnerClasses,EnclosingMethod
-keepattributes Signature
-keep public class * extends android.app.Activity
-keep public class * extends android.app.Service
-keep public class * extends android.content.BroadcastReceiver
-keep public class * extends android.content.ContentProvider
