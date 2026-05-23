import { useState, useEffect } from "react";
import { 
  Button, 
  Input, 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalFooter 
} from "@/components/ui";
import { Patient, TreatmentPackage } from "@/types/models";
import { packageService } from "@/services/packageService";
import { appointmentBillingService } from "@/services/appointmentBillingService";
import { walletService } from "@/services/walletService";
import { patientService } from "@/services/patientService";
import { patientPackageService } from "@/services/patientPackageService";
import { appointmentService } from "@/services/appointmentService";
import { addToast } from "@/components/ui/toast";
import { useAuthContext } from "@/context/AuthContext";

interface SellPackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Patient[];
}

export default function SellPackageModal({ isOpen, onClose, patients }: SellPackageModalProps) {
  const { clinicId, branchId, currentUser } = useAuthContext();
  const [packages, setPackages] = useState<TreatmentPackage[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(true);
  
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startSessionInstantly, setStartSessionInstantly] = useState(false);

  // New vs Existing mode
  const [saleMode, setSaleMode] = useState<"existing" | "new">("existing");
  const [newPatientForm, setNewPatientForm] = useState({ name: "", mobile: "", age: "", gender: "male" });

  useEffect(() => {
    if (isOpen && clinicId) {
      loadPackages();
    }
  }, [isOpen, clinicId]);

  const loadPackages = async () => {
    try {
      setLoadingPackages(true);
      const data = await packageService.getPackagesByClinic(clinicId!, branchId || undefined);
      setPackages(data);
    } catch (error) {
      console.error("Error loading packages:", error);
    } finally {
      setLoadingPackages(false);
    }
  };

  const handleSellPackage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (saleMode === "new") {
      if (!newPatientForm.name || !newPatientForm.mobile || !newPatientForm.age) {
        addToast({ title: "Validation Error", description: "Please fill in all new patient fields.", color: "warning" });
        return;
      }
    } else {
      if (!selectedPatientId) {
        addToast({ title: "Validation Error", description: "Please select an existing patient.", color: "warning" });
        return;
      }
    }

    if (!selectedPackageId) {
      addToast({ title: "Validation Error", description: "Please select a package.", color: "warning" });
      return;
    }

    const pkg = packages.find(p => p.id === selectedPackageId);
    if (!pkg || !clinicId || !currentUser) return;

    try {
      setIsSubmitting(true);

      let finalPatientId = selectedPatientId;
      let finalPatientName = "";

      if (saleMode === "new") {
        // Create patient first
        const nextReg = await patientService.getNextRegistrationNumber(clinicId);
        finalPatientId = await patientService.createPatient({
          name: newPatientForm.name.trim(),
          mobile: newPatientForm.mobile.trim(),
          age: newPatientForm.age.trim(),
          gender: newPatientForm.gender as "male" | "female" | "other",
          regNumber: nextReg,
          address: "Clinic Walk-in",
          clinicId: clinicId,
          branchId: branchId || clinicId,
        });
        finalPatientName = newPatientForm.name.trim();
      } else {
        const pat = patients.find(p => p.id === selectedPatientId);
        if (!pat) throw new Error("Patient not found");
        finalPatientName = pat.name;
      }
      
      // 1. Generate Invoice Number
      const invoiceNo = await appointmentBillingService.generateInvoiceNumber(clinicId);

      // 2. Create the Billing record
      const billingItem = {
        id: crypto.randomUUID(),
        appointmentTypeId: "package-sale",
        appointmentTypeName: `Package: ${pkg.name}`,
        price: pkg.price,
        quantity: 1,
        commission: 0,
        doctorId: "unassigned",
        doctorName: "Clinic",
        amount: pkg.price,
      };

      const billingData = {
        invoiceNumber: invoiceNo,
        clinicId: clinicId,
        branchId: branchId || clinicId,
        patientId: finalPatientId,
        patientName: finalPatientName,
        doctorId: "unassigned",
        doctorName: "Clinic",
        doctorType: "regular" as const,
        invoiceDate: new Date(),
        items: [billingItem],
        subtotal: pkg.price,
        itemDiscountAmount: 0,
        mainDiscountAmount: 0,
        discountType: "percent" as const,
        discountValue: 0,
        discountAmount: 0,
        taxPercentage: 0,
        taxAmount: 0,
        totalAmount: pkg.price,
        status: "draft" as const,
        paymentStatus: "unpaid" as const,
        paidAmount: 0,
        balanceAmount: pkg.price,
        createdBy: currentUser.uid,
      };

      const billingId = await appointmentBillingService.createBilling(billingData);

      // 3. Record Payment (if price > 0)
      if (pkg.price > 0) {
        await appointmentBillingService.recordPayment(
          billingId,
          pkg.price,
          paymentMethod,
          reference,
          notes || `Purchased ${pkg.name}`
        );
      }

      // 4. Add Funds to Wallet
      if (pkg.walletCreditAmount > 0) {
        await walletService.addFunds(
          finalPatientId,
          clinicId,
          branchId || "",
          pkg.walletCreditAmount,
          paymentMethod,
          `Package Credit: ${pkg.name}`,
          currentUser.uid
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
          branchId: branchId || clinicId,
          totalSessions: pkg.totalSessions,
          usedSessions: 0,
          status: "active",
          expiresAt: expiresAt,
          createdBy: currentUser.uid,
        });
      }

      // 6. Start First Session Instantly
      if (startSessionInstantly) {
        const now = new Date();
        const startTime24 = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        
        const newApptId = await appointmentService.createAppointment({
          patientId: finalPatientId,
          doctorId: "unassigned",
          appointmentTypeId: "package-session",
          patientPackageId: patientPkgId,
          appointmentDate: now,
          startTime: startTime24,
          status: "confirmed", // Puts patient directly in the Lobby Queue
          reason: `Session 1 of ${pkg.name}`,
          clinicId: clinicId,
          branchId: branchId || clinicId,
          createdBy: currentUser.uid,
          billingId: billingId,
          billingStatus: "paid",
          paymentStatus: "paid",
        } as any);
        
        if (patientPkgId) {
          await patientPackageService.startSession(patientPkgId, newApptId);
        }
      }

      addToast({
        title: "Package Sold!",
        description: `Successfully sold ${pkg.name} to ${finalPatientName} and credited wallet.`,
        color: "success"
      });
      
      onClose();
    } catch (error) {
      console.error("Error selling package:", error);
      addToast({ title: "Error", description: "Failed to sell package.", color: "danger" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const selectedPkg = packages.find(p => p.id === selectedPackageId);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalContent>
        <form onSubmit={handleSellPackage}>
          <ModalHeader className="flex flex-col gap-1">
              <h3>Sell Treatment Package</h3>
              <p className="text-sm text-default-500 font-normal">Issue an invoice and instantly credit the patient's wallet</p>
            </ModalHeader>
            <ModalBody className="space-y-4 py-4">
              
              {/* Toggle Mode */}
              <div className="flex bg-primary/10 p-1 rounded-md">
                <button
                  type="button"
                  className={`flex-1 py-1.5 text-xs font-medium rounded ${saleMode === "existing" ? "bg-primary text-white shadow" : "text-primary hover:bg-primary/20"}`}
                  onClick={() => setSaleMode("existing")}
                >
                  Existing Patient
                </button>
                <button
                  type="button"
                  className={`flex-1 py-1.5 text-xs font-medium rounded ${saleMode === "new" ? "bg-primary text-white shadow" : "text-primary hover:bg-primary/20"}`}
                  onClick={() => setSaleMode("new")}
                >
                  Walk-In New Patient
                </button>
              </div>

              {saleMode === "existing" ? (
                <div>
                  <label className="text-[12px] font-medium text-text-muted mb-1 block">Search Existing Patient <span className="text-red-500">*</span></label>
                  <select 
                    required
                    className="w-full px-3 py-2 text-[13px] border border-border-base rounded bg-white focus:outline-none focus:border-primary"
                    value={selectedPatientId}
                    onChange={e => setSelectedPatientId(e.target.value)}
                  >
                    <option value="" disabled>Select a patient...</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.regNumber || p.mobile || "No Contact"})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 p-3 bg-surface border border-border-base rounded-md">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[11px] font-semibold text-text-muted mb-1 block">Full Name *</label>
                    <input required type="text" className="w-full text-sm p-1.5 border border-border-base rounded outline-none focus:border-primary" 
                      value={newPatientForm.name} onChange={e => setNewPatientForm(prev => ({...prev, name: e.target.value}))} />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[11px] font-semibold text-text-muted mb-1 block">Mobile *</label>
                    <input required type="tel" className="w-full text-sm p-1.5 border border-border-base rounded outline-none focus:border-primary" 
                      value={newPatientForm.mobile} onChange={e => setNewPatientForm(prev => ({...prev, mobile: e.target.value}))} />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-text-muted mb-1 block">Age *</label>
                    <input required type="text" className="w-full text-sm p-1.5 border border-border-base rounded outline-none focus:border-primary" placeholder="e.g. 30"
                      value={newPatientForm.age} onChange={e => setNewPatientForm(prev => ({...prev, age: e.target.value}))} />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-text-muted mb-1 block">Gender *</label>
                    <select className="w-full text-sm p-1.5 border border-border-base rounded outline-none focus:border-primary"
                      value={newPatientForm.gender} onChange={e => setNewPatientForm(prev => ({...prev, gender: e.target.value}))}>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="text-[12px] font-medium text-text-muted mb-1 block">Package <span className="text-red-500">*</span></label>
                <select 
                  required
                  className="w-full px-3 py-2 text-[13px] border border-border-base rounded bg-white focus:outline-none focus:border-primary"
                  value={selectedPackageId}
                  onChange={e => setSelectedPackageId(e.target.value)}
                >
                  <option value="" disabled>Select a package</option>
                  {packages.map(pkg => (
                    <option key={pkg.id} value={pkg.id}>{pkg.name} - NPR {pkg.price.toLocaleString()}</option>
                  ))}
                </select>
                {selectedPkg && (
                  <p className="text-[11.5px] text-emerald-600 font-medium mt-1">
                    Provides NPR {selectedPkg.walletCreditAmount.toLocaleString()} in wallet credits.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[12px] font-medium text-text-muted mb-1 block">Payment Method</label>
                  <select 
                    className="w-full px-3 py-2 text-[13px] border border-border-base rounded bg-white focus:outline-none focus:border-primary"
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
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
                  onChange={e => setReference(e.target.value)} 
                />
              </div>

              {selectedPkg && (selectedPkg.totalSessions || 0) > 0 && (
                <div className="flex items-center gap-2 mt-2 p-2 bg-primary/5 rounded border border-primary/10">
                  <input 
                    type="checkbox" 
                    id="startSession"
                    checked={startSessionInstantly}
                    onChange={(e) => setStartSessionInstantly(e.target.checked)}
                    className="w-4 h-4 text-primary rounded border-border-base focus:ring-primary"
                  />
                  <label htmlFor="startSession" className="text-[12px] font-medium text-text-main cursor-pointer select-none">
                    Start first session instantly (Add to Lobby Queue)
                  </label>
                </div>
              )}
            </ModalBody>
          <ModalFooter>
            <Button color="default" variant="flat" onClick={onClose} isDisabled={isSubmitting}>Cancel</Button>
            <Button color="primary" type="submit" isLoading={isSubmitting}>Confirm & Charge</Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
