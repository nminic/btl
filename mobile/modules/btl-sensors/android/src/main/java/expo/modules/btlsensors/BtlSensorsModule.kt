package expo.modules.btlsensors

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Looper
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

  /**
   * The GPS the screen listens to before a start, and only then: the screen asks
   * for it while it is seen and lets it go when it is not, so that it does not
   * drain the battery. It writes nothing and judges nothing; it keeps the latest
   * fix for `lastGpsFix`, and TypeScript decides whether that fix lets the member
   * start (`mobile/src/session/startGate.ts`), with the test the length algorithm
   * applies to every fix.
   */
  private var gpsListener: LocationListener? = null

  @Volatile
  private var lastFix: Location? = null

  private val locationManager: LocationManager
    get() = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager

  private fun hasFineLocation() =
    context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

  @SuppressLint("MissingPermission")
  private fun watchGps(): Boolean {
    if (!hasFineLocation()) return false
    if (gpsListener != null) return true
    val listener = object : LocationListener {
      override fun onLocationChanged(location: Location) {
        lastFix = location
      }

      // Abstract before API 30, so they are overridden for the older phones.
      override fun onProviderEnabled(provider: String) = Unit

      override fun onProviderDisabled(provider: String) = Unit

      @Deprecated("Deprecated in API 29")
      override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit
    }
    try {
      // The interval of the recording service, on the main looper: a fix a second is all the screen reads.
      locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, listener, Looper.getMainLooper())
    } catch (refused: SecurityException) {
      return false
    }
    gpsListener = listener
    return true
  }

  private fun unwatchGps() {
    gpsListener?.let { locationManager.removeUpdates(it) }
    gpsListener = null
  }

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
    Function("watchGps") {
      watchGps()
    }

    Function("unwatchGps") {
      unwatchGps()
      Unit
    }

    // The fix on the clock of the samples (`elapsedRealtimeNanos`, as SampleWriter writes `t`), and its accuracy
    // only when it has one, so that a fix without one is poor here as it is in the session file.
    Function("lastGpsFix") {
      val fix = lastFix ?: return@Function null
      val answer = mutableMapOf<String, Any>("t" to fix.elapsedRealtimeNanos / 1_000_000.0)
      if (fix.hasAccuracy()) answer["acc"] = fix.accuracy.toDouble()
      answer
    }

    // The screen is gone with the module: nothing keeps listening after it.
    OnDestroy {
      unwatchGps()
    }

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
