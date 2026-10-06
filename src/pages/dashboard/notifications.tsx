import {
  IoNotificationsOutline,
  IoCheckmarkDoneOutline,
  IoCheckmarkOutline,
} from "react-icons/io5";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";

import { Card, CardBody } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { db } from "@/config/firebase";
import { useAuthContext } from "@/context/AuthContext";
import { doctorService } from "@/services/doctorService";
import { expertService } from "@/services/expertService";
import { NotificationService } from "@/services/notificationService";
import { isNotificationForViewer } from "@/services/core/notificationTargetingCore";

interface NotificationRow {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  targetRole?: string | null;
}

/**
 * A full-page home for notifications — previously the only place to see
 * them at all was the header bell's dropdown, capped at 300px with no way
 * to browse history, and no page a "notification" could meaningfully be
 * said to live on. Same data, same targeting rule as the bell (see
 * notificationTargetingCore), just not boxed into a popover.
 *
 * What this intentionally does NOT add: clicking through to the
 * appointment/invoice/patient a notification is about. ClinicNotification
 * carries only a title, message and who it's for — no reference to the
 * record it was raised from — so there is nothing to link to yet. Adding
 * that means touching every sendNotification call site to attach one;
 * out of scope here.
 */
export default function NotificationsPage() {
  const { clinicId, currentUser, userData } = useAuthContext();
  const [currentDoctorId, setCurrentDoctorId] = useState<string | null>(null);
  const [currentExpertId, setCurrentExpertId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    if (!clinicId || !currentUser?.email) return;

    doctorService.getDoctorsByClinic(clinicId).then((docs) => {
      const match = docs.find(
        (d) => d.email?.toLowerCase() === currentUser.email?.toLowerCase(),
      );

      if (match) setCurrentDoctorId(match.id);
    });

    expertService.getExpertsByClinic(clinicId).then((exps) => {
      const match = exps.find(
        (e) => e.email?.toLowerCase() === currentUser.email?.toLowerCase(),
      );

      if (match) setCurrentExpertId(match.id);
    });
  }, [clinicId, currentUser?.email]);

  useEffect(() => {
    if (!clinicId) return;

    setLoading(true);
    const q = query(
      collection(db, "notifications"),
      where("clinicId", "==", clinicId),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const rows: NotificationRow[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();

          if (
            !isNotificationForViewer(data, {
              userId: currentUser?.uid,
              role: userData?.role,
              doctorId: currentDoctorId,
              expertId: currentExpertId,
            })
          ) {
            return;
          }

          rows.push({
            id: docSnap.id,
            title: data.title,
            message: data.message,
            read: Boolean(data.read),
            createdAt: data.createdAt?.toDate?.() || new Date(),
            targetRole: data.targetRole,
          });
        });

        rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        setNotifications(rows);
        setLoading(false);
      },
      (err) => {
        console.error("Notifications page subscription error:", err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [clinicId, currentUser?.uid, userData?.role, currentDoctorId, currentExpertId]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const visible =
    filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  const formatWhen = (date: Date) =>
    date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <IoNotificationsOutline className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-text-main">Notifications</h1>
          {unreadCount > 0 && (
            <Chip color="danger" size="sm" variant="flat">
              {unreadCount} unread
            </Chip>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border-base overflow-hidden">
            <button
              className={`px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                filter === "all"
                  ? "bg-primary text-white"
                  : "text-text-muted hover:bg-surface-2"
              }`}
              type="button"
              onClick={() => setFilter("all")}
            >
              All
            </button>
            <button
              className={`px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                filter === "unread"
                  ? "bg-primary text-white"
                  : "text-text-muted hover:bg-surface-2"
              }`}
              type="button"
              onClick={() => setFilter("unread")}
            >
              Unread
            </button>
          </div>

          {unreadCount > 0 && (
            <Button
              size="sm"
              startContent={<IoCheckmarkDoneOutline className="w-4 h-4" />}
              variant="flat"
              onClick={() => {
                if (!clinicId) return;
                NotificationService.markAllAsRead(clinicId, {
                  userId: currentUser?.uid,
                  role: userData?.role,
                  doctorId: currentDoctorId ?? undefined,
                  expertId: currentExpertId ?? undefined,
                });
              }}
            >
              Mark all read
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner size="sm" />
            </div>
          ) : visible.length === 0 ? (
            <div className="py-16 text-center text-text-muted">
              <IoNotificationsOutline className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-[13px]">
                {filter === "unread"
                  ? "Nothing unread."
                  : "No notifications yet."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border-base">
              {visible.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 flex items-start gap-3 transition-colors ${
                    !notif.read ? "bg-primary/5" : ""
                  }`}
                >
                  <div
                    className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                      notif.read ? "bg-transparent" : "bg-primary"
                    }`}
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={`text-[13.5px] font-semibold ${
                          !notif.read ? "text-primary" : "text-text-main"
                        }`}
                      >
                        {notif.title}
                      </span>
                      <span className="text-[11px] text-text-muted whitespace-nowrap shrink-0">
                        {formatWhen(notif.createdAt)}
                      </span>
                    </div>
                    <p className="text-[12.5px] text-text-muted leading-snug">
                      {notif.message}
                    </p>
                  </div>
                  {!notif.read && (
                    <button
                      className="shrink-0 p-1.5 rounded-full text-text-muted hover:text-primary hover:bg-surface-2 transition-colors"
                      title="Mark as read"
                      type="button"
                      onClick={() => NotificationService.markAsRead(notif.id)}
                    >
                      <IoCheckmarkOutline className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
