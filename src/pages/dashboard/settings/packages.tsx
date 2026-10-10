import { useState, useEffect } from "react";
import { IoAddOutline } from "react-icons/io5";

import { TreatmentPackage } from "@/types/models";
import { packageService } from "@/services/packageService";
import { expertService } from "@/services/expertService";
import { doctorService } from "@/services/doctorService";
import { Select, SelectItem } from "@/components/ui/select";
import { perSessionValue } from "@/services/core/visitChargeCore";
import { useAuthContext } from "@/context/AuthContext";
import {
  Button,
  Input,
  Checkbox,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui";
import { addToast } from "@/components/ui/toast";

export default function PackagesSettingsPage() {
  const { clinicId } = useAuthContext();
  const branchId = clinicId ?? null;
  const [packages, setPackages] = useState<TreatmentPackage[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(
    new Set(),
  );
  const [loading, setLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingPkg, setEditingPkg] = useState<TreatmentPackage | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    walletCreditAmount: "",
    totalSessions: "",
    validityDays: "",
    calculateCommission: true,
    defaultCommission: "",
    isTaxable: false,
    taxRate: "",
    sessionPerformerKind: "expert" as "expert" | "doctor" | "either",
    defaultPerformerId: "",
  });
  const [performers, setPerformers] = useState<
    Array<{ id: string; name: string; kind: "doctor" | "expert" }>
  >([]);

  useEffect(() => {
    loadPackages();
  }, [clinicId, branchId]);

  useEffect(() => {
    if (!clinicId) return;
    (async () => {
      try {
        const [experts, doctors] = await Promise.all([
          expertService.getExperts(clinicId),
          doctorService.getDoctors(clinicId),
        ]);

        setPerformers([
          ...experts
            .filter((e) => e.isActive !== false && !e.isDeleted)
            .map((e) => ({ id: e.id, name: e.name, kind: "expert" as const })),
          ...doctors
            .filter((d) => d.isActive !== false && !d.isDeleted)
            .map((d) => ({ id: d.id, name: d.name, kind: "doctor" as const })),
        ]);
      } catch (error) {
        console.error("Error loading performers:", error);
      }
    })();
  }, [clinicId]);

  const loadPackages = async () => {
    if (!clinicId) return;
    try {
      setLoading(true);
      const data = await packageService.getPackagesByClinic(
        clinicId,
      );

      setPackages(data);
    } catch (error) {
      console.error("Error loading packages:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (pkg?: TreatmentPackage) => {
    if (pkg) {
      setEditingPkg(pkg);
      setFormData({
        name: pkg.name,
        description: pkg.description || "",
        price: pkg.price.toString(),
        walletCreditAmount: pkg.walletCreditAmount.toString(),
        totalSessions: pkg.totalSessions?.toString() || "",
        validityDays: pkg.validityDays?.toString() || "",
        calculateCommission: pkg.calculateCommission !== false,
        defaultCommission:
          pkg.defaultCommission !== undefined
            ? String(pkg.defaultCommission)
            : "",
        isTaxable: pkg.isTaxable === true,
        taxRate: typeof pkg.taxRate === "number" ? String(pkg.taxRate) : "",
        sessionPerformerKind: pkg.sessionPerformerKind || "expert",
        defaultPerformerId: pkg.defaultPerformerId || "",
      });
    } else {
      setEditingPkg(null);
      setFormData({
        name: "",
        description: "",
        price: "",
        walletCreditAmount: "",
        totalSessions: "",
        validityDays: "",
        calculateCommission: true,
        defaultCommission: "",
        isTaxable: false,
        taxRate: "",
        sessionPerformerKind: "expert",
        defaultPerformerId: "",
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId) return;

    try {
      setIsSaving(true);
      const price = parseFloat(formData.price) || 0;
      const walletCredit = parseFloat(formData.walletCreditAmount) || price;
      const totalSessions = formData.totalSessions
        ? parseInt(formData.totalSessions)
        : undefined;
      const validityDays = formData.validityDays
        ? parseInt(formData.validityDays)
        : undefined;

      const commissionValue =
        formData.calculateCommission && formData.defaultCommission.trim()
          ? Math.min(
              100,
              Math.max(0, parseFloat(formData.defaultCommission) || 0),
            )
          : undefined;
      const taxRateValue =
        formData.isTaxable && formData.taxRate.trim()
          ? Math.min(100, Math.max(0, parseFloat(formData.taxRate) || 0))
          : undefined;
      const defaultPerformerId = formData.defaultPerformerId || undefined;

      if (editingPkg) {
        await packageService.updatePackage(editingPkg.id, {
          name: formData.name,
          description: formData.description,
          price,
          walletCreditAmount: walletCredit,
          // Firestore's updateDoc rejects `undefined` outright — `null`
          // explicitly clears a previously-set value when left blank
          // (this was the actual bug: totalSessions/validityDays passed
          // `undefined` here whenever the field was empty).
          totalSessions: (totalSessions ?? null) as any,
          validityDays: (validityDays ?? null) as any,
          calculateCommission: formData.calculateCommission,
          defaultCommission: (commissionValue ?? null) as any,
          isTaxable: formData.isTaxable,
          taxRate: (taxRateValue ?? null) as any,
          sessionPerformerKind: formData.sessionPerformerKind,
          defaultPerformerId: (defaultPerformerId ?? null) as any,
        });
        addToast({
          title: "Updated",
          description: "Package updated successfully",
          color: "success",
        });
      } else {
        await packageService.createPackage({
          name: formData.name,
          description: formData.description,
          price,
          walletCreditAmount: walletCredit,
          isActive: true,
          clinicId,
          branchId,
          createdBy: "system",
          calculateCommission: formData.calculateCommission,
          isTaxable: formData.isTaxable,
          sessionPerformerKind: formData.sessionPerformerKind,
          ...(taxRateValue !== undefined && { taxRate: taxRateValue }),
          ...(defaultPerformerId !== undefined && { defaultPerformerId }),
          // Fresh addDoc — omit each key entirely rather than writing
          // `undefined`, which Firestore also rejects on create.
          ...(totalSessions !== undefined && { totalSessions }),
          ...(validityDays !== undefined && { validityDays }),
          ...(commissionValue !== undefined && {
            defaultCommission: commissionValue,
          }),
        } as any);
        addToast({
          title: "Created",
          description: "Package created successfully",
          color: "success",
        });
      }
      setIsModalOpen(false);
      loadPackages();
    } catch (error) {
      addToast({
        title: "Error",
        description: "Failed to save package",
        color: "danger",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this package?")) return;
    try {
      await packageService.deletePackage(id);
      addToast({
        title: "Deleted",
        description: "Package deleted successfully",
        color: "success",
      });
      setSelectedPackages((prev) => {
        const next = new Set(prev);

        next.delete(id);

        return next;
      });
      loadPackages();
    } catch (error) {
      addToast({
        title: "Error",
        description: "Failed to delete package",
        color: "danger",
      });
    }
  };

  const handleBatchDelete = async () => {
    if (selectedPackages.size === 0) return;
    if (
      !confirm(
        `Are you sure you want to delete ${selectedPackages.size} packages?`,
      )
    )
      return;

    try {
      setIsBatchDeleting(true);
      const deletePromises = Array.from(selectedPackages).map((id) =>
        packageService.deletePackage(id),
      );

      await Promise.all(deletePromises);

      addToast({
        title: "Deleted",
        description: `${selectedPackages.size} packages deleted successfully`,
        color: "success",
      });
      setSelectedPackages(new Set());
      loadPackages();
    } catch (error) {
      addToast({
        title: "Error",
        description: "Failed to delete packages",
        color: "danger",
      });
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      setSelectedPackages(new Set(packages.map((p) => p.id)));
    } else {
      setSelectedPackages(new Set());
    }
  };

  const handleSelectPackage = (id: string, isSelected: boolean) => {
    setSelectedPackages((prev) => {
      const next = new Set(prev);

      if (isSelected) next.add(id);
      else next.delete(id);

      return next;
    });
  };

  const isAllSelected =
    packages.length > 0 && selectedPackages.size === packages.length;
  const isIndeterminate =
    selectedPackages.size > 0 && selectedPackages.size < packages.length;

  const handleSeedPackages = async () => {
    if (!clinicId) return;
    if (!confirm("Are you sure you want to seed 5 demo skin care packages?"))
      return;

    try {
      setIsSeeding(true);
      const demoPackages = [
        {
          name: "Laser Hair Removal - 6 Sessions",
          description: "Full body laser hair removal",
          price: 50000,
          walletCreditAmount: 50000,
          totalSessions: 6,
        },
        {
          name: "Acne Scar Treatment - 4 Sessions",
          description: "Microneedling & Chemical Peels",
          price: 25000,
          walletCreditAmount: 25000,
          totalSessions: 4,
        },
        {
          name: "Bridal Glow Package",
          description: "Complete skin rejuvenation before wedding",
          price: 35000,
          walletCreditAmount: 35000,
          totalSessions: 5,
        },
        {
          name: "Anti-Aging Botox Plan",
          description: "Annual botox maintenance package",
          price: 60000,
          walletCreditAmount: 60000,
          totalSessions: 1,
        },
        {
          name: "Pigmentation & Melasma Pack",
          description: "Q-Switch laser + Topicals",
          price: 30000,
          walletCreditAmount: 30000,
          totalSessions: 5,
        },
      ];

      for (const pkg of demoPackages) {
        await packageService.createPackage({
          ...pkg,
          clinicId,
          branchId,
          isActive: true,
          createdBy: "system",
        });
      }

      addToast({
        title: "Seeded",
        description: "5 Demo Packages created successfully",
        color: "success",
      });
      loadPackages();
    } catch (error) {
      addToast({
        title: "Error",
        description: "Failed to seed packages",
        color: "danger",
      });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="clarity-page-header">
        <div>
          <h1 className="clarity-page-title">Treatment Packages</h1>
          <p className="clarity-page-subtitle">
            Manage bulk session packages that fund patient wallets
          </p>
        </div>
        <div className="flex gap-2">
          {selectedPackages.size > 0 && (
            <Button
              color="danger"
              isLoading={isBatchDeleting}
              variant="flat"
              onClick={handleBatchDelete}
            >
              Delete Selected ({selectedPackages.size})
            </Button>
          )}
          <Button
            color="warning"
            isLoading={isSeeding}
            startContent={<IoAddOutline className="w-4 h-4" />}
            variant="flat"
            onClick={handleSeedPackages}
          >
            Seed 5 Packages
          </Button>
          <Button
            color="primary"
            startContent={<IoAddOutline className="w-4 h-4" />}
            onClick={() => handleOpenModal()}
          >
            Add Package
          </Button>
        </div>
      </div>

      <div className="bg-surface border border-border-base rounded-[10px] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-muted">Loading...</div>
        ) : packages.length === 0 ? (
          <div className="p-8 text-center text-text-muted">
            No packages defined. Click "Add Package" to create one.
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-2/50 border-b border-border-base text-[11px] uppercase tracking-wider text-text-muted">
                <th className="px-5 py-3 font-medium w-[40px]">
                  <input
                    ref={(input) => {
                      if (input)
                        input.indeterminate = isIndeterminate && !isAllSelected;
                    }}
                    checked={isAllSelected}
                    className="w-4 h-4 rounded border-border-base text-primary focus:ring-primary cursor-pointer"
                    type="checkbox"
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </th>
                <th className="px-2 py-3 font-medium">Package Name</th>
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 font-medium">Price</th>
                <th className="px-5 py-3 font-medium">Wallet Credit</th>
                <th className="px-5 py-3 font-medium text-center">Sessions</th>
                <th className="px-5 py-3 font-medium text-center">Validity</th>
                <th className="px-5 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr
                  key={pkg.id}
                  className="border-b border-border-base last:border-0 hover:bg-surface-2/30 transition-colors"
                >
                  <td className="px-5 py-3">
                    <input
                      checked={selectedPackages.has(pkg.id)}
                      className="w-4 h-4 rounded border-border-base text-primary focus:ring-primary cursor-pointer"
                      type="checkbox"
                      onChange={(e) =>
                        handleSelectPackage(pkg.id, e.target.checked)
                      }
                    />
                  </td>
                  <td className="px-2 py-3 text-[13px] font-semibold text-text-main">
                    {pkg.name}
                  </td>
                  <td className="px-5 py-3 text-[12px] text-text-muted">
                    {pkg.description || "-"}
                  </td>
                  <td className="px-5 py-3 text-[13px]">
                    NPR {pkg.price.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-[13px] text-emerald-600 font-medium">
                    NPR {pkg.walletCreditAmount.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-[13px] text-center font-bold">
                    {pkg.totalSessions || "-"}
                  </td>
                  <td className="px-5 py-3 text-[13px] text-center">
                    {pkg.validityDays ? `${pkg.validityDays} Days` : "Lifetime"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button
                      size="sm"
                      variant="bordered"
                      onClick={() => handleOpenModal(pkg)}
                    >
                      Edit
                    </Button>
                    <Button
                      className="ml-2"
                      color="danger"
                      size="sm"
                      variant="light"
                      onClick={() => handleDelete(pkg.id)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        size="2xl"
        onClose={() => setIsModalOpen(false)}
      >
        <ModalContent>
          <form onSubmit={handleSave}>
            <ModalHeader>
              <h3>{editingPkg ? "Edit Package" : "Add Package"}</h3>
            </ModalHeader>
            <ModalBody className="space-y-4 py-4">
              <Input
                isRequired
                label="Package Name"
                placeholder="e.g. Laser Hair Removal - 6 Sessions"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
              />
              <Input
                label="Description (Optional)"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  isRequired
                  label="Price (Patient Pays)"
                  startContent={
                    <div className="pointer-events-none flex items-center">
                      <span className="text-default-400 text-small">NPR</span>
                    </div>
                  }
                  type="number"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, price: e.target.value }))
                  }
                />
                <Input
                  isRequired
                  description="Amount deposited into wallet"
                  label="Wallet Credit Amount"
                  startContent={
                    <div className="pointer-events-none flex items-center">
                      <span className="text-default-400 text-small">NPR</span>
                    </div>
                  }
                  type="number"
                  value={formData.walletCreditAmount}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      walletCreditAmount: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  description="Visual tracking for multi-session packages"
                  label="Total Sessions (Optional)"
                  type="number"
                  value={formData.totalSessions}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      totalSessions: e.target.value,
                    }))
                  }
                />
                <Input
                  description="Leave empty for lifetime validity"
                  label="Validity in Days (Optional)"
                  type="number"
                  value={formData.validityDays}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      validityDays: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-lg border border-border-base bg-surface-2/30">
                <Checkbox
                  className="font-medium"
                  isSelected={formData.calculateCommission}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      calculateCommission: value,
                    }))
                  }
                >
                  Calculate Commission
                </Checkbox>
                <p className="text-xs text-text-muted ml-7 leading-relaxed">
                  If checked, consuming a session of this package earns the
                  performing doctor/expert a commission. Uncheck to exclude
                  this package's sessions from commission entirely.
                </p>
                {formData.calculateCommission && (
                  <div className="ml-7 mt-2 max-w-[200px]">
                    <Input
                      label="Default Commission % (optional)"
                      max="100"
                      min="0"
                      placeholder="Uses clinician's own default"
                      type="number"
                      value={formData.defaultCommission}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          defaultCommission: e.target.value,
                        }))
                      }
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1 p-3 rounded-lg border border-border-base bg-surface-2/30">
                <Checkbox
                  className="font-medium"
                  isSelected={formData.isTaxable}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, isTaxable: value }))
                  }
                >
                  VAT applies to this package
                </Checkbox>
                <p className="text-xs text-text-muted ml-7 leading-relaxed">
                  The sale invoice adds VAT on top of the price and the full
                  amount is collected at sale. Cosmetic packages are usually
                  taxable; confirm with your accountant.
                </p>
                {formData.isTaxable && (
                  <div className="ml-7 mt-2 max-w-[200px]">
                    <Input
                      label="VAT rate % (optional)"
                      max="100"
                      min="0"
                      placeholder="Uses clinic default"
                      type="number"
                      value={formData.taxRate}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, taxRate: e.target.value }))
                      }
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Sessions performed by"
                  name="sessionPerformerKind"
                  value={formData.sessionPerformerKind}
                  variant="bordered"
                  onChange={(e: any) =>
                    setFormData((prev) => ({
                      ...prev,
                      sessionPerformerKind: e.target.value,
                    }))
                  }
                >
                  <SelectItem key="expert" value="expert">
                    Expert
                  </SelectItem>
                  <SelectItem key="doctor" value="doctor">
                    Doctor
                  </SelectItem>
                  <SelectItem key="either" value="either">
                    Either
                  </SelectItem>
                </Select>
                <Select
                  label="Default performer (optional)"
                  name="defaultPerformerId"
                  value={formData.defaultPerformerId}
                  variant="bordered"
                  onChange={(e: any) =>
                    setFormData((prev) => ({
                      ...prev,
                      defaultPerformerId: e.target.value,
                    }))
                  }
                >
                  <SelectItem key="" value="">
                    — ask at the time —
                  </SelectItem>
                  {performers
                    .filter(
                      (p) =>
                        formData.sessionPerformerKind === "either" ||
                        p.kind === formData.sessionPerformerKind,
                    )
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.kind})
                      </SelectItem>
                    ))}
                </Select>
              </div>
              {(() => {
                const price = parseFloat(formData.price) || 0;
                const credit = parseFloat(formData.walletCreditAmount) || price;
                const sessions = parseInt(formData.totalSessions) || 0;
                const perSession = perSessionValue(credit, sessions);

                return (
                  <div className="text-xs text-text-muted space-y-1">
                    {sessions > 0 && (
                      <p>
                        Per-session value: NPR {perSession.toLocaleString()} (
                        {credit.toLocaleString()} credit ÷ {sessions} sessions).
                        Used for the wallet deduction, the refund cap and the
                        commission base alike.
                      </p>
                    )}
                    {Math.abs(credit - price) >= 0.005 && price > 0 && (
                      <p className="text-warning">
                        Wallet credit differs from the price: refunds of unused
                        sessions are capped by the credit, not the price.
                      </p>
                    )}
                  </div>
                );
              })()}
            </ModalBody>
            <ModalFooter>
              <Button
                color="default"
                isDisabled={isSaving}
                variant="flat"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </Button>
              <Button color="primary" isLoading={isSaving} type="submit">
                Save Package
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </div>
  );
}
