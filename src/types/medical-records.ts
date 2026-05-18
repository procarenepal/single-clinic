// Medical Records Types
export interface MedicalRecord {
  id: string;
  type:
    | "diagnosis"
    | "prescription"
    | "lab-result"
    | "imaging"
    | "vital-signs"
    | "note";
  title: string;
  description: string;
  date: Date;
  doctorName: string;
  files?: string[];
  details?: any;
  patientId: string;
  clinicId: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Prescription {
  id: string;
  prescriptionNo: string; // Generated prescription number
  patientId: string;
  clinicId: string;
  branchId: string; // Branch where prescription was created
  appointmentId?: string; // Optional link to appointment
  doctorId: string; // Doctor who prescribed
  prescriptionDate: Date;
  status: "active" | "completed" | "cancelled";
  diagnosis?: string;
  notes?: string;
  history?: string;      // Patient clinical history / Chief complaints
  examination?: string;  // Physical & clinical examination findings
  investigation?: string;// Medical investigations ordered or suggested
  treatmentPlan?: string;// Structured treatment plan notes / non-drug instructions
  // Appointment context (for easy reference when linked)
  appointmentDate?: Date;
  appointmentType?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  sendToPharmacy?: boolean;
}

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

export interface MedicalDocument {
  id: string;
  patientId: string;
  clinicId: string;
  documentType: "lab-result" | "diagnosis" | "note" | "report";
  title: string;
  description: string;
  content?: string;
  attachments?: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface XrayRecord {
  id: string;
  patientId: string;
  clinicId: string;
  title: string;
  description: string;
  bodyPart: string;
  findings: string;
  impression: string;
  imageUrls: string[];
  radiologistId: string;
  radiologistName: string;
  examinationDate: Date;
  createdAt: Date;
  updatedAt: Date;
}
