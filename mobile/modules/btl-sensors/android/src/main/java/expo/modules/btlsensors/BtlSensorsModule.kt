package expo.modules.btlsensors

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.SystemClock
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

  override fun definition() = ModuleDefinition {
    Name("BtlSensors")

    Function("isRecording") {
      RecordingService.running
    }

    Function("elapsedRealtimeMs") {
      SystemClock.elapsedRealtime().toDouble()
    }

    Function("start") { notificationTitle: String, notificationText: String ->
      if (RecordingService.running) return@Function
      if (context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
        throw CodedException("ERR_NO_LOCATION_PERMISSION", "Fine location is not granted", null)
      }
      // The file is created here, before the service starts, so that a read that
      // follows this call reads the new session and never the previous one.
      val file = Sessions(context).createNew(System.currentTimeMillis())
      val intent = Intent(context, RecordingService::class.java)
        .putExtra(RecordingService.EXTRA_FILE, file.absolutePath)
        .putExtra(RecordingService.EXTRA_TITLE, notificationTitle)
        .putExtra(RecordingService.EXTRA_TEXT, notificationText)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    Function("stop") {
      context.stopService(Intent(context, RecordingService::class.java))
    }

    Function("read") { offset: Double ->
      val (text, next) = Sessions(context).readFrom(offset.toLong())
      mapOf("text" to text, "next" to next.toDouble())
    }
  }
}
