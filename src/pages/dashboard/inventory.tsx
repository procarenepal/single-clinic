import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input, Textarea } from "@heroui/input";
import { Button } from "@heroui/button";
import { Tabs, Tab } from "@heroui/tabs";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";
import { Chip } from "@heroui/chip";
import { Pagination } from "@heroui/pagination";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Spinner } from "@heroui/spinner";
import { addToast } from "@heroui/toast";
import { format } from "date-fns";
import {
  IoAdd,
  IoSearch,
  IoCheckmark,
  IoTimeOutline,
  IoCreateOutline,
  IoCloseCircleOutline,
  IoTrashOutline,
  IoPrintOutline,
} from "react-icons/io5";

import { useAuth } from "@/hooks/useAuth";
import { useModalState } from "@/hooks/useModalState";
import { useTheme } from "@/context/ThemeContext";

// Services
import { itemService } from "@/services/itemService";
import { itemCategoryService } from "@/services/itemCategoryService";
import { issuedItemService } from "@/services/issuedItemService";
import { accountService } from "@/services/accountService";
import { hrService } from "@/services/hrService";

// Types
import { Item, ItemCategory, IssuedItem, Vendor, ItemPurchase } from "@/types/models";

// Icons

export default function InventoryPage() {
  const { currentUser, userData, clinicId } = useAuth();
  const { themeConfig, isDark } = useTheme();

  // Get branchId from userData
  const branchId = userData?.branchId || userData?.clinicId || clinicId;

  // State management
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [issuedItems, setIssuedItems] = useState<IssuedItem[]>([]);
  const [purchases, setPurchases] = useState<ItemPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("items");
  const [saving, setSaving] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // Pagination states
  const [itemsPage, setItemsPage] = useState(1);
  const [categoriesPage, setCategoriesPage] = useState(1);
  const [logsPage, setLogsPage] = useState(1);
  const itemsPerPage = 8;

  // Modal states
  const itemModalState = useModalState(false);
  const categoryModalState = useModalState(false);
  const issueModalState = useModalState(false);
  const returnModalState = useModalState(false);
  const vendorModalState = useModalState(false);
  const refillModalState = useModalState(false);
  const [isDisposing, setIsDisposing] = useState(false);
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [newUnit, setNewUnit] = useState("");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [units, setUnits] = useState<string[]>([
    "piece",
    "box",
    "kg",
    "meter",
    "vial",
    "strip",
    "set",
    "unit",
  ]);
  const [staffList, setStaffList] = useState<
    { id: string; name: string; role: string }[]
  >([]);

  // Form states
  const [itemForm, setItemForm] = useState({
    id: "",
    name: "",
    category: "",
    quantity: 1,
    description: "",
    unit: "piece",
    barcode: "",
    purchasePrice: "",
    purchaseDate: format(new Date(), "yyyy-MM-dd"),
    supplierName: "",
    condition: "new" as Item["condition"],
    itemType: "asset" as "asset" | "consumable",
  });

  const [categoryForm, setCategoryForm] = useState({
    id: "",
    name: "",
    description: "",
  });

  const [issueForm, setIssueForm] = useState({
    itemId: "",
    quantity: 1,
    issuedTo: "",
    expectedReturnDate: null as Date | null,
    notes: "",
  });

  const [returnForm, setReturnForm] = useState({
    notes: "",
    returnDate: new Date().toISOString().split("T")[0],
    condition: "used" as "new" | "used" | "damaged",
    returnQuantity: 1,
  });

  const [vendorForm, setVendorForm] = useState({
    name: "",
    phone: "",
    email: "",
    category: "Equipment",
  });

  const [refillForm, setRefillForm] = useState({
    itemId: "",
    quantity: 1,
    cost: 0,
    invoiceNumber: "",
    purchaseDate: format(new Date(), "yyyy-MM-dd"),
    notes: "",
  });

  const [selectedIssuedItem, setSelectedIssuedItem] =
    useState<IssuedItem | null>(null);
  const [selectedPrintBill, setSelectedPrintBill] = 
    useState<ItemPurchase | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Load data
  useEffect(() => {
    loadInventoryData();
  }, [clinicId, branchId]);

  useEffect(() => {
    const handleBeforePrint = () => setIsPrinting(true);
    const handleAfterPrint = () => {
      setIsPrinting(false);
      setSelectedPrintBill(null);
    };

    window.addEventListener("beforeprint", handleBeforePrint);
    window.addEventListener("afterprint", handleAfterPrint);

    return () => {
      window.removeEventListener("beforeprint", handleBeforePrint);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, []);

  const handlePrintBill = (bill: ItemPurchase) => {
    setSelectedPrintBill(bill);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const loadInventoryData = async () => {
    if (!clinicId || !branchId) return;

    try {
      setLoading(true);
      const [
        itemsData,
        categoriesData,
        issuedItemsData,
        vendorsData,
        staffData,
        purchasesData,
      ] = await Promise.all([
        itemService.getItemsByClinic(clinicId, branchId),
        itemCategoryService.getCategoriesByClinic(clinicId, branchId),
        issuedItemService.getIssuedItemsByClinic(clinicId, branchId),
        accountService.getVendorsByClinic(clinicId, branchId),
        hrService.getStaffByClinic(clinicId), // Fetch all clinic staff
        itemService.getItemPurchasesByClinic(clinicId, branchId),
      ]);

      setItems(itemsData.filter((i) => !i.isDisposed));
      setCategories(categoriesData);
      setIssuedItems(issuedItemsData);
      setVendors(vendorsData);
      setPurchases(purchasesData);

      // Map HR staff for selection
      const staffMembers = staffData
        .map((s) => ({ id: s.id, name: s.name, role: s.role }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setStaffList(staffMembers);

      // Extract unique units from items and merge with defaults
      const existingUnits = itemsData
        .map((i) => i.unit)
        .filter((u): u is string => !!u);
      const uniqueUnits = Array.from(new Set([...units, ...existingUnits]));

      setUnits(uniqueUnits);
    } catch (error) {
      console.error("Error loading inventory data:", error);
      addToast({
        title: "Error",
        description: "Failed to load inventory data",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  const safeFormatDate = (date: any, formatStr: string = "MMM dd, yyyy") => {
    if (!date) return "—";
    try {
      let dateObj;

      if (date.toDate) {
        dateObj = date.toDate();
      } else {
        dateObj = new Date(date);
      }

      if (isNaN(dateObj.getTime())) return "—";

      return format(dateObj, formatStr);
    } catch (error) {
      return "—";
    }
  };

  const handleAddUnit = () => {
    if (newUnit.trim() && !units.includes(newUnit.trim().toLowerCase())) {
      const unit = newUnit.trim().toLowerCase();

      setUnits((prev) => [...prev, unit]);
      setItemForm((prev) => ({ ...prev, unit: unit }));
      setNewUnit("");
      setIsAddingUnit(false);
      addToast({
        title: "Unit added",
        description: `"${unit}" added to options`,
        color: "success",
      });
    }
  };

  const handleSaveVendor = async () => {
    if (!vendorForm.name) {
      addToast({
        title: "Error",
        description: "Please enter vendor name",
        color: "danger",
      });

      return;
    }

    setSaving(true);
    try {
      const vendorData = {
        ...vendorForm,
        isActive: true,
        clinicId: clinicId!,
        branchId: branchId!,
        createdBy: currentUser?.uid || "",
      };

      const vendorId = await accountService.createVendor(vendorData);
      const newVendor = {
        id: vendorId,
        ...vendorData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      setVendors((prev) => [...prev, newVendor as Vendor]);
      setItemForm((prev) => ({ ...prev, supplierName: vendorForm.name }));

      addToast({
        title: "Success",
        description: "Vendor added successfully",
        color: "success",
      });
      vendorModalState.close();
      setVendorForm({ name: "", phone: "", email: "", category: "Equipment" });
    } catch (error) {
      addToast({
        title: "Error",
        description: "Failed to add vendor",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  // Filter functions
  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredCategories = categories.filter((category) => {
    const matchesCategoryName = category.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    
    const matchesItemName = items
      .filter((item) => item.category === category.name)
      .some((item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()),
      );

    return matchesCategoryName || matchesItemName;
  });

  const filteredIssuedItems = issuedItems.filter(
    (item) =>
      item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.itemCategory.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.issuedTo?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Pagination logic
  useEffect(() => {
    setItemsPage(1);
    setCategoriesPage(1);
    setLogsPage(1);
  }, [searchQuery]);

  const paginatedItems = filteredItems.slice(
    (itemsPage - 1) * itemsPerPage,
    itemsPage * itemsPerPage,
  );
  const paginatedCategories = filteredCategories.slice(
    (categoriesPage - 1) * itemsPerPage,
    categoriesPage * itemsPerPage,
  );
  const paginatedLogs = filteredIssuedItems.slice(
    (logsPage - 1) * itemsPerPage,
    logsPage * itemsPerPage,
  );

  // Handle item operations
  const handleSaveItem = async () => {
    if (!itemForm.name || !itemForm.category) {
      addToast({
        title: "Error",
        description: "Please fill in required fields",
        color: "danger",
      });

      return;
    }

    setSaving(true);
    try {
      const { id, ...formData } = itemForm;
      const itemData = {
        ...formData,
        quantity: parseInt(itemForm.quantity.toString()),
        purchasePrice: parseFloat(itemForm.purchasePrice) || 0,
        salePrice: 0, // Assets aren't for sale, but the model requires this
        purchaseDate: new Date(itemForm.purchaseDate),
        itemType: itemForm.itemType,
        clinicId: clinicId!,
        branchId: branchId!,
        isActive: true,
        createdBy: currentUser?.uid || "",
      };

      if (isEditing && id) {
        await itemService.updateItem(id, itemData);
        addToast({
          title: "Success",
          description: "Asset updated successfully",
          color: "success",
        });
      } else {
        const newItemId = await itemService.createItem(itemData);
        
        // Log the initial purchase bill if quantity > 0
        if (itemData.quantity > 0) {
          await itemService.createItemPurchase({
            itemId: newItemId,
            itemName: itemData.name,
            quantity: itemData.quantity,
            unitPrice: itemData.purchasePrice,
            totalAmount: itemData.quantity * itemData.purchasePrice,
            purchaseDate: itemData.purchaseDate,
            invoiceNumber: "INITIAL-STOCK",
            notes: "Initial stock entry during asset creation.",
            clinicId: clinicId!,
            branchId: branchId!,
            createdBy: currentUser?.uid || "",
          });
        }

        addToast({
          title: "Success",
          description: "Asset recorded successfully",
          color: "success",
        });
      }

      itemModalState.forceClose();
      loadInventoryData();
      resetItemForm();
    } catch (error) {
      addToast({
        title: "Error",
        description: "Failed to save asset",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDisposeItem = async (itemId: string) => {
    if (
      !window.confirm(
        "Are you sure you want to dispose of this asset? This will remove it from active inventory.",
      )
    )
      return;
    try {
      await itemService.updateItem(itemId, {
        isDisposed: true,
        disposalDate: new Date(),
        disposalReason: "Marked as damaged or removed by user",
      });
      addToast({
        title: "Disposed",
        description: "Asset removed from active inventory",
        color: "success",
      });
      loadInventoryData();
    } catch (error) {
      addToast({
        title: "Error",
        description: "Failed to dispose asset",
        color: "danger",
      });
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!categoryId) {
      addToast({
        title: "Error",
        description: "Invalid category ID",
        color: "danger",
      });

      return;
    }
    if (!window.confirm("Are you sure you want to delete this category?"))
      return;
    try {
      await itemCategoryService.deleteCategory(categoryId);
      addToast({
        title: "Deleted",
        description: "Category removed successfully",
        color: "success",
      });
      loadInventoryData();
    } catch (error) {
      addToast({
        title: "Error",
        description: "Failed to delete category",
        color: "danger",
      });
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name) {
      addToast({
        title: "Error",
        description: "Please enter category name",
        color: "danger",
      });

      return;
    }

    setSaving(true);
    try {
      // Check for duplicate name
      const exists = await itemCategoryService.checkCategoryNameExists(
        clinicId!,
        branchId!,
        categoryForm.name,
        isEditing ? categoryForm.id : undefined,
      );

      if (exists) {
        addToast({
          title: "Conflict",
          description: "A category with this name already exists",
          color: "warning",
        });
        setSaving(false);

        return;
      }

      const categoryData = {
        ...categoryForm,
        clinicId: clinicId!,
        branchId: branchId!,
        isActive: true,
        createdBy: currentUser?.uid || "",
      };
      const { id, ...dataToSave } = categoryData;

      if (isEditing && categoryForm.id) {
        await itemCategoryService.updateCategory(
          categoryForm.id,
          dataToSave as any,
        );
        addToast({
          title: "Success",
          description: "Category updated successfully",
          color: "success",
        });
      } else {
        await itemCategoryService.createCategory(dataToSave as any);
        addToast({
          title: "Success",
          description: "Category added successfully",
          color: "success",
        });
      }

      categoryModalState.forceClose();
      loadInventoryData();
      resetCategoryForm();
    } catch (error) {
      console.error("Error saving category:", error);
      addToast({
        title: "Error",
        description: "Failed to save category",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleIssueItem = async () => {
    if (!issueForm.itemId || !issueForm.quantity || issueForm.quantity <= 0) {
      addToast({
        title: "Error",
        description:
          "Please fill in all required fields and ensure quantity is greater than 0",
        color: "danger",
      });

      return;
    }

    setSaving(true);
    try {
      const selectedItem = items.find((item) => item.id === issueForm.itemId);

      if (!selectedItem) {
        addToast({
          title: "Error",
          description: "Selected item not found",
          color: "danger",
        });

        return;
      }

      // Check if there's enough quantity available
      if (selectedItem.quantity < issueForm.quantity) {
        addToast({
          title: "Error",
          description: `Insufficient quantity. Available: ${selectedItem.quantity}, Requested: ${issueForm.quantity}`,
          color: "danger",
        });

        return;
      }

      const issuedItemData = {
        itemId: issueForm.itemId,
        itemName: selectedItem.name,
        itemCategory: selectedItem.category,
        quantity: issueForm.quantity,
        issuedDate: new Date(),
        expectedReturnDate:
          selectedItem.itemType === "consumable"
            ? null
            : issueForm.expectedReturnDate,
        status: (selectedItem.itemType === "consumable"
          ? "consumed"
          : "issued") as any,
        issuedTo: issueForm.issuedTo,
        issuedBy: currentUser?.uid || "",
        notes: issueForm.notes,
        clinicId: clinicId!,
        branchId: branchId!,
      };

      await issuedItemService.issueItem(issuedItemData);

      // Update the item quantity by reducing the issued quantity
      const updatedItemData = {
        ...selectedItem,
        quantity: selectedItem.quantity - issueForm.quantity,
      };

      await itemService.updateItem(selectedItem.id, updatedItemData);

      addToast({
        title: "Success",
        description: "Item issued successfully",
        color: "success",
      });

      issueModalState.forceClose();
      loadInventoryData();
      resetIssueForm();
    } catch (error) {
      console.error("Error issuing item:", error);
      addToast({
        title: "Error",
        description: "Failed to issue item",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRefillItem = async () => {
    if (!refillForm.itemId || !refillForm.quantity || refillForm.quantity <= 0) {
      addToast({
        title: "Error",
        description: "Please enter a valid quantity",
        color: "danger",
      });
      return;
    }

    setSaving(true);
    try {
      const selectedItem = items.find((item) => item.id === refillForm.itemId);
      if (!selectedItem) {
        addToast({
          title: "Error",
          description: "Selected item not found",
          color: "danger",
        });
        return;
      }

      const oldQty = selectedItem.quantity || 0;
      const oldPrice = selectedItem.purchasePrice || 0;
      const newQty = refillForm.quantity;
      const newPrice = refillForm.cost || oldPrice;

      // Calculate Weighted Average Cost (WAC)
      const totalOldValue = oldQty * oldPrice;
      const totalNewValue = newQty * newPrice;
      const blendedPrice = Math.round((totalOldValue + totalNewValue) / (oldQty + newQty));

      const updatedItemData = {
        ...selectedItem,
        quantity: oldQty + newQty,
        purchasePrice: blendedPrice,
        purchaseDate: refillForm.purchaseDate,
      };

      const { id, createdAt, updatedAt, ...itemUpdates } = updatedItemData as any;

      await itemService.updateItem(selectedItem.id, itemUpdates);

      // Create permanent purchase bill / refill log
      await itemService.createItemPurchase({
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        quantity: newQty,
        unitPrice: newPrice,
        totalAmount: newQty * newPrice,
        purchaseDate: new Date(refillForm.purchaseDate),
        invoiceNumber: refillForm.invoiceNumber,
        notes: refillForm.notes,
        clinicId,
        branchId,
        createdBy: currentUser?.uid || "",
      });

      addToast({
        title: "Success",
        description: `Successfully added ${refillForm.quantity} to stock`,
        color: "success",
      });

      refillModalState.close();
      loadInventoryData();
      setRefillForm({
        itemId: "",
        quantity: 1,
        cost: 0,
        invoiceNumber: "",
        purchaseDate: format(new Date(), "yyyy-MM-dd"),
        notes: "",
      });
    } catch (error) {
      console.error("Error refilling item:", error);
      addToast({
        title: "Error",
        description: "Failed to refill stock",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReturnItem = async () => {
    if (!selectedIssuedItem) return;

    if (!selectedIssuedItem) return;

    if (
      returnForm.returnQuantity <= 0 ||
      returnForm.returnQuantity > selectedIssuedItem.quantity
    ) {
      addToast({
        title: "Error",
        description: "Invalid return quantity",
        color: "danger",
      });

      return;
    }

    try {
      setSaving(true);

      const isPartial = returnForm.returnQuantity < selectedIssuedItem.quantity;
      const returnQty = returnForm.returnQuantity;

      if (isPartial) {
        // 1. Update original record to reflect remaining quantity
        await issuedItemService.updateIssuedItem(selectedIssuedItem.id, {
          quantity: selectedIssuedItem.quantity - returnQty,
        });

        // 2. Create a new "returned" record for the items brought back
        const returnedRecord = {
          ...selectedIssuedItem,
          id: undefined, // Let Firestore generate new ID
          quantity: returnQty,
          status: "returned" as const,
          returnDate: new Date(returnForm.returnDate),
          returnCondition: returnForm.condition,
          returnNotes: returnForm.notes,
        };

        // Use service to add new doc (assuming createIssuedItem exists or using addDoc logic)
        await issuedItemService.createIssuedItem(returnedRecord);
      } else {
        // Full return - just update status
        const updateData = {
          status: "returned" as const,
          returnDate: new Date(returnForm.returnDate),
          returnCondition: returnForm.condition,
          returnNotes: returnForm.notes,
          updatedAt: new Date(),
        };

        await issuedItemService.updateIssuedItem(
          selectedIssuedItem.id,
          updateData,
        );
      }

      // Update master inventory stock
      const selectedItem = items.find(
        (item) => item.id === selectedIssuedItem.itemId,
      );

      if (selectedItem) {
        const updatedItemData = {
          ...selectedItem,
          quantity: selectedItem.quantity + returnQty,
          // Update master condition if returned as damaged
          condition:
            returnForm.condition === "damaged"
              ? "damaged"
              : selectedItem.condition,
        };

        const { id, createdAt, updatedAt, ...itemUpdates } =
          updatedItemData as any;

        await itemService.updateItem(selectedItem.id, itemUpdates);
      }

      addToast({
        title: "Success",
        description: isPartial
          ? `${returnQty} items returned (partial)`
          : "All items returned successfully",
        color: "success",
      });

      returnModalState.close();
      loadInventoryData();
      setReturnForm({
        notes: "",
        returnDate: new Date().toISOString().split("T")[0],
        condition: "used",
        returnQuantity: 1,
      });
    } catch (error) {
      console.error("Error returning item:", error);
      addToast({
        title: "Error",
        description: "Failed to process return",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  // Reset forms
  const resetItemForm = () => {
    setItemForm({
      id: "",
      name: "",
      category: "",
      quantity: 1,
      description: "",
      unit: "piece",
      barcode: "",
      purchasePrice: "",
      purchaseDate: format(new Date(), "yyyy-MM-dd"),
      supplierName: "",
      condition: "new",
      itemType: "asset",
    });
    setIsEditing(false);
  };

  const resetCategoryForm = () => {
    setCategoryForm({
      id: "",
      name: "",
      description: "",
    });
    setIsEditing(false);
  };

  const resetIssueForm = () => {
    setIssueForm({
      itemId: "",
      quantity: 1,
      issuedTo: "",
      expectedReturnDate: null,
      notes: "",
    });
  };

  const resetVendorForm = () => {
    setVendorForm({
      name: "",
      phone: "",
      email: "",
      category: "Equipment",
    });
    setIsEditing(false);
  };

  // Edit functions
  const editItem = (item: Item) => {
    setItemForm({
      id: item.id,
      name: item.name,
      category: item.category,
      quantity: item.quantity || 1,
      description: item.description || "",
      unit: item.unit || "piece",
      barcode: item.barcode || "",
      purchasePrice: item.purchasePrice?.toString() || "",
      purchaseDate: item.purchaseDate
        ? format(new Date(item.purchaseDate), "yyyy-MM-dd")
        : format(new Date(), "yyyy-MM-dd"),
      supplierName: item.supplierName || "",
      condition: item.condition || "new",
      itemType: item.itemType || "asset",
    });
    setIsEditing(true);
    itemModalState.open();
  };

  const editCategory = (category: ItemCategory) => {
    setCategoryForm({
      id: category.id,
      name: category.name,
      description: category.description || "",
    });
    setIsEditing(true);
    categoryModalState.open();
  };

  const openReturnModal = (issuedItem: IssuedItem) => {
    setSelectedIssuedItem(issuedItem);
    setReturnForm({
      ...returnForm,
      returnQuantity: issuedItem.quantity,
    });
    returnModalState.open();
  };

  // Status chip colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case "issued":
        return "primary";
      case "returned":
        return "success";
      case "overdue":
        return "danger";
      case "consumed":
        return "warning";
      default:
        return "default";
    }
  };

  const valuation = items.reduce(
    (acc, item) => acc + (item.purchasePrice || 0) * (item.quantity || 0),
    0,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner label="Loading inventory..." size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <style>
        {`
          @media print {
            @page {
              margin: 10mm;
            }
            html, body, #root {
              height: auto !important;
              min-height: auto !important;
              overflow: visible !important;
            }
            /* Fix content-visibility bugs in print */
            * {
              content-visibility: visible !important;
            }
            /* Hide any portals/modals/inactive-tabs that might add blank height */
            body > *:not(#root),
            [role="tabpanel"][data-state="inactive"],
            [role="tabpanel"][hidden],
            [data-slot="backdrop"] {
              display: none !important;
            }
          }
        `}
      </style>
      <div className="flex justify-between items-center mb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-black text-primary tracking-tight">
            Asset inventory
          </h1>
          <p className="text-[12px] font-bold text-text-muted tracking-wide uppercase mt-1">
            Track clinic assets, machines, and equipment lifecycle.
          </p>
        </div>
        <Button
          className="h-9 px-4 rounded-xl text-[12.5px] font-semibold tracking-tight bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all print:hidden"
          startContent={<IoPrintOutline className="w-4 h-4" />}
          onPress={() => {
            setSelectedPrintBill(null);
            setTimeout(() => window.print(), 100);
          }}
        >
          Print Report
        </Button>
      </div>

      {/* Stats Cards - visible on screen, hidden when printing individual bill */}
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 print:hidden`}>
        <div className="p-3 border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] rounded-xl">
          <p className="text-[8.5px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.1em] opacity-60 uppercase">Total valuation</p>
          <p className="text-[16px] font-semibold text-primary tracking-tighter mt-0.5">Rs. {valuation.toLocaleString()}</p>
        </div>
        <div className="p-3 border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] rounded-xl border-l-4 border-l-primary">
          <p className="text-[8.5px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.1em] opacity-60 uppercase">Active assets</p>
          <p className="text-[16px] font-semibold text-primary tracking-tighter mt-0.5">{items.reduce((acc, item) => acc + (item.quantity || 0), 0)}</p>
        </div>
        <div className="p-3 border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] rounded-xl border-l-4 border-l-amber-500">
          <p className="text-[8.5px] font-semibold text-[rgb(var(--color-text-muted))] tracking-[0.1em] opacity-60 uppercase">Items in use</p>
          <p className="text-[16px] font-semibold text-amber-500 tracking-tighter mt-0.5">{issuedItems.filter((i) => i.status === "issued").reduce((acc, i) => acc + (i.quantity || 0), 0)}</p>
        </div>
      </div>

      <Card className={`bg-surface border border-[rgb(var(--color-border))] shadow-none rounded-xl print:border-none print:shadow-none print:overflow-visible ${selectedPrintBill ? 'print:hidden' : ''}`}>
        <CardHeader className="flex justify-between items-center p-4 border-b border-[rgb(var(--color-border))] print:hidden">
          <div className="relative w-80">
            <IoSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-text-muted))] w-4 h-4" />
            <input
              className="w-full h-9 pl-10 pr-4 bg-[rgb(var(--color-surface-2))] border border-[rgb(var(--color-border))] rounded-xl text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all"
              placeholder="Search assets or categories..."
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button
            className="h-9 px-4 rounded-xl text-[12.5px] font-semibold tracking-tight"
            color="primary"
            startContent={<IoAdd className="w-4 h-4" />}
            onPress={() => {
              resetItemForm();
              itemModalState.open();
            }}
          >
            Add new asset
          </Button>
        </CardHeader>

        <CardBody className="p-0 print:overflow-visible">
          <Tabs
            className="px-4 pt-2 print:overflow-visible"
            classNames={{ tabList: "print:hidden" }}
            color="primary"
            selectedKey={selectedTab}
            variant="underlined"
            onSelectionChange={(key) => setSelectedTab(key as string)}
          >
            <Tab key="items" title="Asset Registry">
              <div className="p-4 space-y-4">
                {filteredItems.length > 0 ? (
                  <>
                    <Table
                      removeWrapper
                      aria-label="Items table"
                      className="border border-[rgb(var(--color-border))] rounded-xl overflow-hidden print:overflow-visible print:border-none"
                    >
                      <TableHeader className="bg-[rgb(var(--color-surface-2))]">
                        <TableColumn
                          align="start"
                          className="bg-[rgb(var(--color-surface-2))] text-[12px] font-semibold text-[rgb(var(--color-text-muted))] py-4"
                        >
                          Asset details
                        </TableColumn>
                        <TableColumn
                          align="start"
                          className="bg-[rgb(var(--color-surface-2))] text-[12px] font-semibold text-[rgb(var(--color-text-muted))]"
                        >
                          Category
                        </TableColumn>
                        <TableColumn
                          align="center"
                          className="bg-[rgb(var(--color-surface-2))] text-[12px] font-semibold text-[rgb(var(--color-text-muted))]"
                        >
                          Qty
                        </TableColumn>
                        <TableColumn
                          align="end"
                          className="bg-[rgb(var(--color-surface-2))] text-[12px] font-semibold text-[rgb(var(--color-text-muted))]"
                        >
                          Cost
                        </TableColumn>
                        <TableColumn
                          align="start"
                          className="bg-[rgb(var(--color-surface-2))] text-[12px] font-semibold text-[rgb(var(--color-text-muted))]"
                        >
                          Purchase date
                        </TableColumn>
                        <TableColumn
                          align="center"
                          className="bg-[rgb(var(--color-surface-2))] text-[12px] font-semibold text-[rgb(var(--color-text-muted))] print:hidden"
                        >
                          Actions
                        </TableColumn>
                      </TableHeader>
                      <TableBody>
                        {filteredItems.map((item, index) => {
                          const isVisible =
                            index >= (itemsPage - 1) * itemsPerPage &&
                            index < itemsPage * itemsPerPage;

                          const inUseQty = issuedItems
                            .filter((i) => i.itemId === item.id && i.status === "issued")
                            .reduce((acc, i) => acc + (i.quantity || 0), 0);
                          const remainingQty = item.quantity || 0;
                          const totalBoughtQty = remainingQty + inUseQty;

                          return (
                            <TableRow 
                              key={item.id || `item-${index}`}
                              className={isVisible ? "print:table-row" : "hidden print:table-row"}
                            >
                              <TableCell>
                              <div>
                                <p className="font-semibold text-[13.5px] text-text-main capitalize">
                                  {item.name?.toLowerCase()}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span
                                    className={`text-[11px] font-semibold px-1.5 py-0.5 rounded border ${
                                      item.condition === "new"
                                        ? "bg-green-500/10 text-green-600 border-green-500/20"
                                        : item.condition === "damaged"
                                          ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                                          : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                    }`}
                                  >
                                    {item.condition
                                      ? item.condition.charAt(0).toUpperCase() +
                                        item.condition.slice(1)
                                      : "New"}
                                  </span>
                                  {item.supplierName && (
                                    <span className="text-[11px] text-[rgb(var(--color-text-muted))] font-medium italic opacity-70 capitalize">
                                      from {item.supplierName?.toLowerCase()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell align="left">
                              <Chip
                                className="font-bold capitalize"
                                color="primary"
                                size="sm"
                                variant="flat"
                              >
                                {item.category?.toLowerCase()}
                              </Chip>
                            </TableCell>
                            <TableCell align="center">
                              <div className="flex flex-col items-center gap-0.5 min-w-[70px]">
                                <span className="font-semibold text-text-main text-[13px] whitespace-nowrap">
                                  {remainingQty} left
                                </span>
                                {inUseQty > 0 && (
                                  <span className="text-[11px] text-primary whitespace-nowrap font-medium">
                                    {inUseQty} in use
                                  </span>
                                )}
                                <span className="text-[10px] text-text-muted whitespace-nowrap uppercase tracking-wider">
                                  {totalBoughtQty} total
                                </span>
                              </div>
                            </TableCell>
                            <TableCell align="right">
                              <p className="font-semibold text-primary">
                                Rs. {(item.purchasePrice || 0).toLocaleString()}
                              </p>
                            </TableCell>
                            <TableCell align="left">
                              <span className="text-[13.5px] text-text-muted">
                                {item.purchaseDate
                                  ? safeFormatDate(item.purchaseDate)
                                  : "—"}
                              </span>
                            </TableCell>
                            <TableCell align="center" className="print:hidden">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  className="p-2 text-[rgb(var(--color-text-muted))] hover:text-primary transition-colors"
                                  title="Edit"
                                  onClick={() => editItem(item)}
                                >
                                  <IoCreateOutline size={18} />
                                </button>
                                <button
                                  className="px-3 py-1 rounded-xl text-[11px] font-black uppercase tracking-tighter transition-all bg-success/10 text-success hover:bg-success hover:text-white"
                                  title="Refill stock"
                                  onClick={() => {
                                  setRefillForm({
                                      itemId: item.id,
                                      quantity: 1,
                                      cost: item.purchasePrice || 0,
                                      invoiceNumber: "",
                                      purchaseDate: format(new Date(), "yyyy-MM-dd"),
                                      notes: "",
                                    });
                                    refillModalState.open();
                                  }}
                                >
                                  Refill
                                </button>
                                <button
                                  className={`px-3 py-1 rounded-xl text-[11px] font-black uppercase tracking-tighter transition-all ${
                                    item.quantity > 0
                                      ? "bg-primary text-white hover:opacity-90"
                                      : "bg-[rgb(var(--color-surface-2))] text-[rgb(var(--color-text-muted))] cursor-not-allowed"
                                  }`}
                                  disabled={item.quantity === 0}
                                  title="Issue item"
                                  onClick={() => {
                                    setIssueForm({
                                      ...issueForm,
                                      itemId: item.id,
                                    });
                                    issueModalState.open();
                                  }}
                                >
                                  Issue
                                </button>
                                <button
                                  className="p-2 text-[rgb(var(--color-text-muted))] hover:text-rose-500 transition-colors"
                                  title="Mark as damaged / Dispose"
                                  onClick={() => handleDisposeItem(item.id)}
                                >
                                  <IoCloseCircleOutline size={18} />
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>

                    {filteredItems.length > itemsPerPage && (
                      <div className="flex w-full justify-center mt-4 print:hidden">
                        <Pagination
                          isCompact
                          showControls
                          showShadow
                          color="primary"
                          page={itemsPage}
                          size="sm"
                          total={Math.ceil(filteredItems.length / itemsPerPage)}
                          onChange={(page) => setItemsPage(page)}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 mb-4 mx-auto">
                      <IoAdd className="text-3xl text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-[rgb(var(--color-text))]">
                        {searchQuery ? "No assets found" : "No assets yet"}
                      </h3>
                      <p className="text-[13px] text-text-muted mt-1 max-w-sm mx-auto">
                        {searchQuery
                          ? `No assets match your search "${searchQuery}".`
                          : "Start building your clinic inventory by adding machines, furniture, or equipment."}
                      </p>
                    </div>
                    {!searchQuery && (
                      <Button
                        color="primary"
                        startContent={<IoAdd />}
                        onPress={() => {
                          resetItemForm();
                          itemModalState.open();
                        }}
                      >
                        Add Your First Item
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Tab>

            {/* Categories Tab */}
            <Tab key="categories" title="Item Categories">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-default-500">
                    Total Categories: {filteredCategories.length}
                  </p>
                  <Button
                    color="primary"
                    startContent={<IoAdd />}
                    onPress={() => {
                      resetCategoryForm();
                      categoryModalState.open();
                    }}
                  >
                    Add Category
                  </Button>
                </div>

                {filteredCategories.length > 0 ? (
                  <div className="border border-border-base rounded overflow-hidden">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                      <thead>
                        <tr className="bg-surface-2 border-b border-border-base">
                          {[
                            "Category name",
                            "Description",
                            "Items count",
                            "Actions",
                          ].map((h) => (
                            <th
                              key={h}
                              className="px-4 py-3 text-[11px] font-semibold text-primary tracking-wider"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-base bg-surface">
                        {paginatedCategories.map((category, index) => (
                          <tr
                            key={category.id || `cat-${index}`}
                            className="hover:bg-surface-2 transition-colors"
                          >
                            <td className="px-4 py-3 text-[13.5px] font-semibold text-text-main">
                              {category.name}
                            </td>
                            <td className="px-4 py-3 text-[12.5px] text-text-muted">
                              {category.description || "No description"}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-medium bg-primary/10 text-primary border border-primary/20">
                                {
                                  items.filter(
                                    (item) => item.category === category.name,
                                  ).length
                                }
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1">
                                <button
                                  className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded transition-colors"
                                  title="Edit"
                                  onClick={() => editCategory(category)}
                                >
                                  <IoCreateOutline size={18} />
                                </button>
                                <button
                                  className="p-1.5 text-text-muted hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors"
                                  title="Delete"
                                  onClick={() =>
                                    handleDeleteCategory(category.id)
                                  }
                                >
                                  <IoTrashOutline size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {filteredCategories.length > itemsPerPage && (
                      <div className="flex w-full justify-center p-4 border-t border-border-base">
                        <Pagination
                          isCompact
                          showControls
                          showShadow
                          color="primary"
                          page={categoriesPage}
                          size="sm"
                          total={Math.ceil(
                            filteredCategories.length / itemsPerPage,
                          )}
                          onChange={(page) => setCategoriesPage(page)}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 px-4 bg-surface">
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 bg-surface-2 rounded-full flex items-center justify-center mx-auto">
                        <IoAdd className="w-8 h-8 text-text-muted/40" />
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-text-main mb-2">
                          {searchQuery
                            ? "No categories found"
                            : "No categories yet"}
                        </h3>
                        <p className="text-sm text-text-muted max-w-sm">
                          {searchQuery
                            ? `No categories match your search "${searchQuery}". Try adjusting your search terms.`
                            : "Organize your inventory by creating item categories first."}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Tab>

            {/* Usage Logs Tab */}
            <Tab key="issued" title="Usage logs">
              <div className="p-4 space-y-4">
                {filteredIssuedItems.length > 0 ? (
                  <>
                    <Table
                      removeWrapper
                      aria-label="Usage logs table"
                      className="border border-[rgb(var(--color-border))] rounded-xl overflow-hidden"
                    >
                      <TableHeader className="bg-[rgb(var(--color-surface-2))]">
                        <TableColumn
                          align="start"
                          className="bg-[rgb(var(--color-surface-2))] text-[12px] font-semibold text-[rgb(var(--color-text-muted))] py-4"
                        >
                          Item details
                        </TableColumn>
                        <TableColumn
                          align="start"
                          className="bg-[rgb(var(--color-surface-2))] text-[12px] font-semibold text-[rgb(var(--color-text-muted))]"
                        >
                          Category
                        </TableColumn>
                        <TableColumn
                          align="center"
                          className="bg-[rgb(var(--color-surface-2))] text-[12px] font-semibold text-[rgb(var(--color-text-muted))]"
                        >
                          Qty
                        </TableColumn>
                        <TableColumn
                          align="start"
                          className="bg-[rgb(var(--color-surface-2))] text-[12px] font-semibold text-[rgb(var(--color-text-muted))]"
                        >
                          Issued date
                        </TableColumn>
                        <TableColumn
                          align="start"
                          className="bg-[rgb(var(--color-surface-2))] text-[12px] font-semibold text-[rgb(var(--color-text-muted))] text-primary"
                        >
                          Issued to (User)
                        </TableColumn>
                        <TableColumn
                          align="start"
                          className="bg-[rgb(var(--color-surface-2))] text-[12px] font-semibold text-[rgb(var(--color-text-muted))]"
                        >
                          Return details
                        </TableColumn>
                        <TableColumn
                          align="start"
                          className="bg-[rgb(var(--color-surface-2))] text-[12px] font-semibold text-[rgb(var(--color-text-muted))]"
                        >
                          Status
                        </TableColumn>
                        <TableColumn
                          align="center"
                          className="bg-[rgb(var(--color-surface-2))] text-[12px] font-semibold text-[rgb(var(--color-text-muted))]"
                        >
                          Action
                        </TableColumn>
                      </TableHeader>
                      <TableBody>
                        {paginatedLogs.map((issuedItem, index) => (
                          <TableRow
                            key={issuedItem.id || `issued-${index}`}
                            className="border-b border-[rgb(var(--color-border))]"
                          >
                            <TableCell align="left">
                              <p className="text-[13.5px] font-semibold text-text-main capitalize">
                                {issuedItem.itemName?.toLowerCase()}
                              </p>
                            </TableCell>
                            <TableCell align="left">
                              <span className="text-[13px] font-medium text-primary px-2 py-0.5 rounded-lg bg-primary/10 border border-primary/20 capitalize">
                                {issuedItem.itemCategory?.toLowerCase()}
                              </span>
                            </TableCell>
                            <TableCell
                              align="center"
                              className="font-medium text-[14px]"
                            >
                              {issuedItem.quantity}
                            </TableCell>
                            <TableCell align="left">
                              <span className="text-[14px] text-[rgb(var(--color-text-muted))]">
                                {safeFormatDate(issuedItem.issuedDate)}
                              </span>
                            </TableCell>
                            <TableCell align="left">
                              <p className="text-[14.5px] font-semibold text-primary tracking-tighter">
                                {issuedItem.issuedTo || "—"}
                              </p>
                            </TableCell>
                            <TableCell align="left">
                              {issuedItem.status === "returned" ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[13.5px] text-[rgb(var(--color-text-muted))] font-medium">
                                    {issuedItem.quantity} ret:{" "}
                                    {safeFormatDate(issuedItem.returnDate)}
                                  </span>
                                  <span
                                    className={`text-[11.5px] font-semibold w-fit px-1.5 py-0.5 rounded border tracking-wide ${
                                      issuedItem.returnCondition === "damaged"
                                        ? "text-rose-500 border-rose-500/20 bg-rose-500/5"
                                        : "text-green-600 border-green-500/20 bg-green-500/5"
                                    }`}
                                  >
                                    {issuedItem.returnCondition
                                      ? issuedItem.returnCondition
                                          .charAt(0)
                                          .toUpperCase() +
                                        issuedItem.returnCondition.slice(1)
                                      : "Good"}
                                  </span>
                                  {issuedItem.returnNotes && (
                                    <p
                                      className="text-[12px] text-[rgb(var(--color-text-muted))] italic mt-1 line-clamp-2 max-w-[180px]"
                                      title={issuedItem.returnNotes}
                                    >
                                      "{issuedItem.returnNotes}"
                                    </p>
                                  )}
                                </div>
                              ) : issuedItem.status === "consumed" ? (
                                <span className="text-[13px] text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20 uppercase tracking-tighter">
                                  Consumed / Depleted
                                </span>
                              ) : (
                                <span className="text-[13px] text-[rgb(var(--color-text-muted))] italic opacity-60">
                                  In use...
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Chip
                                className="text-[12.5px] font-semibold rounded-lg"
                                color={getStatusColor(issuedItem.status)}
                                size="sm"
                                variant="flat"
                              >
                                {issuedItem.status}
                              </Chip>
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-center">
                                {issuedItem.status === "issued" && (
                                  <button
                                    className="px-3 py-1 rounded-xl bg-green-500 text-white text-[10px] font-black uppercase tracking-tighter hover:opacity-90 transition-all"
                                    onClick={() => openReturnModal(issuedItem)}
                                  >
                                    Return
                                  </button>
                                )}
                                {issuedItem.status === "consumed" && (
                                  <span className="text-[10px] font-bold text-[rgb(var(--color-text-muted))] uppercase opacity-50 italic">
                                    Non-returnable
                                  </span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {filteredIssuedItems.length > itemsPerPage && (
                      <div className="flex w-full justify-center mt-4">
                        <Pagination
                          isCompact
                          showControls
                          showShadow
                          color="primary"
                          page={logsPage}
                          size="sm"
                          total={Math.ceil(
                            filteredIssuedItems.length / itemsPerPage,
                          )}
                          onChange={(page) => setLogsPage(page)}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 mb-4 mx-auto">
                      <IoTimeOutline className="text-3xl text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-[rgb(var(--color-text))]">
                        No usage logs yet
                      </h3>
                      <p className="text-[13px] text-text-muted mt-1 max-w-sm mx-auto">
                        Record equipment assignments to track who is using what
                        in the clinic.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Tab>
            <Tab key="purchases" title="Purchase Bills">
              <div className="bg-[rgb(var(--color-surface))] min-h-[400px] print:min-h-0 print:h-auto">
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center p-4 border-b border-[rgb(var(--color-border))] print:hidden">
                  <div>
                    <h3 className="text-sm font-bold text-[rgb(var(--color-text))]">
                      Restock & Purchase History
                    </h3>
                    <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">
                      Detailed permanent record of all inventory refill bills
                    </p>
                  </div>
                </div>

                {purchases.length > 0 ? (
                  <div className="overflow-x-auto w-full max-w-[100vw] sm:max-w-none">
                    <table className="w-full min-w-[800px] border-collapse text-left">
                      <thead className="bg-[rgb(var(--color-surface-2))] border-b border-[rgb(var(--color-border))]">
                        <tr>
                          <th className="px-4 py-3 text-[11px] font-black uppercase text-[rgb(var(--color-text-muted))] whitespace-nowrap">
                            Date
                          </th>
                          <th className="px-4 py-3 text-[11px] font-black uppercase text-[rgb(var(--color-text-muted))] whitespace-nowrap">
                            Asset / Item
                          </th>
                          <th className="px-4 py-3 text-[11px] font-black uppercase text-[rgb(var(--color-text-muted))] whitespace-nowrap">
                            Invoice No.
                          </th>
                          <th className="px-4 py-3 text-[11px] font-black uppercase text-[rgb(var(--color-text-muted))] text-center whitespace-nowrap">
                            Qty
                          </th>
                          <th className="px-4 py-3 text-[11px] font-black uppercase text-[rgb(var(--color-text-muted))] text-right whitespace-nowrap">
                            Unit Cost
                          </th>
                          <th className="px-4 py-3 text-[11px] font-black uppercase text-[rgb(var(--color-text-muted))] text-right whitespace-nowrap">
                            Total Value
                          </th>
                          <th className="px-4 py-3 text-[11px] font-black uppercase text-[rgb(var(--color-text-muted))] whitespace-nowrap">
                            Notes
                          </th>
                          <th className="px-4 py-3 text-[11px] font-black uppercase text-[rgb(var(--color-text-muted))] text-right whitespace-nowrap print:hidden">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[rgb(var(--color-border))]">
                        {purchases.map((purchase) => (
                          <tr
                            key={purchase.id}
                            className="hover:bg-[rgb(var(--color-surface-2))] transition-colors print:!bg-white"
                          >
                            <td className="px-4 py-3 text-[13px] text-text-main whitespace-nowrap">
                              {purchase.purchaseDate ? format(new Date(purchase.purchaseDate), "MMM dd, yyyy") : "-"}
                            </td>
                            <td className="px-4 py-3 text-[13px] text-text-main font-semibold capitalize">
                              {purchase.itemName?.toLowerCase()}
                            </td>
                            <td className="px-4 py-3 text-[13px] text-text-muted">
                              {purchase.invoiceNumber || "-"}
                            </td>
                            <td className="px-4 py-3 text-[13px] font-bold text-text-main text-center">
                              +{purchase.quantity}
                            </td>
                            <td className="px-4 py-3 text-[13px] text-text-main text-right">
                              Rs. {purchase.unitPrice?.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-[13px] font-bold text-emerald-600 text-right">
                              Rs. {purchase.totalAmount?.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-[12px] text-text-muted max-w-[200px] truncate" title={purchase.notes}>
                              {purchase.notes || "-"}
                            </td>
                            <td className="px-4 py-3 text-right print:hidden">
                              <button
                                className="p-2 text-primary bg-primary/10 hover:bg-primary hover:text-white rounded-lg transition-colors"
                                title="Print Receipt"
                                onClick={() => handlePrintBill(purchase)}
                              >
                                <IoPrintOutline size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 mb-4 mx-auto">
                      <IoTimeOutline className="text-3xl text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-[rgb(var(--color-text))]">
                        No purchase bills yet
                      </h3>
                      <p className="text-[13px] text-text-muted mt-1 max-w-sm mx-auto">
                        Restock items to automatically generate permanent purchase logs and bills.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Tab>
          </Tabs>
        </CardBody>
      </Card>

      {/* Add/Edit Item Modal */}
      <Modal
        classNames={{
          base: "bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl",
        }}
        isOpen={itemModalState.isOpen}
        size="3xl"
        onClose={itemModalState.close}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-[16px] font-black text-[rgb(var(--color-text))]">
                  {isEditing ? "Edit asset details" : "Record new asset"}
                </h2>
                <p className="text-[11px] text-[rgb(var(--color-text-muted))] font-bold">
                  Enter acquisition and condition details for the clinical
                  asset.
                </p>
              </ModalHeader>
              <ModalBody className="py-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-3 gap-y-4">
                  {/* Row 1 */}
                  <div>
                    <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] mb-1.5 block">
                      Item name *
                    </label>
                    <Input
                      classNames={{ inputWrapper: "rounded-xl" }}
                      placeholder="e.g. Dell Latitude 5420"
                      size="sm"
                      value={itemForm.name}
                      onChange={(e) =>
                        setItemForm({ ...itemForm, name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-bold text-[rgb(var(--color-text-muted))] block">
                        Category *
                      </label>
                      <button
                        className="text-primary hover:bg-primary/10 p-0.5 rounded transition-colors"
                        title="Add new category"
                        onClick={() => {
                          resetCategoryForm();
                          categoryModalState.open();
                        }}
                      >
                        <IoAdd size={14} />
                      </button>
                    </div>
                    <Select
                      classNames={{ trigger: "rounded-xl" }}
                      placeholder="Select category"
                      selectedKeys={
                        itemForm.category ? [itemForm.category] : []
                      }
                      size="sm"
                      onSelectionChange={(keys) =>
                        setItemForm({
                          ...itemForm,
                          category: Array.from(keys)[0] as string,
                        })
                      }
                    >
                      {/* Filter unique categories by name just in case duplicates exist in DB */}
                      {Array.from(new Set(categories.map((c) => c.name))).map(
                        (catName, index) => (
                          <SelectItem
                            key={catName || `cn-${index}`}
                            textValue={catName}
                          >
                            {catName}
                          </SelectItem>
                        ),
                      )}
                    </Select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[rgb(var(--color-text-muted))] mb-1.5 block">
                      Quantity *
                    </label>
                    <Input
                      classNames={{ inputWrapper: "rounded-xl" }}
                      placeholder="1"
                      size="sm"
                      type="number"
                      value={itemForm.quantity.toString()}
                      onChange={(e) =>
                        setItemForm({
                          ...itemForm,
                          quantity: parseInt(e.target.value) || 0,
                        })
                      }
                    />
                  </div>

                  {/* Row 2 */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-semibold text-[rgb(var(--color-text-muted))] block">
                        Unit
                      </label>
                      <button
                        className="text-primary hover:bg-primary/10 p-0.5 rounded transition-colors"
                        title={
                          isAddingUnit ? "Back to selection" : "Add new unit"
                        }
                        onClick={() => setIsAddingUnit(!isAddingUnit)}
                      >
                        {isAddingUnit ? (
                          <IoCloseCircleOutline size={14} />
                        ) : (
                          <IoAdd size={14} />
                        )}
                      </button>
                    </div>
                    {isAddingUnit ? (
                      <div className="flex gap-1">
                        <Input
                          classNames={{ inputWrapper: "rounded-xl" }}
                          placeholder="New unit"
                          size="sm"
                          value={newUnit}
                          onChange={(e) => setNewUnit(e.target.value)}
                        />
                        <Button
                          isIconOnly
                          className="rounded-xl min-w-[32px] w-[32px]"
                          color="primary"
                          size="sm"
                          onClick={handleAddUnit}
                        >
                          <IoCheckmark size={16} />
                        </Button>
                      </div>
                    ) : (
                      <Select
                        classNames={{ trigger: "rounded-xl" }}
                        placeholder="Select unit"
                        selectedKeys={[itemForm.unit || "piece"]}
                        size="sm"
                        onSelectionChange={(keys) =>
                          setItemForm({
                            ...itemForm,
                            unit: Array.from(keys)[0] as string,
                          })
                        }
                      >
                        {units.map((unit) => (
                          <SelectItem key={unit} textValue={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </Select>
                    )}
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[rgb(var(--color-text-muted))] mb-1.5 block">
                      Barcode
                    </label>
                    <Input
                      classNames={{ inputWrapper: "rounded-xl" }}
                      placeholder="Scan or enter barcode"
                      size="sm"
                      value={itemForm.barcode}
                      onChange={(e) =>
                        setItemForm({ ...itemForm, barcode: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[rgb(var(--color-text-muted))] mb-1.5 block">
                      Purchase price (Rs.)
                    </label>
                    <Input
                      classNames={{ inputWrapper: "rounded-xl" }}
                      placeholder="0.00"
                      size="sm"
                      startContent={
                        <span className="text-[12px] text-text-muted">Rs.</span>
                      }
                      type="number"
                      value={itemForm.purchasePrice}
                      onChange={(e) =>
                        setItemForm({
                          ...itemForm,
                          purchasePrice: e.target.value,
                        })
                      }
                    />
                  </div>

                  {/* Row 3 */}
                  <div>
                    <label className="text-[11px] font-semibold text-[rgb(var(--color-text-muted))] mb-1.5 block">
                      Purchase date
                    </label>
                    <Input
                      classNames={{ inputWrapper: "rounded-xl" }}
                      size="sm"
                      type="date"
                      value={itemForm.purchaseDate}
                      onChange={(e) =>
                        setItemForm({
                          ...itemForm,
                          purchaseDate: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-semibold text-[rgb(var(--color-text-muted))] block">
                        Supplier / Vendor
                      </label>
                      <button
                        className="text-primary hover:bg-primary/10 p-0.5 rounded transition-colors"
                        title="Add new vendor"
                        onClick={() => {
                          resetVendorForm();
                          vendorModalState.open();
                        }}
                      >
                        <IoAdd size={14} />
                      </button>
                    </div>
                    <Select
                      classNames={{ trigger: "rounded-xl" }}
                      placeholder="Select supplier"
                      selectedKeys={
                        itemForm.supplierName ? [itemForm.supplierName] : []
                      }
                      size="sm"
                      onSelectionChange={(keys) =>
                        setItemForm({
                          ...itemForm,
                          supplierName: Array.from(keys)[0] as string,
                        })
                      }
                    >
                      {vendors.map((vendor) => (
                        <SelectItem key={vendor.name} textValue={vendor.name}>
                          {vendor.name}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[rgb(var(--color-text-muted))] mb-1.5 block">
                      Item Type *
                    </label>
                    <Select
                      classNames={{ trigger: "rounded-xl" }}
                      placeholder="Select type"
                      selectedKeys={[itemForm.itemType]}
                      size="sm"
                      onSelectionChange={(keys) =>
                        setItemForm({
                          ...itemForm,
                          itemType: Array.from(keys)[0] as any,
                        })
                      }
                    >
                      <SelectItem key="asset" textValue="Fixed Asset">
                        Fixed Asset (Equipment)
                      </SelectItem>
                      <SelectItem key="consumable" textValue="Consumable">
                        Consumable (Depleted on use)
                      </SelectItem>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[rgb(var(--color-text-muted))] mb-1.5 block">
                      Condition
                    </label>
                    <Select
                      classNames={{ trigger: "rounded-xl" }}
                      placeholder="Select condition"
                      selectedKeys={[itemForm.condition]}
                      size="sm"
                      onSelectionChange={(keys) =>
                        setItemForm({
                          ...itemForm,
                          condition: Array.from(keys)[0] as any,
                        })
                      }
                    >
                      <SelectItem key="new" textValue="New / Mint">
                        New / Mint
                      </SelectItem>
                      <SelectItem key="used" textValue="Used / Good">
                        Used / Good
                      </SelectItem>
                      <SelectItem key="damaged" textValue="Damaged / Poor">
                        Damaged / Poor
                      </SelectItem>
                    </Select>
                  </div>

                  <div className="md:col-span-3">
                    <label className="text-[11px] font-semibold text-[rgb(var(--color-text-muted))] mb-1.5 block">
                      Description / Notes
                    </label>
                    <Textarea
                      classNames={{ inputWrapper: "rounded-xl" }}
                      placeholder="Enter item description, specifications or location..."
                      size="sm"
                      value={itemForm.description}
                      onChange={(e) =>
                        setItemForm({
                          ...itemForm,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </ModalBody>
              <ModalFooter className="border-t border-[rgb(var(--color-border))] mt-2">
                <Button
                  className="font-semibold text-[12px] rounded-xl"
                  size="sm"
                  variant="light"
                  onPress={onClose}
                >
                  Cancel
                </Button>
                <Button
                  className="font-semibold text-[12px] rounded-xl px-8"
                  color="primary"
                  isLoading={saving}
                  size="sm"
                  onPress={handleSaveItem}
                >
                  {isEditing ? "Update asset" : "Add asset"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Quick Add Vendor Modal */}
      <Modal
        classNames={{
          base: "bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl",
        }}
        isOpen={vendorModalState.isOpen}
        size="md"
        onClose={vendorModalState.close}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-[16px] font-semibold text-primary">
                  Add new supplier
                </h2>
                <p className="text-[11px] text-[rgb(var(--color-text-muted))] font-medium">
                  Register a new vendor to your clinic registry.
                </p>
              </ModalHeader>
              <ModalBody className="py-4">
                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] font-semibold text-[rgb(var(--color-text-muted))] mb-1.5 block">
                      Vendor name *
                    </label>
                    <Input
                      classNames={{ inputWrapper: "rounded-xl" }}
                      placeholder="e.g. Acme Clinical Supplies"
                      size="sm"
                      value={vendorForm.name}
                      onChange={(e) =>
                        setVendorForm({ ...vendorForm, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-semibold text-[rgb(var(--color-text-muted))] mb-1.5 block">
                        Phone number
                      </label>
                      <Input
                        classNames={{ inputWrapper: "rounded-xl" }}
                        placeholder="e.g. 98XXXXXXXX"
                        size="sm"
                        value={vendorForm.phone}
                        onChange={(e) =>
                          setVendorForm({
                            ...vendorForm,
                            phone: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[rgb(var(--color-text-muted))] mb-1.5 block">
                        Email address
                      </label>
                      <Input
                        classNames={{ inputWrapper: "rounded-xl" }}
                        placeholder="e.g. info@acme.com"
                        size="sm"
                        type="email"
                        value={vendorForm.email}
                        onChange={(e) =>
                          setVendorForm({
                            ...vendorForm,
                            email: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter className="border-t border-[rgb(var(--color-border))] mt-2">
                <Button
                  className="font-semibold text-[12px] rounded-xl"
                  size="sm"
                  variant="light"
                  onPress={onClose}
                >
                  Cancel
                </Button>
                <Button
                  className="font-semibold text-[12px] rounded-xl px-6"
                  color="primary"
                  isLoading={saving}
                  size="sm"
                  onPress={handleSaveVendor}
                >
                  Save vendor
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Category Modal */}
      <Modal
        classNames={{
          base: "bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl",
        }}
        isOpen={categoryModalState.isOpen}
        size="md"
        onClose={categoryModalState.close}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-[16px] font-semibold text-primary">
                  {isEditing ? "Update category" : "Add new category"}
                </h2>
                <p className="text-[11px] text-[rgb(var(--color-text-muted))] font-medium">
                  Organize your inventory by creating logical asset groups.
                </p>
              </ModalHeader>
              <ModalBody className="py-4">
                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] font-semibold text-[rgb(var(--color-text-muted))] mb-1.5 block">
                      Category name
                    </label>
                    <Input
                      classNames={{ inputWrapper: "rounded-xl" }}
                      placeholder="e.g. Clinical Machines"
                      size="sm"
                      value={categoryForm.name}
                      onChange={(e) =>
                        setCategoryForm({
                          ...categoryForm,
                          name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-[rgb(var(--color-text-muted))] mb-1.5 block">
                      Description
                    </label>
                    <Textarea
                      classNames={{ inputWrapper: "rounded-xl" }}
                      placeholder="Enter description..."
                      size="sm"
                      value={categoryForm.description}
                      onChange={(e) =>
                        setCategoryForm({
                          ...categoryForm,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </ModalBody>
              <ModalFooter className="border-t border-[rgb(var(--color-border))] mt-2">
                <Button
                  className="font-semibold text-[12px] rounded-xl"
                  size="sm"
                  variant="light"
                  onPress={onClose}
                >
                  Cancel
                </Button>
                <Button
                  className="font-semibold text-[12px] rounded-xl px-6"
                  color="primary"
                  size="sm"
                  onPress={handleSaveCategory}
                >
                  {isEditing ? "Update" : "Add"} category
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Issue Item Modal */}
      <Modal
        classNames={{
          base: "bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl",
        }}
        isOpen={issueModalState.isOpen}
        size="lg"
        onClose={issueModalState.close}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-[16px] font-semibold text-primary">
                  Issue asset
                </h2>
                <p className="text-[11px] text-[rgb(var(--color-text-muted))] font-medium">
                  Assign equipment to a user or department.
                </p>
              </ModalHeader>
              <ModalBody className="py-4">
                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] font-semibold text-[rgb(var(--color-text-muted))] mb-1.5 block">
                      Select item
                    </label>
                    <Select
                      classNames={{ trigger: "rounded-xl" }}
                      placeholder="Choose asset"
                      selectedKeys={issueForm.itemId ? [issueForm.itemId] : []}
                      size="sm"
                      onSelectionChange={(keys) => {
                        const selectedKey = Array.from(keys)[0] as string;

                        setIssueForm({
                          ...issueForm,
                          itemId: selectedKey || "",
                        });
                      }}
                    >
                      {items
                        .filter((item) => item.quantity > 0)
                        .map((item) => (
                          <SelectItem key={item.id} textValue={item.name}>
                            {item.name} ({item.category}) - {item.quantity}{" "}
                            available
                          </SelectItem>
                        ))}
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-semibold text-[rgb(var(--color-text-muted))] mb-1.5 block">
                        Quantity
                      </label>
                      <Input
                        classNames={{ inputWrapper: "rounded-xl" }}
                        placeholder="1"
                        size="sm"
                        type="number"
                        value={issueForm.quantity.toString()}
                        onChange={(e) =>
                          setIssueForm({
                            ...issueForm,
                            quantity: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[rgb(var(--color-text-muted))] mb-1.5 block">
                        Expected return
                      </label>
                      <Input
                        classNames={{ inputWrapper: "rounded-xl" }}
                        size="sm"
                        type="date"
                        value={
                          issueForm.expectedReturnDate
                            ? issueForm.expectedReturnDate
                                .toISOString()
                                .split("T")[0]
                            : ""
                        }
                        onChange={(e) =>
                          setIssueForm({
                            ...issueForm,
                            expectedReturnDate: e.target.value
                              ? new Date(e.target.value)
                              : null,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[rgb(var(--color-text-muted))] mb-1.5 block">
                      Issued to (Staff member) *
                    </label>
                    <Select
                      classNames={{ trigger: "rounded-xl" }}
                      placeholder="Select staff member"
                      selectedKeys={
                        issueForm.issuedTo ? [issueForm.issuedTo] : []
                      }
                      size="sm"
                      onSelectionChange={(keys) => {
                        const selectedKey = Array.from(keys)[0] as string;

                        setIssueForm({
                          ...issueForm,
                          issuedTo: selectedKey || "",
                        });
                      }}
                    >
                      {staffList.map((staff) => (
                        <SelectItem key={staff.name} textValue={staff.name}>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {staff.name}
                            </span>
                            <span className="text-[10px] text-text-muted">
                              {staff.role}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[rgb(var(--color-text-muted))] mb-1.5 block">
                      Notes
                    </label>
                    <Textarea
                      classNames={{ inputWrapper: "rounded-xl" }}
                      placeholder="Enter usage reason or assignment notes..."
                      size="sm"
                      value={issueForm.notes}
                      onChange={(e) =>
                        setIssueForm({ ...issueForm, notes: e.target.value })
                      }
                    />
                  </div>
                </div>
              </ModalBody>
              <ModalFooter className="border-t border-[rgb(var(--color-border))] mt-2">
                <Button
                  className="font-semibold text-[12px] rounded-xl"
                  size="sm"
                  variant="light"
                  onPress={onClose}
                >
                  Cancel
                </Button>
                <Button
                  className="font-semibold text-[12px] rounded-xl px-6"
                  color="primary"
                  size="sm"
                  onPress={handleIssueItem}
                >
                  Issue asset
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Return Item Modal */}
      <Modal
        classNames={{
          base: "bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl",
        }}
        isOpen={returnModalState.isOpen}
        size="md"
        onClose={returnModalState.close}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-[16px] font-semibold text-primary">
                  Confirm return
                </h2>
                <p className="text-[11px] text-[rgb(var(--color-text-muted))] font-medium">
                  Process the return of issued equipment.
                </p>
              </ModalHeader>
              <ModalBody className="py-4">
                {selectedIssuedItem && (
                  <div className="space-y-4">
                    <div className="p-4 bg-[rgb(var(--color-surface-2))] rounded-xl border border-[rgb(var(--color-border))]">
                      <p className="text-[14px] font-semibold text-[rgb(var(--color-text))] mb-1">
                        {selectedIssuedItem.itemName}
                      </p>
                      <p className="text-[11px] text-[rgb(var(--color-text-muted))] font-medium">
                        Quantity: {selectedIssuedItem.quantity} units • Issued
                        to: {selectedIssuedItem.issuedTo || "staff"}
                      </p>
                      <div className="mt-3 pt-3 border-t border-[rgb(var(--color-border))] text-[11px] text-[rgb(var(--color-text-muted))]">
                        <p className="font-medium">
                          Issued on:{" "}
                          {safeFormatDate(selectedIssuedItem.issuedDate)}
                        </p>
                        {selectedIssuedItem.notes && (
                          <p className="italic mt-1 opacity-80">
                            Notes: {selectedIssuedItem.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-[rgb(var(--color-text-muted))] mb-1.5 block">
                          Qty to return
                        </label>
                        <Input
                          classNames={{ inputWrapper: "rounded-xl" }}
                          description={
                            returnForm.returnQuantity <
                            selectedIssuedItem.quantity
                              ? `${selectedIssuedItem.quantity - returnForm.returnQuantity} remain`
                              : "Full return"
                          }
                          max={selectedIssuedItem.quantity}
                          min={1}
                          size="sm"
                          type="number"
                          value={returnForm.returnQuantity.toString()}
                          onChange={(e) =>
                            setReturnForm({
                              ...returnForm,
                              returnQuantity: parseInt(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-[rgb(var(--color-text-muted))] mb-1.5 block">
                          Return date
                        </label>
                        <Input
                          classNames={{ inputWrapper: "rounded-xl" }}
                          size="sm"
                          type="date"
                          value={returnForm.returnDate}
                          onChange={(e) =>
                            setReturnForm({
                              ...returnForm,
                              returnDate: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-[rgb(var(--color-text-muted))] mb-1.5 block">
                          Condition
                        </label>
                        <Select
                          classNames={{ trigger: "rounded-xl" }}
                          selectedKeys={[returnForm.condition]}
                          size="sm"
                          onSelectionChange={(keys) =>
                            setReturnForm({
                              ...returnForm,
                              condition: Array.from(keys)[0] as any,
                            })
                          }
                        >
                          <SelectItem key="new" textValue="New / Mint">
                            New / Mint
                          </SelectItem>
                          <SelectItem key="used" textValue="Used / Good">
                            Used / Good
                          </SelectItem>
                          <SelectItem key="damaged" textValue="Damaged / Poor">
                            Damaged / Poor
                          </SelectItem>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-[rgb(var(--color-text-muted))] mb-1.5 block">
                        Return notes
                      </label>
                      <Textarea
                        classNames={{ inputWrapper: "rounded-xl" }}
                        placeholder="Add notes about the item state or return reason..."
                        size="sm"
                        value={returnForm.notes}
                        onChange={(e) =>
                          setReturnForm({
                            ...returnForm,
                            notes: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </ModalBody>
              <ModalFooter className="border-t border-[rgb(var(--color-border))] mt-2">
                <Button
                  className="font-semibold text-[12px] rounded-xl"
                  size="sm"
                  variant="light"
                  onPress={onClose}
                >
                  Cancel
                </Button>
                <Button
                  className="font-semibold text-[12px] text-white rounded-xl px-8"
                  color="success"
                  isLoading={saving}
                  size="sm"
                  onPress={handleReturnItem}
                >
                  Confirm return
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Refill Modal */}
      <Modal
        classNames={{
          base: "bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] rounded-2xl",
        }}
        isOpen={refillModalState.isOpen}
        onClose={refillModalState.close}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <h2 className="text-[16px] font-semibold text-primary">
              Refill Stock
            </h2>
            <p className="text-[11px] text-[rgb(var(--color-text-muted))] font-medium">
              Add new inventory and generate a purchase bill.
            </p>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <Input
                isRequired
                classNames={{ inputWrapper: "rounded-xl" }}
                label="Quantity to Add"
                min="1"
                size="sm"
                type="number"
                value={refillForm.quantity.toString()}
                onChange={(e) =>
                  setRefillForm({
                    ...refillForm,
                    quantity: parseInt(e.target.value) || 0,
                  })
                }
              />
              <Input
                classNames={{ inputWrapper: "rounded-xl" }}
                label="New Unit Price (Rs.)"
                min="0"
                placeholder="Leave 0 if price hasn't changed"
                size="sm"
                type="number"
                value={refillForm.cost.toString()}
                onChange={(e) =>
                  setRefillForm({
                    ...refillForm,
                    cost: parseInt(e.target.value) || 0,
                  })
                }
              />
              <Input
                classNames={{ inputWrapper: "rounded-xl" }}
                label="Purchase / Refill Date"
                size="sm"
                type="date"
                value={refillForm.purchaseDate}
                onChange={(e) =>
                  setRefillForm({
                    ...refillForm,
                    purchaseDate: e.target.value,
                  })
                }
              />
              <Input
                classNames={{ inputWrapper: "rounded-xl" }}
                label="Invoice / Bill No."
                placeholder="Optional invoice tracking"
                size="sm"
                value={refillForm.invoiceNumber}
                onChange={(e) =>
                  setRefillForm({
                    ...refillForm,
                    invoiceNumber: e.target.value,
                  })
                }
              />
              <Textarea
                classNames={{ inputWrapper: "rounded-xl" }}
                label="Notes"
                placeholder="Optional notes"
                size="sm"
                value={refillForm.notes}
                onChange={(e) =>
                  setRefillForm({ ...refillForm, notes: e.target.value })
                }
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              className="font-semibold text-[12px] rounded-xl"
              size="sm"
              variant="light"
              onPress={refillModalState.close}
            >
              Cancel
            </Button>
            <Button
              className="font-semibold text-[12px] rounded-xl px-6"
              color="primary"
              isLoading={saving}
              size="sm"
              onPress={handleRefillItem}
            >
              Confirm Refill
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* INDIVIDUAL PRINT INVOICE LAYOUT */}
      {selectedPrintBill && (
        <div className="hidden print:block w-full text-black bg-white p-8 font-sans">
          <div className="flex justify-between items-start border-b-2 border-gray-200 pb-6 mb-6">
            <div>
              <h1 className="text-3xl font-black text-gray-900 tracking-tight">PURCHASE RECEIPT</h1>
              <p className="text-sm font-bold text-gray-500 uppercase mt-1">Inventory Asset Restock</p>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-black text-gray-800">Clinic Inventory</h2>
              <p className="text-sm text-gray-500 mt-1">Official Document</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Receipt Details</p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm mb-2"><span className="font-semibold w-24 inline-block text-gray-600">Date:</span> <span className="font-medium text-gray-900">{format(new Date(selectedPrintBill.purchaseDate || new Date()), "MMMM dd, yyyy")}</span></p>
                <p className="text-sm mb-2"><span className="font-semibold w-24 inline-block text-gray-600">Invoice No:</span> <span className="font-medium text-gray-900">{selectedPrintBill.invoiceNumber || "N/A"}</span></p>
                <p className="text-sm"><span className="font-semibold w-24 inline-block text-gray-600">Log ID:</span> <span className="font-mono text-gray-900 text-xs">{selectedPrintBill.id.slice(-8).toUpperCase()}</span></p>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Generated By</p>
              <div className="bg-gray-50 p-4 rounded-lg h-[92px]">
                <p className="text-sm mb-2"><span className="font-semibold w-24 inline-block text-gray-600">User ID:</span> <span className="font-medium text-gray-900">System Admin</span></p>
                <p className="text-sm"><span className="font-semibold w-24 inline-block text-gray-600">Status:</span> <span className="font-medium text-green-600 bg-green-100 px-2 py-0.5 rounded text-xs">Completed</span></p>
              </div>
            </div>
          </div>

          <table className="w-full mb-8 border-collapse">
            <thead>
              <tr className="bg-gray-100 border-y border-gray-300 text-left">
                <th className="py-3 px-4 text-xs font-black uppercase text-gray-600 tracking-wider">Item Description</th>
                <th className="py-3 px-4 text-xs font-black uppercase text-gray-600 tracking-wider text-center">Quantity</th>
                <th className="py-3 px-4 text-xs font-black uppercase text-gray-600 tracking-wider text-right">Unit Price</th>
                <th className="py-3 px-4 text-xs font-black uppercase text-gray-600 tracking-wider text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-200">
                <td className="py-4 px-4">
                  <p className="font-bold text-gray-900 text-sm capitalize">{selectedPrintBill.itemName?.toLowerCase()}</p>
                  <p className="text-xs text-gray-500 mt-1">Asset Registry Refill</p>
                </td>
                <td className="py-4 px-4 text-center text-sm font-semibold text-gray-800">{selectedPrintBill.quantity} units</td>
                <td className="py-4 px-4 text-right text-sm text-gray-700">Rs. {selectedPrintBill.unitPrice?.toLocaleString()}</td>
                <td className="py-4 px-4 text-right text-sm font-bold text-gray-900">Rs. {selectedPrintBill.totalAmount?.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          <div className="flex justify-end mb-12">
            <div className="w-1/3 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-gray-600">Subtotal:</span>
                <span className="text-sm text-gray-800">Rs. {selectedPrintBill.totalAmount?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-semibold text-gray-600">Tax/Fees:</span>
                <span className="text-sm text-gray-800">Rs. 0</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-gray-300">
                <span className="text-base font-black text-gray-900">TOTAL:</span>
                <span className="text-lg font-black text-emerald-600">Rs. {selectedPrintBill.totalAmount?.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {selectedPrintBill.notes && (
            <div className="mb-12">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Transaction Notes</p>
              <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-100 italic">
                "{selectedPrintBill.notes}"
              </p>
            </div>
          )}

          <div className="text-center pt-8 border-t border-gray-200 mt-auto">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">End of Receipt</p>
            <p className="text-[10px] text-gray-400 mt-2">Generated automatically by ProCare Clinical System</p>
          </div>
        </div>
      )}
    </div>
  );
}
