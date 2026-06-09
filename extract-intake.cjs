const fs = require('fs');
const path = 'c:/Users/Karan Bohara/Downloads/procaresoft-main/src/pages/dashboard/front-office/front-office-desk.tsx';
let code = fs.readFileSync(path, 'utf8');

const startStr = 'const renderQuickIntakeModal = () => {';
const startIdx = code.indexOf(startStr);
if (startIdx === -1) { console.error('Start not found'); process.exit(1); }

let braceCount = 0;
let endIdx = -1;
let foundFirstBrace = false;

for (let i = startIdx; i < code.length; i++) {
  if (code[i] === '{') {
    braceCount++;
    foundFirstBrace = true;
  } else if (code[i] === '}') {
    braceCount--;
  }
  
  if (foundFirstBrace && braceCount === 0) {
    endIdx = i + 1;
    break;
  }
}

if (endIdx === -1) { console.error('End not found'); process.exit(1); }

const modalCode = code.substring(startIdx, endIdx);

const replacement = `  const renderQuickIntakeModal = () => {
    return (
      <QuickIntakeModal
        isOpen={isQuickIntakeOpen}
        onClose={() => setIsQuickIntakeOpen(false)}
        quickIntakeSaving={quickIntakeSaving}
        onSubmit={handleQuickIntakeSubmit}
        intakeMode={intakeMode}
        setIntakeMode={setIntakeMode}
        selectedExistingPatient={selectedExistingPatient}
        setSelectedExistingPatient={setSelectedExistingPatient}
        patientSearchQuery={patientSearchQuery}
        setPatientSearchQuery={setPatientSearchQuery}
        quickIntakeForm={quickIntakeForm}
        setQuickIntakeForm={setQuickIntakeForm}
        mobileStatus={mobileStatus}
        appointmentTypes={appointmentTypes}
        packages={packages}
        isSearchDropdownOpen={isSearchDropdownOpen}
        setIsSearchDropdownOpen={setIsSearchDropdownOpen}
        patients={patients}
        doctors={doctors}
        experts={experts}
        staff={staff}
        referralPartners={referralPartners}
        activePatientPackages={activePatientPackages}
        addReferrerRow={addReferrerRow}
        updateReferrerRow={updateReferrerRow}
        removeReferrerRow={removeReferrerRow}
      />
    );
  };`;

code = code.substring(0, startIdx) + replacement + code.substring(endIdx);

// Insert import at line 61
const importLine = `import { QuickIntakeModal } from './QuickIntakeModal';\n`;
const importTarget = `import { ProcedureModal } from "./ProcedureModal";`;
code = code.replace(importTarget, importTarget + '\n' + importLine);

fs.writeFileSync(path, code);

// Create QuickIntakeModal.tsx
const newModalCode = `import React from 'react';
import { createPortal } from 'react-dom';
import { IoCloseOutline, IoSearchOutline, IoTrashOutline, IoAddOutline } from 'react-icons/io5';
import { Spinner } from '@/components/ui';

export interface QuickIntakeModalProps {
  isOpen: boolean;
  onClose: () => void;
  quickIntakeSaving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  intakeMode: 'new' | 'existing';
  setIntakeMode: (mode: 'new' | 'existing') => void;
  selectedExistingPatient: any;
  setSelectedExistingPatient: (patient: any) => void;
  patientSearchQuery: string;
  setPatientSearchQuery: (query: string) => void;
  quickIntakeForm: any;
  setQuickIntakeForm: React.Dispatch<React.SetStateAction<any>>;
  mobileStatus: 'idle' | 'checking' | 'duplicate' | 'clear';
  appointmentTypes: any[];
  packages: any[];
  isSearchDropdownOpen: boolean;
  setIsSearchDropdownOpen: (isOpen: boolean) => void;
  patients: any[];
  doctors: any[];
  experts: any[];
  staff: any[];
  referralPartners: any[];
  activePatientPackages: any[];
  addReferrerRow: () => void;
  updateReferrerRow: (index: number, key: string, value: any) => void;
  removeReferrerRow: (index: number) => void;
}

export const QuickIntakeModal: React.FC<QuickIntakeModalProps> = ({
  isOpen,
  onClose,
  quickIntakeSaving,
  onSubmit,
  intakeMode,
  setIntakeMode,
  selectedExistingPatient,
  setSelectedExistingPatient,
  patientSearchQuery,
  setPatientSearchQuery,
  quickIntakeForm,
  setQuickIntakeForm,
  mobileStatus,
  appointmentTypes,
  packages,
  isSearchDropdownOpen,
  setIsSearchDropdownOpen,
  patients,
  doctors,
  experts,
  staff,
  referralPartners,
  activePatientPackages,
  addReferrerRow,
  updateReferrerRow,
  removeReferrerRow,
}) => {
  if (!isOpen) return null;
  const setIsQuickIntakeOpen = (open: boolean) => { if (!open) onClose(); };
  const handleQuickIntakeSubmit = onSubmit;
  \n` + modalCode.substring(modalCode.indexOf('{') + 1, modalCode.lastIndexOf('}')).trim() + `\n};\n`;

fs.writeFileSync('c:/Users/Karan Bohara/Downloads/procaresoft-main/src/pages/dashboard/front-office/QuickIntakeModal.tsx', newModalCode);

console.log('Successfully extracted QuickIntakeModal.');
