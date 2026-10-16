import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardBody } from "@heroui/card";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Select, SelectItem } from "@heroui/select";
import { Divider } from "@heroui/divider";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Spinner } from "@heroui/spinner";
import { IoArrowBackOutline, IoSaveOutline } from "react-icons/io5";

import { useAuthContext } from "@/context/AuthContext";
import { useModalState } from "@/hooks/useModalState";
import { title } from "@/components/primitives";
import { addToast } from "@/components/ui/toast";
import { pharmacyService } from "@/services/pharmacyService";
import { MedicinePurchase, PharmacySettings } from "@/types/models";

// The only things a recorded sale can still change. Items and amounts are
// frozen: stock was deducted and the ledger filing queued in the same
// transaction that created the sale, and nothing re-balances either
// afterwards — corrections go through a Return and a new sale.
interface EditableFields {
  patientName: string;
  medicationDurationDays: number;
  paymentType: string;
  paymentNote: string;
}

const formFromPurchase = (purchase: MedicinePurchase): EditableFields => ({
  patientName: purchase.patientName || "",
  medicationDurationDays: purchase.medicationDurationDays || 0,
  paymentType: purchase.paymentType || "",
  paymentNote: purchase.paymentNote || "",
});

const npr = (amount: number | undefined) =>
  `NPR ${(amount || 0).toLocaleString()}`;

export default function PurchaseEditPage() {
  const { purchaseId } = useParams<{ purchaseId: string }>();
  const navigate = useNavigate();
  const { clinicId, currentUser, userData } = useAuthContext();
  const branchId = userData?.branchId ?? null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [purchase, setPurchase] = useState<MedicinePurchase | null>(null);
  const [pharmacySettings, setPharmacySettings] =
    useState<PharmacySettings | null>(null);

  const [form, setForm] = useState<EditableFields>({
    patientName: "",
    medicationDurationDays: 0,
    paymentType: "cash",
    paymentNote: "",
  });
  const [savedForm, setSavedForm] = useState<EditableFields | null>(null);

  const confirmModalState = useModalState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!purchaseId || !clinicId) return;

      try {
        setLoading(true);

        const purchaseData =
          await pharmacyService.getMedicinePurchaseById(purchaseId);

        if (!purchaseData || purchaseData.clinicId !== clinicId) {
          addToast({
            title: "Error",
            description: "Purchase record not found",
            color: "danger",
          });
          navigate("/dashboard/pharmacy");

          return;
        }
        if (branchId && purchaseData.branchId !== branchId) {
          addToast({
            title: "Access denied",
            description: "You can only edit purchases for your branch.",
            color: "danger",
          });
          navigate("/dashboard/pharmacy");

          return;
        }

        const settingsData =
          await pharmacyService.getPharmacySettings(clinicId);

        setPurchase(purchaseData);
        setPharmacySettings(settingsData as PharmacySettings);

        const initial = formFromPurchase(purchaseData);

        setForm(initial);
        setSavedForm(initial);
      } catch (error) {
        console.error("Error loading purchase data:", error);
        addToast({
          title: "Error",
          description: "Failed to load purchase data. Please try again.",
          color: "danger",
        });
        navigate("/dashboard/pharmacy");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [purchaseId, clinicId, userData?.branchId, navigate]);

  const isDirty =
    savedForm !== null && JSON.stringify(form) !== JSON.stringify(savedForm);

  const paymentOptions: { key: string; name: string }[] = (
    pharmacySettings?.enabledPaymentMethods || []
  )
    .filter((method) => method.isEnabled)
    .map((method) => ({ key: method.key, name: method.name }));

  // A sale recorded with a method that has since been disabled in Settings
  // still needs to show its own value, not an empty select.
  if (
    form.paymentType &&
    !paymentOptions.some((option) => option.key === form.paymentType)
  ) {
    paymentOptions.push({ key: form.paymentType, name: form.paymentType });
  }

  const handleSave = async () => {
    if (!purchase || !currentUser) return;

    try {
      setSaving(true);

      const updateData = {
        patientName: form.patientName.trim(),
        medicationDurationDays: Math.max(0, form.medicationDurationDays || 0),
        paymentNote: form.paymentNote.trim(),
        updatedBy: currentUser.uid,
        // Older records can lack a payment type; don't write an empty one.
        ...(form.paymentType ? { paymentType: form.paymentType } : {}),
      };

      await pharmacyService.updateMedicinePurchase(purchase.id, updateData);

      addToast({
        title: "Success",
        description: "Purchase updated successfully!",
        color: "success",
      });

      navigate(`/dashboard/pharmacy/purchase/${purchase.id}`);
    } catch (error: any) {
      console.error("Error updating purchase:", error);
      addToast({
        title: "Error",
        description:
          error?.message || "Failed to update purchase. Please try again.",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => navigate(`/dashboard/pharmacy/purchase/${purchaseId}`);

  const handleCancel = () => {
    if (isDirty) {
      confirmModalState.open();
    } else {
      goBack();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className={`${title({ size: "lg" })} text-primary`}>
            Edit Purchase
          </h1>
          <p className="text-default-500 mt-1">Loading purchase data...</p>
        </div>
        <Card>
          <CardBody className="flex items-center justify-center py-12">
            <Spinner label="Loading purchase data..." size="lg" />
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className={`${title({ size: "lg" })} text-primary`}>
            Edit Purchase
          </h1>
          <p className="text-default-500 mt-1">Purchase not found</p>
        </div>
        <Card>
          <CardBody className="text-center py-12">
            <p className="text-default-500">Purchase record not found.</p>
            <Button
              className="mt-4"
              color="primary"
              onPress={() => navigate("/dashboard/pharmacy")}
            >
              Back to Pharmacy
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  const isLocked = Boolean(purchase.irdSynced);
  const taxLabel = pharmacySettings?.taxLabel || "Tax";
  const returnedAmount =
    purchase.totalReturnedAmount && purchase.totalReturnedAmount > 0
      ? purchase.totalReturnedAmount
      : (purchase.returns ?? []).reduce(
          (sum, r) => sum + Math.abs(r.totalAmount || 0),
          0,
        );

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Button isIconOnly variant="light" onPress={handleCancel}>
                <IoArrowBackOutline size={20} />
              </Button>
              <h1 className={`${title({ size: "lg" })} text-primary`}>
                Edit Purchase
              </h1>
            </div>
            <p className="text-default-500">
              Purchase No: {purchase.purchaseNo} •{" "}
              {purchase.purchaseDate.toLocaleDateString()}
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              color="danger"
              isDisabled={saving}
              variant="light"
              onPress={handleCancel}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={saving || isLocked || !isDirty}
              isLoading={saving}
              startContent={<IoSaveOutline size={18} />}
              title={
                isLocked
                  ? "Locked — this purchase is IRD-synced and cannot be edited. Use Record Return instead."
                  : undefined
              }
              onPress={handleSave}
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        {isLocked && (
          <div className="bg-amber-50 border border-amber-200 rounded px-4 py-3 text-[13px] text-amber-800">
            <strong>This purchase has already been synced to IRD.</strong>{" "}
            Per IRD compliance rules, nothing on it can be changed anymore —
            not the amounts, and not patient or payment details either.
            Saving has been disabled below. To reverse or adjust a synced
            purchase, use Record Return from the purchase detail page instead.
          </div>
        )}

        <Card>
          <CardBody className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                isDisabled={isLocked}
                label="Patient Name (optional)"
                placeholder="Enter patient name"
                value={form.patientName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, patientName: e.target.value }))
                }
              />

              <Input
                description="Controls the reminder shown in the pharmacy list"
                isDisabled={isLocked}
                label="Medication Duration (days)"
                min={0}
                placeholder="e.g., 30"
                type="number"
                value={
                  form.medicationDurationDays
                    ? form.medicationDurationDays.toString()
                    : ""
                }
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    medicationDurationDays: Math.max(
                      0,
                      parseInt(e.target.value, 10) || 0,
                    ),
                  }))
                }
              />

              <Select
                disallowEmptySelection
                isDisabled={isLocked}
                isRequired
                label="Payment Type"
                selectedKeys={form.paymentType ? [form.paymentType] : []}
                onSelectionChange={(keys) => {
                  const selectedKey = Array.from(keys)[0] as string;

                  setForm((prev) => ({ ...prev, paymentType: selectedKey }));
                }}
              >
                {paymentOptions.map((option) => (
                  <SelectItem key={option.key}>{option.name}</SelectItem>
                ))}
              </Select>

              <Input
                isDisabled={isLocked}
                label="Payment Note (optional)"
                placeholder="Add any payment related notes..."
                value={form.paymentNote}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, paymentNote: e.target.value }))
                }
              />
            </div>

            <Divider />

            <div>
              <h4 className="text-stat-sm font-medium">Items Sold</h4>
              <p className="text-[13px] text-default-500 mt-1 mb-4">
                Items and amounts can&apos;t be changed after a sale — the
                stock was already deducted and the invoice recorded when it
                was made. To correct a line, record a Return from the purchase
                detail page and make a new sale.
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-default-500 border-b border-default-200">
                      <th className="py-2 pr-3 font-medium">Item</th>
                      <th className="py-2 pr-3 font-medium">Batch</th>
                      <th className="py-2 pr-3 font-medium">Expiry</th>
                      <th className="py-2 pr-3 font-medium text-right">Qty</th>
                      <th className="py-2 pr-3 font-medium text-right">
                        MRP
                      </th>
                      <th className="py-2 pr-3 font-medium text-right">
                        {taxLabel} %
                      </th>
                      <th className="py-2 pr-3 font-medium">HS Code</th>
                      <th className="py-2 font-medium text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchase.items.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-default-100 last:border-0"
                      >
                        <td className="py-2 pr-3">
                          <div>{item.medicineName}</div>
                          {item.type === "item" && (
                            <div className="text-tiny text-default-400">
                              Item
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-3">{item.batchNumber || "—"}</td>
                        <td className="py-2 pr-3">{item.expiryDate || "—"}</td>
                        <td className="py-2 pr-3 text-right">
                          {item.quantity}
                        </td>
                        <td className="py-2 pr-3 text-right">
                          {npr(item.mrp ?? item.salePrice)}
                        </td>
                        <td className="py-2 pr-3 text-right">
                          {item.taxRate ?? purchase.taxPercentage}
                        </td>
                        <td className="py-2 pr-3">{item.hsCode || "—"}</td>
                        <td className="py-2 text-right">{npr(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Divider />

            <div>
              <h4 className="text-stat-sm font-medium mb-4">
                Purchase Summary
              </h4>
              <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <dt className="text-default-500">Total</dt>
                  <dd>{npr(purchase.total)}</dd>
                </div>
                <div>
                  <dt className="text-default-500">Discount</dt>
                  <dd>{npr(purchase.discount)}</dd>
                </div>
                <div>
                  <dt className="text-default-500">{taxLabel} Amount</dt>
                  <dd>{npr(purchase.taxAmount)}</dd>
                </div>
                <div>
                  <dt className="text-default-500">Net Amount</dt>
                  <dd className="font-bold text-stat-sm">
                    {npr(purchase.netAmount)}
                  </dd>
                </div>
                {returnedAmount > 0 && (
                  <div>
                    <dt className="text-default-500">Returned</dt>
                    <dd>{npr(returnedAmount)}</dd>
                  </div>
                )}
              </dl>
            </div>
          </CardBody>
        </Card>
      </div>

      <Modal
        isDismissable={false}
        isOpen={confirmModalState.isOpen}
        onClose={confirmModalState.forceClose}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            Discard Changes?
          </ModalHeader>
          <ModalBody>
            <p>
              You have unsaved changes. Are you sure you want to discard them
              and go back?
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              color="default"
              variant="light"
              onPress={confirmModalState.forceClose}
            >
              Stay and Continue Editing
            </Button>
            <Button color="danger" onPress={goBack}>
              Discard Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
