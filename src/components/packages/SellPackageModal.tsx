import { useState, useEffect } from "react";

import {
  Button,
  Input,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui";
import { Autocomplete, AutocompleteItem } from "@/components/ui/autocomplete";
import {
  AppointmentBillingSettings,
  Doctor,
  Expert,
  Patient,
  TreatmentPackage,
} from "@/types/models";
import { packageService } from "@/services/packageService";
import { appointmentBillingService } from "@/services/appointmentBillingService";
import { walletService } from "@/services/walletService";
import { patientService } from "@/services/patientService";
import { patientPackageService } from "@/services/patientPackageService";
import { appointmentService } from "@/services/appointmentService";
import { ensureSessionLine } from "@/services/visitLineService";
import { addToast } from "@/components/ui/toast";
import { useAuthContext } from "@/context/AuthContext";
import { usePaymentIdempotencyKey } from "@/hooks/usePaymentIdempotencyKey";

interface SellPackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
  doctors: Doctor[];
  experts: Expert[];
}

export default function SellPackageModal({
  isOpen,
  onClose,
  patients,
  doctors,
  experts,
}: SellPackageModalProps) {
  const { clinicId, currentUser } = useAuthContext();
  const [packages, setPackages] = useState<TreatmentPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [billingSettings, setBillingSettings] =
    useState<AppointmentBillingSettings | null>(null);

  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startSessionInstantly, setStartSessionInstantly] = useState(false);
  // "doctor:<id>" or "expert:<id>" — who performs the first session when
  // starting it instantly. There was previously no way to set this at all;
  // the session visit was created with doctorId "unassigned" and Settle
  // later refused it with "No clinician is on this visit".
  const [sessionClinicianKey, setSessionClinicianKey] = useState("");

  // New vs Existing mode
  const [saleMode, setSaleMode] = useState<"existing" | "new">("existing");
  const [newPatientForm, setNewPatientForm] = useState({
    name: "",
    mobile: "",
    patientPanVat: "",
    age: "",
    gender: "male",
  });

  useEffect(() => {
    if (isOpen && clinicId) {
      loadPackages();
    }
  }, [isOpen, clinicId]);

  // The modal stays mounted between opens (the parent never unmounts it),
  // so without this its form silently carries over whatever was left from
  // the previous sale — including "Apply Tax" — into the next one.
  const paymentKey = usePaymentIdempotencyKey();

  useEffect(() => {
    if (isOpen) {
      paymentKey.reset();
      setSelectedPatientId("");
      setSelectedPackageId("");
      setPaymentMethod("cash");
      setReference("");
      setNotes("");
      setStartSessionInstantly(false);
      setSessionClinicianKey("");
      setSaleMode("existing");
      setNewPatientForm({
        name: "",
        mobile: "",
        patientPanVat: "",
        age: "",
        gender: "male",
      });
    }
  }, [isOpen]);

  const loadPackages = async () => {
    try {
      setLoadingPackages(true);
      const [data, settings] = await Promise.all([
        packageService.getPackagesByClinic(clinicId!),
        appointmentBillingService.getBillingSettings(clinicId!).catch(() => null),
      ]);

      setPackages(data);
      setBillingSettings(settings);
    } catch (error) {
      console.error("Error loading packages:", error);
    } finally {
      setLoadingPackages(false);
    }
  };

  const handleSellPackage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (saleMode === "new") {
      if (
        !newPatientForm.name ||
        !newPatientForm.mobile ||
        !newPatientForm.age
      ) {
        addToast({
          title: "Validation Error",
          description: "Please fill in all new patient fields.",
          color: "warning",
        });

        return;
      }
    } else {
      if (!selectedPatientId) {
        addToast({
          title: "Validation Error",
          description: "Please select an existing patient.",
          color: "warning",
        });

        return;
      }
    }

    if (!selectedPackageId) {
      addToast({
        title: "Validation Error",
        description: "Please select a package.",
        color: "warning",
      });

      return;
    }

    const pkg = packages.find((p) => p.id === selectedPackageId);

    if (!pkg || !clinicId || !currentUser) return;

    let sessionClinician: {
      id: string;
      name: string;
      kind: "doctor" | "expert";
    } | null = null;

    if (startSessionInstantly) {
      const [kind, id] = sessionClinicianKey.split(":") as [
        "doctor" | "expert" | undefined,
        string | undefined,
      ];
      const person =
        kind === "doctor"
          ? doctors.find((d) => d.id === id)
          : kind === "expert"
            ? experts.find((e) => e.id === id)
            : undefined;

      if (!person) {
        addToast({
          title: "Clinician Required",
          description:
            "Select who performs the first session before starting it instantly.",
          color: "warning",
        });

        return;
      }
      sessionClinician = { id: person.id, name: person.name, kind };
    }

    try {
      setIsSubmitting(true);

      let finalPatientId = selectedPatientId;
      let finalPatientName = "";
      let finalPatientPanVat: string | undefined;

      if (saleMode === "new") {
        // Create patient first
        const nextReg =
          await patientService.getNextRegistrationNumber(clinicId);

        finalPatientId = await patientService.createPatient({
          name: newPatientForm.name.trim(),
          mobile: newPatientForm.mobile.trim(),
          patientPanVat: newPatientForm.patientPanVat.trim() || undefined,
          age: newPatientForm.age.trim(),
          gender: newPatientForm.gender as "male" | "female" | "other",
          regNumber: nextReg,
          address: "Clinic Walk-in",
          clinicId: clinicId,
          branchId: clinicId,
        });
        finalPatientName = newPatientForm.name.trim();
        finalPatientPanVat = newPatientForm.patientPanVat.trim() || undefined;
      } else {
        const pat = patients.find((p) => p.id === selectedPatientId);

        if (!pat) throw new Error("Patient not found");
        finalPatientName = pat.name;
        finalPatientPanVat = pat.patientPanVat;
      }

      // 2. Create the Billing record. Tax comes from the package's own
      // flag (Settings › Packages), gated by the clinic's master switch —
      // not a per-sale checkbox staff had to remember to tick, which
      // previously let the identical package sell with or without VAT
      // depending on who was at the desk.
      const billingData = appointmentBillingService.buildPackageSaleBillingData({
        pkg,
        clinicId,
        patientId: finalPatientId,
        patientName: finalPatientName,
        patientPanVat: finalPatientPanVat,
        applyTax: pkg.isTaxable === true && Boolean(billingSettings?.enableTax),
        defaultTaxPercentage: billingSettings?.defaultTaxPercentage,
        createdBy: currentUser.uid,
        // Identity for this one sale attempt — the same value also used as
        // recordPayment's idempotencyKey below, so a genuine retry (the
        // modal stays open, "Sell" clicked again after a dropped response)
        // reuses both: createBilling's own (clinicId, idempotencyKey)
        // uniqueness returns the SAME invoice instead of minting a second
        // one, and recordPayment then sees that invoice already paid. Only
        // reset when the modal reopens (see the isOpen effect above), so
        // two deliberately separate sales still get distinct ids.
        saleId: paymentKey.next(),
      });

      const { id: billingId } =
        await appointmentBillingService.createBilling(billingData);

      // 3. Record Payment for the invoice's actual total — VAT included
      // when the package is taxable. Paying the bare pkg.price left every
      // taxable sale "partial" by exactly the VAT despite the patient
      // having paid in full at the desk.
      if (billingData.totalAmount > 0) {
        await appointmentBillingService.recordPayment(
          billingId,
          billingData.totalAmount,
          paymentMethod,
          reference,
          notes || `Purchased ${pkg.name}`,
          0,
          { idempotencyKey: paymentKey.next() },
        );
      }

      // 4. Add Funds to Wallet
      if (pkg.walletCreditAmount > 0) {
        await walletService.addFunds(
          finalPatientId,
          clinicId,
          pkg.walletCreditAmount,
          paymentMethod,
          `Package Credit: ${pkg.name}`,
          currentUser.uid,
          // Tagged to the sale's own invoice — see the identical fix and
          // reasoning in front-office-desk.tsx's Quick Intake package sale.
          // Without this the Daily Report counted this money twice: once
          // as the invoice's own payment, once as this "deposit".
          billingId,
          "package",
        );
      }

      // 5. Create visual session tracker if it has total sessions
      let patientPkgId: string | undefined = undefined;

      if (pkg.totalSessions && pkg.totalSessions > 0) {
        let expiresAt: Date | undefined = undefined;

        if (pkg.validityDays && pkg.validityDays > 0) {
          const expirationDate = new Date();

          expirationDate.setDate(expirationDate.getDate() + pkg.validityDays);
          expiresAt = expirationDate;
        }

        patientPkgId = await patientPackageService.createPatientPackage({
          patientId: finalPatientId,
          packageId: pkg.id,
          packageName: pkg.name,
          clinicId: clinicId,
          branchId: clinicId,
          totalSessions: pkg.totalSessions,
          usedSessions: 0,
          status: "active",
          expiresAt: expiresAt,
          createdBy: currentUser.uid,
          billingId,
        });
      }

      // 6. Start First Session Instantly
      if (startSessionInstantly && sessionClinician && patientPkgId) {
        const now = new Date();
        const startTime24 = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

        const newApptId = await appointmentService.createAppointment({
          patientId: finalPatientId,
          doctorId:
            sessionClinician.kind === "doctor" ? sessionClinician.id : "unassigned",
          assignedExpertId:
            sessionClinician.kind === "expert" ? sessionClinician.id : undefined,
          appointmentTypeId: "package-session",
          patientPackageId: patientPkgId,
          appointmentDate: now,
          startTime: startTime24,
          status: "confirmed", // Puts patient directly in the Lobby Queue
          reason: `Session 1 of ${pkg.name}`,
          clinicId: clinicId,
          branchId: clinicId,
          createdBy: currentUser.uid,
          // Neither billingId (that would be the PACKAGE SALE's invoice,
          // not this visit's) nor a "paid" stamp belongs here — see the
          // identical fix and reasoning in front-office-desk.tsx's Quick
          // Intake package-session paths. This visit needs to reach
          // Settle for the session's commission to actually be generated.
        } as any);

        await patientPackageService.startSession(patientPkgId, newApptId);

        // The session's commission-only line, for whoever was picked
        // above — without this the visit reaches Settle with nothing on
        // it to bill, and the clinician earns nothing for the session.
        try {
          await ensureSessionLine({
            appointment: { id: newApptId },
            patientPackageId: patientPkgId,
            packages,
            performer: sessionClinician,
            ctx: {
              clinicId,
              userId: currentUser.uid,
              pricing: {
                taxPercentage: billingSettings?.defaultTaxPercentage,
                isTaxEnabled: billingSettings?.enableTax,
              },
            },
          });
        } catch (sessionLineErr) {
          console.error(
            "Error recording the first package session's commission line:",
            sessionLineErr,
          );
          addToast({
            title: "Session Started, but Not Logged for Commission",
            description:
              "The package session visit was created, but its commission line could not be recorded — add it from the queue before Settle.",
            color: "warning",
            duration: 15000,
          });
        }
      }

      addToast({
        title: "Package Sold!",
        description: `Successfully sold ${pkg.name} to ${finalPatientName} and credited wallet.`,
        color: "success",
      });

      onClose();
    } catch (error) {
      console.error("Error selling package:", error);
      addToast({
        title: "Error",
        description: "Failed to sell package.",
        color: "danger",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedPkg = packages.find((p) => p.id === selectedPackageId);

  return (
    <Modal isOpen={isOpen} size="lg" onClose={onClose}>
      <ModalContent>
        <form onSubmit={handleSellPackage}>
          <ModalHeader className="flex flex-col gap-1">
            <h3>Sell Treatment Package</h3>
            <p className="text-sm text-default-500 font-normal">
              Issue an invoice and instantly credit the patient's wallet
            </p>
          </ModalHeader>
          <ModalBody className="space-y-4 py-4">
            {/* Toggle Mode */}
            <div className="flex bg-primary/10 p-1 rounded-md">
              <button
                className={`flex-1 py-1.5 text-xs font-medium rounded ${saleMode === "existing" ? "bg-primary text-white shadow" : "text-primary hover:bg-primary/20"}`}
                type="button"
                onClick={() => setSaleMode("existing")}
              >
                Existing Patient
              </button>
              <button
                className={`flex-1 py-1.5 text-xs font-medium rounded ${saleMode === "new" ? "bg-primary text-white shadow" : "text-primary hover:bg-primary/20"}`}
                type="button"
                onClick={() => setSaleMode("new")}
              >
                Walk-In New Patient
              </button>
            </div>

            {saleMode === "existing" ? (
              <div>
                <label className="text-[12px] font-medium text-text-muted mb-1 block">
                  Search Existing Patient{" "}
                  <span className="text-red-500">*</span>
                </label>
                {/* Was a plain unsearchable <select> despite the "Search"
                    label — with 100+ patients, staff had to scroll a giant
                    native dropdown by eye. Matches the real search-as-you-type
                    patient picker already used in QuickIntakeModal. */}
                <Autocomplete
                  isRequired
                  placeholder="Type a patient name or phone number..."
                  selectedKey={selectedPatientId || null}
                  onSelectionChange={(key) =>
                    setSelectedPatientId(key ? String(key) : "")
                  }
                >
                  {patients.map((p) => (
                    <AutocompleteItem
                      key={p.id}
                      textValue={`${p.name} ${p.regNumber || ""} ${p.mobile || ""}`}
                    >
                      {p.name} ({p.regNumber || p.mobile || "No Contact"})
                    </AutocompleteItem>
                  ))}
                </Autocomplete>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 p-3 bg-surface border border-border-base rounded-md">
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-[11px] font-semibold text-text-muted mb-1 block">
                    Full Name *
                  </label>
                  <input
                    required
                    className="w-full text-sm p-1.5 border border-border-base rounded outline-none focus:border-primary"
                    type="text"
                    value={newPatientForm.name}
                    onChange={(e) =>
                      setNewPatientForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-[11px] font-semibold text-text-muted mb-1 block">
                    Mobile *
                  </label>
                  <input
                    required
                    className="w-full text-sm p-1.5 border border-border-base rounded outline-none focus:border-primary"
                    type="tel"
                    value={newPatientForm.mobile}
                    onChange={(e) =>
                      setNewPatientForm((prev) => ({
                        ...prev,
                        mobile: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-text-muted mb-1 block">
                    Age *
                  </label>
                  <input
                    required
                    className="w-full text-sm p-1.5 border border-border-base rounded outline-none focus:border-primary"
                    placeholder="e.g. 30"
                    type="text"
                    value={newPatientForm.age}
                    onChange={(e) =>
                      setNewPatientForm((prev) => ({
                        ...prev,
                        age: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-text-muted mb-1 block">
                    Gender *
                  </label>
                  <select
                    className="w-full text-sm p-1.5 border border-border-base rounded outline-none focus:border-primary"
                    value={newPatientForm.gender}
                    onChange={(e) =>
                      setNewPatientForm((prev) => ({
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
                  <label className="text-[11px] font-semibold text-text-muted mb-1 block">
                    PAN/VAT Number (Optional)
                  </label>
                  <input
                    className="w-full text-sm p-1.5 border border-border-base rounded outline-none focus:border-primary"
                    inputMode="numeric"
                    maxLength={9}
                    placeholder="9-digit PAN/VAT, e.g. 123456789"
                    type="text"
                    value={newPatientForm.patientPanVat}
                    onChange={(e) =>
                      setNewPatientForm((prev) => ({
                        ...prev,
                        // Nepal PAN/VAT numbers are digits only, 9 digits —
                        // this prints on the invoice's Purchaser's PAN
                        // field, so filter garbage input rather than
                        // letting it through.
                        patientPanVat: e.target.value
                          .replace(/\D/g, "")
                          .slice(0, 9),
                      }))
                    }
                  />
                </div>
              </div>
            )}

            <div>
              <label className="text-[12px] font-medium text-text-muted mb-1 block">
                Package <span className="text-red-500">*</span>
              </label>
              <select
                required
                className="w-full px-3 py-2 text-[13px] border border-border-base rounded bg-white focus:outline-none focus:border-primary"
                value={selectedPackageId}
                onChange={(e) => setSelectedPackageId(e.target.value)}
              >
                <option disabled value="">
                  Select a package
                </option>
                {packages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>
                    {pkg.name} - NPR {pkg.price.toLocaleString()}
                  </option>
                ))}
              </select>
              {selectedPkg && (
                <p className="text-[11.5px] text-emerald-600 font-medium mt-1">
                  Provides NPR {selectedPkg.walletCreditAmount.toLocaleString()}{" "}
                  in wallet credits.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[12px] font-medium text-text-muted mb-1 block">
                  Payment Method
                </label>
                <select
                  className="w-full px-3 py-2 text-[13px] border border-border-base rounded bg-white focus:outline-none focus:border-primary"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="esewa">eSewa</option>
                  <option value="khalti">Khalti</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
              <Input
                label="Transaction Reference"
                placeholder="Optional"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>

            {selectedPkg && (
              <p className="text-[11.5px] text-text-muted">
                {selectedPkg.isTaxable
                  ? "VAT applies to this package per Settings › Packages."
                  : "This package is VAT-exempt per Settings › Packages."}
              </p>
            )}

            {selectedPkg && (selectedPkg.totalSessions || 0) > 0 && (
              <div className="mt-2 p-2 bg-primary/5 rounded border border-primary/10 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    checked={startSessionInstantly}
                    className="w-4 h-4 text-primary rounded border-border-base focus:ring-primary"
                    id="startSession"
                    type="checkbox"
                    onChange={(e) => {
                      setStartSessionInstantly(e.target.checked);
                      if (!e.target.checked) setSessionClinicianKey("");
                    }}
                  />
                  <label
                    className="text-[12px] font-medium text-text-main cursor-pointer select-none"
                    htmlFor="startSession"
                  >
                    Start first session instantly (Add to Lobby Queue)
                  </label>
                </div>
                {startSessionInstantly && (
                  <div>
                    <label className="text-[11px] font-semibold text-text-muted mb-1 block">
                      Performed By <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      className="w-full px-3 py-2 text-[13px] border border-border-base rounded bg-white focus:outline-none focus:border-primary"
                      value={sessionClinicianKey}
                      onChange={(e) => setSessionClinicianKey(e.target.value)}
                    >
                      <option value="">Select a doctor or expert</option>
                      {doctors.length > 0 && (
                        <optgroup label="Doctors">
                          {doctors.map((d) => (
                            <option key={d.id} value={`doctor:${d.id}`}>
                              Dr. {d.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {experts.length > 0 && (
                        <optgroup label="Experts">
                          {experts.map((e) => (
                            <option key={e.id} value={`expert:${e.id}`}>
                              {e.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                )}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button
              color="default"
              isDisabled={isSubmitting}
              variant="flat"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button color="primary" isLoading={isSubmitting} type="submit">
              Confirm & Charge
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
