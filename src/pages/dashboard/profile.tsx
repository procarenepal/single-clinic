import {
  IoSettingsOutline,
  IoLockClosedOutline,
  IoCalendarOutline,
  IoPeopleOutline,
  IoTimeOutline,
  IoCheckmarkCircleOutline,
  IoWalletOutline,
} from "react-icons/io5";
import { useState, useEffect } from "react";

import { EditProfileModal } from "./components/EditProfileModal";
import { AdminCredentialsModal } from "./components/AdminCredentialsModal";

import { Card, CardBody } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { useDisclosure } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useAuthContext } from "@/context/AuthContext";
import { clinicService } from "@/services/clinicService";
import { title } from "@/components/primitives";
import { doctorService } from "@/services/doctorService";
import { expertService } from "@/services/expertService";
import { appointmentService } from "@/services/appointmentService";
import { patientService } from "@/services/patientService";
import { doctorCommissionService } from "@/services/doctorCommissionService";
import { expertCommissionService } from "@/services/expertCommissionService";
import {
  Doctor,
  Expert,
  Appointment,
  Patient,
  DoctorCommission,
  ExpertCommission,
} from "@/types/models";

export default function ProfilePage() {
  const { currentUser, userData, isClinicAdmin, isSystemOwner } =
    useAuthContext();
  const {
    isOpen: isEditModalOpen,
    onOpen: onEditModalOpen,
    onClose: onEditModalClose,
  } = useDisclosure();
  const {
    isOpen: isCredentialsModalOpen,
    onOpen: onCredentialsModalOpen,
    onClose: onCredentialsModalClose,
  } = useDisclosure();
  const [clinicName, setClinicName] = useState<string>("");
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [expert, setExpert] = useState<Expert | null>(null);
  const [loadingDoctorOrExpert, setLoadingDoctorOrExpert] = useState(true);

  // Doctor state
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientNames, setPatientNames] = useState<Record<string, string>>({});
  const [doctorCommissions, setDoctorCommissions] = useState<
    DoctorCommission[]
  >([]);
  const [doctorCommissionStats, setDoctorCommissionStats] = useState({
    totalCommission: 0,
    paidCommission: 0,
    pendingCommission: 0,
    totalInvoices: 0,
    paidInvoices: 0,
    pendingInvoices: 0,
  });

  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [patientsLoading, setPatientsLoading] = useState(false);
  const [commissionsLoading, setCommissionsLoading] = useState(false);

  // Expert state
  const [expertCommissions, setExpertCommissions] = useState<
    ExpertCommission[]
  >([]);
  const [expertCommissionsLoading, setExpertCommissionsLoading] =
    useState(false);

  const [doctorOrExpertTab, setDoctorOrExpertTab] = useState("overview");

  const displayName =
    currentUser?.displayName || userData?.displayName || "User";
  const email = currentUser?.email || userData?.email || "No email provided";

  const loadDoctorAppointments = async (docId: string) => {
    try {
      setAppointmentsLoading(true);
      const data = await appointmentService.getAppointmentsByDoctor(docId);

      setAppointments(data || []);

      if (data && data.length > 0) {
        const uniquePatientIds = [...new Set(data.map((apt) => apt.patientId))];
        const patientNamePromises = uniquePatientIds.map(async (patientId) => {
          try {
            const patient = await patientService.getPatientById(patientId);

            return { patientId, name: patient?.name || "Unknown Patient" };
          } catch {
            return { patientId, name: "Unknown Patient" };
          }
        });
        const results = await Promise.allSettled(patientNamePromises);
        const nameMap: Record<string, string> = {};

        results.forEach((r) => {
          if (r.status === "fulfilled") {
            nameMap[r.value.patientId] = r.value.name;
          }
        });
        setPatientNames(nameMap);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAppointmentsLoading(false);
    }
  };

  const loadDoctorPatients = async (docId: string) => {
    try {
      setPatientsLoading(true);
      let data: Patient[] | null = null;

      if (userData?.clinicId) {
        data = await patientService.getPatientsByDoctor(
          docId,
          userData.clinicId,
        );
      }
      setPatients(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setPatientsLoading(false);
    }
  };

  const loadDoctorCommissions = async (docId: string) => {
    if (!userData?.clinicId) return;
    try {
      setCommissionsLoading(true);
      const [commissionsData, statsData] = await Promise.all([
        doctorCommissionService.getCommissionsByDoctor(
          docId,
          userData.clinicId,
        ),
        doctorCommissionService.getCommissionStats(docId, userData.clinicId),
      ]);

      setDoctorCommissions(commissionsData);
      setDoctorCommissionStats(statsData);
    } catch (err) {
      console.error(err);
    } finally {
      setCommissionsLoading(false);
    }
  };

  const loadExpertCommissions = async (expId: string) => {
    if (!userData?.clinicId) return;
    try {
      setExpertCommissionsLoading(true);
      const data = await expertCommissionService.getCommissionsByExpert(
        expId,
        userData.clinicId,
      );

      setExpertCommissions(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setExpertCommissionsLoading(false);
    }
  };

  useEffect(() => {
    if (userData?.clinicId) {
      clinicService.getClinicById(userData.clinicId).then((clinic) => {
        if (clinic) setClinicName(clinic.name);
      });
    } else if (isSystemOwner()) {
      setClinicName("ProCare Administration");
    }
  }, [userData?.clinicId]);

  useEffect(() => {
    const checkDoctorOrExpert = async () => {
      if (!email || email === "No email provided") {
        setLoadingDoctorOrExpert(false);

        return;
      }

      try {
        setLoadingDoctorOrExpert(true);
        // Check doctor first
        const doctorData = await doctorService.getDoctorByEmail(email);

        if (doctorData) {
          setDoctor(doctorData);
          // Load doctor details
          await Promise.allSettled([
            loadDoctorAppointments(doctorData.id),
            loadDoctorPatients(doctorData.id),
            loadDoctorCommissions(doctorData.id),
          ]);
        } else {
          // Check expert
          const expertData = await expertService.getExpertByEmail(email);

          if (expertData) {
            setExpert(expertData);
            await loadExpertCommissions(expertData.id);
          }
        }
      } catch (error) {
        console.error("Error loading doctor or expert details:", error);
      } finally {
        setLoadingDoctorOrExpert(false);
      }
    };

    checkDoctorOrExpert();
  }, [email, userData?.clinicId]);

  const totalAppointments = appointments.length;
  const totalPatients = patients.length;
  const upcomingAppointments = appointments.filter((apt) => {
    try {
      return (
        new Date(apt.appointmentDate) > new Date() && apt.status === "scheduled"
      );
    } catch {
      return false;
    }
  }).length;
  const completedAppointments = appointments.filter(
    (apt) => apt.status === "completed",
  ).length;

  const recentAppointments = [...appointments]
    .sort(
      (a, b) =>
        new Date(b.appointmentDate).getTime() -
        new Date(a.appointmentDate).getTime(),
    )
    .slice(0, 10);

  const formatSpeciality = (spec: string) => {
    if (!spec) return "";

    return spec
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getRoleBadge = () => {
    if (isSystemOwner())
      return (
        <Chip color="danger" size="sm" variant="flat">
          System Admin
        </Chip>
      );
    if (isClinicAdmin())
      return (
        <Chip color="primary" size="sm" variant="flat">
          Clinic Admin
        </Chip>
      );

    return (
      <Chip color="success" size="sm" variant="flat">
        {userData?.role || "Staff"}
      </Chip>
    );
  };

  return (
    <div className="flex flex-col gap-8 max-w-[1400px] mx-auto py-8 px-4 w-full">
      {/* Premium Hero Section */}
      <div className="relative overflow-hidden bg-surface border border-border-base rounded-2xl p-8 shadow-sm">
        <div className="flex flex-col md:flex-row gap-8 items-center md:items-start relative z-10">
          <div className="relative group w-16 h-16 shrink-0">
            <Avatar
              className="w-full h-full text-3xl shadow-md ring-4 ring-mountain-50 dark:ring-zinc-900"
              color="primary"
              name={displayName}
              src={userData?.photoURL || currentUser?.photoURL || ""}
            />
            <button
              className="absolute -bottom-1 -right-1 p-2 bg-teal-600 text-white rounded-full shadow-lg hover:bg-teal-700 transition-all border-2 border-white dark:border-zinc-900 z-10"
              title="Change Profile Picture"
              onClick={onEditModalOpen}
            >
              <IoSettingsOutline className="w-3 h-3" />
            </button>
          </div>

          <div className="flex-1 text-center md:text-left space-y-3">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <h1 className={`${title({ size: "lg" })} text-primary`}>
                {displayName}
              </h1>
              <div className="flex justify-center md:justify-start">
                {getRoleBadge()}
              </div>
            </div>

            <p className="text-text-muted font-medium flex items-center justify-center md:justify-start gap-2">
              <span className="p-1 px-2 bg-surface-2 rounded text-xs font-mono">
                {email}
              </span>
            </p>

            <div className="flex flex-wrap justify-center md:justify-start gap-3 mt-6">
              <Button
                className="rounded-full px-6"
                color="primary"
                size="sm"
                variant="solid"
                onClick={onEditModalOpen}
              >
                Edit Profile
              </Button>
              <Button
                className="rounded-full px-6 bg-surface-2"
                color="default"
                size="sm"
                variant="flat"
                onClick={onCredentialsModalOpen}
              >
                Admin Credentials
              </Button>
            </div>
          </div>
        </div>

        {/* Subtle decorative element */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-teal-50 dark:bg-teal-900/10 rounded-full blur-3xl opacity-50" />
      </div>

      {loadingDoctorOrExpert ? (
        <div className="flex justify-center items-center py-16">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent animate-spin rounded-full" />
        </div>
      ) : doctor ? (
        <>
          {/* Fast Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: "Total Patients",
                val: totalPatients,
                icon: <IoPeopleOutline className="w-6 h-6 text-indigo-500" />,
                bg: "bg-indigo-500/5 border-indigo-500/20",
              },
              {
                label: "Total Appt.",
                val: totalAppointments,
                icon: <IoCalendarOutline className="w-6 h-6 text-primary" />,
                bg: "bg-primary/5 border-primary/20",
              },
              {
                label: "Upcoming Appt.",
                val: upcomingAppointments,
                icon: <IoTimeOutline className="w-6 h-6 text-amber-500" />,
                bg: "bg-amber-500/5 border-amber-500/20",
              },
              {
                label: "Completed Appt.",
                val: completedAppointments,
                icon: (
                  <IoCheckmarkCircleOutline className="w-6 h-6 text-green-500" />
                ),
                bg: "bg-green-500/5 border-green-500/20",
              },
            ].map((s, i) => (
              <div
                key={i}
                className={`flex items-center gap-4 p-5 rounded-2xl border bg-surface ${s.bg}`}
              >
                <div className="p-3 bg-surface border border-border-base rounded-full shadow-sm">
                  {s.icon}
                </div>
                <div>
                  <p className="text-xl font-bold text-text-main leading-none">
                    {s.val}
                  </p>
                  <p className="text-[13px] text-text-muted font-medium mt-1">
                    {s.label}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Doctor Data Tabs Container */}
          <div className="bg-surface border border-border-base rounded-2xl shadow-sm overflow-hidden">
            <div className="flex border-b border-border-base/50 overflow-x-auto bg-surface-2/30">
              {[
                { key: "overview", label: "Overview" },
                { key: "appointments", label: "Appointments" },
                { key: "patients", label: "Patients" },
                { key: "commission", label: "Commission" },
              ].map((t) => (
                <button
                  key={t.key}
                  className={`px-5 py-4 text-[14px] font-semibold whitespace-nowrap transition-colors border-b-2 ${
                    doctorOrExpertTab === t.key
                      ? "border-primary text-primary bg-primary/5"
                      : "border-transparent text-text-muted hover:text-text-main hover:bg-surface-2"
                  }`}
                  onClick={() => setDoctorOrExpertTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {doctorOrExpertTab === "overview" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left Column: Personal details */}
                  <div className="space-y-4">
                    <h3 className="text-[14px] font-bold text-text-main uppercase tracking-wider mb-4 border-b border-border-base pb-2">
                      Personal details
                    </h3>
                    <div className="flex justify-between text-[14px] border-b border-border-base/50 pb-2">
                      <span className="text-text-muted">Email address</span>
                      <span className="font-semibold text-text-main">
                        {email}
                      </span>
                    </div>
                    <div className="flex justify-between text-[14px] border-b border-border-base/50 pb-2">
                      <span className="text-text-muted">Phone number</span>
                      <span className="font-semibold text-text-main">
                        {userData?.phone || "—"}
                      </span>
                    </div>
                    <div className="flex justify-between text-[14px] border-b border-border-base/50 pb-2">
                      <span className="text-text-muted">User type</span>
                      <span className="font-semibold text-text-main capitalize">
                        {userData?.role?.replace(/-/g, " ") || "Staff"}
                      </span>
                    </div>
                    <div className="flex justify-between text-[14px] pb-2">
                      <span className="text-text-muted">Member since</span>
                      <span className="font-semibold text-text-main">
                        {currentUser?.metadata.creationTime
                          ? new Date(
                              currentUser.metadata.creationTime,
                            ).toLocaleDateString(undefined, {
                              month: "long",
                              year: "numeric",
                            })
                          : "N/A"}
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Professional details */}
                  <div className="space-y-4">
                    <h3 className="text-[14px] font-bold text-text-main uppercase tracking-wider mb-4 border-b border-border-base pb-2">
                      Professional details
                    </h3>
                    <div className="flex justify-between text-[14px] border-b border-border-base/50 pb-2">
                      <span className="text-text-muted">Speciality</span>
                      <span className="font-semibold text-text-main">
                        {formatSpeciality(doctor.speciality)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[14px] border-b border-border-base/50 pb-2">
                      <span className="text-text-muted">Type</span>
                      <span className="font-semibold capitalize text-text-main">
                        {doctor.doctorType}
                      </span>
                    </div>
                    <div className="flex justify-between text-[14px] border-b border-border-base/50 pb-2">
                      <span className="text-text-muted">NMC License</span>
                      <span className="font-semibold text-text-main">
                        {doctor.nmcNumber}
                      </span>
                    </div>
                    <div className="flex justify-between text-[14px] border-b border-border-base/50 pb-2">
                      <span className="text-text-muted">
                        Consultation Charge
                      </span>
                      <span className="font-semibold text-text-main">
                        {doctor.consultationCharge !== undefined
                          ? `NPR ${doctor.consultationCharge.toLocaleString()}`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between text-[14px] pb-2">
                      <span className="text-text-muted">
                        Default Commission
                      </span>
                      <span className="font-semibold text-text-main">
                        {doctor.defaultCommission}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {doctorOrExpertTab === "appointments" && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-[16px] font-bold text-text-main">
                      Recent Appointments
                    </h3>
                    <Button
                      isLoading={appointmentsLoading}
                      size="sm"
                      variant="bordered"
                      onClick={() => loadDoctorAppointments(doctor.id)}
                    >
                      Refresh
                    </Button>
                  </div>
                  {recentAppointments.length > 0 ? (
                    <div className="overflow-x-auto border border-border-base rounded-2xl">
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
                          {recentAppointments.map((appointment) => (
                            <tr
                              key={appointment.id}
                              className="hover:bg-surface-2/30"
                            >
                              <td className="px-5 py-3">
                                <div className="font-medium text-[13.5px] text-text-main">
                                  {patientNames[appointment.patientId] ||
                                    "Unknown"}
                                </div>
                              </td>
                              <td className="px-5 py-3 text-[13px] text-text-muted">
                                {new Date(
                                  appointment.appointmentDate,
                                ).toLocaleDateString()}{" "}
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
                                    {appointment.appointmentType}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-12 text-center text-text-muted bg-surface-2 rounded-2xl">
                      <IoCalendarOutline className="text-3xl mb-2 text-text-muted/30" />
                      <p>No appointments found.</p>
                    </div>
                  )}
                </div>
              )}

              {doctorOrExpertTab === "patients" && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-[16px] font-bold text-text-main">
                      Linked Patients
                    </h3>
                    <Button
                      isLoading={patientsLoading}
                      size="sm"
                      variant="bordered"
                      onClick={() => loadDoctorPatients(doctor.id)}
                    >
                      Refresh
                    </Button>
                  </div>
                  {patients.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {patients.map((patient) => (
                        <div
                          key={patient.id}
                          className="p-4 border border-border-base rounded-2xl hover:border-primary/50 transition-colors flex items-start gap-4 shadow-sm bg-surface"
                        >
                          <div className="w-10 h-10 bg-indigo-500/10 text-indigo-500 rounded flex items-center justify-center font-bold">
                            {patient.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-[14px] text-text-main leading-tight">
                              {patient.name}
                            </p>
                            <p className="text-[12px] text-text-muted mt-1">
                              Reg: {patient.regNumber} • {patient.age}y
                            </p>
                            <p className="text-[12.5px] text-text-main font-medium mt-0.5">
                              {patient.mobile || patient.phone}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-12 text-center text-text-muted bg-surface-2 rounded-2xl">
                      <IoPeopleOutline className="text-3xl mb-2 text-text-muted/30" />
                      <p>No patients linked.</p>
                    </div>
                  )}
                </div>
              )}

              {doctorOrExpertTab === "commission" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      {
                        val: `NPR ${doctorCommissionStats.totalCommission.toLocaleString()}`,
                        label: "Total Commission",
                        color: "text-blue-500",
                      },
                      {
                        val: `NPR ${doctorCommissionStats.paidCommission.toLocaleString()}`,
                        label: "Paid Commission",
                        color: "text-green-500",
                      },
                      {
                        val: `NPR ${doctorCommissionStats.pendingCommission.toLocaleString()}`,
                        label: "Pending Commission",
                        color: "text-amber-500",
                      },
                    ].map((s, i) => (
                      <div
                        key={i}
                        className="p-5 text-center border border-border-base rounded-2xl shadow-sm bg-surface-2/50"
                      >
                        <p
                          className={`text-2xl font-bold leading-none ${s.color}`}
                        >
                          {s.val}
                        </p>
                        <p className="text-[13px] text-text-muted font-medium mt-1">
                          {s.label}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center mt-6">
                    <h3 className="text-[16px] font-bold text-text-main">
                      Commission Records
                    </h3>
                    <Button
                      isLoading={commissionsLoading}
                      size="sm"
                      variant="bordered"
                      onClick={() => loadDoctorCommissions(doctor.id)}
                    >
                      Refresh Data
                    </Button>
                  </div>

                  {doctorCommissions.length > 0 ? (
                    <div className="space-y-3">
                      {doctorCommissions.map((commission) => (
                        <div
                          key={commission.id}
                          className="p-4 border border-border-base rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface shadow-sm"
                        >
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <span className="font-bold text-[15px] font-mono text-text-main">
                                {commission.invoiceNumber}
                              </span>
                              <span
                                className={`inline-flex px-2 py-0.5 border rounded text-[11px] font-bold tracking-wide uppercase ${
                                  commission.status === "paid"
                                    ? "bg-primary/10 text-primary border-primary/20"
                                    : commission.status === "pending"
                                      ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                      : "bg-red-500/10 text-red-600 border-red-500/20"
                                }`}
                              >
                                {commission.status}
                              </span>
                            </div>
                            <p className="text-[13.5px] font-medium text-text-main">
                              {commission.patientName} -{" "}
                              {(commission.serviceNames || []).join(", ")}
                            </p>
                            <p className="text-[12px] text-text-muted mt-1">
                              Rate:{" "}
                              {Number(commission.commissionPercentage)
                                .toFixed(2)
                                .replace(/\.00$/, "")}
                              % • Invoiced: NPR{" "}
                              {commission.totalInvoiceAmount.toLocaleString()}
                            </p>
                          </div>
                          <div className="text-left md:text-right">
                            <p className="text-[18px] font-bold text-text-main leading-none">
                              NPR {commission.commissionAmount.toLocaleString()}
                            </p>
                            {commission.status === "pending" && (
                              <p className="text-[12px] text-amber-500 font-medium mt-1">
                                Pending: NPR{" "}
                                {(
                                  commission.commissionAmount -
                                  (commission.paidAmount || 0)
                                ).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-12 text-center text-text-muted bg-surface-2 rounded-2xl">
                      <IoWalletOutline className="text-3xl mb-2 text-text-muted/30" />
                      <p>No commissions attached yet.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      ) : expert ? (
        <>
          {/* Expert Data Tabs Container */}
          <div className="bg-surface border border-border-base rounded-2xl shadow-sm overflow-hidden">
            <div className="flex border-b border-border-base bg-surface-2/30">
              {[
                { key: "overview", label: "Overview" },
                { key: "commissions", label: "Commissions" },
              ].map((t) => (
                <button
                  key={t.key}
                  className={`px-5 py-3 text-[13.5px] font-semibold capitalize transition-all ${
                    doctorOrExpertTab === t.key
                      ? "border-b-2 border-primary text-primary bg-primary/5"
                      : "text-text-muted hover:bg-surface-2 hover:text-text-main"
                  }`}
                  onClick={() => setDoctorOrExpertTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="p-6">
              {doctorOrExpertTab === "overview" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-[13.5px]">
                  {/* Left Column: Personal details */}
                  <div className="space-y-3">
                    <h3 className="font-bold uppercase tracking-wider border-b border-border-base pb-2 text-text-muted text-[11px]">
                      Personal details
                    </h3>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Email address</span>
                      <span className="font-semibold text-text-main">
                        {email}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Phone number</span>
                      <span className="font-semibold text-text-main">
                        {userData?.phone || "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">User type</span>
                      <span className="font-semibold text-text-main capitalize">
                        {userData?.role?.replace(/-/g, " ") || "Staff"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Member since</span>
                      <span className="font-semibold text-text-main">
                        {currentUser?.metadata.creationTime
                          ? new Date(
                              currentUser.metadata.creationTime,
                            ).toLocaleDateString(undefined, {
                              month: "long",
                              year: "numeric",
                            })
                          : "N/A"}
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Professional details & Earnings */}
                  <div className="space-y-3">
                    <h3 className="font-bold uppercase tracking-wider border-b border-border-base pb-2 text-text-muted text-[11px]">
                      Professional & Earnings details
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
                    <div className="flex justify-between">
                      <span className="text-text-muted">
                        Default Commission
                      </span>
                      <span className="font-semibold text-text-main">
                        {expert.defaultCommission}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Balance</span>
                      <span className="font-bold text-success">
                        NPR{" "}
                        {(expert.totalCommissionBalance || 0).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Lifetime Earned</span>
                      <span className="font-semibold text-text-main">
                        NPR{" "}
                        {(expert.totalCommissionEarned || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {doctorOrExpertTab === "commissions" && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-[16px] font-bold text-text-main">
                      Commission Records
                    </h3>
                    <Button
                      isLoading={expertCommissionsLoading}
                      size="sm"
                      variant="bordered"
                      onClick={() => loadExpertCommissions(expert.id)}
                    >
                      Refresh
                    </Button>
                  </div>
                  {expertCommissions.length === 0 ? (
                    <p className="text-text-muted">No commissions recorded.</p>
                  ) : (
                    <div className="border border-border-base rounded-2xl overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-surface-2 text-[12px] font-semibold text-text-muted uppercase tracking-wider">
                          <tr>
                            <th className="p-3">Invoice</th>
                            <th className="p-3">Patient</th>
                            <th className="p-3">Service / Source</th>
                            <th className="p-3">Amount</th>
                            <th className="p-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="text-[13px] divide-y divide-border-base/50">
                          {expertCommissions.map((c) => (
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
                                NPR {c.commissionAmount.toLocaleString()}
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
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-8">
            <section className="space-y-4">
              <h3 className="text-[14px] font-bold text-text-main px-1">
                Personal details
              </h3>
              <Card className="border-none shadow-none bg-surface-2/30">
                <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 p-8">
                  <div className="space-y-1">
                    <label className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400">
                      Email address
                    </label>
                    <p className="text-[13px] font-semibold text-text-main">
                      {email}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400">
                      Phone number
                    </label>
                    <p className="text-sm font-medium text-text-main">
                      {userData?.phone || "—"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400">
                      User type
                    </label>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 capitalize">
                      {userData?.role?.replace(/-/g, " ") || "Staff"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[12px] font-semibold text-zinc-500 dark:text-zinc-400">
                      Member since
                    </label>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {currentUser?.metadata.creationTime
                        ? new Date(
                            currentUser.metadata.creationTime,
                          ).toLocaleDateString(undefined, {
                            month: "long",
                            year: "numeric",
                          })
                        : "N/A"}
                    </p>
                  </div>
                </CardBody>
              </Card>
            </section>

            <section className="space-y-4">
              <h3 className="text-[14px] font-bold text-text-main px-1">
                Permissions
              </h3>
              <div className="p-6 rounded-2xl bg-surface border border-border-base flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-teal-50 dark:bg-teal-900/20 flex items-center justify-center text-teal-600">
                    <IoLockClosedOutline size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold capitalize text-text-main">
                      {userData?.role?.replace(/-/g, " ")} Access
                    </p>
                    <p className="text-xs text-zinc-500">
                      Full administrative control over this branch
                    </p>
                  </div>
                </div>
                <Button
                  className="text-xs font-semibold"
                  size="sm"
                  variant="light"
                >
                  View RBAC
                </Button>
              </div>
            </section>
          </div>

          {/* Sidebar Info */}
          <div className="space-y-8">
            <section className="space-y-4">
              <h3 className="text-[14px] font-bold text-text-main px-1">
                Organization
              </h3>
              <Card className="border-border-base shadow-sm overflow-hidden">
                <div className="h-24 bg-surface-2 flex items-center justify-center border-b border-border-base">
                  {clinicName ? (
                    <span className="text-lg font-bold text-zinc-300 dark:text-zinc-700 tracking-tighter">
                      {isSystemOwner() ? "System" : "Clinic"}
                    </span>
                  ) : (
                    <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent animate-spin rounded-full" />
                  )}
                </div>
                <CardBody className="p-6 text-center">
                  <h4 className="text-lg font-extrabold text-text-main">
                    {clinicName || "Loading..."}
                  </h4>
                  <p className="text-[12px] text-zinc-500 font-medium mt-1">
                    {isSystemOwner()
                      ? "System platform"
                      : userData?.clinicId
                        ? "Clinic head"
                        : "Clinic unit"}
                  </p>
                </CardBody>
              </Card>
            </section>

            <section className="space-y-4">
              <h3 className="text-[14px] font-bold text-text-main px-1">
                Recent activity
              </h3>
              <div className="space-y-4 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-[1px] before:bg-zinc-100 dark:before:bg-zinc-800">
                <div className="relative pl-8 space-y-1">
                  <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-surface border-2 border-teal-500 z-10" />
                  <p className="text-xs font-bold text-text-main">
                    Last Sign In
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    {currentUser?.metadata.lastSignInTime
                      ? new Date(
                          currentUser.metadata.lastSignInTime,
                        ).toLocaleString()
                      : "First Session"}
                  </p>
                </div>
                <div className="relative pl-8 space-y-1">
                  <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-surface border-2 border-border-base z-10" />
                  <p className="text-xs font-bold text-text-main">
                    Account Created
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    {currentUser?.metadata.creationTime
                      ? new Date(
                          currentUser.metadata.creationTime,
                        ).toLocaleString()
                      : "N/A"}
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      <EditProfileModal isOpen={isEditModalOpen} onClose={onEditModalClose} />

      <AdminCredentialsModal
        isOpen={isCredentialsModalOpen}
        onClose={onCredentialsModalClose}
      />
    </div>
  );
}
