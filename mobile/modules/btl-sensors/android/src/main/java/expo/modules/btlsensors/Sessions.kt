package expo.modules.btlsensors

import android.content.Context
import java.io.File
import java.io.RandomAccessFile

/**
 * The recordings on the phone. One file per session, named by the wall clock at
 * its start, in the app's private storage. Nothing is sent anywhere: outside the
 * BTL dezorijentiring the app is a personal meter (PDL, „Van BTL dezorijentiringa
 * aplikacija je lično merilo").
 */
class Sessions(context: Context) {
  private val dir = File(context.filesDir, "sessions").apply { mkdirs() }

  fun createNew(wallClockMs: Long): File = File(dir, "$wallClockMs.jsonl").apply { createNewFile() }

  fun latest(): File? = dir.listFiles { f -> f.name.endsWith(".jsonl") }?.maxByOrNull { it.name.removeSuffix(".jsonl").toLongOrNull() ?: 0L }

  /**
   * The bytes of the latest session from [offset], up to and including its last
   * complete line. A line the service is writing at this moment stays for the
   * next read, so the reader never sees half of it.
   */
  fun readFrom(offset: Long): Pair<String, Long> {
    val file = latest() ?: return Pair("", 0L)
    RandomAccessFile(file, "r").use { raf ->
      val length = raf.length()
      if (offset >= length) return Pair("", offset)
      val bytes = ByteArray((length - offset).toInt())
      raf.seek(offset)
      raf.readFully(bytes)
      val lastNewline = bytes.lastIndexOf('\n'.code.toByte())
      if (lastNewline < 0) return Pair("", offset)
      return Pair(String(bytes, 0, lastNewline + 1, Charsets.UTF_8), offset + lastNewline + 1)
    }
  }
}

/**
 * The session being recorded, kept outside the process. When Android kills the
 * process, the service is started again with no intent, and this is how it knows
 * which file to go on writing: „Kad Android ubije servis za merenje, servis se sam
 * podiže i nastavlja ISTO merenje" (PDL). Only the member's stop ends it.
 */
class ActiveSession(context: Context) {
  private val prefs = context.getSharedPreferences("btl-sensors", Context.MODE_PRIVATE)

  val file: String?
    get() = prefs.getString(KEY_FILE, null)
  val notificationTitle: String
    get() = prefs.getString(KEY_TITLE, null).orEmpty()
  val notificationText: String
    get() = prefs.getString(KEY_TEXT, null).orEmpty()

  fun begin(file: String, notificationTitle: String, notificationText: String) {
    prefs.edit().putString(KEY_FILE, file).putString(KEY_TITLE, notificationTitle).putString(KEY_TEXT, notificationText).commit()
  }

  fun end() {
    prefs.edit().remove(KEY_FILE).remove(KEY_TITLE).remove(KEY_TEXT).commit()
  }

  /** True only the first time: the app asks for the battery exemption once, on its first start. */
  fun firstAskForBatteryExemption(): Boolean {
    if (prefs.getBoolean(KEY_BATTERY_ASKED, false)) return false
    prefs.edit().putBoolean(KEY_BATTERY_ASKED, true).commit()
    return true
  }

  private companion object {
    const val KEY_FILE = "activeFile"
    const val KEY_TITLE = "notificationTitle"
    const val KEY_TEXT = "notificationText"
    const val KEY_BATTERY_ASKED = "batteryExemptionAsked"
  }
}
