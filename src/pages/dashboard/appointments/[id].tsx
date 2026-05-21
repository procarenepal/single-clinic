import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { format } from "date-fns";
import { IoMedicalOutline } from "react-icons/io5";

import { title } from "@/components/primitives";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Divider } from "@/components/ui/divider";
import { Spinner } from "@/components/ui/spinner";
import { Avatar } from "@/components/ui/avatar";
import { useAuthContext } from "@/context/AuthContext";
import { appointmentService } from "@/services/appointmentService";
import { patientService } from "@/services/patientService";
import { doctorService } from "@/services/doctorService";
import { appointmentTypeService } from "@/services/appointmentTypeService";
import { Appointment, Patient, Doctor, AppointmentType } from "@/types/models";

export default function AppointmentDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clinicId, userData, branchId } = useAuthContext();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [appointmentType, setAppointmentType] =
    useState<AppointmentType | null>(null);

  // Load appointment details
  useEffect(() => {
    const loadAppointmentDetails = async () => {
      if (!id || !clinicId) return;

      setLoading(true);
      setError(null);

      try {
        // Get appointment details
        const appointmentData = await appointmentService.getAppointmentById(id);

        if (!appointmentData) {
          setError("Appointment not found");

          return;
        }

        // Check if appointment belongs to this clinic
        if (appointmentData.clinicId !== clinicId) {
          setError("Appointment not found");

          return;
        }

        // Enforce branch-level access for branch staff
        const userBranchId = branchId || userData?.branchId;

        if (
          userBranchId &&
          appointmentData.branchId &&
          appointmentData.branchId !== userBranchId
        ) {
          setError("Appointment not found");

          return;
        }

        setAppointment(appointmentData);

        // Load related data in parallel
        const [patientData, doctorData, appointmentTypeData] =
          await Promise.all([
            patientService.getPatientById(appointmentData.patientId),
            doctorService.getDoctorById(appointmentData.doctorId),
            appointmentTypeService.getAppointmentTypeById(
              appointmentData.appointmentTypeId,
            ),
          ]);

        setPatient(patientData);
        setDoctor(doctorData);
        setAppointmentType(appointmentTypeData);
      } catch (err) {
        console.error("Error loading appointment details:", err);
        setError("Failed to load appointment details. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadAppointmentDetails();
  }, [id, clinicId]);

  // Helper function to get status color
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "confirmed":
        return "success";
      case "scheduled":
        return "primary";
      case "in-progress":
        return "warning";
      case "completed":
        return "success";
      case "cancelled":
        return "danger";
      case "no-show":
        return "danger";
      default:
        return "default";
    }
  };

  // Helper function to format appointment time
  const formatAppointmentTime = () => {
    if (!appointment) return { date: "", time: "" };

    const date = format(appointment.appointmentDate, "EEEE, MMMM dd, yyyy");
    let time = "Time not set";

    if (appointment.startTime && appointment.endTime) {
      time = `${appointment.startTime} - ${appointment.endTime}`;
    } else if (appointment.startTime) {
      time = appointment.startTime;
    }

    return { date, time };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="py-12 text-center flex flex-col items-center">
        <div className="mb-3 text-red-500">
          <svg
            className="mx-auto"
            fill="none"
            height="40"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="40"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" x2="9" y1="9" y2="15" />
            <line x1="9" x2="15" y1="9" y2="15" />
          </svg>
        </div>
        <p className="text-red-600 font-medium mb-1">
          Error loading appointment
        </p>
        <p className="text-mountain-500 text-[13px]">{error}</p>
        <div className="flex gap-3 justify-center mt-4">
          <Button
            color="primary"
            variant="flat"
            onPress={() => navigate("/dashboard/appointments")}
          >
            Back to Appointments
          </Button>
          <Button color="primary" onPress={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const { date, time } = formatAppointmentTime();
  const statusColor = getStatusColor(appointment.status);

  return (
    <div className="flex flex-col gap-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className={`${title({ size: "lg" })} text-primary`}>
            Appointment Details
          </h1>
          <p className="text-mountain-500 mt-1 text-[13.5px]">
            View appointment information and history
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            startContent={
              <svg
                fill="none"
                height="18"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="18"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="m12 19-7-7 7-7" />
                <path d="M19 12H5" />
              </svg>
            }
            variant="flat"
            onPress={() => navigate("/dashboard/appointments")}
          >
            Back
          </Button>
          <Button
            color="secondary"
            startContent={
              <svg
                fill="none"
                height="18"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="18"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            onPress={() =>
              navigate(
                `/dashboard/prescriptions/new?appointmentId=${appointment.id}`,
              )
            }
          >
            Create Prescription
          </Button>
          <Link to={`/dashboard/appointments/${appointment.id}/edit`}>
            <Button
              color="primary"
              startContent={
                <svg
                  fill="none"
                  height="18"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  width="18"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
              }
            >
              Edit
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main appointment information */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="bg-mountain-50/50">
              <div className="flex items-center justify-between w-full">
                <h3 className="font-semibold text-[15px] text-mountain-900">
                  Appointment Information
                </h3>
                <Chip
                  color={
                    statusColor as
                      | "success"
                      | "primary"
                      | "warning"
                      | "danger"
                      | "default"
                      | "secondary"
                  }
                  size="md"
                  variant="flat"
                >
                  {appointment.status}
                </Chip>
              </div>
            </CardHeader>
            <Divider />
            <CardBody className="gap-6">
              {/* Date and Time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-[13px] font-medium text-mountain-700 mb-1.5">
                    Date
                  </h4>
                  <p className="text-[13.5px] text-mountain-900">{date}</p>
                </div>
                <div>
                  <h4 className="text-[13px] font-medium text-mountain-700 mb-1.5">
                    Time
                  </h4>
                  <p className="text-[13.5px] text-mountain-900">{time}</p>
                </div>
              </div>

              {/* BS Date if available */}
              {appointment.appointmentBS && (
                <div>
                  <h4 className="text-[13px] font-medium text-mountain-700 mb-1.5">
                    B.S. Date
                  </h4>
                  <p className="text-[13.5px] text-mountain-900">
                    {format(appointment.appointmentBS, "yyyy-MM-dd")}
                  </p>
                </div>
              )}

              {/* Appointment Type and Price */}
              {appointmentType && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-[13px] font-medium text-mountain-700 mb-1.5">
                      Appointment Type
                    </h4>
                    <p className="text-[13.5px] text-mountain-900">
                      {appointmentType.name}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-[13px] font-medium text-mountain-700 mb-1.5">
                      Price
                    </h4>
                    <p className="text-[13.5px] text-mountain-900">
                      NPR {appointmentType.price.toLocaleString()}
                    </p>
                  </div>
                </div>
              )}

              {/* Reason */}
              {appointment.reason && (
                <div>
                  <h4 className="text-[13px] font-medium text-mountain-700 mb-1.5">
                    Reason for Visit
                  </h4>
                  <p className="text-[13.5px] text-mountain-900">
                    {appointment.reason}
                  </p>
                </div>
              )}

              {/* Notes */}
              {appointment.notes && (
                <div>
                  <h4 className="text-[13px] font-medium text-mountain-700 mb-1.5">
                    Notes
                  </h4>
                  <p className="text-[13.5px] text-mountain-900">
                    {appointment.notes}
                  </p>
                </div>
              )}

              {/* Registration Date */}
              <div>
                <h4 className="text-[13px] font-medium text-mountain-700 mb-1.5">
                  Registration Date
                </h4>
                <p className="text-[13.5px] text-mountain-900">
                  {format(appointment.registrationDate, "MMMM dd, yyyy")}
                </p>
              </div>

              {/* Created and Updated */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-[13px] font-medium text-mountain-700 mb-1.5">
                    Created
                  </h4>
                  <p className="text-[13.5px] text-mountain-900">
                    {format(appointment.createdAt, "MMM dd, yyyy hh:mm a")}
                  </p>
                </div>
                <div>
                  <h4 className="text-[13px] font-medium text-mountain-700 mb-1.5">
                    Last Updated
                  </h4>
                  <p className="text-[13.5px] text-mountain-900">
                    {format(appointment.updatedAt, "MMM dd, yyyy hh:mm a")}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Patient and Doctor information */}
        <div className="space-y-6">
          {/* Patient Information */}
          {patient && (
            <Card>
              <CardHeader className="bg-mountain-50/50">
                <h3 className="font-semibold text-[15px] text-mountain-900">
                  Patient Information
                </h3>
              </CardHeader>
              <Divider />
              <CardBody className="gap-4">
                <div className="flex items-center gap-3">
                  <Avatar
                    color="primary"
                    name={patient.name}
                    size="lg"
                    src={patient.picture}
                  />
                  <div>
                    <h4 className="text-[14.5px] font-semibold text-mountain-900">
                      {patient.name}
                    </h4>
                    <p className="text-[12.5px] text-mountain-500">
                      Reg. No: {patient.regNumber}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <h5 className="text-[13px] font-medium text-mountain-700">
                      Age & Gender
                    </h5>
                    <p className="text-[13.5px] text-mountain-900">
                      {patient.age}, {patient.gender}
                    </p>
                  </div>

                  <div>
                    <h5 className="text-[13px] font-medium text-mountain-700">
                      Contact
                    </h5>
                    <p className="text-[13.5px] text-mountain-900">
                      {patient.mobile}
                    </p>
                    {patient.email && (
                      <p className="text-[13.5px] text-mountain-900">
                        {patient.email}
                      </p>
                    )}
                  </div>

                  <div>
                    <h5 className="text-[13px] font-medium text-mountain-700">
                      Address
                    </h5>
                    <p className="text-[13.5px] text-mountain-900">
                      {patient.address}
                    </p>
                  </div>

                  <div>
                    <h5 className="text-[13px] font-medium text-mountain-700">
                      Blood Group
                    </h5>
                    <p className="text-[13.5px] text-mountain-900">
                      {patient.bloodGroup}
                    </p>
                  </div>
                </div>

                <Divider />

                <Button
                  className="w-full"
                  color="primary"
                  size="sm"
                  variant="flat"
                >
                  <Link
                    className="w-full inline-flex justify-center"
                    to={`/dashboard/patients/${patient.id}`}
                  >
                    View Patient Profile
                  </Link>
                </Button>
              </CardBody>
            </Card>
          )}

          {/* Doctor Information */}
          {doctor && (
            <Card>
              <CardHeader className="bg-mountain-50/50">
                <h3 className="font-semibold text-[15px] text-mountain-900">
                  Doctor Information
                </h3>
              </CardHeader>
              <Divider />
              <CardBody className="gap-4">
                <div className="flex items-center gap-3">
                  <Avatar color="secondary" name={doctor.name} size="lg" />
                  <div>
                    <h4 className="text-[14.5px] font-semibold text-mountain-900">
                      Dr. {doctor.name}
                    </h4>
                    <p className="text-[12.5px] text-mountain-500">
                      {doctor.speciality}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <h5 className="text-[13px] font-medium text-mountain-700">
                      Type
                    </h5>
                    <p className="text-[13.5px] text-mountain-900 capitalize">
                      {doctor.doctorType} Doctor
                    </p>
                  </div>

                  <div>
                    <h5 className="text-[13px] font-medium text-mountain-700">
                      Contact
                    </h5>
                    <p className="text-[13.5px] text-mountain-900">
                      {doctor.phone}
                    </p>
                    {doctor.email && (
                      <p className="text-[13.5px] text-mountain-900">
                        {doctor.email}
                      </p>
                    )}
                  </div>

                  <div>
                    <h5 className="text-[13px] font-medium text-mountain-700">
                      NMC Number
                    </h5>
                    <p className="text-[13.5px] text-mountain-900">
                      {doctor.nmcNumber}
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button
              color="warning"
              startContent={
                <svg
                  fill="none"
                  height="18"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  width="18"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              }
              variant="flat"
            >
              Process Payment
            </Button>

            <Link
              to={`/dashboard/appointments/${appointment.id}/medical-records`}
            >
              <Button
                color="primary"
                startContent={
                  <svg
                    fill="none"
                    height="18"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="18"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14,2 14,8 20,8" />
                    <line x1="16" x2="8" y1="13" y2="13" />
                    <line x1="16" x2="8" y1="17" y2="17" />
                    <polyline points="10,9 9,9 8,9" />
                  </svg>
                }
                variant="flat"
              >
                Medical Records
              </Button>
            </Link>

            <Link
              to={`/dashboard/prescriptions/new?appointmentId=${appointment.id}&patientId=${appointment.patientId}&doctorId=${appointment.doctorId}`}
            >
              <Button
                color="secondary"
                startContent={<IoMedicalOutline className="w-4 h-4" />}
                variant="flat"
              >
                Create Prescription
              </Button>
            </Link>

            {appointment.status === "scheduled" && (
              <Button
                color="success"
                startContent={
                  <svg
                    fill="none"
                    height="18"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="18"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <polyline points="20,6 9,17 4,12" />
                  </svg>
                }
                variant="flat"
              >
                Confirm Appointment
              </Button>
            )}

            {(appointment.status === "scheduled" ||
              appointment.status === "confirmed") && (
              <Button
                color="danger"
                startContent={
                  <svg
                    fill="none"
                    height="18"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    width="18"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" x2="9" y1="9" y2="15" />
                    <line x1="9" x2="15" y1="9" y2="15" />
                  </svg>
                }
                variant="flat"
              >
                Cancel Appointment
              </Button>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
