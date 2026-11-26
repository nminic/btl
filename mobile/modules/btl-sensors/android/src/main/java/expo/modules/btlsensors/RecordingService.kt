package expo.modules.btlsensors

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.PowerManager
import android.os.SystemClock
import java.io.File

/**
 * Records raw GPS fixes and air pressure to the session file while the app is in
 * the background and the screen is off. JavaScript can be paused by Android at
 * any time; this service is what keeps measuring, and the file it writes is the
 * only source the algorithm reads.
 */
class RecordingService : Service(), LocationListener, SensorEventListener {
  companion object {
    const val EXTRA_FILE = "file"
    const val EXTRA_TITLE = "title"
    const val EXTRA_TEXT = "text"
    private const val CHANNEL_ID = "btl-recording"
    private const val NOTIFICATION_ID = 1

    /** GPS at one fix per second, with no minimum distance: the filtering is the algorithm's job. */
    private const val LOCATION_INTERVAL_MS = 1000L

    /** A hint to the sensor; the algorithm averages pressure into one-second buckets. */
    private const val PRESSURE_PERIOD_US = 200_000

    @Volatile
    var running = false
      private set
  }

  private var thread: HandlerThread? = null
  private var writer: SampleWriter? = null
  private var wakeLock: PowerManager.WakeLock? = null

  override fun onBind(intent: Intent?): IBinder? = null

  @SuppressLint("MissingPermission")
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val path = intent?.getStringExtra(EXTRA_FILE)
    if (running || path == null) return START_NOT_STICKY

    startInForeground(intent.getStringExtra(EXTRA_TITLE) ?: "", intent.getStringExtra(EXTRA_TEXT) ?: "")
    running = true

    val sensorManager = getSystemService(SENSOR_SERVICE) as SensorManager
    val pressure = sensorManager.getDefaultSensor(Sensor.TYPE_PRESSURE)
    writer = SampleWriter(File(path)).also {
      it.meta(pressure != null, System.currentTimeMillis(), SystemClock.elapsedRealtime())
    }

    val handlerThread = HandlerThread("btl-sensors").also { it.start() }
    thread = handlerThread
    val looper = handlerThread.looper

    // The module checks ACCESS_FINE_LOCATION before it starts this service.
    val locationManager = getSystemService(LOCATION_SERVICE) as LocationManager
    locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, LOCATION_INTERVAL_MS, 0f, this, looper)
    if (pressure != null) {
      sensorManager.registerListener(this, pressure, PRESSURE_PERIOD_US, Handler(looper))
    }

    wakeLock = (getSystemService(POWER_SERVICE) as PowerManager)
      .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "btl:recording")
      .also { it.acquire() }

    return START_NOT_STICKY
  }

  override fun onDestroy() {
    (getSystemService(LOCATION_SERVICE) as LocationManager).removeUpdates(this)
    (getSystemService(SENSOR_SERVICE) as SensorManager).unregisterListener(this)
    thread?.quitSafely()
    thread = null
    writer?.close()
    writer = null
    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
    running = false
    super.onDestroy()
  }

  override fun onLocationChanged(location: Location) {
    writer?.location(location, SystemClock.elapsedRealtime())
  }

  override fun onSensorChanged(event: SensorEvent) {
    writer?.pressure(event.timestamp, event.values[0], SystemClock.elapsedRealtime())
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

  // Abstract before API 30, so they are overridden for the older phones.
  override fun onProviderEnabled(provider: String) = Unit

  override fun onProviderDisabled(provider: String) = Unit

  @Deprecated("Deprecated in API 29")
  override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit

  private fun startInForeground(title: String, text: String) {
    val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, title, NotificationManager.IMPORTANCE_LOW))
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val open = launch?.let { PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE) }
    val notification = builder
      .setContentTitle(title)
      .setContentText(text)
      .setSmallIcon(applicationInfo.icon)
      .setOngoing(true)
      .setContentIntent(open)
      .build()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }
}
