/**
 * Expert Profile Page
 */
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  IoArrowBackOutline,
  IoCallOutline,
  IoMailOutline,
  IoIdCardOutline,
  IoCreateOutline,
  IoStatsChartOutline,
  IoCalendarOutline,
  IoPeopleOutline,
  IoTimeOutline,
} from "react-icons/io5";

import { title } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/hooks/useAuth";
import { expertService } from "@/services/expertService";
import { expertCommissionService } from "@/services/expertCommissionService";
import { appointmentService } from "@/services/appointmentService";
import { patientService } from "@/services/patientService";
import { appointmentTypeService } from "@/services/appointmentTypeService";
import { Expert, ExpertCommission, Appointment, Patient } from "@/types/models";
import { addToast } from "@/components/ui/toast";
import { Input } from "@/components/ui/input";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { Chip } from "@/components/ui/chip";

export default function ExpertProfilePage() {
  const { expertId } = useParams<{ expertId: string }>();
  const navigate = useNavigate();
  const { clinicId, currentUser } = useAuth();

  const [expert, setExpert] = useState<Expert | null>(null);
  const [commissions, setCommissions] = useState<ExpertCommission[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointmentTypeNames, setAppointmentTypeNames] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [commissionsLoading, setCommissionsLoading] = useState(false);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [patientsLoading, setPatientsLoading] = useState(false);
  
  const [selectedTab, setSelectedTab] = useState("overview");

  const [commissionDateRange, setCommissionDateRange] = useState({
    start: "",
    end: "",
  });
  
  const [appointmentDateRange, setAppointmentDateRange] = useState({
    start: "",
    end: "",
  });
  const [appointmentTypeFilter, setAppointmentTypeFilter] = useState("all");
  
  const [patientDateRange, setPatientDateRange] = useState({
    start: "",
    end: "",
  });

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedCommission, setSelectedCommission] =
    useState<ExpertCommission | null>(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "cash",
    reference: "",
    notes: "",
  });

  useEffect(() => {
    if (expertId && clinicId) loadExpertProfile();
  }, [expertId, clinicId]);

  const loadExpertProfile = async () => {
    try {
      setLoading(true);
      const data = await expertService.getExpertById(expertId!);

      if (!data) {
        addToast({
          title: "Error",
          description: "Expert not found.",
          color: "danger",
        });
        navigate("/dashboard/experts");

        return;
      }
      setExpert(data);
      
      const loadTasks = [
        loadCommissions().catch(() => {}),
        loadAppointments().catch(() => {}),
        loadPatients().catch(() => {}),
      ];
      await Promise.allSettled(loadTasks);
    } catch {
      addToast({
        title: "Error",
        description: "Failed to load profile.",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCommissions = async () => {
    if (!clinicId || !expertId) return;
    try {
      setCommissionsLoading(true);
      const data = await expertCommissionService.getCommissionsByExpert(
        expertId,
        clinicId,
      );

      setCommissions(data);
    } finally {
      setCommissionsLoading(false);
    }
  };

  const loadAppointments = async () => {
    if (!expertId || !clinicId) return;
    try {
      setAppointmentsLoading(true);
      const data = await appointmentService.getAppointmentsByExpert(expertId);
      setAppointments(data);

      const types = await appointmentTypeService.getAppointmentTypes(clinicId);
      const typeMap: Record<string, string> = {};
      types.forEach((t) => {
        typeMap[t.id] = t.name;
      });
      setAppointmentTypeNames(typeMap);
    } finally {
      setAppointmentsLoading(false);
    }
  };

  const loadPatients = async () => {
    if (!expertId) return;
    try {
      setPatientsLoading(true);
      const data = await patientService.getPatientsByExpert(expertId);
      setPatients(data || []);
    } finally {
      setPatientsLoading(false);
    }
  };

  const filteredAppointments = [...appointments]
    .filter((apt) => {
      // Type Filter
      if (appointmentTypeFilter !== "all" && apt.appointmentTypeId !== appointmentTypeFilter) {
        return false;
      }
      
      // Date Filter
      if (appointmentDateRange.start && appointmentDateRange.end) {
        const aptDate = new Date(apt.appointmentDate);
        const start = new Date(appointmentDateRange.start);
        start.setHours(0, 0, 0, 0);
        const end = new Date(appointmentDateRange.end);
        end.setHours(23, 59, 59, 999);
        if (aptDate < start || aptDate > end) {
          return false;
        }
      }
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.appointmentDate).getTime() -
        new Date(a.appointmentDate).getTime(),
    );

  const filteredPatients = [...patients]
    .filter((pat) => {
      if (patientDateRange.start && patientDateRange.end) {
        const patDate = new Date(pat.createdAt);
        const start = new Date(patientDateRange.start);
        start.setHours(0, 0, 0, 0);
        const end = new Date(patientDateRange.end);
        end.setHours(23, 59, 59, 999);
        if (patDate < start || patDate > end) {
          return false;
        }
      }
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  const patientNames = patients.reduce((acc, p) => {
    acc[p.id] = p.name;
    return acc;
  }, {} as Record<string, string>);

  const filteredCommissions = [...commissions]
    .filter((comm) => {
      if (commissionDateRange.start && commissionDateRange.end) {
        const commDate = new Date(comm.createdAt);
        const start = new Date(commissionDateRange.start);
        start.setHours(0, 0, 0, 0);
        const end = new Date(commissionDateRange.end);
        end.setHours(23, 59, 59, 999);
        if (commDate < start || commDate > end) {
          return false;
        }
      }
      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  const handlePaymentSubmit = async () => {
    if (!selectedCommission) return;
    const amount = parseFloat(paymentForm.amount);

    if (isNaN(amount) || amount <= 0) return;

    try {
      setPaymentProcessing(true);
      await expertCommissionService.payCommission(
        selectedCommission.id,
        amount,
        paymentForm.method,
        paymentForm.reference,
        paymentForm.notes,
        currentUser?.uid,
      );
      addToast({
        title: "Success",
        description: "Payment recorded.",
        color: "success",
      });
      loadCommissions();
      setIsPaymentModalOpen(false);
    } catch {
      addToast({
        title: "Error",
        description: "Payment failed.",
        color: "danger",
      });
    } finally {
      setPaymentProcessing(false);
    }
  };

  if (loading)
    return (
      <div className="p-12 flex justify-center">
        <Spinner size="md" />
      </div>
    );
  if (!expert)
    return (
      <div className="p-12 text-center text-text-muted">Expert not found.</div>
    );

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-3">
          <Button isIconOnly variant="bordered" onClick={() => navigate(-1)}>
            <IoArrowBackOutline />
          </Button>
          <div>
            <h1 className={`${title({ size: "lg" })} text-primary`}>
              Expert Profile
            </h1>
            <p className="text-[13.5px] text-text-muted mt-1">
              View and manage expert information
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            startContent={<IoCreateOutline />}
            variant="bordered"
            onClick={() => navigate(`/dashboard/experts/${expertId}/edit`)}
          >
            Edit
          </Button>
        </div>
      </div>

      <div className="bg-surface border border-border-base rounded p-6 shadow-none flex gap-6">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-stat-sm font-bold text-primary">
          {expert.name.charAt(0)}
        </div>
        <div className="flex-1">
          <h2 className="text-page-title font-bold text-text-main">
            {expert.name}
          </h2>
          <p className="text-text-muted font-medium capitalize text-[14px]">
            {expert.speciality} • {expert.expertType}
          </p>
          <div className="flex gap-4 mt-4">
            <span className="flex items-center gap-1.5 text-[13px] bg-surface-2 px-3 py-1 rounded border border-border-base text-text-main">
              <IoIdCardOutline /> License: {expert.licenseNumber}
            </span>
            <span className="flex items-center gap-1.5 text-[13px] bg-surface-2 px-3 py-1 rounded border border-border-base text-text-main">
              <IoStatsChartOutline /> Commission: {expert.defaultCommission}%
            </span>
          </div>
          <div className="flex gap-6 mt-4 text-[13.5px] text-text-muted">
            <span className="flex items-center gap-2">
              <IoCallOutline /> {expert.phone}
            </span>
            {expert.email && (
              <span className="flex items-center gap-2">
                <IoMailOutline /> {expert.email}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border-base rounded shadow-none overflow-hidden">
        <div className="flex border-b border-border-base bg-surface-2/30">
          {["overview", "appointments", "patients", "commissions"].map((t) => (
            <button
              key={t}
              className={`px-5 py-3 text-[13.5px] font-semibold capitalize transition-all ${selectedTab === t ? "border-b-2 border-primary text-primary bg-primary/5" : "text-text-muted hover:bg-surface-2 hover:text-text-main"}`}
              onClick={() => setSelectedTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="p-6">
          {selectedTab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-[13.5px]">
              <div className="space-y-3">
                <h3 className="font-bold uppercase tracking-wider border-b border-border-base pb-2 text-text-muted text-[11px]">
                  Professional details
                </h3>
                <div className="flex justify-between">
                  <span className="text-text-muted">Speciality</span>
                  <span className="font-semibold text-text-main">
                    {expert.speciality}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Type</span>
                  <span className="font-semibold capitalize text-text-main">
                    {expert.expertType}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">License</span>
                  <span className="font-semibold text-text-main">
                    {expert.licenseNumber}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="font-bold uppercase tracking-wider border-b border-border-base pb-2 text-text-muted text-[11px]">
                  Earnings
                </h3>
                <div className="flex justify-between">
                  <span className="text-text-muted">Balance</span>
                  <span className="font-bold text-success">
                    NPR {expert.totalCommissionBalance || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">Lifetime</span>
                  <span className="font-semibold text-text-main">
                    NPR {expert.totalCommissionEarned || 0}
                  </span>
                </div>
              </div>
            </div>
          )}
          
          {selectedTab === "appointments" && (
            <div className="space-y-6">
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-[16px] font-bold text-text-main">
                    Appointments
                  </h3>
                  <Button
                    isLoading={appointmentsLoading}
                    size="sm"
                    variant="bordered"
                    onClick={() => loadAppointments()}
                  >
                    Refresh
                  </Button>
                </div>
                
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-4 bg-surface-2/50 p-3 rounded-lg border border-border-base">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Type:</span>
                    <select
                      className="h-8 px-2 text-[12.5px] rounded border border-border-base bg-surface text-text-main outline-none focus:border-primary"
                      value={appointmentTypeFilter}
                      onChange={(e) => setAppointmentTypeFilter(e.target.value)}
                    >
                      <option value="all">All Types</option>
                      {[...new Set(appointments.map(a => a.appointmentTypeId).filter(Boolean))]
                        .filter(typeId => {
                          if (appointmentTypeNames[typeId]) return true;
                          if (typeId === "package-session") return true;
                          if (typeId.length !== 20) return true;
                          return false;
                        })
                        .map(typeId => {
                          let displayName = appointmentTypeNames[typeId];
                          if (!displayName) {
                            if (typeId === "package-session") displayName = "Package Session";
                            else {
                              const apt = appointments.find(a => a.appointmentTypeId === typeId);
                              if (apt && apt.appointmentType && apt.appointmentType !== typeId) {
                                displayName = apt.appointmentType.charAt(0).toUpperCase() + apt.appointmentType.slice(1).replace("-", " ");
                              } else {
                                displayName = typeId; // fallback
                              }
                            }
                          }
                          return (
                            <option key={typeId} value={typeId}>{displayName}</option>
                          );
                      })}
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <IoCalendarOutline className="w-4 h-4 text-text-muted" />
                    <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Date:</span>
                    <input
                      type="date"
                      className="h-8 px-2 text-[12.5px] rounded border border-border-base bg-surface text-text-main outline-none focus:border-primary"
                      value={appointmentDateRange.start}
                      onChange={(e) => setAppointmentDateRange(p => ({ ...p, start: e.target.value }))}
                    />
                    <span className="text-[11px] text-text-muted font-medium">to</span>
                    <input
                      type="date"
                      className="h-8 px-2 text-[12.5px] rounded border border-border-base bg-surface text-text-main outline-none focus:border-primary"
                      value={appointmentDateRange.end}
                      onChange={(e) => setAppointmentDateRange(p => ({ ...p, end: e.target.value }))}
                    />
                    {(appointmentDateRange.start || appointmentDateRange.end || appointmentTypeFilter !== "all") && (
                      <button
                        className="text-[11px] font-bold text-red-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-500/10 transition-colors ml-2"
                        onClick={() => {
                          setAppointmentDateRange({ start: "", end: "" });
                          setAppointmentTypeFilter("all");
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              {filteredAppointments.length > 0 ? (
                <div className="overflow-x-auto border border-border-base rounded-[10px]">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-surface-2 border-b border-border-base">
                        <th className="px-5 py-3 text-[12.5px] font-semibold text-text-muted">
                          Patient
                        </th>
                        <th className="px-5 py-3 text-[12.5px] font-semibold text-text-muted">
                          Date/Time
                        </th>
                        <th className="px-5 py-3 text-[12.5px] font-semibold text-text-muted">
                          Type & Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-base/50">
                      {filteredAppointments.map((appointment) => (
                        <tr
                          key={appointment.id}
                          className="hover:bg-surface-2/30"
                        >
                          <td className="px-5 py-3">
                            <div className="font-medium text-[13.5px] text-text-main">
                              {patientNames[appointment.patientId] || "Unknown"}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-[13px] text-text-muted">
                            {appointment.appointmentDate.toLocaleDateString()}{" "}
                            at {appointment.startTime || "N/A"}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex px-2 py-0.5 border rounded text-[11px] font-bold tracking-wide uppercase ${
                                  appointment.status === "completed"
                                    ? "bg-green-500/10 text-green-500 border-green-500/20"
                                    : appointment.status === "scheduled"
                                      ? "bg-primary/10 text-primary border-primary/20"
                                      : appointment.status === "cancelled"
                                        ? "bg-red-500/10 text-red-500 border-red-500/20"
                                        : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                }`}
                              >
                                {appointment.status}
                              </span>
                              <span className="text-[12px] text-text-muted">
                                {appointmentTypeNames[appointment.appointmentTypeId] || appointment.appointmentType || "Consultation"}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center text-text-muted bg-surface-2 rounded">
                  <IoCalendarOutline className="text-stat mb-2 text-text-muted/30" />
                  <p>No appointments found.</p>
                </div>
              )}
            </div>
          )}

          {selectedTab === "patients" && (
            <div className="space-y-6">
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-[16px] font-bold text-text-main">
                    Patients
                  </h3>
                  <Button
                    isLoading={patientsLoading}
                    size="sm"
                    variant="bordered"
                    onClick={() => loadPatients()}
                  >
                    Refresh
                  </Button>
                </div>
                
                {/* Patient Filters */}
                <div className="flex flex-wrap items-center gap-4 bg-surface-2/50 p-3 rounded-lg border border-border-base">
                  <div className="flex items-center gap-2">
                    <IoCalendarOutline className="w-4 h-4 text-text-muted" />
                    <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Date:</span>
                    <input
                      type="date"
                      className="h-8 px-2 text-[12.5px] rounded border border-border-base bg-surface text-text-main outline-none focus:border-primary"
                      value={patientDateRange.start}
                      onChange={(e) => setPatientDateRange(p => ({ ...p, start: e.target.value }))}
                    />
                    <span className="text-[11px] text-text-muted font-medium">to</span>
                    <input
                      type="date"
                      className="h-8 px-2 text-[12.5px] rounded border border-border-base bg-surface text-text-main outline-none focus:border-primary"
                      value={patientDateRange.end}
                      onChange={(e) => setPatientDateRange(p => ({ ...p, end: e.target.value }))}
                    />
                    {(patientDateRange.start || patientDateRange.end) && (
                      <button
                        className="text-[11px] font-bold text-red-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-500/10 transition-colors ml-2"
                        onClick={() => setPatientDateRange({ start: "", end: "" })}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              {filteredPatients.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredPatients.map((patient) => (
                    <div
                      key={patient.id}
                      className="p-4 border border-border-base rounded-[10px] hover:border-primary/50 transition-colors flex items-start gap-4 shadow-sm bg-surface"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary flex-shrink-0">
                        {patient.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-semibold text-[13.5px] text-text-main">
                          {patient.name}
                        </h4>
                        <div className="text-[12px] text-text-muted mt-0.5 space-x-1">
                          <span>Reg: {patient.regNumber}</span>
                          <span>•</span>
                          <span>
                            {patient.age}
                            {typeof patient.age === "number" ? "y" : ""}
                          </span>
                        </div>
                        <div className="text-[12.5px] font-medium text-text-main mt-1.5 flex items-center gap-1.5">
                          <IoCallOutline className="text-text-muted" />
                          {patient.mobile}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center text-text-muted bg-surface-2 rounded">
                  <IoPeopleOutline className="text-stat mb-2 text-text-muted/30" />
                  <p>No patients found.</p>
                </div>
              )}
            </div>
          )}

          {selectedTab === "commissions" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-[16px] font-bold text-text-main">
                    Commission Records
                  </h3>
                  <Button
                    isLoading={commissionsLoading}
                    size="sm"
                    variant="bordered"
                    onClick={() => loadCommissions()}
                  >
                    Refresh
                  </Button>
                </div>
                
                {/* Commission Filters */}
                <div className="flex flex-wrap items-center gap-4 bg-surface-2/50 p-3 rounded-lg border border-border-base">
                  <div className="flex items-center gap-2">
                    <IoCalendarOutline className="w-4 h-4 text-text-muted" />
                    <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">Date:</span>
                    <input
                      type="date"
                      className="h-8 px-2 text-[12.5px] rounded border border-border-base bg-surface text-text-main outline-none focus:border-primary"
                      value={commissionDateRange.start}
                      onChange={(e) => setCommissionDateRange(p => ({ ...p, start: e.target.value }))}
                    />
                    <span className="text-[11px] text-text-muted font-medium">to</span>
                    <input
                      type="date"
                      className="h-8 px-2 text-[12.5px] rounded border border-border-base bg-surface text-text-main outline-none focus:border-primary"
                      value={commissionDateRange.end}
                      onChange={(e) => setCommissionDateRange(p => ({ ...p, end: e.target.value }))}
                    />
                    {(commissionDateRange.start || commissionDateRange.end) && (
                      <button
                        className="text-[11px] font-bold text-red-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-500/10 transition-colors ml-2"
                        onClick={() => setCommissionDateRange({ start: "", end: "" })}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              {commissionsLoading ? (
                <Spinner size="sm" />
              ) : filteredCommissions.length === 0 ? (
                <p className="text-text-muted">No commissions found.</p>
              ) : (
                <div className="border border-border-base rounded overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-surface-2 text-[12px] font-semibold text-text-muted uppercase tracking-wider">
                      <tr>
                        <th className="p-3">Invoice</th>
                        <th className="p-3">Patient</th>
                        <th className="p-3">Service / Source</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-[13px] divide-y divide-border-base/50">
                      {filteredCommissions.map((c) => (
                        <tr key={c.id}>
                          <td className="p-3">#{c.invoiceNumber}</td>
                          <td className="p-3 font-medium text-text-main">
                            {c.patientName}
                          </td>
                          <td className="p-3 text-text-muted">
                            {(c.serviceNames || []).join(", ") ||
                              "Expert Consultation"}
                          </td>
                          <td className="p-3 font-semibold">
                            NPR {c.commissionAmount}
                          </td>
                          <td className="p-3">
                            <Chip
                              color={
                                c.status === "paid" ? "success" : "warning"
                              }
                              size="sm"
                              variant="flat"
                            >
                              {c.status}
                            </Chip>
                          </td>
                          <td className="p-3 text-right">
                            {c.status !== "paid" && (
                              <Button
                                color="primary"
                                size="sm"
                                variant="flat"
                                onClick={() => {
                                  setSelectedCommission(c);
                                  setPaymentForm({
                                    ...paymentForm,
                                    amount: (
                                      c.commissionAmount - (c.paidAmount || 0)
                                    ).toString(),
                                  });
                                  setIsPaymentModalOpen(true);
                                }}
                              >
                                Record Payment
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
      >
        <ModalContent>
          <ModalHeader>Record Commission Payment</ModalHeader>
          <ModalBody className="p-5 flex flex-col gap-4">
            <Input
              fullWidth
              label="Amount to Pay"
              placeholder="0.00"
              startContent={
                <span className="text-text-muted text-[12px] font-semibold">
                  NPR
                </span>
              }
              type="number"
              value={paymentForm.amount}
              variant="bordered"
              onChange={(e: any) =>
                setPaymentForm({ ...paymentForm, amount: e.target.value })
              }
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onClick={() => setIsPaymentModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={paymentProcessing}
              onClick={handlePaymentSubmit}
            >
              Save Payment
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
