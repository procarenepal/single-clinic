import React, { useState, useEffect } from "react";
import {
  IoAddOutline,
  IoSearchOutline,
  IoCreateOutline,
  IoArchiveOutline,
  IoWarningOutline,
  IoTrendingUpOutline,
  IoTrendingDownOutline,
  IoAlertCircleOutline,
  IoCheckmarkCircleOutline,
  IoTimeOutline,
  IoReceiptOutline,
} from "react-icons/io5";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/ui/modal";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Chip } from "@/components/ui/chip";
import { Card, CardBody } from "@/components/ui/card";
import { Tabs, Tab } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { addToast } from "@/components/ui/toast";
import { useAuthContext } from "@/context/AuthContext";
import { medicineService } from "@/services/medicineService";
import {
  Medicine,
  MedicineStock,
  StockTransaction,
  ClinicSettings,
} from "@/types/models";

interface StockTabProps {
  clinicSettings: ClinicSettings | null;
  onStatsChange: () => void;
  /**
   * Effective branch scope for this view.
   * For branch users this matches their fixed branchId.
   * For clinic admins this is the branch selected on the parent page.
   */
  effectiveBranchId?: string | null;
}

export default function StockTab({
  clinicSettings,
  onStatsChange,
  effectiveBranchId,
}: StockTabProps) {
  const { userData, clinicId, branchId } = useAuthContext();
  const [stockItems, setStockItems] = useState<
    (MedicineStock & { medicine: Medicine })[]
  >([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [stockTransactions, setStockTransactions] = useState<
    StockTransaction[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("overview");
  const [currentStockItem, setCurrentStockItem] = useState<
    (MedicineStock & { medicine: Medicine }) | null
  >(null);

  const [stockFormData, setStockFormData] = useState({
    medicineId: "",
    currentStock: "",
    minimumStock: "",
    maximumStock: "",
    reorderLevel: "",
    location: "",
  });

  const [transactionFormData, setTransactionFormData] = useState({
    medicineId: "",
    type: "purchase" as StockTransaction["type"],
    quantity: "",
    unitPrice: "",
    batchNumber: "",
    expiryDate: "",
    reason: "",
    invoiceNumber: "",
  });

  const branchScopeId = effectiveBranchId ?? branchId ?? null;

  useEffect(() => {
    if (clinicId) {
      fetchStockData();
      fetchMedicines();
    }
  }, [clinicId, branchScopeId]);

  const fetchStockData = async () => {
    if (!clinicId) return;

    setIsLoading(true);
    try {
      const data = await medicineService.getStockByClinic(
        clinicId,
        branchScopeId || undefined,
      );

      setStockItems(data);
    } catch (error) {
      console.error("Error fetching stock data:", error);
      addToast({
        title: "Error",
        description: "Failed to load stock data",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMedicines = async () => {
    if (!clinicId) return;

    try {
      const data = await medicineService.getMedicinesByClinic(
        clinicId,
        true,
        branchScopeId || undefined,
      );

      setMedicines(data);
    } catch (error) {
      console.error("Error fetching medicines:", error);
    }
  };

  const fetchTransactions = async (medicineId: string) => {
    try {
      const data = await medicineService.getStockTransactions(medicineId);

      setStockTransactions(data);
    } catch (error) {
      console.error("Error fetching transactions:", error);
    }
  };

  const handleStockChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setStockFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleTransactionChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;

    setTransactionFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const openStockModal = (
    stockItem?: MedicineStock & { medicine: Medicine },
  ) => {
    if (stockItem) {
      setCurrentStockItem(stockItem);
      setStockFormData({
        medicineId: stockItem.medicineId,
        currentStock: stockItem.currentStock.toString(),
        minimumStock: stockItem.minimumStock.toString(),
        maximumStock: stockItem.maximumStock?.toString() || "",
        reorderLevel: stockItem.reorderLevel.toString(),
        location: stockItem.location || "",
      });
    } else {
      setCurrentStockItem(null);
      setStockFormData({
        medicineId: "",
        currentStock: "",
        minimumStock: "",
        maximumStock: "",
        reorderLevel: "",
        location: "",
      });
    }
    setIsStockModalOpen(true);
  };

  const openTransactionModal = () => {
    setTransactionFormData({
      medicineId: "",
      type: "purchase",
      quantity: "",
      unitPrice: "",
      batchNumber: "",
      expiryDate: "",
      reason: "",
      invoiceNumber: "",
    });
    setIsTransactionModalOpen(true);
  };

  const handleSaveStock = async () => {
    if (
      !stockFormData.medicineId ||
      !stockFormData.currentStock ||
      !stockFormData.minimumStock
    ) {
      addToast({
        title: "Validation Error",
        description: "Please fill in all required fields",
      });

      return;
    }

    if (!clinicId || !userData?.id) return;

    setIsLoading(true);
    try {
      const stockData = {
        medicineId: stockFormData.medicineId,
        branchId: branchScopeId || "",
        schemeStock: 0,
        currentStock: parseInt(stockFormData.currentStock),
        minimumStock: parseInt(stockFormData.minimumStock),
        maximumStock: stockFormData.maximumStock
          ? parseInt(stockFormData.maximumStock)
          : undefined,
        reorderLevel: parseInt(stockFormData.reorderLevel),
        location: stockFormData.location || undefined,
        clinicId,
        updatedBy: userData.id,
      };

      if (currentStockItem) {
        await medicineService.updateMedicineStock(
          currentStockItem.id,
          stockData,
        );
        addToast({
          title: "Success",
          description: "Stock updated successfully",
        });
      } else {
        await medicineService.createMedicineStock(stockData);
        addToast({
          title: "Success",
          description: "Stock record created successfully",
        });
      }

      setIsStockModalOpen(false);
      fetchStockData();
      onStatsChange();
    } catch (error) {
      console.error("Error saving stock:", error);
      addToast({
        title: "Error",
        description: "Failed to save stock",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTransaction = async () => {
    if (!transactionFormData.medicineId || !transactionFormData.quantity) {
      addToast({
        title: "Validation Error",
        description: "Please fill in all required fields",
      });

      return;
    }

    if (!clinicId || !userData?.id) return;

    setIsLoading(true);
    try {
      // Get current stock to calculate new stock
      const stockItem = stockItems.find(
        (item) => item.medicineId === transactionFormData.medicineId,
      );
      const currentStock = stockItem?.currentStock || 0;
      const quantity = parseInt(transactionFormData.quantity);

      let newStock = currentStock;

      if (transactionFormData.type === "purchase") {
        newStock = currentStock + quantity;
      } else if (transactionFormData.type === "sale") {
        newStock = currentStock - quantity;
      } else if (transactionFormData.type === "adjustment") {
        newStock = quantity; // For adjustments, the quantity is the new stock level
      }

      const transactionData = {
        medicineId: transactionFormData.medicineId,
        branchId: branchScopeId || "",
        type: transactionFormData.type,
        quantity: quantity,
        previousStock: currentStock,
        newStock: newStock,
        unitPrice: transactionFormData.unitPrice
          ? parseFloat(transactionFormData.unitPrice)
          : undefined,
        totalAmount: transactionFormData.unitPrice
          ? parseFloat(transactionFormData.unitPrice) * quantity
          : undefined,
        batchNumber: transactionFormData.batchNumber || undefined,
        expiryDate: transactionFormData.expiryDate
          ? new Date(transactionFormData.expiryDate)
          : undefined,
        reason: transactionFormData.reason || undefined,
        invoiceNumber: transactionFormData.invoiceNumber || undefined,
        clinicId,
        createdBy: userData.id,
      };

      await medicineService.createStockTransaction(transactionData);

      // Update stock if it exists
      if (stockItem) {
        await medicineService.updateMedicineStock(stockItem.id, {
          currentStock: newStock,
          lastRestocked:
            transactionFormData.type === "purchase"
              ? new Date()
              : stockItem.lastRestocked,
        });
      }

      addToast({
        title: "Success",
        description: "Stock transaction recorded successfully",
      });

      setIsTransactionModalOpen(false);
      fetchStockData();
      onStatsChange();
    } catch (error) {
      console.error("Error recording transaction:", error);
      addToast({
        title: "Error",
        description: "Failed to record transaction",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStockItems = stockItems.filter(
    (item) =>
      item.medicine.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.medicine.genericName
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()),
  );

  const lowStockItems = stockItems.filter((item) => {
    const totalStock = item.currentStock + (item.schemeStock || 0);

    return totalStock <= item.reorderLevel;
  });
  const outOfStockItems = stockItems.filter((item) => {
    const totalStock = item.currentStock + (item.schemeStock || 0);

    return totalStock === 0;
  });

  const getStockStatus = (item: MedicineStock & { medicine: Medicine }) => {
    const totalStock = item.currentStock + (item.schemeStock || 0);

    if (totalStock === 0)
      return { label: "Out of Stock", color: "danger" as const };
    if (totalStock <= item.reorderLevel)
      return { label: "Low Stock", color: "warning" as const };

    return { label: "In Stock", color: "success" as const };
  };

  const getStockPercentage = (item: MedicineStock & { medicine: Medicine }) => {
    if (!item.maximumStock) return 0;
    const totalStock = item.currentStock + (item.schemeStock || 0);

    return Math.min((totalStock / item.maximumStock) * 100, 100);
  };

  return (
    <div className="space-y-6">
      {/* Stock overview stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border border-default-200">
          <CardBody className="text-center py-4">
            <div className="flex items-center justify-center mb-2">
              <div className="p-2 bg-primary-100 rounded-lg">
                <IoArchiveOutline className="text-primary text-xl" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[rgb(var(--color-text))]">
              {stockItems.length}
            </p>
            <p className="text-sm text-text-muted">Total Items</p>
          </CardBody>
        </Card>

        <Card className="border border-default-200">
          <CardBody className="text-center py-4">
            <div className="flex items-center justify-center mb-2">
              <div className="p-2 bg-warning-100 rounded-lg">
                <IoWarningOutline className="text-warning text-xl" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[rgb(var(--color-text))]">
              {lowStockItems.length}
            </p>
            <p className="text-sm text-text-muted">Low Stock</p>
          </CardBody>
        </Card>

        <Card className="border border-default-200">
          <CardBody className="text-center py-4">
            <div className="flex items-center justify-center mb-2">
              <div className="p-2 bg-danger-100 rounded-lg">
                <IoAlertCircleOutline className="text-danger text-xl" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[rgb(var(--color-text))]">
              {outOfStockItems.length}
            </p>
            <p className="text-sm text-text-muted">Out of Stock</p>
          </CardBody>
        </Card>

        <Card className="border border-default-200">
          <CardBody className="text-center py-4">
            <div className="flex items-center justify-center mb-2">
              <div className="p-2 bg-success-100 rounded-lg">
                <IoCheckmarkCircleOutline className="text-success text-xl" />
              </div>
            </div>
            <p className="text-2xl font-bold text-[rgb(var(--color-text))]">
              {stockItems.length - lowStockItems.length}
            </p>
            <p className="text-sm text-text-muted">Adequate Stock</p>
          </CardBody>
        </Card>
      </div>

      {/* Header actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="w-full sm:max-w-md">
          <Input
            placeholder="Search stock items..."
            startContent={<IoSearchOutline className="text-default-400" />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            color="secondary"
            startContent={<IoReceiptOutline />}
            onClick={openTransactionModal}
          >
            Add Transaction
          </Button>
          <Button
            color="primary"
            startContent={<IoAddOutline />}
            onClick={() => openStockModal()}
          >
            Add Stock Item
          </Button>
        </div>
      </div>

      {/* Stock management tabs */}
      <Card className="border border-default-200">
        <CardBody className="p-0">
          <Tabs
            className="w-full"
            selectedKey={selectedTab}
            onSelectionChange={(key) => setSelectedTab(key as string)}
          >
            <Tab key="overview" title="Stock Overview">
              <div className="p-6">
                <Table aria-label="Stock overview table">
                  <TableHeader>
                    <TableColumn>MEDICINE</TableColumn>
                    <TableColumn>CURRENT STOCK</TableColumn>
                    <TableColumn>STOCK LEVEL</TableColumn>
                    <TableColumn>REORDER LEVEL</TableColumn>
                    <TableColumn>LOCATION</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                    <TableColumn>ACTIONS</TableColumn>
                  </TableHeader>
                  <TableBody
                    emptyContent="No stock items found"
                    isLoading={isLoading}
                  >
                    {filteredStockItems.map((item) => {
                      const status = getStockStatus(item);
                      const percentage = getStockPercentage(item);

                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-text">
                                {item.medicine.name}
                              </p>
                              {item.medicine.genericName && (
                                <p className="text-sm text-text-muted">
                                  {item.medicine.genericName}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium text-text">
                                Regular: {item.currentStock}{" "}
                                {item.medicine.unit}
                                {item.schemeStock > 0 && (
                                  <span className="text-default-500">
                                    {" "}
                                    | Scheme: {item.schemeStock}{" "}
                                    {item.medicine.unit}
                                  </span>
                                )}
                              </p>
                              {item.maximumStock && (
                                <Progress
                                  className="max-w-[100px]"
                                  color={status.color}
                                  value={percentage}
                                />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {item.maximumStock ? (
                              <span className="text-sm">
                                {item.currentStock + (item.schemeStock || 0)} /{" "}
                                {item.maximumStock}
                              </span>
                            ) : (
                              <span className="text-default-400">
                                No max set
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {item.reorderLevel} {item.medicine.unit}
                            </span>
                          </TableCell>
                          <TableCell>
                            {item.location || (
                              <span className="text-default-400">
                                No location
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip color={status.color} size="sm" variant="flat">
                              {status.label}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                isIconOnly
                                color="primary"
                                size="sm"
                                variant="bordered"
                                onClick={() => openStockModal(item)}
                              >
                                <IoCreateOutline />
                              </Button>
                              <Button
                                isIconOnly
                                color="secondary"
                                size="sm"
                                variant="bordered"
                                onClick={() => {
                                  fetchTransactions(item.medicineId);
                                  setSelectedTab("transactions");
                                }}
                              >
                                <IoTimeOutline />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Tab>

            <Tab key="low-stock" title="Low Stock Alerts">
              <div className="p-6">
                {lowStockItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 mb-4">
                      <IoCheckmarkCircleOutline className="text-3xl text-emerald-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-emerald-500">
                      All Good!
                    </h3>
                    <p className="text-[13px] text-text-muted mt-1 max-w-xs">
                      No items are currently running low on stock. Your inventory levels are adequate.
                    </p>
                  </div>
                ) : (
                  <Table aria-label="Low stock items table">
                    <TableHeader>
                      <TableColumn>MEDICINE</TableColumn>
                      <TableColumn>CURRENT STOCK</TableColumn>
                      <TableColumn>REORDER LEVEL</TableColumn>
                      <TableColumn>SHORTAGE</TableColumn>
                      <TableColumn>ACTIONS</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {lowStockItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <IoWarningOutline className="text-warning" />
                              <div>
                                <p className="font-medium">
                                  {item.medicine.name}
                                </p>
                                {item.medicine.genericName && (
                                  <p className="text-sm text-default-500">
                                    {item.medicine.genericName}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium text-warning">
                              Regular: {item.currentStock} {item.medicine.unit}
                              {item.schemeStock > 0 && (
                                <span className="text-default-500">
                                  {" "}
                                  | Scheme: {item.schemeStock}{" "}
                                  {item.medicine.unit}
                                </span>
                              )}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span>
                              {item.reorderLevel} {item.medicine.unit}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-danger font-medium">
                              {Math.max(
                                0,
                                item.reorderLevel -
                                  (item.currentStock + (item.schemeStock || 0)),
                              )}{" "}
                              {item.medicine.unit}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button
                              color="primary"
                              size="sm"
                              variant="bordered"
                              onClick={() => openStockModal(item)}
                            >
                              Restock
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </Tab>

            <Tab key="transactions" title="Recent Transactions">
              <div className="p-6">
                {stockTransactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 mb-4">
                      <IoReceiptOutline className="text-3xl text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold text-[rgb(var(--color-text))]">
                      No Transactions Found
                    </h3>
                    <p className="text-[13px] text-text-muted mt-1 max-w-xs">
                      No recent stock transactions recorded for this medicine.
                    </p>
                  </div>
                ) : (
                  <Table aria-label="Stock transactions table">
                    <TableHeader>
                      <TableColumn>DATE</TableColumn>
                      <TableColumn>TYPE</TableColumn>
                      <TableColumn>QUANTITY</TableColumn>
                      <TableColumn>STOCK CHANGE</TableColumn>
                      <TableColumn>AMOUNT</TableColumn>
                      <TableColumn>REFERENCE</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {stockTransactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell>
                            {transaction.createdAt
                              ? transaction.createdAt.toLocaleDateString()
                              : "N/A"}
                          </TableCell>
                          <TableCell>
                            <Chip
                              color={
                                transaction.type === "purchase"
                                  ? "success"
                                  : transaction.type === "sale"
                                    ? "primary"
                                    : transaction.type === "adjustment"
                                      ? "warning"
                                      : "danger"
                              }
                              size="sm"
                              variant="flat"
                            >
                              {transaction.type}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">
                              {transaction.quantity}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {transaction.type === "purchase" ? (
                                <IoTrendingUpOutline className="text-success" />
                              ) : (
                                <IoTrendingDownOutline className="text-danger" />
                              )}
                              <span className="text-sm">
                                {transaction.previousStock} →{" "}
                                {transaction.newStock}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {transaction.totalAmount ? (
                              <span>NPR {transaction.totalAmount}</span>
                            ) : (
                              <span className="text-default-400">N/A</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {transaction.invoiceNumber ||
                              transaction.reason || (
                                <span className="text-default-400">
                                  No reference
                                </span>
                              )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      {/* Stock Modal */}
      <Modal
        isOpen={isStockModalOpen}
        size="2xl"
        onClose={() => setIsStockModalOpen(false)}
      >
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <IoArchiveOutline className="text-primary" />
              <span>{currentStockItem ? "Edit Stock" : "Add Stock Item"}</span>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-default-700 mb-1.5 block">
                  Medicine <span className="text-danger">*</span>
                </label>
                <select
                  required
                  className="w-full p-3 border border-default-300 rounded-lg"
                  disabled={!!currentStockItem}
                  name="medicineId"
                  value={stockFormData.medicineId}
                  onChange={(e) => handleStockChange(e as any)}
                >
                  <option value="">Select a medicine</option>
                  {medicines.map((medicine) => (
                    <option key={medicine.id} value={medicine.id}>
                      {medicine.name}{" "}
                      {medicine.genericName ? `(${medicine.genericName})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-default-700 mb-1.5 block">
                    Current Stock <span className="text-danger">*</span>
                  </label>
                  <Input
                    required
                    name="currentStock"
                    placeholder="Enter current stock"
                    type="number"
                    value={stockFormData.currentStock}
                    variant="bordered"
                    onChange={handleStockChange}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-default-700 mb-1.5 block">
                    Minimum Stock <span className="text-danger">*</span>
                  </label>
                  <Input
                    required
                    name="minimumStock"
                    placeholder="Enter minimum stock"
                    type="number"
                    value={stockFormData.minimumStock}
                    variant="bordered"
                    onChange={handleStockChange}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-default-700 mb-1.5 block">
                    Maximum Stock
                  </label>
                  <Input
                    name="maximumStock"
                    placeholder="Enter maximum stock"
                    type="number"
                    value={stockFormData.maximumStock}
                    variant="bordered"
                    onChange={handleStockChange}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-default-700 mb-1.5 block">
                    Reorder Level <span className="text-danger">*</span>
                  </label>
                  <Input
                    required
                    name="reorderLevel"
                    placeholder="Enter reorder level"
                    type="number"
                    value={stockFormData.reorderLevel}
                    variant="bordered"
                    onChange={handleStockChange}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-default-700 mb-1.5 block">
                  Storage Location
                </label>
                <Input
                  name="location"
                  placeholder="Enter storage location"
                  value={stockFormData.location}
                  variant="bordered"
                  onChange={handleStockChange}
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              color="default"
              variant="bordered"
              onClick={() => setIsStockModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={isLoading}
              onClick={handleSaveStock}
            >
              Save Stock
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Transaction Modal */}
      <Modal
        isOpen={isTransactionModalOpen}
        size="2xl"
        onClose={() => setIsTransactionModalOpen(false)}
      >
        <ModalContent>
          <ModalHeader>
            <div className="flex items-center gap-2">
              <IoReceiptOutline className="text-primary" />
              <span>Add Stock Transaction</span>
            </div>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-default-700 mb-1.5 block">
                  Medicine <span className="text-danger">*</span>
                </label>
                <select
                  required
                  className="w-full p-3 border border-default-300 rounded-lg"
                  name="medicineId"
                  value={transactionFormData.medicineId}
                  onChange={handleTransactionChange}
                >
                  <option value="">Select a medicine</option>
                  {medicines.map((medicine) => (
                    <option key={medicine.id} value={medicine.id}>
                      {medicine.name}{" "}
                      {medicine.genericName ? `(${medicine.genericName})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-default-700 mb-1.5 block">
                    Transaction Type <span className="text-danger">*</span>
                  </label>
                  <select
                    required
                    className="w-full p-3 border border-default-300 rounded-lg"
                    name="type"
                    value={transactionFormData.type}
                    onChange={handleTransactionChange}
                  >
                    <option value="purchase">Purchase</option>
                    <option value="sale">Sale</option>
                    <option value="adjustment">Adjustment</option>
                    <option value="expired">Expired</option>
                    <option value="damaged">Damaged</option>
                    <option value="returned">Returned</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-default-700 mb-1.5 block">
                    Quantity <span className="text-danger">*</span>
                  </label>
                  <Input
                    required
                    name="quantity"
                    placeholder="Enter quantity"
                    type="number"
                    value={transactionFormData.quantity}
                    variant="bordered"
                    onChange={(e) => handleTransactionChange(e as any)}
                  />
                </div>

                {clinicSettings?.sellsMedicines && (
                  <div>
                    <label className="text-sm font-medium text-default-700 mb-1.5 block">
                      Unit Price (NPR)
                    </label>
                    <Input
                      name="unitPrice"
                      placeholder="Enter unit price"
                      startContent={
                        <div className="pointer-events-none flex items-center">
                          <span className="text-default-400 text-small">
                            NPR
                          </span>
                        </div>
                      }
                      type="number"
                      value={transactionFormData.unitPrice}
                      variant="bordered"
                      onChange={(e) => handleTransactionChange(e as any)}
                    />
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-default-700 mb-1.5 block">
                    Batch Number
                  </label>
                  <Input
                    name="batchNumber"
                    placeholder="Enter batch number"
                    value={transactionFormData.batchNumber}
                    variant="bordered"
                    onChange={(e) => handleTransactionChange(e as any)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-default-700 mb-1.5 block">
                    Expiry Date
                  </label>
                  <Input
                    name="expiryDate"
                    type="date"
                    value={transactionFormData.expiryDate}
                    variant="bordered"
                    onChange={(e) => handleTransactionChange(e as any)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-default-700 mb-1.5 block">
                    Invoice Number
                  </label>
                  <Input
                    name="invoiceNumber"
                    placeholder="Enter invoice number"
                    value={transactionFormData.invoiceNumber}
                    variant="bordered"
                    onChange={(e) => handleTransactionChange(e as any)}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-default-700 mb-1.5 block">
                  Reason/Notes
                </label>
                <Input
                  name="reason"
                  placeholder="Enter reason or notes"
                  value={transactionFormData.reason}
                  variant="bordered"
                  onChange={(e) => handleTransactionChange(e as any)}
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              color="default"
              variant="bordered"
              onClick={() => setIsTransactionModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={isLoading}
              onClick={handleSaveTransaction}
            >
              Record Transaction
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
