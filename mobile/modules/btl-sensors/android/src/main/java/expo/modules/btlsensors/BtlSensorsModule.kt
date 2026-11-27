package expo.modules.btlsensors

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.os.SystemClock
import android.provider.Settings
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The sensor layer of the BTL meter, as JavaScript sees it. The contract is typed
 * on the other side in `mobile/modules/btl-sensors/index.ts`.
 */
class BtlSensorsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.AppContextLost()

  private fun startService() {
    val intent = Intent(context, RecordingService::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(intent)
    } else {
      context.startService(intent)
    }
  }

  override fun definition() = ModuleDefinition {
    Name("BtlSensors")

    // A session is recording from the member's start to the member's stop, also
    // while Android has the service down and has not started it again yet.
    Function("isRecording") {
      ActiveSession(context).file != null
    }

    Function("elapsedRealtimeMs") {
      SystemClock.elapsedRealtime().toDouble()
    }

    Function("start") { notificationTitle: String, notificationText: String ->
      if (ActiveSession(context).file != null) return@Function Unit
      if (context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
        throw CodedException("ERR_NO_LOCATION_PERMISSION", "Fine location is not granted", null)
      }
      // The file is created here, before the service starts, so that a read that
      // follows this call reads the new session and never the previous one.
      val file = Sessions(context).createNew(System.currentTimeMillis())
      ActiveSession(context).begin(file.absolutePath, notificationTitle, notificationText)
      startService()
      Unit
    }

    // On opening the app: a session that is recording but whose service is down
    // (Android killed it and has not started it again) is started again here.
    Function("resume") {
      if (ActiveSession(context).file != null && !RecordingService.running) {
        try {
          startService()
        } catch (refused: IllegalStateException) {
          // Android 12 and later refuse a foreground service started from the
          // background; the next opening of the app tries again.
        }
      }
      Unit
    }

    Function("stop") {
      ActiveSession(context).end()
      context.stopService(Intent(context, RecordingService::class.java))
      Unit
    }

    Function("read") { offset: Double ->
      val (text, next) = Sessions(context).readFrom(offset.toLong())
      mapOf("text" to text, "next" to next.toDouble())
    }

    // „Aplikacija na prvom pokretanju traži izuzetak od štednje baterije" (PDL).
    Function("askBatteryExemptionOnce") {
      val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      if (power.isIgnoringBatteryOptimizations(context.packageName)) return@Function false
      if (!ActiveSession(context).firstAskForBatteryExemption()) return@Function false
      val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${context.packageName}"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      true
    }
  }
}
