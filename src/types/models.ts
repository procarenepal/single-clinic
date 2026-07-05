// Core data models for the multi-tenant clinic platform

// Clinic (Tenant) model
export interface Clinic {
  id: string;
  name: string;
  city: string;
  clinicType: string;
  phone: string;
  email: string;
  address?: string; // Added address
  zipCode?: string; // Added zipCode
  state?: string; // Added state
  country?: string; // Added country
  logo?: string;
  panNumber?: string;
  description?: string;
  subscriptionStatus: "active" | "suspended" | "cancelled";
  subscriptionPlan: string;
  subscriptionStartDate: Date;
  subscriptionEndDate?: Date;
  subscriptionType: "monthly" | "yearly"; // Added subscription type field
  // Multi-branch support
  isMultiBranchEnabled: boolean; // Platform admin controls this
  totalBranches?: number; // Current number of branches
  maxBranches?: number; // Maximum branches allowed (based on subscription)
  createdAt: Date;
  updatedAt: Date;
}

// Branch model for multi-branch clinics
export interface Branch {
  id: string;
  clinicId: string; // Parent clinic
  name: string; // Branch name (e.g., "Main Branch", "Downtown Branch")
  code: string; // Unique branch code within clinic (e.g., "MB", "DT")
  address: string;
  city: string;
  phone: string;
  email?: string;
  isMainBranch: boolean; // One branch per clinic should be marked as main
  isActive: boolean;
  managerId?: string; // User ID of the branch admin/manager
  // Branch-specific settings
  operatingHours?: {
    monday?: { open: string; close: string; isOpen: boolean };
    tuesday?: { open: string; close: string; isOpen: boolean };
    wednesday?: { open: string; close: string; isOpen: boolean };
    thursday?: { open: string; close: string; isOpen: boolean };
    friday?: { open: string; close: string; isOpen: boolean };
    saturday?: { open: string; close: string; isOpen: boolean };
    sunday?: { open: string; close: string; isOpen: boolean };
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // User ID who created the branch
}

// User model with clinic association and role information
export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phone?: string;
  clinicId?: string; // null for system-owner
  branchId?: string; // null for system-owner and system-owner
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}

// Possible user roles in the system
export type UserRole = "system-owner" | "clinic-admin" | "staff" | "doctor" | "expert" | "hr";

// Clinic Type model for categorizing clinics
export interface ClinicType {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // User ID of the creator (system-owner)
}

// Subscription Plan model for different subscription tiers
export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number; // Monthly price in NPR
  yearlyPrice: number; // Yearly price in NPR (should be cheaper than monthly × 12)
  discountedMonthlyPrice?: number; // Optional discounted monthly price in NPR
  discountedYearlyPrice?: number; // Optional discounted yearly price in NPR
  features: string[];
  isActive: boolean;
  maxUsers: number; // Maximum number of users allowed
  maxPatients: number; // Maximum number of patients allowed
  storageLimitGB: number; // Storage limit in GB
  createdAt: Date;
  updatedAt: Date;
}

// Permission definition
export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string; // e.g., 'patients', 'appointments', 'staff'
  action: "create" | "read" | "update" | "delete" | "manage";
}

// Role with associated permissions
export interface Role {
  id: string;
  clinicId: string | null; // Associated clinic (null for system-defined roles)
  branchId?: string; // Associated branch (null for clinic-wide or system-defined roles)
  name: string;
  description: string;
  permissions: string[]; // Permission IDs
  isDefault: boolean; // Is this a default role for the clinic
  isBranchSpecific: boolean; // Whether this role is specific to a branch
  linkedToDoctor: boolean; // Whether this role is linked to doctors for user creation
  linkedToExpert?: boolean; // Whether this role is linked to experts for user creation
  createdAt: Date;
  updatedAt: Date;
}

// User-Role assignment (many-to-many relationship)
export interface UserRoleAssignment {
  userId: string;
  roleId: string;
  clinicId: string;
}

// Invitation to join a clinic
export interface Invitation {
  id: string;
  email: string;
  clinicId: string;
  role: string; // Role to be assigned upon acceptance
  status: "pending" | "accepted" | "expired";
  invitedBy: string; // User ID who sent the invitation
  invitedAt: Date;
  expiresAt: Date;
  acceptedAt?: Date;
}

// Page model for system pages that can be assigned to clinic types
export interface Page {
  id: string;
  name: string;
  path: string;
  description: string;
  icon?: string;
  isActive: boolean;
  order: number;
  autoAssign?: boolean; // Auto-assign to new clinic types
  showInSidebar?: boolean; // Whether to show this page in the sidebar navigation
  parentId?: string; // For sub-menu functionality - references parent page
  hasSubmenu?: boolean; // Whether this page has child pages
  level?: number; // Depth level (0 = root, 1 = sub-menu, etc.)
  createdAt: Date;
  updatedAt: Date;
}

// ClinicTypePage represents the relation between clinic types and pages
export interface ClinicTypePage {
  id: string;
  clinicTypeId: string;
  pageId: string;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Patient model for storing patient information
export interface Patient {
  id: string;
  regNumber: string; // Registration number
  name: string;
  address: string;
  mobile: string;
  email?: string;
  gender: "male" | "female" | "other";
  dob: Date; // Date of birth
  bsDate?: Date; // B.S Date (Bikram Sambat)
  bloodGroup?: "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
  age: string | number;
  referredBy?: string;
  phone?: string;
  picture?: string; // URL to the patient's picture
  doctorId: string; // ID of the assigned doctor
  assignedExpertId?: string; // ID of the assigned expert (optional)
  medicalConditions: string[]; // Array of medical conditions
  clinicId: string; // Associated clinic
  branchId: string; // Associated branch
  isActive: boolean;
  isCritical: boolean; // Critical patient indicator
  criticalReason?: string; // Optional reason for critical status
  criticalDate?: Date; // Date when marked as critical
  referralPartnerId?: string; // Linked referral partner
  referrals?: Array<{
    type: "referral-partner" | "doctor" | "expert" | "staff";
    id: string;
    name: string;
    commissionPercentage: number;
    referredById?: string; // Optional specific doctor/expert associated with this partner
    referredByName?: string; // Name of specific doctor/expert
  }>;
  walletBalance?: number; // Total available advance deposit balance
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // User ID who created the patient record
}

// Wallet Transaction model for recording patient deposits and deductions
export interface WalletTransaction {
  id: string;
  patientId: string;
  clinicId: string;
  branchId: string;
  type: "deposit" | "deduction";
  amount: number;
  paymentMethod?: string; // e.g. "cash", "card" for deposits
  referenceId?: string; // invoiceId if deduction, or external reference for deposit
  notes?: string;
  createdAt: Date;
  createdBy: string;
}

// Treatment Category model for categorizing services/appointment types
export interface TreatmentCategory {
  id: string;
  name: string;
  description?: string;
  clinicId: string;
  branchId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Treatment Package model for selling bulk sessions that fund the wallet
export interface TreatmentPackage {
  id: string;
  name: string;
  description?: string;
  price: number; // The cost the patient pays
  walletCreditAmount: number; // The amount credited to their wallet (usually same as price)
  totalSessions?: number; // Visual tracking of sessions
  validityDays?: number; // Expiration period from purchase date
  clinicId: string;
  branchId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface PackageSessionTicket {
  sessionNumber: number;
  status: "pending" | "in-progress" | "completed";
  appointmentId?: string;
  clinicianId?: string;
  clinicianName?: string;
  consumedAt?: Date;
}

// Patient Package model for tracking purchased packages and their consumed sessions
export interface PatientPackage {
  id: string;
  patientId: string;
  packageId: string;
  packageName: string;
  clinicId: string;
  branchId: string;
  totalSessions: number;
  usedSessions: number;
  sessions?: PackageSessionTicket[]; // Explicit ticket tracking
  sessionHistory?: {
    consumedAt: Date;
    appointmentId: string;
    clinicianId?: string;
    clinicianName?: string;
  }[];
  status: "active" | "completed" | "expired";
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Appointment Type model for configurable appointment types with pricing in Nepali Rupees
export interface AppointmentType {
  id: string;
  name: string;
  price: number; // Price in Nepali Rupees (NPR)
  clinicId: string; // Associated clinic
  branchId?: string; // Associated branch (optional for individual clinics)
  isActive: boolean;
  categoryId?: string; // Reference to TreatmentCategory
  color?: string; // Color identifier for theme-dynamic blinking rows
  billAtFrontDesk?: boolean; // Whether to bill automatically at check-in
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // User ID who created the appointment type
}

// Appointment model for patient appointments
export interface Appointment {
  id: string;
  patientId: string;
  clinicId: string;
  branchId: string; // Associated branch
  doctorId: string;
  assignedExpertId?: string;
  appointmentDate: Date;
  appointmentBS?: Date; // B.S Date
  startTime?: string;
  endTime?: string;
  appointmentTypeId: string; // Reference to AppointmentType
  appointmentType:
    | "initial"
    | "followup"
    | "emergency"
    | "routine"
    | "screening"
    | "vaccination"
    | "lab-review"
    | "pre-op"
    | "post-op"
    | "therapy"; // Keep for backward compatibility
  status:
    | "scheduled"
    | "confirmed"
    | "in-progress"
    | "completed"
    | "cancelled"
    | "no-show";
  reason?: string; // Reason for the appointment visit
  notes?: string;
  registrationDate: Date;
  billingId?: string | null;
  billingStatus?: "unpaid" | "partial" | "paid" | null;
  paymentStatus?: "unpaid" | "partial" | "paid" | null;
  consultationBillingId?: string | null;
  consultationBillingStatus?: "unpaid" | "partial" | "paid" | null;
  checkoutCompleted?: boolean;
  doctorConsultationCompleted?: boolean;
  cabinName?: string;
  patientPackageId?: string; // Links this appointment to a specific active package session
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Doctor model for storing doctor information
export interface Doctor {
  id: string;
  name: string;
  doctorType: "regular" | "visiting";
  defaultCommission: number;
  speciality: string;
  phone: string;
  email?: string;
  nmcNumber: string; // NMC License Number
  clinicId: string;
  branchId: string; // Associated branch
  isActive: boolean;
  isDeleted?: boolean; // Soft delete flag - deleted doctors won't show in list
  totalCommissionBalance?: number; // Current pending balance to be paid
  totalCommissionEarned?: number; // Lifetime total commission earned
  consultationCharge?: number; // Custom charge per doctor consultation
  monthlyTarget?: number; // Monthly business target
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Expert model for storing expert information (similar to Doctor)
export interface Expert {
  id: string;
  name: string;
  expertType: "regular" | "visiting";
  defaultCommission: number;
  speciality: string;
  phone: string;
  email?: string;
  licenseNumber: string; // Expert License/Registration Number
  clinicId: string;
  branchId: string; // Associated branch
  isActive: boolean;
  isDeleted?: boolean; // Soft delete flag
  totalCommissionBalance?: number; // Current pending balance to be paid
  totalCommissionEarned?: number; // Lifetime total commission earned
  monthlyTarget?: number; // Monthly business target
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Referral Partner model for managing external referral sources with commissions
export interface ReferralPartner {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  partnerType: "individual" | "lab" | "clinic" | "other";
  defaultCommission: number; // Commission percentage (e.g., 10 for 10%)
  clinicId: string;
  branchId: string; // Associated branch
  isActive: boolean;
  isDeleted?: boolean; // Soft delete flag
  totalCommissionBalance?: number; // Current pending balance to be paid
  totalCommissionEarned?: number; // Lifetime total commission earned
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Doctor Speciality model for managing medical specialities
export interface DoctorSpeciality {
  id: string;
  name: string; // Display name (e.g., "General Medicine")
  key: string; // Unique key (e.g., "general-medicine")
  description?: string; // Optional description
  isActive: boolean;
  clinicId: string;
  branchId: string; // Associated branch
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Medical Report Field model for configurable fields in patient medical reports
export interface MedicalReportField {
  id: string;
  fieldLabel: string; // Field name/label
  fieldKey: string; // Unique key for the field
  fieldType:
    | "text"
    | "textarea"
    | "select"
    | "checkbox"
    | "radio"
    | "number"
    | "date"
    | "yes-no";
  options?: string[]; // For select, radio, checkbox types
  placeholder?: string;
  description?: string;
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number; // Display order
  clinicId: string;
  branchId: string; // Associated branch
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Medical Report Response model for storing patient responses to medical report fields
export interface MedicalReportResponse {
  id: string;
  clinicId: string;
  branchId: string; // Associated branch
  patientId: string;
  fieldValues: Record<string, any>; // Field key to value mapping
  submittedBy: string;
  submittedAt: Date;
  updatedAt: Date;
}

// Medical Document model for storing patient documents with just note and file
export interface MedicalDocument {
  id: string;
  patientId: string;
  clinicId: string;
  note: string; // Simple note/description
  file?: string; // Single Appwrite file ID
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// X-ray Record model for storing patient X-ray information with just note and file
export interface XrayRecord {
  id: string;
  patientId: string;
  clinicId: string;
  note: string; // Simple note/description
  file?: string; // Single Appwrite file ID for X-ray image
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Notes Section model for configurable note sections in patient notes
export interface NotesSection {
  id: string;
  sectionLabel: string; // Section name/label
  sectionKey: string; // Unique key for the section
  description?: string;
  isActive: boolean;
  displayOrder: number; // Display order
  clinicId: string;
  branchId: string; // Associated branch
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Patient Notes model for storing patient notes content
export interface PatientNotes {
  id: string;
  clinicId: string;
  branchId: string; // Associated branch
  patientId: string;
  sectionValues: Record<string, string>; // Section key to content mapping
  lastModifiedBy: string;
  lastModifiedAt: Date;
  createdAt: Date;
}

// Individual Patient Note Entry model for timestamped note entries
export interface PatientNoteEntry {
  id: string;
  clinicId: string;
  branchId: string; // Associated branch
  patientId: string;
  sectionKey: string;
  sectionLabel: string; // Store label for display purposes
  content: string;
  createdBy: string;
  createdAt: Date;
}

// Medicine Brand model for organizing medicines by brands
export interface MedicineBrand {
  id: string;
  name: string;
  description?: string;
  manufacturer?: string;
  isActive: boolean;
  clinicId: string;
  branchId: string; // Associated branch
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Medicine Category model for categorizing medicines
export interface MedicineCategory {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  clinicId: string;
  branchId: string; // Associated branch
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Medicine model for storing medicine information
export interface Medicine {
  id: string;
  name: string;
  genericName?: string;
  brandId?: string; // Reference to MedicineBrand
  categoryId?: string; // Reference to MedicineCategory
  type: string;
  strength?: string; // e.g., "500mg", "10ml"
  unit: "tablet" | "capsule" | "ml" | "bottle" | "vial" | "tube" | "piece";
  description?: string;
  manufacturer?: string;
  supplierId?: string; // Reference to Supplier
  batchNumber?: string;
  expiryDate?: Date;
  price?: number; // Price per unit in NPR (null for non-medicine-selling clinics)
  costPrice?: number; // Cost price for profit calculation
  barcode?: string;
  prescriptionRequired: boolean;
  isActive: boolean;
  isVatApplied: boolean;
  vatPercentage: number;
  clinicId: string;
  branchId: string; // Associated branch
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Medicine Stock model for inventory management
export interface MedicineStock {
  id: string;
  medicineId: string;
  currentStock: number;
  schemeStock: number; // Scheme stock quantity (doctor-received medicines)
  minimumStock: number;
  maximumStock?: number;
  reorderLevel: number;
  lastRestocked?: Date;
  location?: string; // Storage location in clinic
  clinicId: string;
  branchId: string; // Associated branch
  batchNumber?: string; // Batch number for this specific stock
  expiryDate?: Date; // Expiry date for this specific stock
  manufactureDate?: Date; // Manufacturing date for this batch
  costPrice?: number; // Cost price (purchase price) for this batch
  salePrice?: number; // Sale price (selling price) for this batch
  schemePrice?: number; // Scheme price (selling price for scheme stock) for this batch
  supplierId?: string; // Supplier of this batch
  invoiceNumber?: string; // Invoice number associated with this batch
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;
}

// Stock Transaction model for tracking stock movements
export interface StockTransaction {
  id: string;
  medicineId: string;
  type: "purchase" | "sale" | "adjustment" | "expired" | "damaged" | "returned";
  quantity: number;
  previousStock: number;
  newStock: number;
  unitPrice?: number; // Price at time of transaction (legacy)
  totalAmount?: number;
  batchNumber?: string;
  expiryDate?: Date;
  manufacturer?: string; // Manufacturer for this batch
  supplierId?: string;
  invoiceNumber?: string;
  reason?: string; // For adjustments, expired, damaged items
  referenceId?: string; // Reference to sale invoice, purchase order, etc.
  isSchemeStock?: boolean; // Flag indicating if this transaction is for scheme stock
  salePrice?: number; // Sale price for this specific refill/transaction
  costPrice?: number; // Cost price for this specific refill/transaction
  schemePrice?: number; // Scheme stock sale price (if isSchemeStock is true)
  clinicId: string;
  branchId: string; // Associated branch
  createdAt: Date;
  createdBy: string;
}

// Supplier model for medicine suppliers
export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  licenseNumber?: string;
  isActive: boolean;
  clinicId: string;
  branchId: string; // Associated branch
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Purchase Order model for medicine purchases
export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  supplierId: string;
  orderDate: Date;
  expectedDeliveryDate?: Date;
  status: "pending" | "ordered" | "received" | "cancelled";
  items: PurchaseOrderItem[];
  subtotal: number;
  tax?: number;
  discount?: number;
  totalAmount: number;
  notes?: string;
  clinicId: string;
  branchId: string; // Associated branch
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Purchase Order Item model
export interface PurchaseOrderItem {
  medicineId: string;
  medicineName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  batchNumber?: string;
  expiryDate?: Date;
}

// Enhanced Clinic model to include medicine selling capability
export interface ClinicSettings {
  id: string;
  clinicId: string;
  sellsMedicines: boolean; // Whether clinic sells medicines or just prescribes
  enableInventoryManagement: boolean;
  enableLowStockAlerts: boolean;
  lowStockThreshold?: number; // Threshold for low stock alerts
  enableExpiryAlerts?: boolean; // Whether to enable expiry alerts
  expiryAlertDays?: number; // Days before expiry to alert
  defaultMarkupPercentage?: number; // Default markup for medicine pricing
  taxRate?: number; // Tax rate for medicine sales
  allowNegativeStock: boolean;
  requireBatchTracking: boolean;
  requireExpiryTracking: boolean;
  autoGenerateBarcode: boolean;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;
}

// Visitor model for Front Office - Manage Visitors
export interface Visitor {
  id: string;
  clinicId: string;
  branchId: string; // Associated branch
  purpose: string;
  name: string;
  phone: string;
  date: Date;
  notes?: string;
  createdBy: string; // User ID who created the visitor record
  createdAt: Date;
  updatedAt: Date;
}

// Call Log model for Front Office - Manage Call Logs
export interface CallLog {
  id: string;
  clinicId: string;
  branchId: string; // Associated branch
  name: string;
  phone: string;
  receivedOn: Date;
  callType: "incoming" | "outgoing";
  notes?: string;
  createdBy: string; // User ID who created the call log record
  createdAt: Date;
  updatedAt: Date;
}

// ============= PHARMACY MANAGEMENT MODELS =============

// Item model for non-medicine inventory items
export interface Item {
  id: string;
  name: string;
  description?: string;
  purchasePrice?: number;
  salePrice: number;
  quantity: number; // Current quantity in stock
  category: string;
  unit?: string; // e.g., "piece", "box", "bottle"
  barcode?: string;
  purchaseDate?: Date;
  supplierName?: string;
  condition?: "new" | "used" | "damaged";
  itemType?: "asset" | "consumable"; // asset needs return, consumable is depleted
  isDisposed?: boolean;
  disposalDate?: Date;
  disposalReason?: string;
  isActive: boolean;
  clinicId: string;
  branchId: string; // Associated branch
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Item Purchase model for tracking refills and purchase bills of items
export interface ItemPurchase {
  id: string;
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  purchaseDate: Date;
  invoiceNumber?: string;
  notes?: string;
  clinicId: string;
  branchId: string;
  createdAt: Date;
  createdBy: string;
}

// Purchase Medicine Item model for individual items in a purchase
export interface MedicinePurchaseItem {
  id: string;
  medicineId: string;
  medicineName: string;
  expiryDate: string;
  salePrice: number;
  quantity: number;
  amount: number;
  batchNumber?: string; // Batch sold from
  type?: "medicine" | "item"; // Support both medicines and items
}

// Line item inside a medicine purchase return
export interface MedicinePurchaseReturnItem {
  id: string;
  /** Id of the original purchase line (MedicinePurchaseItem.id) */
  purchaseItemId: string;
  medicineId: string;
  medicineName: string;
  /** Quantity being returned in this return record */
  quantity: number;
  /** Amount attributed to this line in the return (after discount/tax allocation) */
  amount: number;
  reason?: string;
}

// Return record linked to an existing medicine purchase (patient sales return)
export interface MedicinePurchaseReturn {
  id: string;
  clinicId: string;
  branchId: string;
  purchaseId: string;
  /** Negative value representing the credit/refund to the patient */
  totalAmount: number;
  /** How the refund/credit was given (cash, card, adjustment, etc.) */
  refundMethod?: string;
  notes?: string;
  items: MedicinePurchaseReturnItem[];
  createdAt: Date;
  createdBy: string;
}

// Purchase Item model for unified purchase handling
export interface PurchaseItem {
  id: string;
  type: "medicine" | "item";
  productId: string;
  productName: string;
  expiryDate?: string;
  salePrice: number;
  quantity: number;
  amount: number;
}

// Item Purchase Item model for individual items in a purchase
export interface ItemPurchaseItem {
  id: string;
  itemId: string;
  itemName: string;
  salePrice: number;
  quantity: number;
  amount: number;
}

// Medicine Purchase model for recording medicine purchases
export interface MedicinePurchase {
  id: string;
  purchaseNo: string;
  items: MedicinePurchaseItem[];
  total: number;
  discount: number;
  taxPercentage: number;
  taxAmount: number;
  netAmount: number;
  /**
   * Key of the payment method used for this purchase. Should correspond to
   * `PaymentMethod.key` from the clinic's Pharmacy Settings. Storing the key
   * (instead of a narrow string union) makes the system extensible for any
   * custom payment methods that clinics might introduce.
   */
  paymentType: string;
  paymentStatus: "paid" | "pending" | "partial" | "unpaid";
  paymentNote?: string;
  patientName?: string;
  patientPhone?: string;
  patientAddress?: string;
  /**
   * Number of days the prescribed medicines are expected to last.
   * Used for dashboard reminders when the course is about to end.
   */
  medicationDurationDays?: number;
  purchaseDate: Date;
  clinicId: string;
  branchId: string; // Associated branch
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  /**
   * Optional list of sales return records created against this purchase.
   * This keeps the original invoice immutable while tracking adjustments.
   */
  returns?: MedicinePurchaseReturn[];
  /**
   * Cached total of all returns (absolute positive amount). Useful for fast UI
   * calculations without scanning the returns array on every render.
   */
  totalReturnedAmount?: number;
  paymentHistory?: PaymentEvent[]; // Array of all payments made
}

// Supplier Purchase Record model for tracking purchases from suppliers
export interface SupplierPurchaseRecord {
  id: string;
  supplierId: string;
  supplierName: string;
  purchaseDate: Date;
  billNumber: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: "paid" | "pending" | "partial" | "overdue";
  paymentDone: boolean;
  paymentMethod?: string;
  notes?: string;
  items?: any[]; // List of medicines in this purchase
  clinicId: string;
  branchId: string; // Associated branch
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  supplierName: string;
  clinicId: string;
  branchId: string;
  amount: number;
  type: "payment" | "refund";
  date: Date;
  referenceNumber?: string;
  notes?: string;
  recordedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Supplier Ledger Entry model for transaction-based ledger
export interface SupplierLedgerEntry {
  id: string;
  supplierId: string;
  supplierName: string;
  billNumber?: string; // Optional, for purchases only
  transactionDate: Date;
  debitAmount: number; // For purchases
  creditAmount: number; // For payments
  balanceAmount: number; // Running total balance
  type: "purchase" | "payment";
  notes?: string;
  referenceNumber?: string;
  clinicId: string;
  branchId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Enquiry model for tracking marketing leads
export type EnquiryStatus =
  | "new"
  | "contacted"
  | "scheduled"
  | "converted"
  | "lost"
  | "closed";

// ============= ACCOUNTS & FINANCIAL MODELS =============

/**
 * AccountBill model for tracking all purchase bills (Accounts Payable)
 * This includes medicine purchases, hospital equipment, utilities, rent, etc.
 */
export interface AccountBill {
  id: string;
  category:
    | "medicine"
    | "equipment"
    | "utility"
    | "salary"
    | "rent"
    | "office_supply"
    | "other";
  itemName?: string; // Generic name for equipment, inventory, or assets
  vendorName: string;
  vendorId?: string; // Optional link to a Vendor or Supplier record
  billNumber: string;
  billDate: Date;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentStatus: "paid" | "partial" | "pending";
  paymentMethod?: string;
  description?: string;
  attachmentUrl?: string; // URL for the scanned bill/receipt file
  clinicId: string;
  branchId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Vendor model for tracking non-medicine suppliers, utility companies, etc.
 */
export interface Vendor {
  id: string;
  name: string;
  category: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  isActive: boolean;
  clinicId: string;
  branchId: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// ============= HR & STAFF MODELS =============

/**
 * StaffMember model for tracking clinic employees
 */
export interface StaffMember {
  id: string;
  name: string;
  role: string;
  age: number;
  email: string;
  phone: string;
  photoUrl?: string;
  joiningDate: Date;
  salary: number;
  status: "active" | "resigned" | "on_leave" | "on_break" | "in_surgery";
  address?: string;
  performanceNotes?: string;
  taskCompletionScore?: number;
  shiftStartTime?: string; // Format: "HH:mm"
  shiftEndTime?: string; // Format: "HH:mm"
  allowedLeavesPerMonth?: number; // Number of paid leaves allowed per month
  totalCommissionBalance?: number; // Current pending balance to be paid
  totalCommissionEarned?: number; // Lifetime total commission earned
  defaultCommission: number; // Default commission percentage
  clinicId: string;
  branchId: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

/**
 * StaffCommission model for tracking commissions earned by staff
 */
export interface StaffCommission {
  id: string;
  staffId: string;
  staffName: string;
  clinicId: string;
  branchId: string;
  billingId: string;
  billingType: "appointment" | "pathology" | "pharmacy";
  invoiceNumber: string;
  appointmentDate: Date;
  patientId: string;
  patientName: string;
  serviceNames: string[];
  totalInvoiceAmount: number;
  commissionPercentage: number;
  commissionAmount: number;
  status: "pending" | "paid" | "cancelled";
  paidAmount?: number;
  paymentMethod?: string;
  paymentReference?: string;
  paymentNotes?: string;
  paidDate?: Date;
  paidBy?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

/**
 * StaffAttendance model for tracking daily clock-in/out
 */
export interface StaffAttendance {
  id: string;
  staffId: string;
  staffName: string;
  date: Date;
  checkIn: Date | null;
  checkOut: Date | null;
  status: "present" | "absent" | "late" | "half_day" | "on_break";
  totalHours?: number; // Calculated hours for the session
  lateByMinutes?: number; // Minutes late relative to expected start time
  notes?: string;
  leaveType?: "paid" | "unpaid"; // Only relevant when status === "absent"
  clinicId: string;
  branchId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClinicHoliday {
  id?: string;
  clinicId: string;
  date: Date;
  name: string;
  type?: "paid" | "unpaid";
}

/**
 * LeaveRequest model for formal staff leave management workflow
 */
export interface LeaveRequest {
  id: string;
  staffId: string;
  staffName: string;
  staffRole: string;
  clinicId: string;
  branchId: string;

  // Leave details
  leaveType: "annual" | "sick" | "casual" | "unpaid" | "maternity" | "emergency";
  startDate: Date;
  endDate: Date;
  totalDays: number;
  reason: string;
  attachmentUrl?: string; // Medical certificate, etc.

  // Workflow
  status: "pending" | "approved" | "rejected" | "cancelled";
  reviewedBy?: string; // userId who approved/rejected
  reviewerName?: string;
  reviewedAt?: Date;
  reviewNotes?: string; // Manager's note on decision

  // Payroll impact
  isPaid: boolean; // Computed from leaveType

  createdAt: Date;
  updatedAt: Date;
}

/**
 * LeaveBalance model for tracking annual leave quotas per staff
 */
export interface LeaveBalance {
  id: string;
  staffId: string;
  staffName: string;
  clinicId: string;
  year: number; // Calendar year e.g. 2025
  annualAllotted: number;
  sickAllotted: number;
  casualAllotted: number;
  annualUsed: number;
  sickUsed: number;
  casualUsed: number;
  unpaidUsed: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Enquiry {
  id: string;
  clinicId: string;
  branchId: string;
  fullName: string;
  phone: string;
  reasonForVisit?: string;
  appointmentDate?: Date;
  source?: string;
  note?: string;
  lastContactedAt?: Date;
  nextContactAt?: Date;
  action?: "call" | "offer" | "council";
  status: EnquiryStatus;
  createdBy: string;
  assignedTo?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Medicine Usage model for tracking medicine consumption
export interface MedicineUsage {
  id: string;
  medicineId: string;
  medicineName: string;
  quantityUsed: number;
  usageDate: Date;
  reason?: string; // Reason for usage (patient treatment, expired, damaged, etc.)
  patientId?: string; // If used for a specific patient
  appointmentId?: string; // If used during an appointment
  notes?: string;
  clinicId: string;
  branchId: string; // Associated branch
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// Pharmacy Settings model for clinic-specific pharmacy configuration
export interface PharmacySettings {
  id: string;
  clinicId: string;
  branchId: string; // Associated branch
  // Tax Configuration
  defaultTaxPercentage: number; // Default tax percentage for purchases
  enableTax: boolean; // Whether tax is enabled
  taxLabel?: string; // Custom label for tax (e.g., "VAT", "GST", "Tax")

  // Payment Methods Configuration
  enabledPaymentMethods: PaymentMethod[];
  defaultPaymentMethod: string; // Changed from union type to string to support custom payment methods

  // Other Settings
  enableDiscount: boolean; // Whether discount is enabled on purchases
  defaultDiscountPercentage?: number; // Default discount percentage

  // Invoice Settings
  invoicePrefix?: string; // Prefix for purchase numbers (e.g., "PUR")
  nextInvoiceNumber: number; // Next invoice number sequence

  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;
}

// Payment Method model for configuring available payment methods
export interface PaymentMethod {
  /** Primary id (generated with `crypto.randomUUID()` on the client). */
  id: string;
  /** Display label, e.g. "Cash", "Credit Card", "eSewa" */
  name: string;
  /**
   * Stable programmatic identifier (lower-cased, snake_cased).
   * This value is stored in purchase records via `MedicinePurchase.paymentType`.
   */
  key: string;
  /** Whether the clinic has enabled this payment method. */
  isEnabled: boolean;
  /** If selected, users must enter a reference / txn id when recording payment. */
  requiresReference: boolean;
  /** Optional emoji / short text icon for nicer UX in the UI list. */
  icon?: string;
  /** Optional longer description shown in the settings page. */
  description?: string;
  /** `true` if the method was created by the clinic (as opposed to default ones). */
  isCustom: boolean;
  /** Audit fields */
  createdAt?: Date;
  updatedAt?: Date;
  updatedBy?: string;
}

// ============= PRESCRIPTION MANAGEMENT MODELS =============

// Prescription model for storing prescription information
// ============= PATIENT FOLLOW-UP MANAGEMENT =============
// Tracks multi-step follow-up schedules per patient visit, mirroring
// the clinic's internal "Patient Follow up" sheet.

export type FollowupStatus = "pending" | "completed" | "no-answer" | "wrong-no" | "cancelled";
export type FollowupInitStatus = "good" | "complain" | "neutral";
export type FollowupUpdatedStatus = "good" | "solved" | "wrong-no" | "no-answer" | "neutral";

export interface PatientFollowup {
  id: string;
  clinicId: string;
  branchId: string;

  // Patient info (denormalized for performance)
  patientId: string;
  patientName: string;
  patientMobile: string;

  // Visit context
  appointmentId?: string; // Optional link to the originating appointment
  visitDate?: Date; // The date of the original visit
  session?: string; // e.g. "1st", "2nd", "3rd"

  // Status tracking (matches Excel init/updated status columns)
  initStatus: FollowupInitStatus;
  updatedStatus?: FollowupUpdatedStatus;

  // Store statuses per session
  sessionStatuses?: {
    [session: string]: {
      initStatus?: FollowupInitStatus;
      updatedStatus?: FollowupUpdatedStatus;
    }
  };

  // Follow-up date chain (up to 5 sequential follow-ups per Excel)
  followupDates: {
    first?: Date;
    second?: Date;
    third?: Date;
    fourth?: Date;
    fifth?: Date;
  };

  // Clinical notes
  service?: string; // Service received (e.g. "HYDRAFACIAL ST", "PRP FACE")
  product?: string; // Product used/sold (e.g. "TPS NIACINAMIDE 5% serum")
  notes?: string; // General free-text notes

  // Computed status for the module view
  overallStatus: FollowupStatus;

  // Action Log / History timeline
  logs?: {
    date: Date;
    note: string;
    user?: string;
  }[];

  // Audit fields
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// ============= END PATIENT FOLLOW-UP MANAGEMENT =============

export interface Prescription {
  id: string;
  prescriptionNo: string; // Generated prescription number
  patientId: string;
  clinicId: string;
  branchId: string; // Associated branch
  doctorId: string;
  appointmentId?: string; // Optional link to appointment
  prescriptionDate: Date;
  status: "active" | "completed" | "cancelled";
  notes?: string;
  // Appointment context (for easy reference when linked)
  appointmentDate?: Date;
  appointmentType?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  sendToPharmacy?: boolean;
}

// Prescription Item model for individual medicines in a prescription
export interface PrescriptionItem {
  id: string;
  prescriptionId: string;
  medicineId: string;
  medicineName: string; // Denormalized for easy display
  dosage: string; // e.g., "500mg", "1 tablet"
  frequency: string; // e.g., "twice daily", "once daily"
  duration: string; // e.g., "7 days", "2 weeks"
  time: string; // e.g., "morning", "evening", "after meals"
  instructions?: string; // Additional instructions
  quantity?: number; // Total quantity prescribed
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  sendToPharmacy?: boolean;
}

// Prescription Template model for saving commonly used prescriptions
export interface PrescriptionTemplate {
  id: string;
  name: string;
  description?: string;
  doctorId: string; // Doctor who created the template
  clinicId: string;
  branchId: string;
  items: PrescriptionTemplateItem[];
  isActive: boolean;
  usageCount: number; // Track how often this template is used
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Prescription Template Item model
export interface PrescriptionTemplateItem {
  medicineId: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  time: string;
  instructions?: string;
  quantity?: number;
}

// Prescription History model for tracking prescription changes
export interface PrescriptionHistory {
  id: string;
  prescriptionId: string;
  changeType: "created" | "updated" | "cancelled" | "completed";
  changeDescription: string;
  previousData?: any; // Store previous state for audit
  newData?: any; // Store new state for audit
  changedBy: string;
  changedAt: Date;
}

// ============= END PRESCRIPTION MANAGEMENT MODELS =============

// ============= SMS REMINDER MANAGEMENT MODELS =============

// Appointment Reminder model for tracking scheduled SMS reminders
export interface AppointmentReminder {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  assignedExpertId?: string;
  clinicId: string;
  branchId: string;
  appointmentDate: Date;
  reminderDate: Date;
  reminderHours: number; // Hours before appointment when reminder was/will be sent
  originalReminderHours: number; // Original hours from settings (before smart scheduling)
  smartSchedulingApplied: boolean; // Whether smart scheduling logic was applied
  hoursUntilAppointment: number; // How many hours until appointment when reminder was scheduled
  status: "scheduled" | "sent" | "failed" | "cancelled";
  sentAt?: Date; // When the reminder was actually sent
  errorMessage?: string; // Error message if sending failed
  createdAt: Date;
  updatedAt?: Date;
  createdBy?: string; // User ID who created the reminder (or 'system' for automated)
}

// ============= END SMS REMINDER MANAGEMENT MODELS =============

// Print Layout Configuration model
export interface PrintLayoutConfig {
  id?: string;
  clinicId: string;
  phone?: string; // Optional override, default is clinic profile value
  email?: string; // Optional override, default is clinic profile value
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;
}

// Item Category model for inventory categorization
export interface ItemCategory {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  clinicId: string;
  branchId: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Issued Item model for tracking item issuance
export interface IssuedItem {
  id: string;
  itemId: string;
  itemName: string;
  itemCategory: string;
  quantity: number;
  issuedDate: Date;
  returnDate?: Date;
  returnCondition?: "new" | "used" | "damaged";
  returnNotes?: string;
  expectedReturnDate?: Date;
  returnedQuantity?: number;
  status: "issued" | "returned" | "overdue" | "consumed";
  issuedTo?: string; // Person or department
  issuedBy: string; // User ID who issued the item
  returnedBy?: string; // User ID who processed the return
  notes?: string;
  clinicId: string;
  branchId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Appointment Billing models

// Appointment Billing Settings for clinic-specific configuration
export interface AppointmentBillingSettings {
  id: string;
  clinicId: string;
  branchId: string; // Associated branch
  // Feature Configuration
  enabledByAdmin: boolean; // Platform super admin controls this
  isActive: boolean; // Clinic can enable/disable locally

  // Invoice Settings
  invoicePrefix: string; // Prefix for invoice numbers (e.g., "INV")
  nextInvoiceNumber: number; // Next invoice number sequence (shared across branches)

  // Default Settings
  defaultDiscountType: "flat" | "percent";
  defaultDiscountValue: number;
  defaultCommission: number; // Default commission percentage

  // Tax Configuration
  enableTax: boolean;
  defaultTaxPercentage: number;
  taxLabel?: string; // Custom label for tax (e.g., "VAT", "Service Tax")

  // Payment Methods Configuration
  paymentMethods: PaymentMethod[]; // Available payment methods for this clinic
  defaultPaymentMethod: string; // Default payment method key

  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;
}

// Individual line item in an appointment invoice
export interface AppointmentBillingItem {
  id: string;
  appointmentTypeId: string;
  appointmentTypeName: string; // Denormalized for easy display
  price: number; // Price per appointment (auto-fetched from appointment type)
  quantity: number; // Number of appointments (default 1)
  commission: number; // Commission percentage for this item
  doctorId?: string; // Specific doctor for this item (multi-doctor support)
  doctorName?: string; // Denormalized for display
  categoryId?: string; // Treatment category for this item
  discountType?: "flat" | "percent";
  discountValue?: number;
  discountAmount?: number;
  amount: number; // (price * quantity) - discountAmount
}

// Main appointment billing/invoice record
export interface AppointmentBilling {
  id: string;
  invoiceNumber: string; // Generated invoice number (prefix + sequence)
  clinicId: string;
  branchId: string; // Associated branch

  // Patient and Doctor Information
  patientId: string;
  patientName: string; // Denormalized for easy display
  doctorId: string;
  doctorName: string; // Denormalized for easy display
  doctorType: "regular" | "visitor"; // Default: regular
  referralPartnerId?: string; // Optional link to referral partner
  referralCommissionAmount?: number; // Calculated commission for the referrer
  referrals?: Array<{
    type: "referral-partner" | "doctor" | "expert" | "staff";
    id: string;
    name: string;
    commissionPercentage: number;
    commissionAmount: number;
    referredById?: string; // Optional specific doctor/expert associated with this partner
    referredByName?: string; // Name of specific doctor/expert
  }>;

  // Invoice Details
  invoiceDate: Date; // Default: today's date
  items: AppointmentBillingItem[]; // One or more appointment billing items

  // Totals and Calculations
  subtotal: number; // Sum of all item amounts (before any discounts)
  itemDiscountAmount: number; // Total amount from individual item discounts
  mainDiscountAmount: number; // Amount from the final invoice-level discount
  discountType: "flat" | "percent";
  discountValue: number; // Discount amount or percentage
  discountAmount: number; // Total calculated discount amount (item + main)
  taxPercentage: number; // Tax percentage applied
  taxAmount: number; // Calculated tax amount in NPR
  totalAmount: number; // Final amount after discount and tax

  // Status and Audit
  status: "draft" | "finalized" | "paid" | "cancelled";
  paymentStatus: "unpaid" | "partial" | "paid";
  paidAmount: number; // Amount paid so far
  balanceAmount: number; // Remaining balance

  // Payment Information
  paymentMethod?: string; // Payment method if paid
  paymentReference?: string; // Payment reference/transaction ID
  paymentDate?: Date; // Date of payment
  paymentNotes?: string; // Payment related notes
  paymentHistory?: PaymentEvent[]; // Array of all payments made

  // Metadata
  notes?: string; // General notes about the invoice
  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // User ID who created the invoice
  finalizedBy?: string; // User ID who finalized the invoice
  finalizedAt?: Date; // When the invoice was finalized
}

// Bed Category model for categorizing beds
export interface BedCategory {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  clinicId: string;
  branchId: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Bed model for storing bed information
export interface Bed {
  id: string;
  bedNumber: string; // Unique bed identifier
  roomNumber?: string; // Optional room number
  categoryId: string; // Reference to BedCategory
  categoryName: string; // Denormalized for display
  status: "available" | "occupied" | "maintenance";
  clinicId: string;
  branchId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Bed Allotment model for tracking bed assignments to patients
export interface BedAllotment {
  id: string;
  bedId: string; // Reference to Bed
  bedNumber: string; // Denormalized for display
  patientId: string; // Reference to Patient
  patientName: string; // Denormalized for display
  doctorId?: string; // Optional reference to Doctor
  doctorName?: string; // Denormalized for display
  allotmentDate: Date; // When bed was allotted
  dischargeDate?: Date; // When patient was discharged
  status: "active" | "discharged" | "cancelled";
  clinicId: string;
  branchId: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface DoctorCommission {
  id: string;
  doctorId: string;
  doctorName: string;
  clinicId: string;
  branchId: string;
  billingId: string; // Reference to the appointment billing
  invoiceNumber: string;
  appointmentDate: Date;
  patientId: string;
  patientName: string;
  serviceNames: string[]; // Array of service names (tests or appointment types)
  billingType: "appointment" | "pathology"; // Type of billing
  totalInvoiceAmount: number; // Total invoice amount
  commissionPercentage: number; // Commission percentage at the time
  commissionAmount: number; // Calculated commission
  status: "pending" | "paid" | "cancelled";
  paidDate?: Date;
  paidAmount?: number;
  paymentMethod?: string;
  paymentReference?: string;
  paymentNotes?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  paidBy?: string;
}

// Expert Commission model for tracking commissions earned by experts
export interface ExpertCommission {
  id: string;
  expertId: string;
  expertName: string;
  clinicId: string;
  branchId: string;
  billingId: string;
  billingType: "appointment" | "pathology" | "other"; // Type of billing this commission is from
  invoiceNumber: string;
  date: Date;
  patientId: string;
  patientName: string;
  serviceNames: string[];
  totalInvoiceAmount: number;
  commissionPercentage: number;
  commissionAmount: number;
  paidAmount?: number;
  paymentMethod?: string;
  paidDate?: Date;
  status: "pending" | "paid" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  paidBy?: string;
}

// Audit Log for tracking role and user creation events
export interface AuditLog {
  id: string;
  eventType:
    | "role_created"
    | "role_updated"
    | "role_deleted"
    | "user_created"
    | "user_updated"
    | "user_deactivated"
    | "user_activated"
    | "roles_assigned"
    | "roles_removed"
    | "validation_failed"
    | "operation_failed";
  performedBy: string; // User ID who performed the action
  performedByEmail?: string; // User email for display
  performedByName?: string; // User name for display
  clinicId: string;
  branchId?: string;
  targetUserId?: string; // For user-related events
  targetRoleId?: string; // For role-related events
  details: {
    // Event-specific details (role data, user data, changes, errors, etc.)
    [key: string]: any;
  };
  status: "success" | "failure" | "partial";
  errorMessage?: string;
  timestamp: Date;
  createdAt: Date;
}

// Pathology Management Models

// Pathology Category model for categorizing pathology tests
export interface PathologyCategory {
  id: string;
  name: string;
  clinicId: string;
  branchId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Pathology Test Price model for configuring prices for Categories or Parameters
export interface PathologyTestType {
  id: string;
  name?: string; // Optional denormalized name
  targetId?: string; // Reference ID for category or parameter
  targetType?: "category" | "parameter";
  price: number; // Price in NPR (Nepali Rupees)
  clinicId: string;
  branchId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Pathology Unit model for measurement units
export interface PathologyUnit {
  id: string;
  name: string;
  clinicId: string;
  branchId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Pathology Parameter model for test parameters (Sub-categories)
export interface PathologyParameter {
  id: string;
  categoryId?: string; // Reference to PathologyCategory (Optional for legacy compatibility)
  name: string;
  referenceRange: string; // Display string (e.g., "135 - 145")
  referenceRangeMale?: string;
  referenceRangeFemale?: string;
  unit: string; // Unit ID reference or string

  // Dynamic Configuration
  resultType: "numeric" | "boolean" | "select" | "text" | "richText";
  options?: string[]; // Predefined options for 'select' type (e.g., ["Nil", "Trace", "1+"])
  minValue?: number; // Numeric lower bound for validation
  maxValue?: number; // Numeric upper bound for validation
  minValueMale?: number;
  maxValueMale?: number;
  minValueFemale?: number;
  maxValueFemale?: number;
  criticalLow?: number; // Panic value lower bound
  criticalHigh?: number; // Panic value upper bound
  defaultValue?: string; // Default result value

  clinicId: string;
  branchId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Pathology Test Parameter (nested within a test)
export interface PathologyTestParameter {
  parameterId: string; // Reference to PathologyParameter
  parameterName: string; // Denormalized for display
  categoryId?: string; // Reference to PathologyCategory (for UI filtering)
  patientResult: string;
  referenceRange: string;
  unit: string;
  resultType?: "numeric" | "boolean" | "select" | "text" | "richText";
  options?: string[];
  minValue?: number;
  maxValue?: number;
  criticalLow?: number;
  criticalHigh?: number;
}

// Pathology Test model
export interface PathologyTest {
  id: string;
  patientId?: string; // Optional - for backward compatibility with existing tests
  patientName: string; // Required - can be any name (including outsiders)
  patientEmail?: string; // Denormalized for display
  patientAge?: string | number; // Patient age
  patientGender?: "male" | "female" | "other"; // Patient gender
  patientType?: string; // OPD, IPD, Emergency, etc.
  sampleNumber?: string; // Lab sample ID
  testName: string;
  shortName?: string;
  testType?: string;
  categoryId: string; // Reference to PathologyCategory
  categoryName: string; // Denormalized for display
  unit?: string;
  subCategory?: string;
  method?: string;
  reportDays?: number;
  chargeCategory?: string;
  standardCharge?: number; // In NPR (Nepali Rupees)
  parameters: PathologyTestParameter[]; // Array of test parameters
  labTechnicianId?: string; // Optional reference to LabTechnician
  labTechnicianName?: string; // Denormalized for display
  clinicId: string;
  branchId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Lab Technician model for managing lab technicians
export interface LabTechnician {
  id: string;
  name: string;
  employeeId?: string; // Optional employee ID
  phone?: string;
  email?: string;
  address?: string;
  specialization?: string; // Area of specialization
  qualifications?: string; // Educational qualifications, certifications
  isActive: boolean; // Availability status
  clinicId: string;
  branchId: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Pathology Billing models

// Pathology Billing Settings for clinic-specific configuration
export interface PathologyBillingSettings {
  id: string;
  clinicId: string;
  branchId: string; // Associated branch
  // Feature Configuration
  enabledByAdmin: boolean; // Platform super admin controls this
  isActive: boolean; // Clinic can enable/disable locally

  // Invoice Settings
  invoicePrefix: string; // Prefix for invoice numbers (e.g., "PATH-INV")
  nextInvoiceNumber: number; // Next invoice number sequence (shared across branches)

  // Default Settings
  defaultDiscountType: "flat" | "percent";
  defaultDiscountValue: number;

  // Tax Configuration
  enableTax: boolean;
  defaultTaxPercentage: number;
  taxLabel?: string; // Custom label for tax (e.g., "VAT", "Service Tax")

  // Payment Methods Configuration
  paymentMethods: PaymentMethod[]; // Available payment methods for this clinic
  defaultPaymentMethod: string; // Default payment method key

  createdAt: Date;
  updatedAt: Date;
  updatedBy: string;
}

// Individual line item in a pathology invoice
export interface PathologyBillingItem {
  id: string;
  testId: string; // Reference to PathologyTest
  testName: string; // Denormalized for easy display
  testType?: string; // Test type name (optional)
  price: number; // Price per test (from test's standardCharge or test type)
  quantity: number; // Number of tests (default 1)
  discountType?: "flat" | "percent"; // Per-item discount type
  discountValue?: number; // Per-item discount value
  discountAmount?: number; // Calculated per-item discount amount
  amount: number; // (price * quantity) - discountAmount
  sampleType?: string; // e.g., "Blood", "Urine"
  isUrgent?: boolean; // Fast-track status
}

// Payment Event model for tracking multiple payment installments
export interface PaymentEvent {
  id: string;
  amount: number;
  method: string; // Key of the payment method
  reference?: string; // Transaction ID / Reference
  date: Date;
  recordedBy: string; // User ID
  notes?: string;
}

// Main pathology billing/invoice record
export interface PathologyBilling {
  id: string;
  invoiceNumber: string; // Generated invoice number (prefix + sequence)
  clinicId: string;
  branchId: string; // Associated branch

  // Patient Information (can be external/outsider)
  patientId?: string; // Reference to existing patient if available
  patientName: string; // Required - can be any name
  patientEmail?: string;
  patientPhone?: string;
  patientAddress?: string;
  patientAge?: string | number;
  patientGender?: string;

  // Invoice Details
  invoiceDate: Date; // Default: today's date
  items: PathologyBillingItem[]; // One or more pathology billing items

  // Totals and Calculations
  subtotal: number; // Sum of all item amounts
  discountType: "flat" | "percent";
  discountValue: number; // Discount amount or percentage
  discountAmount: number; // Calculated discount amount
  taxPercentage: number; // Tax percentage applied
  taxAmount: number; // Calculated tax amount
  totalAmount: number; // Final amount after discount and tax

  // Status and Audit
  status: "draft" | "finalized" | "paid" | "cancelled";
  paymentStatus: "unpaid" | "partial" | "paid";
  paidAmount: number; // Amount paid so far
  balanceAmount: number; // Remaining balance

  // Payment Information
  paymentMethod?: string; // Payment method if paid
  paymentReference?: string; // Payment reference/transaction ID
  paymentDate?: Date; // Date of payment
  paymentNotes?: string; // Payment related notes

  referringDoctors?: ReferringDoctor[]; // Multiple referring doctors with commissions

  // Metadata
  notes?: string; // General notes about the invoice

  // Robust Pathology Workflow Fields
  labReferenceNo?: string; // Internal Lab tracking ID
  sampleCollectionDate?: Date;
  expectedReportDate?: Date;
  reportStatus:
    | "pending_collection"
    | "collected"
    | "in_lab"
    | "partially_ready"
    | "ready"
    | "delivered";
  paymentHistory?: PaymentEvent[]; // List of all payments made

  createdAt: Date;
  updatedAt: Date;
  createdBy: string; // User ID who created the invoice
  finalizedBy?: string; // User ID who finalized the invoice
  finalizedAt?: Date; // When the invoice was finalized
}

// Interface for multiple referring doctors in pathology
export interface ReferringDoctor {
  doctorId: string;
  doctorName: string;
  commissionType: "percent" | "flat";
  commissionValue: number;
  calculatedAmount: number;
  type?: "doctor" | "partner";
}

// Referral Commission model for tracking commissions earned by referral partners
export interface ReferralCommission {
  id?: string;
  partnerId: string;
  partnerName: string;
  clinicId: string;
  branchId: string;
  billingId: string;
  invoiceNumber: string;
  invoiceDate: Date;
  patientId: string;
  patientName: string;
  serviceNames?: string[];
  totalInvoiceAmount: number;
  commissionPercentage: number;
  commissionAmount: number;
  status: "pending" | "paid" | "cancelled";
  paidAmount: number;
  paymentMethod?: string;
  paymentReference?: string;
  paidDate?: Date;
  paidBy?: string;
  paymentNotes?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}
