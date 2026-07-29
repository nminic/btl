import { useState } from "react";
import {
  formatDuration,
  formatNumber,
  formatPoints,
  formatShortDate,
} from "../../i18n/format";
import { useI18n } from "../../i18n/useI18n";
import { isStaff } from "../../roles/context";
import { useRole } from "../../roles/useRole";
import { useSession } from "../../session/useSession";
import { StaffOnly } from "./StaffOnly";
import "../member/Member.css";

/* The queue of results waiting to be checked.
 *
 * Nothing here is in a table yet: a result enters the standings only once it is
 * approved, and until then it does not exist for anybody but its author
 * (PDL P9). Sending one back always carries a reason, because a member who is
 * refused without one will simply send the same thing again.
 */
export function ReviewQueue() {
  const { locale, t } = useI18n();
  const { role } = useRole();
  const { submissions, decide } = useSession();
  const [notes, setNotes] = useState<Record<string, string>>({});

  if (!isStaff(role)) {
    return <StaffOnly />;
  }

  const waiting = submissions.filter((one) => one.status === "pending");
  const decided = submissions.filter((one) => one.status !== "pending");

  return (
    <div className="member">
      <h1>{t("review.title")}</h1>
      <p className="member__note">{t("review.note")}</p>

      <h2 className="profile__section">
        {t("review.waiting")}{" "}
        <span className="profile__count">{waiting.length}</span>
      </h2>

      {waiting.length === 0 ? (
        <p className="profile__empty">{t("review.empty")}</p>
      ) : (
        <ul className="submissions">
          {waiting.map((one) => {
            const note = notes[one.id] ?? "";

            return (
              <li key={one.id} className="submissions__item">
                <div className="submissions__head">
                  <strong>{one.eventName}</strong>
                  <span className="table__member-number">
                    {one.memberNumber}
                  </span>
                </div>
                <p className="submissions__meta">
                  {formatShortDate(one.date, locale)}
                  {" · "}
                  {formatNumber(one.distanceKm, locale, 2)} km
                  {" · "}
                  {formatNumber(one.ascentM, locale)} m{" · "}
                  {formatDuration(one.seconds)}
                  {" · "}
                  {formatPoints(one.points, locale)} BTL points
                </p>
                <p className="submissions__meta">
                  <a href={one.link} rel="noreferrer noopener" target="_blank">
                    {t("review.officialResults")}
                  </a>
                </p>

                <label className="rankings__field rankings__field--wide">
                  <span>{t("review.reason")}</span>
                  <input
                    type="text"
                    value={note}
                    placeholder={t("review.reasonPlaceholder")}
                    onChange={(event) =>
                      setNotes((current) => ({
                        ...current,
                        [one.id]: event.target.value,
                      }))
                    }
                  />
                </label>

                <div className="member__links">
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={() => decide(one.id, "approved", "")}
                  >
                    {t("review.approve")}
                  </button>
                  <button
                    type="button"
                    className="button button--secondary"
                    disabled={note === ""}
                    onClick={() => decide(one.id, "rejected", note)}
                  >
                    {t("review.sendBack")}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {decided.length > 0 && (
        <>
          <h2 className="profile__section">{t("review.decided")}</h2>
          <ul className="submissions">
            {decided.map((one) => (
              <li
                key={one.id}
                className={`submissions__item submissions__item--${one.status}`}
              >
                <div className="submissions__head">
                  <strong>{one.eventName}</strong>
                  <span className={`tag tag--${one.status}`}>
                    {t(`status.${one.status}`)}
                  </span>
                </div>
                <p className="submissions__meta">{one.memberNumber}</p>
                {one.note !== "" && (
                  <p className="submissions__note">{one.note}</p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
