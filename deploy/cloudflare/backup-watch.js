/* Cloudflare Worker that mails the superadmin when no new backup has reached R2 for 26 hours.
 *
 * The owner's decision (3) of 20.10.2026 (ADL O19): an alert goes both ways - deploy/backup.sh mails
 * through the relay when it fails, and this mails when no new copy exists for 26 hours. The second
 * half is the one that still works when the server itself is gone, which is the case a backup is
 * for: a host that is down sends nothing, and that silence is what this hears.
 *
 * 26 HOURS is the owner's number, and the same one deploy/backup/prove.sh refuses a copy older than
 * (BackupScriptTest compares the two). A copy arrives every night a little after 04:00 Belgrade
 * time, so 26 hours is one missed night and two hours of slack.
 *
 * WHAT IT READS is only the listing of daily/ in the bucket: the keys and the times R2 says they
 * were uploaded. It never reads a copy, and it could not open one: they are encrypted with a
 * passphrase that is not here.
 *
 * Wired up in the Cloudflare panel, by the owner, the same way as no-reply-reject.js beside it;
 * nothing in this repository deploys it:
 *   Workers > Create > paste this file.
 *   Settings > Bindings:
 *     R2 bucket            name BACKUPS, the backup bucket (EU jurisdiction)
 *     Send email           name MAIL, destination address: the superadmin's address
 *   Settings > Variables:
 *     ALERT_TO             the superadmin's address, the same one BTL_SUPERADMIN_EMAIL names on
 *                          the server. Send email can only reach an address verified under Email
 *                          Routing, so it has to be verified there first.
 *   Settings > Triggers > Cron: "0 * * * *", every hour.
 *
 * ONE MESSAGE WHEN THE LIMIT IS CROSSED AND ONE A DAY AFTER THAT, and no state is kept to do it: the
 * hour in which the newest copy turns 26 hours old mails, and so does the 07:00 UTC run every day
 * after that while it stays old. An hourly mail about the same silence would be a mail nobody reads
 * by the second day.
 */

import { EmailMessage } from 'cloudflare:email'

const LIMIT_HOURS = 26

const HOUR = 60 * 60 * 1000

/* The domain the portal already sends from, which Email Routing is set up on. */
const FROM = 'no-reply@balkanskatrkackaliga.net'

const REMINDER_HOUR_UTC = 7

async function newestUpload(bucket) {
  let newest = null
  let cursor
  do {
    const page = await bucket.list({ prefix: 'daily/', cursor })
    for (const object of page.objects) {
      if (newest === null || object.uploaded > newest.uploaded) {
        newest = object
      }
    }
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)
  return newest
}

function message(to, subject, text) {
  return [
    `From: BTL backup <${FROM}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@balkanskatrkackaliga.net>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    '',
    text,
    '',
  ].join('\r\n')
}

export default {
  async scheduled(event, env) {
    const now = event.scheduledTime
    const newest = await newestUpload(env.BACKUPS)
    const age = newest === null ? Infinity : now - newest.uploaded.getTime()

    if (age < LIMIT_HOURS * HOUR) {
      return
    }

    const justCrossed = age < (LIMIT_HOURS + 1) * HOUR
    const reminder = new Date(now).getUTCHours() === REMINDER_HOUR_UTC
    if (!justCrossed && !reminder) {
      return
    }

    const said = newest === null
      ? 'There is no copy under daily/ in the bucket at all.'
      : `The newest copy is ${newest.key}, uploaded ${newest.uploaded.toISOString()}, ` +
        `${Math.floor(age / HOUR)} hours ago.`
    const text = [
      `No new backup of the BTL portal has reached R2 for more than ${LIMIT_HOURS} hours.`,
      '',
      said,
      '',
      'Either the nightly copy failed and could not mail (look at the journal on the host:',
      'journalctl -u btl-backup.service), or the host is down.',
    ].join('\r\n')

    await env.MAIL.send(new EmailMessage(FROM, env.ALERT_TO,
      message(env.ALERT_TO, `BTL backup: no new copy for ${LIMIT_HOURS} hours`, text)))
  },
}
