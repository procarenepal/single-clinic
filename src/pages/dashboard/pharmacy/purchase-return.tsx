import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import { Divider } from "@heroui/divider";
import { Spinner } from "@heroui/spinner";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/modal";
import {
  IoArrowBackOutline,
  IoSaveOutline,
  IoWarningOutline,
  IoReloadOutline,
} from "react-icons/io5";
import { addToast } from "@heroui/toast";

import { title } from "@/components/primitives";
import { useAuthContext } from "@/context/AuthContext";
import { pharmacyService } from "@/services/pharmacyService";
import {
  MedicinePurchase,
  MedicinePurchaseItem,
  MedicinePurchaseReturn,
  MedicinePurchaseReturnItem,
} from "@/types/models";

interface LocalReturnItem {
  id: string;
  purchaseItemId: string;
  medicineId: string;
  medicineName: string;
  soldQuantity: number;
  alreadyReturnedQuantity: number;
  remainingQuantity: number;
  unitPrice: number;
  requestedQuantity: number;
  lineAmount: number;
  reason: string;
}

export default function PurchaseReturnPage() {
  const { purchaseId } = useParams<{ purchaseId: string }>();
  const navigate = useNavigate();
  const { currentUser, clinicId, userData } = useAuthContext();
  const branchId = userData?.branchId ?? null;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [purchase, setPurchase] = useState<MedicinePurchase | null>(null);
  const [returnItems, setReturnItems] = useState<LocalReturnItem[]>([]);
  const [refundMethod, setRefundMethod] = useState<string>("cash");
  const [notes, setNotes] = useState<string>("");
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  useEffect(() => {
    const loadPurchase = async () => {
      if (!purchaseId) return;
      try {
        setLoading(true);
        const data = await pharmacyService.getMedicinePurchaseById(purchaseId);

        if (!data) {
          addToast({
            title: "Not found",
            description: "Purchase record could not be found.",
            color: "danger",
          });
          navigate("/dashboard/pharmacy");

          return;
        }

        if (!data.clinicId || data.clinicId.trim() === "") {
          console.error("Purchase missing clinicId:", data);
          addToast({
            title: "Data Error",
            description:
              "Purchase record is missing clinic information. Please contact support.",
            color: "danger",
          });
          navigate("/dashboard/pharmacy");

          return;
        }
        if (branchId && data.branchId !== branchId) {
          addToast({
            title: "Access denied",
            description: "You can only process returns for your branch.",
            color: "danger",
          });
          navigate("/dashboard/pharmacy");

          return;
        }

        setPurchase(data);

        // Build local return items with already returned quantity
        const existingReturns = data.returns ?? [];

        const aggregateReturnedByItemId = new Map<string, number>();

        existingReturns.forEach((ret) => {
          ret.items.forEach((it) => {
            const prev = aggregateReturnedByItemId.get(it.purchaseItemId) || 0;

            aggregateReturnedByItemId.set(
              it.purchaseItemId,
              prev + it.quantity,
            );
          });
        });

        const items: LocalReturnItem[] = data.items.map(
          (item: MedicinePurchaseItem) => {
            const returnedQty = aggregateReturnedByItemId.get(item.id) || 0;
            const remaining = Math.max(0, item.quantity - returnedQty);
            const itemAmount =
              typeof item.amount === "number"
                ? item.amount
                : parseFloat(String(item.amount || 0));
            const itemQty =
              typeof item.quantity === "number"
                ? item.quantity
                : parseFloat(String(item.quantity || 0));
            const unitPrice =
              itemQty > 0
                ? parseFloat((itemAmount / itemQty).toFixed(2))
                : item.salePrice || 0;

            return {
              id: item.id,
              purchaseItemId: item.id,
              medicineId: item.medicineId,
              medicineName: item.medicineName,
              soldQuantity: item.quantity,
              alreadyReturnedQuantity: returnedQty,
              remainingQuantity: remaining,
              unitPrice,
              requestedQuantity: 0,
              lineAmount: 0,
              reason: "",
            };
          },
        );

        setReturnItems(items);
      } catch (error) {
        console.error("Error loading purchase for return:", error);
        addToast({
          title: "Error",
          description: "Failed to load purchase for return.",
          color: "danger",
        });
        navigate("/dashboard/pharmacy");
      } finally {
        setLoading(false);
      }
    };

    loadPurchase();
  }, [purchaseId, navigate]);

  const handleQuantityChange = (rowId: string, value: string) => {
    const qty = parseFloat(value || "0");

    setReturnItems((prev) =>
      prev.map((item) => {
        if (item.id !== rowId) return item;
        const safeQty = Math.max(0, Math.min(qty, item.remainingQuantity));
        const newLineAmount = parseFloat((safeQty * item.unitPrice).toFixed(2));

        return {
          ...item,
          requestedQuantity: safeQty,
          lineAmount: newLineAmount,
        };
      }),
    );
  };

  const handleReasonChange = (rowId: string, reason: string) => {
    setReturnItems((prev) =>
      prev.map((item) => (item.id === rowId ? { ...item, reason } : item)),
    );
  };

  const totalReturnAmount = useMemo(
    () =>
      returnItems.reduce((sum, item) => {
        return sum + (item.lineAmount || 0);
      }, 0),
    [returnItems],
  );

  const hasAnyQuantity = returnItems.some((item) => item.requestedQuantity > 0);

  const validateReturn = () => {
    if (!currentUser) {
      addToast({
        title: "Error",
        description: "User not authenticated. Please refresh and try again.",
        color: "danger",
      });

      return false;
    }

    if (!purchase) {
      addToast({
        title: "Error",
        description: "Purchase data not loaded. Please refresh and try again.",
        color: "danger",
      });

      return false;
    }

    // Use purchase's clinicId as fallback if context clinicId is not available.
    // Branch is optional and may legitimately be empty for some data.
    const effectiveClinicId = clinicId || purchase.clinicId;

    if (!effectiveClinicId || effectiveClinicId.trim() === "") {
      console.error("Missing clinicId:", {
        clinicId,
        purchaseClinicId: purchase.clinicId,
        purchase,
      });
      addToast({
        title: "Error",
        description:
          "Missing clinic information. Please refresh and try again.",
        color: "danger",
      });

      return false;
    }

    if (!hasAnyQuantity) {
      addToast({
        title: "Validation Error",
        description: "Please enter return quantity for at least one item.",
        color: "warning",
      });

      return false;
    }

    const invalid = returnItems.find(
      (item) =>
        item.requestedQuantity < 0 ||
        item.requestedQuantity > item.remainingQuantity,
    );

    if (invalid) {
      addToast({
        title: "Validation Error",
        description:
          "Return quantity must not exceed remaining quantity for any item.",
        color: "warning",
      });

      return false;
    }

    if (totalReturnAmount <= 0) {
      addToast({
        title: "Validation Error",
        description: "Return amount must be greater than 0.",
        color: "warning",
      });

      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!purchase || !currentUser) {
      addToast({
        title: "Error",
        description:
          "Missing purchase data or user authentication. Please refresh and try again.",
        color: "danger",
      });

      return;
    }

    if (!validateReturn()) return;

    // Use purchase's clinicId/branchId as fallback if userData is not available.
    // Branch is optional; if it's missing we'll store an empty string.
    const effectiveClinicId = clinicId || purchase.clinicId;
    const effectiveBranchId = userData?.branchId ?? purchase.branchId ?? "";

    if (!effectiveClinicId || effectiveClinicId.trim() === "") {
      console.error("Missing clinicId in handleSubmit:", {
        clinicId,
        purchaseClinicId: purchase.clinicId,
        purchase,
      });
      addToast({
        title: "Error",
        description:
          "Missing clinic information. Please refresh and try again.",
        color: "danger",
      });

      return;
    }

    try {
      setSubmitting(true);

      const items: MedicinePurchaseReturnItem[] = returnItems
        .filter((item) => item.requestedQuantity > 0)
        .map((item) => {
          const itemData: any = {
            id: crypto.randomUUID(),
            purchaseItemId: item.purchaseItemId,
            medicineId: item.medicineId,
            medicineName: item.medicineName,
            quantity: item.requestedQuantity,
            amount: -Math.abs(item.lineAmount),
          };

          // Only include reason if it's not empty
          if (item.reason && item.reason.trim()) {
            itemData.reason = item.reason.trim();
          }

          return itemData;
        });

      const returnRecord: Omit<MedicinePurchaseReturn, "id" | "createdAt"> = {
        clinicId: effectiveClinicId,
        branchId: effectiveBranchId,
        purchaseId: purchase.id,
        totalAmount: -Math.abs(totalReturnAmount),
        refundMethod,
        items,
        createdBy: currentUser.uid,
        // Only include notes if it's not empty
        ...(notes && notes.trim() && { notes: notes.trim() }),
      };

      await pharmacyService.addMedicinePurchaseReturn(
        purchase.id,
        returnRecord,
      );

      addToast({
        title: "Return recorded",
        description: "Sales return created successfully.",
        color: "success",
      });

      navigate(`/dashboard/pharmacy/purchase/${purchase.id}`);
    } catch (error: any) {
      console.error("Error creating purchase return:", error);
      addToast({
        title: "Error",
        description:
          error?.message || "Failed to create return. Please try again.",
        color: "danger",
      });
    } finally {
      setSubmitting(false);
      setConfirmModalOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <Button isIconOnly variant="light" onPress={() => navigate(-1)}>
            <IoArrowBackOutline />
          </Button>
          <h1 className={`${title({ size: "lg" })} text-primary`}>
            Record Return
          </h1>
        </div>
        <Card
          className="border border-neutral-200 dark:border-neutral-800"
          shadow="none"
        >
          <CardBody className="flex items-center justify-center py-12">
            <Spinner label="Loading purchase details..." size="lg" />
          </CardBody>
        </Card>
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <Button
            isIconOnly
            variant="light"
            onPress={() => navigate("/dashboard/pharmacy")}
          >
            <IoArrowBackOutline />
          </Button>
          <h1 className={`${title({ size: "lg" })} text-primary`}>
            Record Return
          </h1>
        </div>
        <Card
          className="border border-neutral-200 dark:border-neutral-800"
          shadow="none"
        >
          <CardBody className="py-10 text-center">
            <p className="text-default-500">Purchase not found.</p>
            <Button
              className="mt-4"
              onPress={() => navigate("/dashboard/pharmacy")}
            >
              Back to Pharmacy
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  const totalReturnedAmount =
    purchase.totalReturnedAmount && purchase.totalReturnedAmount > 0
      ? purchase.totalReturnedAmount
      : (purchase.returns ?? []).reduce(
          (sum, r) => sum + Math.abs(r.totalAmount || 0),
          0,
        );

  const remainingNetAfterReturns = Math.max(
    0,
    purchase.netAmount - totalReturnedAmount,
  );

  const allFullyReturned = returnItems.every(
    (item) => item.remainingQuantity === 0,
  );

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              isIconOnly
              variant="light"
              onPress={() =>
                navigate(`/dashboard/pharmacy/purchase/${purchase.id}`)
              }
            >
              <IoArrowBackOutline />
            </Button>
            <div>
              <h1 className={`${title({ size: "lg" })} text-primary`}>
                Record Return
              </h1>
              <p className="text-default-500 mt-1">
                Purchase No: {purchase.purchaseNo} •{" "}
                {purchase.purchaseDate.toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="light"
              onPress={() =>
                navigate(`/dashboard/pharmacy/purchase/${purchase.id}`)
              }
            >
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={submitting || allFullyReturned}
              startContent={<IoSaveOutline />}
              onPress={() => {
                if (validateReturn()) {
                  setConfirmModalOpen(true);
                }
              }}
            >
              Save Return
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card
            className="border border-neutral-200 dark:border-neutral-800"
            shadow="none"
          >
            <CardBody className="py-4">
              <p className="text-sm text-default-500">Original Net Amount</p>
              <p className="text-stat font-semibold">
                NPR {purchase.netAmount.toLocaleString()}
              </p>
            </CardBody>
          </Card>
          <Card
            className="border border-neutral-200 dark:border-neutral-800"
            shadow="none"
          >
            <CardBody className="py-4">
              <p className="text-sm text-default-500">Total Returned So Far</p>
              <p className="text-stat font-semibold text-warning-600">
                NPR {totalReturnedAmount.toLocaleString()}
              </p>
            </CardBody>
          </Card>
          <Card
            className="border border-neutral-200 dark:border-neutral-800"
            shadow="none"
          >
            <CardBody className="py-4">
              <p className="text-sm text-default-500">Net After Returns</p>
              <p className="text-stat font-semibold text-success">
                NPR {remainingNetAfterReturns.toLocaleString()}
              </p>
            </CardBody>
          </Card>
        </div>

        {/* Return form */}
        <Card
          className="border border-neutral-200 dark:border-neutral-800"
          shadow="none"
        >
          <CardHeader className="flex flex-col gap-1 border-b border-default-200 bg-default-50">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <IoReloadOutline className="text-primary" />
                <h3 className="text-stat-sm font-semibold">Return Items</h3>
              </div>
              {allFullyReturned && (
                <div className="flex items-center gap-1 text-sm text-warning-600">
                  <IoWarningOutline />
                  <span>All items are already fully returned.</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <Table removeWrapper aria-label="Return items table">
              <TableHeader>
                <TableColumn>MEDICINE</TableColumn>
                <TableColumn>QTY SOLD</TableColumn>
                <TableColumn>QTY RETURNED</TableColumn>
                <TableColumn>AVAILABLE</TableColumn>
                <TableColumn>RETURN QTY</TableColumn>
                <TableColumn>REASON</TableColumn>
                <TableColumn>LINE AMT</TableColumn>
              </TableHeader>
              <TableBody emptyContent="No items available for return.">
                {returnItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{item.medicineName}</span>
                      </div>
                    </TableCell>
                    <TableCell>{item.soldQuantity}</TableCell>
                    <TableCell>{item.alreadyReturnedQuantity}</TableCell>
                    <TableCell>
                      <span
                        className={
                          item.remainingQuantity === 0
                            ? "text-danger font-medium"
                            : "text-success font-medium"
                        }
                      >
                        {item.remainingQuantity}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Input
                        isDisabled={item.remainingQuantity === 0}
                        max={item.remainingQuantity}
                        min={0}
                        size="sm"
                        type="number"
                        value={item.requestedQuantity.toString()}
                        onChange={(e) =>
                          handleQuantityChange(item.id, e.target.value)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        isDisabled={item.remainingQuantity === 0}
                        placeholder="Optional reason"
                        size="sm"
                        value={item.reason}
                        onChange={(e) =>
                          handleReasonChange(item.id, e.target.value)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">
                        NPR {Math.round(item.lineAmount).toLocaleString()}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Divider />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <Select
                  label="Refund Method"
                  selectedKeys={[refundMethod]}
                  onSelectionChange={(keys) =>
                    setRefundMethod(Array.from(keys)[0] as string)
                  }
                >
                  <SelectItem key="cash">Cash</SelectItem>
                  <SelectItem key="adjustment">Adjust in next bill</SelectItem>
                  <SelectItem key="other">Other</SelectItem>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Input
                  label="Notes (optional)"
                  placeholder="Add any notes about this return..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <div className="text-right">
                <p className="text-sm text-default-500">Return Amount</p>
                <p className="text-stat font-semibold text-warning-600">
                  NPR {Math.round(totalReturnAmount).toLocaleString()}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Confirm modal */}
      <Modal
        isDismissable={!submitting}
        isOpen={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
      >
        <ModalContent>
          <ModalHeader>Confirm Return</ModalHeader>
          <ModalBody>
            <p>
              You are about to record a return for this purchase with total
              amount{" "}
              <span className="font-semibold">
                NPR {Math.round(totalReturnAmount).toLocaleString()}
              </span>
              . This will update the purchase record and be visible in history.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              isDisabled={submitting}
              variant="light"
              onPress={() => setConfirmModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={submitting}
              isLoading={submitting}
              startContent={<IoSaveOutline />}
              onPress={handleSubmit}
            >
              Confirm Return
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
