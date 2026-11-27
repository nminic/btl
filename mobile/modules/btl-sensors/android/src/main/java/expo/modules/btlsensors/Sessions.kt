package expo.modules.btlsensors

import android.content.Context
import android.provider.Settings
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
 * True when the phone was restarted since [storedBoot] was read. Both are
 * `Settings.Global.BOOT_COUNT`, a count of boots that only a restart raises. A
 * count that is unknown on either side (a session begun before the count was
 * kept, a phone that does not report it) is no proof of a restart, so the session
 * goes on: the killed service of the SAME boot must not be ended by a guess.
 */
fun restartedSince(storedBoot: Int?, currentBoot: Int?): Boolean =
  storedBoot != null && currentBoot != null && storedBoot != currentBoot

/**
 * The session being recorded, kept outside the process. When Android kills the
 * process, the service is started again with no intent, and this is how it knows
 * which file to go on writing: „Kad Android ubije servis za merenje, servis se sam
 * podiže i nastavlja ISTO merenje" (PDL). The member's stop ends it, and so does
 * a restart of the phone: „Kad se telefon usred merenja restartuje, merenje se
 * završava" (PDL), with what was measured up to then kept as a finished session.
 *
 * A restart is checked HERE, in [file], and nowhere else, so that every door a
 * session is continued through (the module's `isRecording`, `start` and `resume`,
 * and the service's own restart) gets the same answer. After a restart the
 * elapsedRealtime clock of the samples begins again from zero, and a session
 * written on past it would be measured as one with its clock gone backwards.
 */
class ActiveSession(context: Context) {
  private val prefs = context.getSharedPreferences("btl-sensors", Context.MODE_PRIVATE)
  private val resolver = context.contentResolver

  /** The file of the session still recording; a session the phone restarted in the middle of is ended here and gives null. */
  val file: String?
    get() {
      val stored = prefs.getString(KEY_FILE, null) ?: return null
      val begunAt = if (prefs.contains(KEY_BOOT)) prefs.getInt(KEY_BOOT, 0) else null
      if (restartedSince(begunAt, currentBoot())) {
        end()
        return null
      }
      return stored
    }
  val notificationTitle: String
    get() = prefs.getString(KEY_TITLE, null).orEmpty()
  val notificationText: String
    get() = prefs.getString(KEY_TEXT, null).orEmpty()

  fun begin(file: String, notificationTitle: String, notificationText: String) {
    val editor = prefs.edit().putString(KEY_FILE, file).putString(KEY_TITLE, notificationTitle).putString(KEY_TEXT, notificationText)
    val boot = currentBoot()
    if (boot != null) editor.putInt(KEY_BOOT, boot) else editor.remove(KEY_BOOT)
    editor.commit()
  }

  fun end() {
    prefs.edit().remove(KEY_FILE).remove(KEY_TITLE).remove(KEY_TEXT).remove(KEY_BOOT).commit()
  }

  /** True only the first time: the app asks for the battery exemption once, on its first start. */
  fun firstAskForBatteryExemption(): Boolean {
    if (prefs.getBoolean(KEY_BATTERY_ASKED, false)) return false
    prefs.edit().putBoolean(KEY_BATTERY_ASKED, true).commit()
    return true
  }

  /** The boot count from the system, never from [prefs]: that is the one that changes with a restart. */
  private fun currentBoot(): Int? {
    val boot = Settings.Global.getInt(resolver, Settings.Global.BOOT_COUNT, -1)
    return if (boot < 0) null else boot
  }

  private companion object {
    const val KEY_FILE = "activeFile"
    const val KEY_TITLE = "notificationTitle"
    const val KEY_TEXT = "notificationText"
    const val KEY_BOOT = "bootCount"
    const val KEY_BATTERY_ASKED = "batteryExemptionAsked"
  }
}
