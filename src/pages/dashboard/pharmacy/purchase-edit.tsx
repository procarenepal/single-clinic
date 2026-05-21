import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardBody } from "@heroui/card";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Select, SelectItem } from "@heroui/select";
import { Autocomplete, AutocompleteItem } from "@heroui/autocomplete";
import { Divider } from "@heroui/divider";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Spinner } from "@heroui/spinner";
import {
  IoArrowBackOutline,
  IoSaveOutline,
  IoAddOutline,
  IoTrashOutline,
  IoMedicalOutline,
  IoStorefrontOutline,
} from "react-icons/io5";

import { useAuthContext } from "@/context/AuthContext";
import { useModalState } from "@/hooks/useModalState";
import { title } from "@/components/primitives";
import { addToast } from "@/components/ui/toast";
import { medicineService } from "@/services/medicineService";
import { pharmacyService } from "@/services/pharmacyService";
import { itemService } from "@/services/itemService";
import {
  Medicine,
  Item,
  MedicinePurchase,
  MedicinePurchaseItem,
  PharmacySettings,
} from "@/types/models";

// Local types for form handling
interface LocalPurchaseItem {
  id: string;
  type: "medicine" | "item";
  productId: string;
  productName: string;
  expiryDate?: string;
  salePrice: number;
  quantity: number;
  amount: number;
}

export default function PurchaseEditPage() {
  const { purchaseId } = useParams<{ purchaseId: string }>();
  const navigate = useNavigate();
  const { clinicId, currentUser, userData } = useAuthContext();
  const branchId = userData?.branchId ?? null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Data
  const [purchase, setPurchase] = useState<MedicinePurchase | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [pharmacySettings, setPharmacySettings] =
    useState<PharmacySettings | null>(null);

  // Form state
  const [purchaseItems, setPurchaseItems] = useState<LocalPurchaseItem[]>([]);
  const [purchaseForm, setPurchaseForm] = useState({
    total: 0,
    discount: 0,
    taxPercentage: 0,
    taxAmount: 0,
    netAmount: 0,
    paymentType: "cash" as string,
    paymentNote: "",
    patientName: "",
    medicationDurationDays: 0,
  });

  // Modal state
  const confirmModalState = useModalState(false);

  // Load data on component mount
  useEffect(() => {
    const loadData = async () => {
      if (!purchaseId || !clinicId) return;

      try {
        setLoading(true);

        const purchaseData =
          await pharmacyService.getMedicinePurchaseById(purchaseId);

        if (!purchaseData) {
          addToast({
            title: "Error",
            description: "Purchase record not found",
            color: "danger",
          });
          navigate("/dashboard/pharmacy");

          return;
        }
        if (purchaseData.clinicId !== clinicId) {
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

        const invoiceBranchId = purchaseData.branchId || undefined;
        const [medicinesData, itemsData, settingsData] = await Promise.all([
          medicineService.getMedicinesByClinic(
            clinicId,
            undefined,
            invoiceBranchId,
          ),
          itemService.getItemsByClinic(clinicId, invoiceBranchId),
          pharmacyService.getPharmacySettings(clinicId, invoiceBranchId),
        ]);

        setPurchase(purchaseData);
        setMedicines(medicinesData as Medicine[]);
        setItems(itemsData);
        setPharmacySettings(settingsData as PharmacySettings);

        // Convert purchase items to form format
        const formattedItems: LocalPurchaseItem[] = purchaseData.items.map(
          (item) => ({
            id: item.id,
            type: (item.type || "medicine") as "medicine" | "item",
            productId: item.medicineId, // Use medicineId as productId for compatibility
            productName: item.medicineName,
            expiryDate: item.expiryDate,
            salePrice: item.salePrice,
            quantity: item.quantity,
            amount: item.amount,
          }),
        );

        setPurchaseItems(formattedItems);

        // Set form values
        setPurchaseForm({
          total: purchaseData.total,
          discount: purchaseData.discount,
          taxPercentage: purchaseData.taxPercentage,
          taxAmount: purchaseData.taxAmount,
          netAmount: purchaseData.netAmount,
          paymentType: purchaseData.paymentType,
          paymentNote: purchaseData.paymentNote || "",
          patientName: purchaseData.patientName || "",
          medicationDurationDays: purchaseData.medicationDurationDays || 0,
        });
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

  // Calculate amounts when items change
  useEffect(() => {
    const total = purchaseItems.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = Math.round((total * purchaseForm.taxPercentage) / 100);
    const netAmount = Math.round(total + taxAmount - purchaseForm.discount);

    setPurchaseForm((prev) => ({
      ...prev,
      total,
      taxAmount,
      netAmount: Math.max(0, netAmount),
    }));
  }, [purchaseItems, purchaseForm.discount, purchaseForm.taxPercentage]);

  // Add new purchase item row
  const addPurchaseItem = () => {
    setPurchaseItems((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type: "medicine",
        productId: "",
        productName: "",
        expiryDate: "",
        salePrice: 0,
        quantity: 1,
        amount: 0,
      },
    ]);
  };

  // Remove purchase item row
  const removePurchaseItem = (id: string) => {
    if (purchaseItems.length > 1) {
      setPurchaseItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  // Update purchase item
  const updatePurchaseItem = (
    id: string,
    field: keyof LocalPurchaseItem,
    value: any,
  ) => {
    setPurchaseItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value };

          // Auto-select product details when product is selected
          if (field === "productId") {
            if (updatedItem.type === "medicine") {
              const selectedMedicine = medicines.find((m) => m.id === value);

              if (selectedMedicine) {
                updatedItem.productName = selectedMedicine.name;
                updatedItem.salePrice = selectedMedicine.price || 0;
                updatedItem.expiryDate = selectedMedicine.expiryDate
                  ? selectedMedicine.expiryDate.toISOString().split("T")[0]
                  : "";
                updatedItem.amount =
                  updatedItem.quantity * updatedItem.salePrice;
              }
            } else if (updatedItem.type === "item") {
              const selectedItem = items.find((i) => i.id === value);

              if (selectedItem) {
                updatedItem.productName = selectedItem.name;
                updatedItem.salePrice = selectedItem.salePrice || 0;
                updatedItem.expiryDate = "";
                updatedItem.amount =
                  updatedItem.quantity * updatedItem.salePrice;
              }
            }
          }

          // When type changes, reset the item
          if (field === "type") {
            updatedItem.productId = "";
            updatedItem.productName = "";
            updatedItem.salePrice = 0;
            updatedItem.expiryDate = "";
            updatedItem.amount = 0;
          }

          // Auto-calculate amount when quantity or price changes
          if (field === "quantity" || field === "salePrice") {
            updatedItem.amount = updatedItem.quantity * updatedItem.salePrice;
          }

          return updatedItem;
        }

        return item;
      }),
    );
  };

  // Get available payment methods
  const getAvailablePaymentMethods = () => {
    if (!pharmacySettings?.enabledPaymentMethods) return [];

    return pharmacySettings.enabledPaymentMethods.filter(
      (method) => method.isEnabled,
    );
  };

  // Handle save changes
  const handleSave = async () => {
    if (!purchase || !currentUser) return;

    // Validate form
    const hasValidItems = purchaseItems.some(
      (item) => item.productId && item.quantity > 0 && item.salePrice > 0,
    );

    if (!hasValidItems) {
      addToast({
        title: "Validation Error",
        description: "Please add at least one valid item.",
        color: "warning",
      });

      return;
    }

    try {
      setSaving(true);

      // Convert LocalPurchaseItem back to MedicinePurchaseItem format
      const updatedItems: MedicinePurchaseItem[] = purchaseItems
        .filter((item) => item.productId && item.quantity > 0)
        .map((item) => ({
          id: item.id,
          medicineId: item.productId,
          medicineName: item.productName,
          expiryDate: item.expiryDate || "",
          salePrice: item.salePrice,
          quantity: item.quantity,
          amount: item.amount,
          type: item.type,
        }));

      const updateData = {
        items: updatedItems,
        total: purchaseForm.total,
        discount: purchaseForm.discount,
        taxPercentage: purchaseForm.taxPercentage,
        taxAmount: purchaseForm.taxAmount,
        netAmount: purchaseForm.netAmount,
        paymentType: purchaseForm.paymentType,
        paymentNote: purchaseForm.paymentNote,
        patientName: purchaseForm.patientName || undefined,
        medicationDurationDays:
          purchaseForm.medicationDurationDays || undefined,
        updatedBy: currentUser.uid,
        updatedAt: new Date(),
      };

      await pharmacyService.updateMedicinePurchase(purchase.id, updateData);

      addToast({
        title: "Success",
        description: "Purchase updated successfully!",
        color: "success",
      });

      // Navigate back to detail page
      navigate(`/dashboard/pharmacy/purchase/${purchase.id}`);
    } catch (error) {
      console.error("Error updating purchase:", error);
      addToast({
        title: "Error",
        description: "Failed to update purchase. Please try again.",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  // Handle cancel with confirmation
  const handleCancel = () => {
    confirmModalState.open();
  };

  const confirmCancel = () => {
    navigate(`/dashboard/pharmacy/purchase/${purchaseId}`);
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

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Button
                isIconOnly
                variant="light"
                onPress={() =>
                  navigate(`/dashboard/pharmacy/purchase/${purchaseId}`)
                }
              >
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
              isDisabled={saving}
              isLoading={saving}
              startContent={<IoSaveOutline size={18} />}
              onPress={handleSave}
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>

        {/* Edit Form */}
        <Card>
          <CardBody className="space-y-6">
            {/* Patient Name */}
            <Input
              label="Patient Name (optional)"
              placeholder="Enter patient name"
              value={purchaseForm.patientName}
              onChange={(e) =>
                setPurchaseForm((prev) => ({
                  ...prev,
                  patientName: e.target.value,
                }))
              }
            />

            <Input
              description="Controls the reminder shown in the pharmacy list"
              label="Medication Duration (days)"
              min={0}
              placeholder="e.g., 30"
              type="number"
              value={
                purchaseForm.medicationDurationDays
                  ? purchaseForm.medicationDurationDays.toString()
                  : ""
              }
              onChange={(e) =>
                setPurchaseForm((prev) => ({
                  ...prev,
                  medicationDurationDays: Math.max(
                    0,
                    parseInt(e.target.value, 10) || 0,
                  ),
                }))
              }
            />

            {/* Purchase Items */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-stat-sm font-medium">Purchase Items</h4>
                <Button
                  color="primary"
                  size="sm"
                  startContent={<IoAddOutline />}
                  variant="flat"
                  onPress={addPurchaseItem}
                >
                  Add Item
                </Button>
              </div>

              <div className="space-y-4">
                {purchaseItems.map((item) => (
                  <Card key={item.id} className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                      <div>
                        <Select
                          disallowEmptySelection
                          isRequired
                          label="Type *"
                          selectedKeys={[item.type]}
                          onSelectionChange={(keys) => {
                            const selectedType = Array.from(keys)[0] as
                              | "medicine"
                              | "item";

                            updatePurchaseItem(item.id, "type", selectedType);
                          }}
                        >
                          <SelectItem
                            key="medicine"
                            startContent={<IoMedicalOutline />}
                          >
                            Medicine
                          </SelectItem>
                          <SelectItem
                            key="item"
                            startContent={<IoStorefrontOutline />}
                          >
                            Item
                          </SelectItem>
                        </Select>
                      </div>

                      <div
                        className={
                          item.type === "medicine"
                            ? "md:col-span-1"
                            : "md:col-span-2"
                        }
                      >
                        <Autocomplete
                          isRequired
                          label={`${item.type === "medicine" ? "Medicine" : "Item"} *`}
                          placeholder={`Select ${item.type}`}
                          selectedKey={item.productId}
                          onSelectionChange={(key) =>
                            updatePurchaseItem(
                              item.id,
                              "productId",
                              key as string,
                            )
                          }
                        >
                          {item.type === "medicine"
                            ? medicines.map((medicine) => (
                                <AutocompleteItem
                                  key={medicine.id}
                                  textValue={medicine.name}
                                >
                                  <div className="flex flex-col">
                                    <span className="text-small">
                                      {medicine.name}
                                    </span>
                                    <span className="text-tiny text-default-400">
                                      {medicine.genericName} • NPR{" "}
                                      {medicine.price}
                                    </span>
                                  </div>
                                </AutocompleteItem>
                              ))
                            : items.map((itemData) => (
                                <AutocompleteItem
                                  key={itemData.id}
                                  textValue={itemData.name}
                                >
                                  <div className="flex flex-col">
                                    <span className="text-small">
                                      {itemData.name}
                                    </span>
                                    <span className="text-tiny text-default-400">
                                      {itemData.category} • NPR{" "}
                                      {itemData.salePrice}
                                    </span>
                                  </div>
                                </AutocompleteItem>
                              ))}
                        </Autocomplete>
                      </div>

                      {item.type === "medicine" && (
                        <Input
                          isRequired
                          label="Expiry Date *"
                          type="date"
                          value={item.expiryDate || ""}
                          onChange={(e) =>
                            updatePurchaseItem(
                              item.id,
                              "expiryDate",
                              e.target.value,
                            )
                          }
                        />
                      )}

                      <Input
                        isRequired
                        label="Sale Price *"
                        startContent="NPR"
                        type="number"
                        value={(item.salePrice || 0).toString()}
                        onChange={(e) =>
                          updatePurchaseItem(
                            item.id,
                            "salePrice",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                      />

                      <Input
                        isRequired
                        label="Quantity *"
                        type="number"
                        value={(item.quantity || 0).toString()}
                        onChange={(e) =>
                          updatePurchaseItem(
                            item.id,
                            "quantity",
                            parseInt(e.target.value) || 0,
                          )
                        }
                      />

                      <div className="flex gap-2 items-end">
                        <Input
                          isReadOnly
                          label="Amount"
                          startContent="NPR"
                          type="number"
                          value={(item.amount || 0).toString()}
                        />
                        {purchaseItems.length > 1 && (
                          <Button
                            isIconOnly
                            color="danger"
                            variant="flat"
                            onPress={() => removePurchaseItem(item.id)}
                          >
                            <IoTrashOutline />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            <Divider />

            {/* Summary Section */}
            <div>
              <h4 className="text-stat-sm font-medium mb-4">
                Purchase Summary
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  isReadOnly
                  label="Total *"
                  startContent="NPR"
                  type="number"
                  value={(purchaseForm.total || 0).toString()}
                />

                <Input
                  label="Discount"
                  startContent="NPR"
                  type="number"
                  value={(purchaseForm.discount || 0).toString()}
                  onChange={(e) =>
                    setPurchaseForm((prev) => ({
                      ...prev,
                      discount: parseFloat(e.target.value) || 0,
                    }))
                  }
                />

                <Input
                  endContent="%"
                  label={`${pharmacySettings?.taxLabel || "Tax"} %`}
                  type="number"
                  value={(purchaseForm.taxPercentage || 0).toString()}
                  onChange={(e) =>
                    setPurchaseForm((prev) => ({
                      ...prev,
                      taxPercentage: parseFloat(e.target.value) || 0,
                    }))
                  }
                />

                <Input
                  isReadOnly
                  description="Based on total and tax%"
                  label="Tax Amount"
                  startContent="NPR"
                  type="number"
                  value={(purchaseForm.taxAmount || 0).toString()}
                />

                <Input
                  isReadOnly
                  classNames={{
                    input: "font-bold text-stat-sm",
                  }}
                  label="Net Amount *"
                  startContent="NPR"
                  type="number"
                  value={(purchaseForm.netAmount || 0).toString()}
                />

                <Select
                  disallowEmptySelection
                  isRequired
                  label="Choose Payment Type *"
                  selectedKeys={[purchaseForm.paymentType]}
                  onSelectionChange={(keys) => {
                    const selectedKey = Array.from(keys)[0] as string;

                    setPurchaseForm((prev) => ({
                      ...prev,
                      paymentType: selectedKey,
                    }));
                  }}
                >
                  {getAvailablePaymentMethods().map((method) => (
                    <SelectItem key={method.key}>{method.name}</SelectItem>
                  ))}
                </Select>

                <div className="md:col-span-2">
                  <Input
                    label="Payment Note (optional)"
                    placeholder="Add any payment related notes..."
                    value={purchaseForm.paymentNote}
                    onChange={(e) =>
                      setPurchaseForm((prev) => ({
                        ...prev,
                        paymentNote: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Confirmation Modal */}
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
            <Button color="danger" onPress={confirmCancel}>
              Discard Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
