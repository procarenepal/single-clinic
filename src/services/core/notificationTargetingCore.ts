/**
 * The one rule for "is this notification mine?" — shared by the bell
 * dropdown's live subscription (what shows as unread) and
 * NotificationService.markAllAsRead (what gets cleared).
 *
 * Those two used to be independent reimplementations of the same rule,
 * which is the exact failure mode this codebase has hit before: two copies
 * of one rule drift the moment either one is edited without the other.
 * Here specifically, the subscription treats targetUserId and targetRole
 * as an either/or precedence (an exact-user match is checked FIRST and, if
 * the notification carries one, a role match is never even considered),
 * while the old markAllAsRead checked all four conditions independently
 * with OR. The two only agreed by coincidence on every notification shape
 * this clinic happened to have generated so far — the next shape either
 * side didn't anticipate would have let "Mark all read" silently clear
 * (or silently skip) something the badge disagreed with.
 */

export interface NotificationViewer {
  userId?: string | null;
  role?: string | null;
  /** This viewer's own doctors-collection id, when their login matches one. */
  doctorId?: string | null;
  /** This viewer's own experts-collection id, when their login matches one. */
  expertId?: string | null;
}

export interface TargetableNotification {
  targetUserId?: string | null;
  targetRole?: string | null;
}

/**
 * - A notification with a specific targetUserId belongs to whichever
 *   account that id names — checked against the viewer's Auth uid, their
 *   matched doctor id, and their matched expert id, since a notification
 *   may target any one of those three id spaces depending on who sent it.
 *   A role is NOT consulted when targetUserId is set, even if the
 *   notification also carries one — an exact-person notification is that
 *   person's regardless of anyone else who happens to share their role.
 * - Otherwise, a targetRole-only notification belongs to every viewer
 *   whose role matches it.
 * - Otherwise (neither set — a general broadcast) it belongs to everyone
 *   EXCEPT clinical staff (doctor/expert logins), who get a narrower feed
 *   of only what's specifically routed to them.
 */
export function isNotificationForViewer(
  notification: TargetableNotification,
  viewer: NotificationViewer,
): boolean {
  if (notification.targetUserId) {
    return (
      notification.targetUserId === viewer.userId ||
      notification.targetUserId === viewer.doctorId ||
      notification.targetUserId === viewer.expertId
    );
  }

  if (notification.targetRole) {
    return notification.targetRole === viewer.role;
  }

  const isClinicalStaff =
    Boolean(viewer.doctorId) ||
    Boolean(viewer.expertId) ||
    viewer.role === "doctor" ||
    viewer.role === "expert";

  return !isClinicalStaff;
}
