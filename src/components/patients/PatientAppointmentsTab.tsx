/**
 * PatientAppointmentsTab — Clinic Clarity, zero HeroUI
 * Custom flat table, filter chips, inline status dropdown.
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  IoCalendarOutline,
  IoAddOutline,
  IoEyeOutline,
  IoRefreshOutline,
} from "react-icons/io5";

import { useAuth } from "@/hooks/useAuth";
import { appointmentService } from "@/services/appointmentService";
import { doctorService } from "@/services/doctorService";
import { appointmentTypeService } from "@/services/appointmentTypeService";
import { Appointment, Doctor, AppointmentType } from "@/types/models";
import { addToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@/components/ui/dropdown";

interface PatientAppointmentsTabProps {
  patientId: string;
}

// ── Status helpers ────────────────────────────────────────────────────────────
const STATUS_STYLE: Record<string, string> = {
  scheduled: "bg-primary/10 text-primary border-primary/20",
  confirmed:
    "bg-health-500/10 text-health-600 dark:text-health-400 border-health-500/20",
  "in-progress":
    "bg-saffron-500/10 text-saffron-600 dark:text-saffron-400 border-saffron-500/20",
  completed: "bg-surface-2 text-text-muted border-border-base",
  cancelled: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  "no-show": "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
};

const ALL_STATUSES = [
  { id: "scheduled", name: "Scheduled" },
  { id: "confirmed", name: "Confirmed" },
  { id: "in-progress", name: "In Progress" },
  { id: "completed", name: "Completed" },
  { id: "cancelled", name: "Cancelled" },
  { id: "no-show", name: "No Show" },
] as const;

type StatusKey = (typeof ALL_STATUSES)[number]["id"];

function StatusBadge({ status }: { status: string }) {
  const cls =
    STATUS_STYLE[status.toLowerCase()] ||
    "bg-mountain-100 text-mountain-600 border-mountain-200";

  return (
    <span
      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border capitalize ${cls}`}
    >
      {status}
    </span>
  );
}

// Inline status change dropdown
function StatusDropdown({
  appointmentId,
  current,
  onChanged,
}: {
  appointmentId: string;
  current: string;
  onChanged: (id: string, s: StatusKey) => void;
}) {
  const options = ALL_STATUSES.filter((s) => s.id !== current.toLowerCase());

  return (
    <Dropdown placement="bottom-start">
      <DropdownTrigger>
        <button
          className="inline-flex items-center gap-1 text-[10.5px] px-1.5 py-0.5 rounded border border-primary/20 text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
          type="button"
        >
          <IoRefreshOutline className="w-3 h-3" /> Change
        </button>
      </DropdownTrigger>
      <DropdownMenu>
        {options.map((s) => (
          <DropdownItem
            key={s.id}
            startContent={
              <span
                className={`w-2 h-2 rounded-full ${STATUS_STYLE[s.id]?.split(" ")[0] || "bg-mountain-300"}`}
              />
            }
            onClick={() => onChanged(appointmentId, s.id)}
          >
            {s.name}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PatientAppointmentsTab({
  patientId,
}: PatientAppointmentsTabProps) {
  const { clinicId } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    "all" | "scheduled" | "completed" | "cancelled"
  >("all");
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId || !clinicId) return;
    setLoading(true);
    Promise.all([
      appointmentService.getAppointmentsByClinic(clinicId),
      doctorService.getDoctorsByClinic(clinicId),
      appointmentTypeService.getAppointmentTypesByClinic(clinicId),
    ])
      .then(([all, docs, types]) => {
        const mine = all
          .filter((a) => a.patientId === patientId)
          .sort(
            (a, b) =>
              new Date(b.appointmentDate).getTime() -
              new Date(a.appointmentDate).getTime(),
          );

        setAppointments(mine);
        setDoctors(docs);
        setAppointmentTypes(types);
      })
      .catch((err) => {
        console.error(err);
        addToast({
          title: "Error",
          description: "Failed to load appointments.",
          color: "danger",
        });
      })
      .finally(() => setLoading(false));
  }, [patientId, clinicId]);

  const getDoctorName = (id: string) => {
    const d = doctors.find((x) => x.id === id);

    return d ? `Dr. ${d.name}` : "Unknown";
  };
  const getTypeName = (id: string) => {
    const t = appointmentTypes.find((x) => x.id === id);

    return t?.name || "General";
  };

  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  const fmtTime = (t: string) => {
    try {
      return new Date(`1970-01-01T${t}`).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return t;
    }
  };

  const handleStatusChange = async (
    appointmentId: string,
    newStatus: StatusKey,
  ) => {
    setUpdatingStatus(appointmentId);
    try {
      await appointmentService.updateAppointmentStatus(
        appointmentId,
        newStatus,
      );
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === appointmentId ? { ...a, status: newStatus } : a,
        ),
      );
      addToast({ title: "Status updated", color: "success" });
    } catch {
      addToast({
        title: "Error",
        description: "Failed to update status.",
        color: "danger",
      });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const filtered = appointments.filter(
    (a) => filter === "all" || a.status === filter,
  );

  const stats = {
    total: appointments.length,
    scheduled: appointments.filter((a) => a.status === "scheduled").length,
    completed: appointments.filter((a) => a.status === "completed").length,
    cancelled: appointments.filter((a) => a.status === "cancelled").length,
  };

  const FILTERS = [
    { key: "all", label: `All (${stats.total})` },
    { key: "scheduled", label: `Scheduled (${stats.scheduled})` },
    { key: "completed", label: `Completed (${stats.completed})` },
    { key: "cancelled", label: `Cancelled (${stats.cancelled})` },
  ] as const;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner label="Loading appointments…" size="lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-section-title text-text-main">Appointments</h2>
          <p className="text-[12.5px] text-text-muted">
            Appointment history and schedule
          </p>
        </div>
        <Link
          className="no-underline"
          to={`/dashboard/appointments/new?patientId=${patientId}`}
        >
          <Button
            color="primary"
            size="sm"
            startContent={<IoCalendarOutline className="w-3.5 h-3.5" />}
          >
            New Appointment
          </Button>
        </Link>
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`text-[11.5px] font-medium px-3 py-1 rounded border transition-colors
              ${
                filter === f.key
                  ? "bg-primary text-white border-primary"
                  : "bg-surface text-text-muted border-border-base hover:border-primary hover:text-primary"
              }`}
            type="button"
            onClick={() => setFilter(f.key as any)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Table / empty */}
      {filtered.length === 0 ? (
        <div className="bg-surface border border-border-base rounded py-12 text-center">
          <IoCalendarOutline className="mx-auto w-10 h-10 text-text-muted/30 mb-3" />
          <p className="text-[13px] font-medium text-text-main mb-1">
            No appointments found
          </p>
          <p className="text-[12px] text-text-muted mb-4">
            {filter === "all"
              ? "No appointments scheduled yet."
              : `No ${filter} appointments.`}
          </p>
          <Link
            className="no-underline"
            to={`/dashboard/appointments/new?patientId=${patientId}`}
          >
            <Button
              color="primary"
              size="sm"
              startContent={<IoAddOutline className="w-3.5 h-3.5" />}
            >
              Schedule Appointment
            </Button>
          </Link>
        </div>
      ) : (
        <div className="bg-surface border border-border-base rounded overflow-visible">
          <div className="overflow-visible">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-2 border-b border-border-base/50">
                  {[
                    "Date & Time",
                    "Type",
                    "Doctor",
                    "Status",
                    "Reason",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="py-2 px-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.06em] text-text-muted/60 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border-base/50">
                {filtered.map((a) => (
                  <tr
                    key={a.id}
                    className="hover:bg-surface-2 transition-colors"
                  >
                    <td className="py-2.5 px-3">
                      <p className="text-[12.5px] font-medium text-text-main">
                        {fmtDate(a.appointmentDate)}
                      </p>
                      {(a.startTime || a.endTime) && (
                        <p className="text-[11px] text-text-muted">
                          {a.startTime && fmtTime(a.startTime)}
                          {a.startTime && a.endTime && " – "}
                          {a.endTime && fmtTime(a.endTime)}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-[12.5px] text-text-main/80">
                      {getTypeName(a.appointmentTypeId)}
                    </td>
                    <td className="py-2.5 px-3 text-[12.5px] text-text-muted">
                      {getDoctorName(a.doctorId)}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {updatingStatus === a.id ? (
                          <Spinner size="xs" />
                        ) : (
                          <StatusDropdown
                            appointmentId={a.id}
                            current={a.status}
                            onChanged={handleStatusChange}
                          />
                        )}
                        <StatusBadge status={a.status} />
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-[12px] text-mountain-500 max-w-[140px] truncate">
                      {a.reason || "—"}
                    </td>
                    <td className="py-2.5 px-3">
                      <Link
                        className="no-underline"
                        to={`/dashboard/appointments/${a.id}`}
                      >
                        <Button
                          color="default"
                          size="sm"
                          startContent={
                            <IoEyeOutline className="w-3.5 h-3.5" />
                          }
                          variant="bordered"
                        >
                          View
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
