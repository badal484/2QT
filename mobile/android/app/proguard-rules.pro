# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-rules.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ─── React Native ──────────────────────────────────────────────────────────────
# Keep React Native core classes
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.react.**
-dontwarn com.facebook.hermes.**

# ─── 2QT Native Modules ────────────────────────────────────────────────────────
# These classes are referenced by name from the JavaScript bridge.
# R8 must NOT rename or remove them.
-keep class com.veltomobile.LocationForegroundService { *; }
-keep class com.veltomobile.LocationServiceModule { *; }
-keep class com.veltomobile.LocationServicePackage { *; }
-keep class com.veltomobile.RoleModule { *; }
-keep class com.veltomobile.RolePackage { *; }
-keep class com.veltomobile.MainActivity { *; }
-keep class com.veltomobile.MainApplication { *; }

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

# ─── Kotlin ───────────────────────────────────────────────────────────────────
-keep class kotlin.** { *; }
-keep class kotlin.Metadata { *; }
-dontwarn kotlin.**
-keepclassmembers class **$WhenMappings { <fields>; }
-keepclassmembers class kotlin.Lazy { *; }

# ─── Android Standard ─────────────────────────────────────────────────────────
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
-keep public class * extends android.app.Activity
-keep public class * extends android.app.Service
-keep public class * extends android.content.BroadcastReceiver
-keep public class * extends android.content.ContentProvider

# ─── Hermes JS Engine ─────────────────────────────────────────────────────────
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }
