package expo.modules.btlsensors

import android.location.Location
import android.os.Build
import org.json.JSONObject
import java.io.BufferedWriter
import java.io.File
import java.io.FileOutputStream
import java.io.OutputStreamWriter

/**
 * Writes raw samples, one JSON object per line, in the format that
 * `mobile/src/measure/recording.ts` reads. Nothing here is filtered or computed:
 * the algorithm lives in TypeScript, over this file, so that it can be tested
 * against a sequence of samples without a phone.
 *
 * Every line carries `t`, the time the SAMPLE was taken, and `rx`, the time it
 * was received here. Both are on the elapsedRealtime clock, which keeps counting
 * while the device sleeps. The algorithm reads `t`; `rx` is kept because Android
 * delivers fixes in batches and the gap between the two is the measure of that.
 *
 * Each line is flushed as it is written, so a process that is killed loses at
 * most the line it was writing, and the reader skips a line it cannot parse.
 */
class SampleWriter(file: File) {
  private val out = BufferedWriter(OutputStreamWriter(FileOutputStream(file, true), Charsets.UTF_8))

  fun meta(pressureSensor: Boolean, wallClockMs: Long, elapsedMs: Long) {
    write(
      JSONObject()
        .put("k", "meta")
        .put("v", 1)
        .put("pressure", pressureSensor)
        .put("wall", wallClockMs)
        .put("t", elapsedMs)
    )
  }

  fun location(location: Location, receivedMs: Long) {
    val line = JSONObject()
      .put("k", "loc")
      .put("t", location.elapsedRealtimeNanos / 1_000_000.0)
      .put("lat", location.latitude)
      .put("lon", location.longitude)
      .put("rx", receivedMs)
      .put("mock", isMock(location))
    if (location.hasAccuracy()) line.put("acc", location.accuracy.toDouble())
    if (location.hasAltitude()) line.put("alt", location.altitude)
    if (location.hasSpeed()) line.put("spd", location.speed.toDouble())
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && location.hasSpeedAccuracy()) {
      line.put("spdAcc", location.speedAccuracyMetersPerSecond.toDouble())
    }
    write(line)
  }

  fun pressure(sampleNanos: Long, hPa: Float, receivedMs: Long) {
    write(
      JSONObject()
        .put("k", "prs")
        .put("t", sampleNanos / 1_000_000.0)
        .put("hpa", hPa.toDouble())
        .put("rx", receivedMs)
    )
  }

  /**
   * The member's stop, written by the module and not by the service, which may be down:
   * the moment on the same elapsedRealtime clock as every `t`, never the wall clock.
   */
  fun end(elapsedMs: Long) {
    write(JSONObject().put("k", "end").put("t", elapsedMs).put("rx", elapsedMs))
  }

  fun close() {
    out.close()
  }

  @Synchronized
  private fun write(line: JSONObject) {
    out.write(line.toString())
    out.write("\n")
    out.flush()
  }

  @Suppress("DEPRECATION")
  private fun isMock(location: Location): Boolean =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) location.isMock else location.isFromMockProvider
}
