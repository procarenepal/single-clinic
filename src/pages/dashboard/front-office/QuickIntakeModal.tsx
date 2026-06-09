import React from "react";
import { createPortal } from "react-dom";
import { IoCloseOutline, IoSearchOutline } from "react-icons/io5";
import { useNavigate } from "react-router-dom";

import { Spinner } from "@/components/ui";

export interface QuickIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  quickIntakeSaving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  intakeMode: "new" | "existing";
  setIntakeMode: (mode: "new" | "existing") => void;
  selectedExistingPatient: any;
  setSelectedExistingPatient: (patient: any) => void;
  patientSearchQuery: string;
  setPatientSearchQuery: (query: string) => void;
  quickIntakeForm: any;
  setQuickIntakeForm: React.Dispatch<React.SetStateAction<any>>;
  mobileStatus: "idle" | "checking" | "duplicate" | "clear";
  appointmentTypes: any[];
  packages: any[];
  isSearchDropdownOpen: boolean;
  setIsSearchDropdownOpen: (isOpen: boolean) => void;
  patients: any[];
  doctors: any[];
  experts: any[];
  staff: any[];
  referralPartners: any[];
  activePatientPackages: any[];
  addReferrerRow: () => void;
  updateReferrerRow: (index: number, key: string, value: any) => void;
  removeReferrerRow: (index: number) => void;
}

export const QuickIntakeModal: React.FC<QuickIntakeModalProps> = ({
  isOpen,
  onClose,
  quickIntakeSaving,
  onSubmit,
  intakeMode,
  setIntakeMode,
  selectedExistingPatient,
  setSelectedExistingPatient,
  patientSearchQuery,
  setPatientSearchQuery,
  quickIntakeForm,
  setQuickIntakeForm,
  mobileStatus,
  appointmentTypes,
  packages,
  isSearchDropdownOpen,
  setIsSearchDropdownOpen,
  patients,
  doctors,
  experts,
  staff,
  referralPartners,
  activePatientPackages,
  addReferrerRow,
  updateReferrerRow,
  removeReferrerRow,
}) => {
  if (!isOpen) return null;
  const setIsQuickIntakeOpen = (open: boolean) => {
    if (!open) onClose();
  };
  const handleQuickIntakeSubmit = onSubmit;
  const navigate = useNavigate();

  const modalRoot = document.body;

  return createPortal(
    <>
      {/* Fixed backdrop — covers full viewport independently */}
      <div
        className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm"
        onClick={() => setIsQuickIntakeOpen(false)}
      />

      {/* Scroll container — sits over backdrop */}
      <div className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center overflow-y-auto p-3 sm:p-4 pointer-events-none">
        <div className="bg-surface rounded border border-border-base shadow-2xl w-full max-w-6xl relative my-auto pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
          <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-border-base bg-surface-2 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-[14px] sm:text-[14.5px] text-text-main">
                📋 Quick Walk-In Registration
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                Register & Check-in walk-in patient instantly.
              </p>
            </div>
            <button
              className="text-text-muted hover:text-text-main p-1"
              onClick={() => setIsQuickIntakeOpen(false)}
            >
              <IoCloseOutline className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleQuickIntakeSubmit}>
            <div className="p-4 sm:p-5 max-h-[calc(100vh-10rem)] overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Left Column: Demographics & Intake Details */}
                <div className="space-y-4">
                  {/* Intake Mode Switcher */}
                  <div className="flex bg-surface-2 p-1 rounded-lg border border-border-base w-full mb-2">
                    <button
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                        intakeMode === "new"
                          ? "bg-primary text-white shadow-sm"
                          : "text-text-muted hover:text-text-main"
                      }`}
                      type="button"
                      onClick={() => {
                        setIntakeMode("new");
                        setSelectedExistingPatient(null);
                        setPatientSearchQuery("");
                      }}
                    >
                      New Patient Walk-in
                    </button>
                    <button
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
                        intakeMode === "existing"
                          ? "bg-primary text-white shadow-sm"
                          : "text-text-muted hover:text-text-main"
                      }`}
                      type="button"
                      onClick={() => {
                        setIntakeMode("existing");
                      }}
                    >
                      Search Existing Patient
                    </button>
                  </div>

                  <h4 className="text-[12px] font-bold text-primary uppercase tracking-wider border-b border-border-base pb-1">
                    {intakeMode === "new"
                      ? "New Patient Profile & Consultation"
                      : "Select Patient & Consultation"}
                  </h4>

                  {intakeMode === "new" ? (
                    <>
                      {/* Full Name */}
                      <div>
                        <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                          Patient Full Name{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <input
                          required
                          className="w-full h-9 px-3 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors"
                          placeholder="e.g. John Doe"
                          type="text"
                          value={quickIntakeForm.name}
                          onChange={(e) =>
                            setQuickIntakeForm((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                        />
                      </div>

                      {/* Mobile & Age */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                            Mobile Number{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              required
                              className={`w-full h-9 px-3 pr-8 text-[13px] border ${mobileStatus === "duplicate" ? "border-error focus:border-error focus:ring-1 focus:ring-error/20" : "border-border-base focus:border-primary focus:ring-1 focus:ring-primary/20"} rounded outline-none bg-surface text-text-main transition-colors`}
                              placeholder="e.g. 98XXXXXXXX"
                              type="tel"
                              value={quickIntakeForm.mobile}
                              onChange={(e) =>
                                setQuickIntakeForm((prev) => ({
                                  ...prev,
                                  mobile: e.target.value,
                                }))
                              }
                            />
                            {mobileStatus === "checking" && (
                              <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                                <Spinner size="xs" />
                              </div>
                            )}
                          </div>
                          {mobileStatus === "duplicate" && (
                            <p className="text-[10.5px] text-error font-medium mt-1">
                              ⚠️ Patient with this mobile exists.
                            </p>
                          )}
                          {mobileStatus === "clear" && (
                            <p className="text-[10.5px] text-health-600 font-medium mt-1">
                              ✓ Number available.
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                            Age <span className="text-red-500">*</span>
                          </label>
                          <input
                            required
                            className="w-full h-9 px-3 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors"
                            placeholder="e.g. 28 or 10 Months"
                            type="text"
                            value={quickIntakeForm.age}
                            onChange={(e) =>
                              setQuickIntakeForm((prev) => ({
                                ...prev,
                                age: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>

                      {/* Gender, Appointment Category & Date */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                            Gender
                          </label>
                          <select
                            className="w-full h-9 pl-3 pr-8 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors truncate"
                            value={quickIntakeForm.gender}
                            onChange={(e) =>
                              setQuickIntakeForm((prev) => ({
                                ...prev,
                                gender: e.target.value,
                              }))
                            }
                          >
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                            Appointment Date
                          </label>
                          <input
                            required
                            className="w-full h-9 px-3 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors"
                            type="date"
                            value={quickIntakeForm.appointmentDate}
                            onChange={(e) =>
                              setQuickIntakeForm((prev) => ({
                                ...prev,
                                appointmentDate: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                            Appointment Category
                          </label>
                          <select
                            className="w-full h-9 pl-3 pr-8 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors truncate"
                            value={quickIntakeForm.appointmentTypeId}
                            onChange={(e) =>
                              setQuickIntakeForm((prev) => ({
                                ...prev,
                                appointmentTypeId: e.target.value,
                              }))
                            }
                          >
                            <optgroup label="Appointments">
                              {appointmentTypes.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                            </optgroup>
                            {packages.length > 0 && (
                              <optgroup label="Treatment Packages">
                                {packages.map((pkg) => (
                                  <option
                                    key={`pkg_${pkg.id}`}
                                    value={`pkg_${pkg.id}`}
                                  >
                                    📦 {pkg.name} (NPR{" "}
                                    {pkg.price.toLocaleString()})
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Existing Patient Search Panel */}
                      <div className="space-y-4">
                        {!selectedExistingPatient ? (
                          <div className="relative">
                            <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                              🔍 Search Existing Patient
                            </label>
                            <div className="relative flex items-center border border-border-base rounded-[10px] min-h-[38px] bg-surface focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20">
                              <IoSearchOutline className="ml-3 w-4 h-4 text-text-muted/70 shrink-0" />
                              <input
                                className="flex-1 w-full text-[13.5px] px-2 py-1.5 bg-transparent outline-none text-text-main placeholder:text-text-muted/70"
                                placeholder="Search by name, Reg # or mobile number..."
                                type="text"
                                value={patientSearchQuery}
                                onChange={(e) => {
                                  setPatientSearchQuery(e.target.value);
                                  setIsSearchDropdownOpen(true);
                                }}
                                onFocus={() => setIsSearchDropdownOpen(true)}
                              />
                              {patientSearchQuery && (
                                <button
                                  className="mr-3 text-text-muted hover:text-text-main"
                                  type="button"
                                  onClick={() => setPatientSearchQuery("")}
                                >
                                  <IoCloseOutline className="w-4 h-4" />
                                </button>
                              )}
                            </div>

                            {/* Search Results Dropdown */}
                            {isSearchDropdownOpen &&
                              patientSearchQuery.trim().length > 0 && (
                                <>
                                  <div
                                    className="fixed inset-0 z-[10]"
                                    onClick={() =>
                                      setIsSearchDropdownOpen(false)
                                    }
                                  />
                                  <div className="absolute left-0 right-0 mt-1 bg-surface border border-border-base rounded-lg shadow-xl max-h-60 overflow-y-auto z-[20] pr-1">
                                    {(() => {
                                      const query =
                                        patientSearchQuery.toLowerCase();
                                      const filteredPatients = patients.filter(
                                        (p) =>
                                          p.name
                                            .toLowerCase()
                                            .includes(query) ||
                                          (p.regNumber &&
                                            p.regNumber
                                              .toLowerCase()
                                              .includes(query)) ||
                                          p.mobile.includes(query),
                                      );

                                      if (filteredPatients.length === 0) {
                                        return (
                                          <div className="p-4 text-center text-xs text-text-muted">
                                            No matching patients found.
                                          </div>
                                        );
                                      }

                                      return filteredPatients.map((p) => (
                                        <button
                                          key={p.id}
                                          className="w-full text-left px-4 py-2.5 hover:bg-primary/5 border-b border-border-base/30 last:border-0 flex items-center justify-between transition-colors"
                                          type="button"
                                          onClick={() => {
                                            setSelectedExistingPatient(p);
                                            setIsSearchDropdownOpen(false);
                                            // Auto-fill physician or referrals if they exist on the patient
                                            setQuickIntakeForm((prev) => {
                                              const updated = { ...prev };

                                              if (
                                                p.doctorId &&
                                                p.doctorId !== "unassigned"
                                              ) {
                                                updated.doctorId = p.doctorId;
                                              }
                                              if (p.assignedExpertId) {
                                                updated.assignedExpertId =
                                                  p.assignedExpertId;
                                              }
                                              if (
                                                p.referrals &&
                                                p.referrals.length > 0
                                              ) {
                                                updated.referrals = p.referrals;
                                              }

                                              return updated;
                                            });
                                          }}
                                        >
                                          <div>
                                            <p className="text-[13px] font-bold text-text-main leading-tight font-sans">
                                              {p.name}
                                            </p>
                                            <p className="text-[11px] text-text-muted mt-0.5 leading-tight font-sans">
                                              Reg #: {p.regNumber || "N/A"} •
                                              Mob: {p.mobile}
                                            </p>
                                          </div>
                                          <span className="text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded uppercase">
                                            Select
                                          </span>
                                        </button>
                                      ));
                                    })()}
                                  </div>
                                </>
                              )}
                          </div>
                        ) : (
                          /* Selected Patient Preview Card */
                          <div className="bg-surface-2/60 border border-border-base rounded-xl p-4 flex flex-col gap-3.5 relative shadow-sm animate-in fade-in zoom-in-95 duration-150">
                            <div className="flex items-center gap-3.5">
                              <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-base font-bold shrink-0 shadow-sm">
                                {selectedExistingPatient.name
                                  .substring(0, 2)
                                  .toUpperCase()}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-[14.5px] font-extrabold text-text-main leading-none">
                                    {selectedExistingPatient.name}
                                  </p>
                                  {selectedExistingPatient.isCritical && (
                                    <span className="text-[9px] font-bold bg-red-500/10 text-red-600 border border-red-500/20 px-1 py-0.5 rounded leading-none">
                                      CRITICAL
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11.5px] text-text-muted mt-1.5 font-medium leading-none">
                                  Reg #:{" "}
                                  <span className="text-primary font-bold">
                                    {selectedExistingPatient.regNumber || "N/A"}
                                  </span>
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border-base/50 pt-3 text-[12px]">
                              <div>
                                <span className="text-text-muted block text-[10px] uppercase font-bold tracking-wider">
                                  Mobile Number
                                </span>
                                <span className="text-text-main font-semibold mt-0.5 block">
                                  {selectedExistingPatient.mobile}
                                </span>
                              </div>
                              <div>
                                <span className="text-text-muted block text-[10px] uppercase font-bold tracking-wider">
                                  Age / Gender
                                </span>
                                <span className="text-text-main font-semibold mt-0.5 block">
                                  {selectedExistingPatient.age || "—"} /{" "}
                                  {selectedExistingPatient.gender || "—"}
                                </span>
                              </div>
                            </div>

                            <button
                              className="w-full mt-1.5 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 text-[11.5px] font-bold transition-all shadow-none flex items-center justify-center gap-1"
                              type="button"
                              onClick={() => {
                                setSelectedExistingPatient(null);
                                setPatientSearchQuery("");
                              }}
                            >
                              <IoCloseOutline className="w-4 h-4" /> Reset &
                              Search Another Patient
                            </button>
                          </div>
                        )}

                        {/* Appointment Date & Category for Existing Patient */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                              Appointment Date
                            </label>
                            <input
                              required
                              className="w-full h-9 px-3 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors"
                              type="date"
                              value={quickIntakeForm.appointmentDate}
                              onChange={(e) =>
                                setQuickIntakeForm((prev) => ({
                                  ...prev,
                                  appointmentDate: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div>
                            <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                              Appointment Category
                            </label>
                            <select
                              className="w-full h-9 pl-3 pr-8 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors truncate"
                              value={quickIntakeForm.appointmentTypeId}
                              onChange={(e) =>
                                setQuickIntakeForm((prev) => ({
                                  ...prev,
                                  appointmentTypeId: e.target.value,
                                }))
                              }
                            >
                              <optgroup label="Appointments">
                                {appointmentTypes.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                  </option>
                                ))}
                              </optgroup>
                              {activePatientPackages.length > 0 && (
                                <optgroup label="Active Packages (Consume Session)">
                                  {activePatientPackages.map((pkg) => (
                                    <option
                                      key={`consume_${pkg.id}`}
                                      value={`consume_pkg_${pkg.id}`}
                                    >
                                      ⭐ Consume Session: {pkg.packageName} (
                                      {pkg.usedSessions}/{pkg.totalSessions}{" "}
                                      used)
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              {packages.length > 0 && (
                                <optgroup label="Treatment Packages">
                                  {packages.map((pkg) => (
                                    <option
                                      key={`pkg_${pkg.id}`}
                                      value={`pkg_${pkg.id}`}
                                    >
                                      📦 {pkg.name} (NPR{" "}
                                      {pkg.price.toLocaleString()})
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Assigned Doctor & Assigned Expert */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                        Assigned Doctor (Internal)
                      </label>
                      <select
                        className="w-full h-9 pl-3 pr-8 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors truncate"
                        value={quickIntakeForm.doctorId}
                        onChange={(e) =>
                          setQuickIntakeForm((prev) => ({
                            ...prev,
                            doctorId: e.target.value,
                          }))
                        }
                      >
                        <option value="">None / Unassigned</option>
                        {doctors.map((d) => (
                          <option key={d.id} value={d.id}>
                            Dr. {d.name} ({d.speciality || "GP"})
                          </option>
                        ))}
                      </select>
                      {quickIntakeForm.doctorId &&
                        quickIntakeForm.doctorId !== "unassigned" && (
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              checked={quickIntakeForm.generateConsultationBill}
                              className="w-3.5 h-3.5 rounded border-border-base text-primary focus:ring-primary cursor-pointer"
                              id="generateConsultationBill"
                              type="checkbox"
                              onChange={(e) =>
                                setQuickIntakeForm((prev) => ({
                                  ...prev,
                                  generateConsultationBill: e.target.checked,
                                }))
                              }
                            />
                            <label
                              className="text-[11px] text-text-muted font-medium cursor-pointer select-none"
                              htmlFor="generateConsultationBill"
                            >
                              Charge Consultation Fee
                            </label>

                            <input
                              checked={quickIntakeForm.addDoctorCommission}
                              className="w-3.5 h-3.5 rounded border-border-base text-primary focus:ring-primary cursor-pointer ml-3"
                              id="addClinicianCommissionDoc"
                              type="checkbox"
                              onChange={(e) =>
                                setQuickIntakeForm((prev) => ({
                                  ...prev,
                                  addDoctorCommission: e.target.checked,
                                }))
                              }
                            />
                            <label
                              className="text-[11px] text-text-muted font-medium cursor-pointer select-none"
                              htmlFor="addClinicianCommissionDoc"
                            >
                              Add commission
                            </label>
                          </div>
                        )}
                    </div>
                    <div>
                      <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                        Assigned Expert (External)
                      </label>
                      <select
                        className="w-full h-9 pl-3 pr-8 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors truncate"
                        value={quickIntakeForm.assignedExpertId}
                        onChange={(e) =>
                          setQuickIntakeForm((prev) => ({
                            ...prev,
                            assignedExpertId: e.target.value,
                          }))
                        }
                      >
                        <option value="">None / Unassigned</option>
                        {experts.map((exp) => (
                          <option key={exp.id} value={exp.id}>
                            {exp.name} ({exp.speciality || "Consultant"})
                          </option>
                        ))}
                      </select>
                      {quickIntakeForm.assignedExpertId &&
                        quickIntakeForm.assignedExpertId !== "unassigned" && (
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              checked={quickIntakeForm.addExpertCommission}
                              className="w-3.5 h-3.5 rounded border-border-base text-primary focus:ring-primary cursor-pointer"
                              id="addClinicianCommissionExp"
                              type="checkbox"
                              onChange={(e) =>
                                setQuickIntakeForm((prev) => ({
                                  ...prev,
                                  addExpertCommission: e.target.checked,
                                }))
                              }
                            />
                            <label
                              className="text-[11px] text-text-muted font-medium cursor-pointer select-none"
                              htmlFor="addClinicianCommissionExp"
                            >
                              Add commission
                            </label>
                          </div>
                        )}
                    </div>
                  </div>

                  {/* Payment details for Package Sales */}
                  {quickIntakeForm.appointmentTypeId.startsWith("pkg_") && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                        <div>
                          <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                            Payment Method
                          </label>
                          <select
                            className="w-full h-9 pl-3 pr-8 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors truncate"
                            value={quickIntakeForm.paymentMethod}
                            onChange={(e) =>
                              setQuickIntakeForm((prev) => ({
                                ...prev,
                                paymentMethod: e.target.value,
                              }))
                            }
                          >
                            <option value="cash">Cash</option>
                            <option value="card">Card</option>
                            <option value="esewa">eSewa</option>
                            <option value="khalti">Khalti</option>
                            <option value="bank_transfer">Bank Transfer</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                            Payment Reference (Optional)
                          </label>
                          <input
                            className="w-full h-9 px-3 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors"
                            placeholder="e.g. Trx ID"
                            type="text"
                            value={quickIntakeForm.paymentReference}
                            onChange={(e) =>
                              setQuickIntakeForm((prev) => ({
                                ...prev,
                                paymentReference: e.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>

                      {/* Checkbox for package sale: start session instantly */}
                      <div className="mt-3 flex items-center gap-2 p-2 bg-primary/5 rounded border border-primary/10">
                        <input
                          checked={quickIntakeForm.startSessionInstantly}
                          className="w-4 h-4 rounded border-border-base text-primary focus:ring-primary cursor-pointer"
                          id="intakeStartSession"
                          type="checkbox"
                          onChange={(e) =>
                            setQuickIntakeForm((prev) => ({
                              ...prev,
                              startSessionInstantly: e.target.checked,
                            }))
                          }
                        />
                        <label
                          className="text-[12px] font-medium text-text-main cursor-pointer select-none"
                          htmlFor="intakeStartSession"
                        >
                          Start first session instantly (Add to Lobby Queue)
                        </label>
                      </div>
                    </>
                  )}

                  {/* Complaints / Reason */}
                  <div>
                    <label className="block text-[11.5px] font-semibold text-text-muted mb-1.5">
                      Chief Complaints / Reason for Visit
                    </label>
                    <textarea
                      className="w-full min-h-16 px-3 py-2 text-[13px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors resize-none"
                      placeholder="e.g. fever since yesterday, follow-up consult..."
                      value={quickIntakeForm.reason}
                      onChange={(e) =>
                        setQuickIntakeForm((prev) => ({
                          ...prev,
                          reason: e.target.value,
                        }))
                      }
                    />
                  </div>

                  {/* Checkbox for bypass workflow */}
                  {quickIntakeForm.appointmentTypeId.startsWith(
                    "consume_pkg_",
                  ) && (
                    <div className="mt-3 flex items-center gap-2 p-2 bg-indigo-500/10 rounded border border-indigo-500/20">
                      <input
                        checked={quickIntakeForm.sendDirectlyToCabin}
                        className="w-4 h-4 rounded border-border-base text-indigo-500 focus:ring-indigo-500 cursor-pointer"
                        id="intakeSendDirect"
                        type="checkbox"
                        onChange={(e) =>
                          setQuickIntakeForm((prev) => ({
                            ...prev,
                            sendDirectlyToCabin: e.target.checked,
                          }))
                        }
                      />
                      <label
                        className="text-[12px] font-medium text-text-main cursor-pointer select-none"
                        htmlFor="intakeSendDirect"
                      >
                        Skip Lobby/Triage (Send directly to Doctor or Expert
                        Cabin)
                      </label>
                    </div>
                  )}
                </div>

                {/* Right Column: Polymorphic Referrals Panel */}
                <div className="space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <h4 className="text-[12px] font-bold text-primary uppercase tracking-wider border-b border-border-base pb-1">
                      Referral Sources & Commissions
                    </h4>

                    <div className="border border-border-base rounded p-3 bg-surface-2/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="block text-[11.5px] font-bold text-text-main">
                            Referral Sources & Commission Splits
                          </label>
                          <p className="text-[10px] text-text-muted">
                            Associate this patient check-in with one or more
                            referrers.
                          </p>
                        </div>
                        <button
                          className="px-2.5 py-1 text-[11px] font-bold text-primary border border-primary/20 hover:border-primary bg-primary/5 hover:bg-primary/10 rounded transition-colors"
                          type="button"
                          onClick={addReferrerRow}
                        >
                          ➕ Add Referrer
                        </button>
                      </div>

                      {quickIntakeForm.referrals.length === 0 ? (
                        <div className="py-4 text-center text-[11.5px] text-text-muted bg-surface/50 border border-dashed border-border-base rounded">
                          No active referrals added (Patient is a Direct
                          Walk-in).
                        </div>
                      ) : (
                        <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                          {quickIntakeForm.referrals.map((ref, idx) => (
                            <div
                              key={idx}
                              className="flex flex-col gap-2 bg-surface p-2 border border-border-base rounded shadow-none relative"
                            >
                              <div className="flex items-center gap-2">
                                <div className="grid grid-cols-12 gap-2 flex-1">
                                  {/* Referrer Type Dropdown */}
                                  <div className="col-span-4">
                                    <label className="block text-[9px] font-semibold text-text-muted mb-0.5">
                                      Type
                                    </label>
                                    <select
                                      className="w-full h-8 pl-2 pr-6 text-[11px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors truncate"
                                      value={ref.type}
                                      onChange={(e) =>
                                        updateReferrerRow(
                                          idx,
                                          "type",
                                          e.target.value,
                                        )
                                      }
                                    >
                                      <option value="referral-partner">
                                        External Partner
                                      </option>
                                      <option value="doctor">
                                        Internal Doctor
                                      </option>
                                      <option value="expert">
                                        External Expert
                                      </option>
                                      <option value="staff">
                                        Internal Staff
                                      </option>
                                    </select>
                                  </div>

                                  {/* Referrer Name Dropdown */}
                                  <div className="col-span-5">
                                    <label className="block text-[9px] font-semibold text-text-muted mb-0.5">
                                      Name
                                    </label>
                                    <select
                                      className="w-full h-8 pl-2 pr-6 text-[11px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors truncate"
                                      value={ref.id}
                                      onChange={(e) =>
                                        updateReferrerRow(
                                          idx,
                                          "id",
                                          e.target.value,
                                        )
                                      }
                                    >
                                      {ref.type === "referral-partner" && (
                                        <>
                                          <option value="">
                                            -- Choose Partner --
                                          </option>
                                          {referralPartners.map((rp) => (
                                            <option key={rp.id} value={rp.id}>
                                              {rp.name}
                                            </option>
                                          ))}
                                        </>
                                      )}
                                      {ref.type === "doctor" && (
                                        <>
                                          <option value="">
                                            -- Choose Doctor --
                                          </option>
                                          {doctors.map((d) => (
                                            <option key={d.id} value={d.id}>
                                              Dr. {d.name}
                                            </option>
                                          ))}
                                        </>
                                      )}
                                      {ref.type === "expert" && (
                                        <>
                                          <option value="">
                                            -- Choose Expert --
                                          </option>
                                          {experts.map((exp) => (
                                            <option key={exp.id} value={exp.id}>
                                              {exp.name}
                                            </option>
                                          ))}
                                        </>
                                      )}
                                      {ref.type === "staff" && (
                                        <>
                                          <option value="">
                                            -- Choose Staff --
                                          </option>
                                          {staff.map((s) => (
                                            <option key={s.id} value={s.id}>
                                              {s.name}
                                            </option>
                                          ))}
                                        </>
                                      )}
                                    </select>
                                  </div>

                                  {/* Commission split percentage */}
                                  <div className="col-span-3">
                                    <label className="block text-[9px] font-semibold text-text-muted mb-0.5">
                                      Split %
                                    </label>
                                    <input
                                      className="w-full h-8 px-1 text-[11px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors text-right"
                                      max="100"
                                      min="0"
                                      type="number"
                                      value={ref.commissionPercentage}
                                      onChange={(e) =>
                                        updateReferrerRow(
                                          idx,
                                          "commissionPercentage",
                                          e.target.value,
                                        )
                                      }
                                    />
                                  </div>
                                </div>

                                {/* Action delete button */}
                                <button
                                  className="h-8 w-8 rounded border border-border-base text-red-500 hover:bg-red-500/5 flex items-center justify-center transition-colors shrink-0 mt-3"
                                  title="Remove referrer"
                                  type="button"
                                  onClick={() => removeReferrerRow(idx)}
                                >
                                  &times;
                                </button>
                              </div>

                              {/* Partner sub-row: Specific referred by doctor/expert */}
                              {ref.type === "referral-partner" && (
                                <div className="border-t border-border-base/50 pt-2 mt-1 grid grid-cols-12 gap-2 items-center">
                                  <div className="col-span-5">
                                    <span className="text-[9.5px] font-bold text-text-muted">
                                      Referred By (Doc/Expert):
                                    </span>
                                  </div>
                                  <div className="col-span-7">
                                    <select
                                      className="w-full h-8 pl-2 pr-6 text-[11px] border border-border-base rounded outline-none focus:border-primary bg-surface text-text-main transition-colors truncate"
                                      value={ref.referredById || ""}
                                      onChange={(e) =>
                                        updateReferrerRow(
                                          idx,
                                          "referredById",
                                          e.target.value,
                                        )
                                      }
                                    >
                                      <option value="">
                                        -- Optional Referring Person --
                                      </option>
                                      <optgroup label="Internal Doctors">
                                        {doctors.map((d) => (
                                          <option key={d.id} value={d.id}>
                                            Dr. {d.name} ({d.speciality || "GP"}
                                            )
                                          </option>
                                        ))}
                                      </optgroup>
                                      <optgroup label="External Experts">
                                        {experts.map((exp) => (
                                          <option key={exp.id} value={exp.id}>
                                            {exp.name}
                                          </option>
                                        ))}
                                      </optgroup>
                                    </select>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Smart CTA Redirect link */}
                  <div className="p-3 bg-primary/5 rounded border border-primary/10 text-center">
                    <p className="text-[11px] text-text-muted">
                      Need to record Insurance, full family history, or payment
                      details?
                    </p>
                    <button
                      className="text-[11px] font-semibold text-primary hover:underline mt-1"
                      type="button"
                      onClick={() => {
                        setIsQuickIntakeOpen(false);
                        navigate("/dashboard/patients/new");
                      }}
                    >
                      Go to Full Patient Registration Page &rarr;
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-4 sm:px-5 py-3 border-t border-border-base bg-surface-2 flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 rounded-b-lg">
              <button
                className="h-9 px-4 rounded border border-border-base text-[12.5px] font-medium text-text-muted hover:bg-surface-3 transition-colors w-full sm:w-auto"
                type="button"
                onClick={() => setIsQuickIntakeOpen(false)}
              >
                Cancel
              </button>
              <button
                className="h-9 px-4 rounded bg-primary text-white text-[12.5px] font-medium hover:bg-primary/95 flex items-center justify-center gap-1.5 disabled:opacity-50 transition-colors w-full sm:w-auto"
                disabled={quickIntakeSaving}
                type="submit"
              >
                {quickIntakeSaving ? "Checking In..." : "Complete Check-In"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>,
    modalRoot,
  );
};
