import React, { useMemo, useState, useEffect } from "react";
import { 
  IoTimeOutline, 
  IoCalendarOutline, 
  IoPersonAddOutline, 
  IoChatbubbleEllipsesOutline,
  IoFilterOutline,
  IoRefreshOutline,
  IoArrowBackOutline
} from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow, format } from "date-fns";

// Services
import { appointmentService } from "@/services/appointmentService";
import { patientService } from "@/services/patientService";
import { enquiryService } from "@/services/enquiryService";
import { doctorService } from "@/services/doctorService";

// Context
import { useAuthContext } from "@/context/AuthContext";

// UI Components
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { title } from "@/components/primitives";

interface Activity {
  id: string;
  type: "appointment" | "patient" | "enquiry";
  title: string;
  description: string;
  timestamp: Date;
  color: string;
  icon: React.ReactNode;
}

export default function ActivityLogPage() {
  const navigate = useNavigate();
  const { clinicId } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<Activity[]>([]);

  const fetchActivity = async () => {
    if (!clinicId) return;
    setLoading(true);
    try {
      const [appts, pts, enqs, doctorsList] = await Promise.all([
        appointmentService.getAppointmentsByClinic(clinicId),
        patientService.getPatientsByClinic(clinicId),
        enquiryService.getEnquiries(clinicId, undefined, { dateField: "createdAt" }),
        doctorService.getDoctorsByClinic(clinicId)
      ]);

      const combined: Activity[] = [
        ...appts.map(a => {
          const patient = pts.find(p => p.id === a.patientId);
          const doctor = doctorsList.find(d => d.id === a.doctorId);
          return {
            id: a.id,
            type: "appointment" as const,
            title: "Appointment Booked",
            description: `Patient ${patient?.name || "Unknown"} scheduled with ${doctor?.name || "a specialist"}`,
            timestamp: new Date(a.createdAt),
            color: "bg-blue-500",
            icon: <IoCalendarOutline className="w-3.5 h-3.5" />
          };
        }),
        ...pts.map(p => ({
          id: p.id,
          type: "patient" as const,
          title: "New Patient Registered",
          description: `${p.name} was added to the clinic records`,
          timestamp: new Date(p.createdAt),
          color: "bg-emerald-500",
          icon: <IoPersonAddOutline className="w-3.5 h-3.5" />
        })),
        ...enqs.map(e => ({
          id: e.id,
          type: "enquiry" as const,
          title: "New Enquiry Received",
          description: `Lead from ${e.fullName} regarding ${e.reasonForVisit || "general inquiry"}`,
          timestamp: new Date(e.createdAt),
          color: "bg-amber-500",
          icon: <IoChatbubbleEllipsesOutline className="w-3.5 h-3.5" />
        }))
      ];

      // Sort by newest first
      combined.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setActivities(combined);
    } catch (error) {
      console.error("Failed to fetch activity log:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivity();
  }, [clinicId]);

  return (
    <div className="flex flex-col gap-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-2">
        <div className="flex items-center gap-3">
          <Button 
            isIconOnly 
            size="sm" 
            variant="flat" 
            onClick={() => navigate(-1)}
            className="bg-surface-2 hover:bg-surface-3"
          >
            <IoArrowBackOutline className="w-4 h-4" />
          </Button>
          <div>
            <h1 className={`${title({ size: "lg" })} text-primary`}>
              Activity Log
            </h1>
            <p className="text-[13.5px] text-text-muted mt-1">
              A comprehensive history of clinic events and changes
            </p>
          </div>
        </div>
        <Button 
          size="sm" 
          variant="flat" 
          startContent={<IoRefreshOutline />}
          onClick={fetchActivity}
          className="bg-surface-2 hover:bg-surface-3"
        >
          Refresh
        </Button>
      </div>

      {/* Activity List */}
      <div className="bg-surface border border-border-base rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Spinner size="md" />
            <p className="text-[13px] text-text-muted font-medium">Retrieving activity history...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <IoTimeOutline className="w-12 h-12 text-text-muted/20 mb-3" />
            <p className="text-[14px] text-text-main font-bold">No activity found</p>
            <p className="text-[12px] text-text-muted mt-1">Events will appear here as they happen</p>
          </div>
        ) : (
          <div className="divide-y divide-border-base/50">
            {activities.map((item) => (
              <div key={`${item.type}-${item.id}`} className="p-4 hover:bg-surface-2/50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${item.color.replace('bg-', 'bg-opacity-10 text-').replace('500', '600')} ${item.color.replace('500', '100')} dark:bg-opacity-20`}>
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <p className="text-[13px] font-bold text-text-main leading-tight">
                        {item.title}
                      </p>
                      <span className="text-[10px] font-medium text-text-muted whitespace-nowrap">
                        {formatDistanceToNow(item.timestamp, { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-[12px] text-text-muted">
                      {item.description}
                    </p>
                    <p className="text-[10px] text-text-muted/60 mt-1">
                      {format(item.timestamp, "MMM d, yyyy • h:mm a")}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
