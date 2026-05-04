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
import { title } from "@/components/primitives";
import {
  IoAdd,
  IoSearch,
  IoCreate,
  IoCheckmark,
  IoTime,
  IoWarning,
  IoArrowForward,
  IoTimeOutline,
  IoCheckmarkCircleOutline,
  IoWarningOutline,
  IoCreateOutline,
  IoArrowForwardOutline
} from "react-icons/io5";

import { useAuth } from "@/hooks/useAuth";
import { useModalState } from "@/hooks/useModalState";
import { useTheme } from "@/context/ThemeContext";

// Services
import { itemService } from "@/services/itemService";
import { itemCategoryService } from "@/services/itemCategoryService";
import { issuedItemService } from "@/services/issuedItemService";

// Types
import { Item, ItemCategory, IssuedItem } from "@/types/models";

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
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("items");

  // Modal states
  const itemModalState = useModalState(false);
  const categoryModalState = useModalState(false);
  const issueModalState = useModalState(false);
  const returnModalState = useModalState(false);

  // Form states
  const [itemForm, setItemForm] = useState({
    id: "",
    name: "",
    category: "",
    quantity: 0,
    description: "",
    unit: "",
    barcode: "",
  });

  const [categoryForm, setCategoryForm] = useState({
    id: "",
    name: "",
    description: "",
  });

  const [issueForm, setIssueForm] = useState({
    itemId: "",
    quantity: 0,
    issuedTo: "",
    expectedReturnDate: null as Date | null,
    notes: "",
  });

  const [selectedIssuedItem, setSelectedIssuedItem] =
    useState<IssuedItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Load data

  // Load data
  useEffect(() => {
    loadInventoryData();
  }, [clinicId, branchId]);

  const loadInventoryData = async () => {
    if (!clinicId || !branchId) return;

    try {
      setLoading(true);
      const [itemsData, categoriesData, issuedItemsData] = await Promise.all([
        itemService.getItemsByClinic(clinicId, branchId),
        itemCategoryService.getCategoriesByClinic(clinicId, branchId),
        issuedItemService.getIssuedItemsByClinic(clinicId, branchId),
      ]);

      setItems(itemsData);
      setCategories(categoriesData);
      setIssuedItems(issuedItemsData);
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

  // Filter functions
  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredCategories = categories.filter((category) =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredIssuedItems = issuedItems.filter(
    (item) =>
      item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.itemCategory.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.issuedTo?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Handle item operations
  const handleSaveItem = async () => {
    if (!itemForm.name || !itemForm.category || itemForm.quantity < 0) {
      addToast({
        title: "Error",
        description:
          "Please fill in all required fields and ensure quantity is not negative",
        color: "danger",
      });

      return;
    }

    try {
      const itemData = {
        name: itemForm.name,
        category: itemForm.category,
        description: itemForm.description,
        unit: itemForm.unit,
        barcode: itemForm.barcode,
        quantity: itemForm.quantity, // Include quantity in the data
        salePrice: 0, // Default sale price since we're not tracking prices in the UI
        clinicId: clinicId!,
        branchId: branchId!,
        isActive: true,
        createdBy: currentUser?.uid || "",
      };

      if (isEditing) {
        await itemService.updateItem(itemForm.id, itemData);
        addToast({
          title: "Success",
          description: "Item updated successfully",
          color: "success",
        });
      } else {
        await itemService.createItem(itemData);
        addToast({
          title: "Success",
          description: "Item created successfully",
          color: "success",
        });
      }

      itemModalState.forceClose();
      loadInventoryData();
      resetItemForm();
    } catch (error) {
      console.error("Error saving item:", error);
      addToast({
        title: "Error",
        description: "Failed to save item",
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

    try {
      const categoryData = {
        ...categoryForm,
        clinicId: clinicId!,
        branchId: branchId!,
        isActive: true,
        createdBy: currentUser?.uid || "",
      };

      if (isEditing) {
        await itemCategoryService.updateCategory(categoryForm.id, categoryData);
        addToast({
          title: "Success",
          description: "Category updated successfully",
          color: "success",
        });
      } else {
        await itemCategoryService.createCategory(categoryData);
        addToast({
          title: "Success",
          description: "Category created successfully",
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
        expectedReturnDate: issueForm.expectedReturnDate,
        status: "issued" as const,
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
    }
  };

  const handleReturnItem = async () => {
    if (!selectedIssuedItem) return;

    try {
      await issuedItemService.returnItem(
        selectedIssuedItem.id,
        currentUser?.uid || "",
      );

      // Find the original item and increase its quantity
      const originalItem = items.find(
        (item) => item.id === selectedIssuedItem.itemId,
      );

      if (originalItem) {
        const updatedItemData = {
          ...originalItem,
          quantity: originalItem.quantity + selectedIssuedItem.quantity,
        };

        await itemService.updateItem(originalItem.id, updatedItemData);
      }

      addToast({
        title: "Success",
        description: "Item returned successfully",
        color: "success",
      });

      returnModalState.forceClose();
      loadInventoryData();
      setSelectedIssuedItem(null);
    } catch (error) {
      console.error("Error returning item:", error);
      addToast({
        title: "Error",
        description: "Failed to return item",
        color: "danger",
      });
    }
  };

  // Reset forms
  const resetItemForm = () => {
    setItemForm({
      id: "",
      name: "",
      category: "",
      quantity: 0,
      description: "",
      unit: "",
      barcode: "",
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
      quantity: 0,
      issuedTo: "",
      expectedReturnDate: null,
      notes: "",
    });
  };

  // Edit functions
  const editItem = (item: Item) => {
    setItemForm({
      id: item.id,
      name: item.name,
      category: item.category,
      quantity: item.quantity || 0, // Use the actual quantity from the item
      description: item.description || "",
      unit: item.unit || "",
      barcode: item.barcode || "",
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
      default:
        return "default";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Spinner label="Loading inventory..." size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className={title({ size: "lg", color: "primary" })}>Inventory Management</h1>
          <p className="text-[13.5px] text-text-muted mt-1">
            Manage your clinic's inventory items, categories, and issued items
          </p>
        </div>
      </div>

      {/* Main Content */}
      <Card className="bg-surface border border-border-base shadow-none">
        <CardHeader className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Input
              className="w-80"
              placeholder="Search inventory..."
              startContent={<IoSearch />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardHeader>

        <CardBody>
          <Tabs
            className="w-full"
            selectedKey={selectedTab}
            onSelectionChange={(key) => setSelectedTab(key as string)}
          >
            {/* Items Tab */}
            <Tab key="items" title="Items">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-default-500">
                    Total Items: {filteredItems.length}
                  </p>
                  <Button
                    color="primary"
                    startContent={<IoAdd />}
                    onPress={() => {
                      resetItemForm();
                      itemModalState.open();
                    }}
                  >
                    Add Item
                  </Button>
                </div>

                {filteredItems.length > 0 ? (
                  <Table aria-label="Items table">
                    <TableHeader>
                      <TableColumn>NAME</TableColumn>
                      <TableColumn>CATEGORY</TableColumn>
                      <TableColumn>QUANTITY</TableColumn>
                      <TableColumn>CREATED ON</TableColumn>
                      <TableColumn>ACTIONS</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{item.name}</p>
                              {item.description && (
                                <p className="text-sm text-default-500">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Chip color="primary" size="sm" variant="flat">
                              {item.category}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            <Chip
                              color={item.quantity > 0 ? "success" : "danger"}
                              size="sm"
                              variant="flat"
                            >
                              {item.quantity || 0}
                            </Chip>
                          </TableCell>
                          <TableCell>
                            {format(item.createdAt, "MMM dd, yyyy")}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                color="primary"
                                size="sm"
                                startContent={<IoCreate />}
                                variant="flat"
                                onPress={() => editItem(item)}
                              >
                                Edit
                              </Button>
                              <Button
                                color="secondary"
                                isDisabled={item.quantity === 0}
                                size="sm"
                                startContent={<IoArrowForward />}
                                variant="flat"
                                onPress={() => {
                                  setIssueForm({
                                    ...issueForm,
                                    itemId: item.id,
                                  });
                                  issueModalState.open();
                                }}
                              >
                                Issue
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 mb-4 mx-auto">
                      <IoAdd className="text-3xl text-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-[rgb(var(--color-text))]">
                        {searchQuery ? "No items found" : "No items yet"}
                      </h3>
                      <p className="text-[13px] text-text-muted mt-1 max-w-sm mx-auto">
                        {searchQuery
                          ? `No items match your search "${searchQuery}". Try adjusting your search terms.`
                          : "Start building your inventory by adding your first item."}
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
                          {["CATEGORY NAME", "DESCRIPTION", "ITEMS COUNT", "ACTIONS"].map((h) => (
                            <th key={h} className="px-4 py-3 text-[11px] font-semibold text-primary uppercase tracking-wider">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-base bg-surface">
                        {filteredCategories.map((category) => (
                          <tr key={category.id} className="hover:bg-surface-2 transition-colors">
                            <td className="px-4 py-3 text-[13.5px] font-medium text-text-main">
                              {category.name}
                            </td>
                            <td className="px-4 py-3 text-[12.5px] text-text-muted">
                              {category.description || "No description"}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-medium bg-primary/10 text-primary border border-primary/20">
                                {items.filter((item) => item.category === category.name).length}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                className="p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded transition-colors"
                                title="Edit"
                                onClick={() => editCategory(category)}
                              >
                                <IoCreateOutline size={18} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 px-4 bg-surface">
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 bg-surface-2 rounded-full flex items-center justify-center mx-auto">
                        <IoAdd className="w-8 h-8 text-text-muted/40" />
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-text-main mb-2">
                          {searchQuery ? "No categories found" : "No categories yet"}
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

            {/* Issued Items Tab */}
            <Tab key="issued" title="Issued Items">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-default-500">
                    Total Issued Items: {filteredIssuedItems.length}
                  </p>
                  <Button
                    color="primary"
                    startContent={<IoAdd />}
                    onPress={() => {
                      resetIssueForm();
                      issueModalState.open();
                    }}
                  >
                    Issue Item
                  </Button>
                </div>

                {filteredIssuedItems.length > 0 ? (
                  <div className="border border-border-base rounded overflow-hidden">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                      <thead>
                        <tr className="bg-surface-2 border-b border-border-base">
                          {[
                            "ITEM NAME",
                            "CATEGORY",
                            "QUANTITY",
                            "ISSUED DATE",
                            "RETURN DATE",
                            "ISSUED TO",
                            "STATUS",
                            "ACTIONS",
                          ].map((h) => (
                            <th key={h} className="px-4 py-3 text-[11px] font-semibold text-primary uppercase tracking-wider">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-base bg-surface">
                        {filteredIssuedItems.map((issuedItem) => (
                          <tr key={issuedItem.id} className="hover:bg-surface-2 transition-colors">
                            <td className="px-4 py-3 text-[13.5px] font-medium text-text-main">
                              {issuedItem.itemName}
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-medium bg-primary/10 text-primary border border-primary/20">
                                {issuedItem.itemCategory}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-[13px] text-text-main">
                              {issuedItem.quantity}
                            </td>
                            <td className="px-4 py-3 text-[12.5px] text-text-muted">
                              {format(issuedItem.issuedDate, "MMM dd, yyyy")}
                            </td>
                            <td className="px-4 py-3 text-[12.5px] text-text-muted">
                              {issuedItem.returnDate
                                ? format(issuedItem.returnDate, "MMM dd, yyyy")
                                : issuedItem.expectedReturnDate
                                  ? `Exp: ${format(issuedItem.expectedReturnDate, "MMM dd, yyyy")}`
                                  : "—"}
                            </td>
                            <td className="px-4 py-3 text-[12.5px] text-text-main">
                              {issuedItem.issuedTo || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-medium 
                                ${issuedItem.status === "returned" ? "bg-green-500/10 text-green-600 border border-green-500/20" :
                                  issuedItem.status === "overdue" ? "bg-red-500/10 text-red-600 border border-red-500/20" :
                                    "bg-primary/10 text-primary border border-primary/20"}`}>
                                {issuedItem.status === "issued" ? <IoTimeOutline /> :
                                  issuedItem.status === "returned" ? <IoCheckmarkCircleOutline /> :
                                    <IoWarningOutline />}
                                {issuedItem.status.charAt(0).toUpperCase() + issuedItem.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {issuedItem.status === "issued" && (
                                <button
                                  className="p-1.5 text-text-muted hover:text-green-600 hover:bg-green-500/10 rounded transition-colors"
                                  title="Return"
                                  onClick={() => openReturnModal(issuedItem)}
                                >
                                  <IoCheckmarkCircleOutline size={18} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 px-4 bg-surface">
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 bg-surface-2 rounded-full flex items-center justify-center mx-auto">
                        <IoArrowForwardOutline className="w-8 h-8 text-text-muted/40" />
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-text-main mb-2">
                          {searchQuery ? "No issued items found" : "No issued items yet"}
                        </h3>
                        <p className="text-sm text-text-muted max-w-sm">
                          {searchQuery
                            ? `No issued items match your search "${searchQuery}". Try adjusting your search terms.`
                            : items.length > 0
                              ? "Start tracking item usage by issuing items to staff or departments."
                              : "Add some items to your inventory first before you can issue them."}
                        </p>
                      </div>
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
        isOpen={itemModalState.isOpen}
        onClose={itemModalState.close}
        size="2xl"
        classNames={{
          base: "bg-surface border border-border-base",
          header: "border-b border-border-base font-semibold text-text-main",
          body: "py-6",
          footer: "border-t border-border-base bg-surface-2/50",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>{isEditing ? "Edit Item" : "Add New Item"}</ModalHeader>
              <ModalBody>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <Input
                    isRequired
                    label="Item Name"
                    placeholder="Enter item name"
                    variant="bordered"
                    labelPlacement="outside"
                    classNames={{ inputWrapper: "bg-surface border-border-base" }}
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  />
                  <Select
                    isRequired
                    label="Category"
                    placeholder="Select category"
                    variant="bordered"
                    labelPlacement="outside"
                    classNames={{ trigger: "bg-surface border-border-base" }}
                    selectedKeys={itemForm.category ? new Set([itemForm.category]) : new Set()}
                    onSelectionChange={(keys) => {
                      const selectedKey = Array.from(keys)[0] as string;
                      setItemForm({ ...itemForm, category: selectedKey || "" });
                    }}
                  >
                    {categories.map((category) => (
                      <SelectItem key={category.name} textValue={category.name}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </Select>
                  <Input
                    isRequired
                    label="Quantity"
                    min="0"
                    type="number"
                    variant="bordered"
                    labelPlacement="outside"
                    classNames={{ inputWrapper: "bg-surface border-border-base" }}
                    value={itemForm.quantity.toString()}
                    onChange={(e) => setItemForm({ ...itemForm, quantity: parseInt(e.target.value) || 0 })}
                  />
                  <Input
                    label="Unit"
                    placeholder="e.g., piece, box"
                    variant="bordered"
                    labelPlacement="outside"
                    classNames={{ inputWrapper: "bg-surface border-border-base" }}
                    value={itemForm.unit}
                    onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                  />
                  <Input
                    label="Barcode"
                    placeholder="Scan or enter barcode"
                    variant="bordered"
                    labelPlacement="outside"
                    classNames={{ inputWrapper: "bg-surface border-border-base" }}
                    value={itemForm.barcode}
                    onChange={(e) => setItemForm({ ...itemForm, barcode: e.target.value })}
                  />
                  <Textarea
                    label="Description"
                    placeholder="Enter item description"
                    variant="bordered"
                    labelPlacement="outside"
                    className="md:col-span-2"
                    classNames={{ inputWrapper: "bg-surface border-border-base" }}
                    value={itemForm.description}
                    onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button color="primary" onPress={handleSaveItem}>
                  {isEditing ? "Update" : "Add"} Item
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Add/Edit Category Modal */}
      <Modal
        isOpen={categoryModalState.isOpen}
        onClose={categoryModalState.close}
        classNames={{
          base: "bg-surface border border-border-base",
          header: "border-b border-border-base font-semibold text-text-main",
          body: "py-6",
          footer: "border-t border-border-base bg-surface-2/50",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>{isEditing ? "Edit Category" : "Add New Category"}</ModalHeader>
              <ModalBody className="space-y-5">
                <Input
                  isRequired
                  label="Category Name"
                  placeholder="Enter category name"
                  variant="bordered"
                  labelPlacement="outside"
                  classNames={{ inputWrapper: "bg-surface border-border-base" }}
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                />
                <Textarea
                  label="Description"
                  placeholder="Enter description"
                  variant="bordered"
                  labelPlacement="outside"
                  classNames={{ inputWrapper: "bg-surface border-border-base" }}
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button color="primary" onPress={handleSaveCategory}>
                  {isEditing ? "Update" : "Add"} Category
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Issue Item Modal */}
      <Modal
        isOpen={issueModalState.isOpen}
        onClose={issueModalState.close}
        classNames={{
          base: "bg-surface border border-border-base",
          header: "border-b border-border-base font-semibold text-text-main",
          body: "py-6",
          footer: "border-t border-border-base bg-surface-2/50",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Issue Item</ModalHeader>
              <ModalBody className="space-y-5">
                <Select
                  isRequired
                  label="Select Item"
                  placeholder="Choose item to issue"
                  variant="bordered"
                  labelPlacement="outside"
                  classNames={{ trigger: "bg-surface border-border-base" }}
                  selectedKeys={issueForm.itemId ? new Set([issueForm.itemId]) : new Set()}
                  onSelectionChange={(keys) => {
                    const selectedKey = Array.from(keys)[0] as string;
                    setIssueForm({ ...issueForm, itemId: selectedKey || "" });
                  }}
                >
                  {items.filter(item => item.quantity > 0).map((item) => (
                    <SelectItem key={item.id} textValue={item.name}>
                      {item.name} ({item.category}) - {item.quantity} available
                    </SelectItem>
                  ))}
                </Select>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    isRequired
                    label="Quantity"
                    type="number"
                    min="1"
                    variant="bordered"
                    labelPlacement="outside"
                    classNames={{ inputWrapper: "bg-surface border-border-base" }}
                    value={issueForm.quantity.toString()}
                    onChange={(e) => setIssueForm({ ...issueForm, quantity: parseInt(e.target.value) || 0 })}
                  />
                  <Input
                    label="Exp. Return Date"
                    type="date"
                    variant="bordered"
                    labelPlacement="outside"
                    classNames={{ inputWrapper: "bg-surface border-border-base" }}
                    value={issueForm.expectedReturnDate ? issueForm.expectedReturnDate.toISOString().split('T')[0] : ""}
                    onChange={(e) => setIssueForm({ ...issueForm, expectedReturnDate: e.target.value ? new Date(e.target.value) : null })}
                  />
                </div>
                <Input
                  label="Issued To"
                  placeholder="Person or department"
                  variant="bordered"
                  labelPlacement="outside"
                  classNames={{ inputWrapper: "bg-surface border-border-base" }}
                  value={issueForm.issuedTo}
                  onChange={(e) => setIssueForm({ ...issueForm, issuedTo: e.target.value })}
                />
                <Textarea
                  label="Notes"
                  placeholder="Reason or additional info"
                  variant="bordered"
                  labelPlacement="outside"
                  classNames={{ inputWrapper: "bg-surface border-border-base" }}
                  value={issueForm.notes}
                  onChange={(e) => setIssueForm({ ...issueForm, notes: e.target.value })}
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button color="primary" onPress={handleIssueItem}>
                  Issue Item
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Return Item Modal */}
      <Modal
        isOpen={returnModalState.isOpen}
        onClose={returnModalState.close}
        classNames={{
          base: "bg-surface border border-border-base",
          header: "border-b border-border-base font-semibold text-text-main",
          body: "py-6",
          footer: "border-t border-border-base bg-surface-2/50",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Confirm Return</ModalHeader>
              <ModalBody>
                {selectedIssuedItem && (
                  <div className="space-y-4">
                    <p className="text-[14px] text-text-muted">
                      Marking <strong>{selectedIssuedItem.itemName}</strong> ({selectedIssuedItem.quantity} units) as returned by {selectedIssuedItem.issuedTo || "staff"}.
                    </p>
                    <div className="bg-surface-2 p-4 rounded border border-border-base text-sm space-y-1">
                      <p className="text-text-muted">Issued on: {format(selectedIssuedItem.issuedDate, "MMM dd, yyyy")}</p>
                      {selectedIssuedItem.notes && <p className="text-text-muted italic">Notes: {selectedIssuedItem.notes}</p>}
                    </div>
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button color="success" onPress={handleReturnItem} className="text-white">
                  Confirm Return
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
