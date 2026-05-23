import { useState, useEffect } from "react";
import { IoAddOutline } from "react-icons/io5";
import { TreatmentPackage } from "@/types/models";
import { packageService } from "@/services/packageService";
import { useAuthContext } from "@/context/AuthContext";
import { 
  Button, 
  Input, 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalFooter
} from "@/components/ui";
import { addToast } from "@/components/ui/toast";

export default function PackagesSettingsPage() {
  const { clinicId, branchId } = useAuthContext();
  const [packages, setPackages] = useState<TreatmentPackage[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set());
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
    validityDays: ""
  });

  useEffect(() => {
    loadPackages();
  }, [clinicId, branchId]);

  const loadPackages = async () => {
    if (!clinicId) return;
    try {
      setLoading(true);
      const data = await packageService.getPackagesByClinic(clinicId, branchId || undefined);
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
        validityDays: pkg.validityDays?.toString() || ""
      });
    } else {
      setEditingPkg(null);
      setFormData({
        name: "",
        description: "",
        price: "",
        walletCreditAmount: "",
        totalSessions: "",
        validityDays: ""
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
      const totalSessions = formData.totalSessions ? parseInt(formData.totalSessions) : undefined;

      if (editingPkg) {
        await packageService.updatePackage(editingPkg.id, {
          name: formData.name,
          description: formData.description,
          price,
          walletCreditAmount: walletCredit,
          totalSessions,
          validityDays: formData.validityDays ? parseInt(formData.validityDays) : undefined
        });
        addToast({ title: "Updated", description: "Package updated successfully", color: "success" });
      } else {
        await packageService.createPackage({
          name: formData.name,
          description: formData.description,
          price,
          walletCreditAmount: walletCredit,
          totalSessions,
          validityDays: formData.validityDays ? parseInt(formData.validityDays) : undefined,
          isActive: true,
          clinicId,
          branchId,
          createdBy: "system"
        });
        addToast({ title: "Created", description: "Package created successfully", color: "success" });
      }
      setIsModalOpen(false);
      loadPackages();
    } catch (error) {
      addToast({ title: "Error", description: "Failed to save package", color: "danger" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this package?")) return;
    try {
      await packageService.deletePackage(id);
      addToast({ title: "Deleted", description: "Package deleted successfully", color: "success" });
      setSelectedPackages(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      loadPackages();
    } catch (error) {
      addToast({ title: "Error", description: "Failed to delete package", color: "danger" });
    }
  };

  const handleBatchDelete = async () => {
    if (selectedPackages.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedPackages.size} packages?`)) return;
    
    try {
      setIsBatchDeleting(true);
      const deletePromises = Array.from(selectedPackages).map(id => packageService.deletePackage(id));
      await Promise.all(deletePromises);
      
      addToast({ title: "Deleted", description: `${selectedPackages.size} packages deleted successfully`, color: "success" });
      setSelectedPackages(new Set());
      loadPackages();
    } catch (error) {
      addToast({ title: "Error", description: "Failed to delete packages", color: "danger" });
    } finally {
      setIsBatchDeleting(false);
    }
  };

  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      setSelectedPackages(new Set(packages.map(p => p.id)));
    } else {
      setSelectedPackages(new Set());
    }
  };

  const handleSelectPackage = (id: string, isSelected: boolean) => {
    setSelectedPackages(prev => {
      const next = new Set(prev);
      if (isSelected) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const isAllSelected = packages.length > 0 && selectedPackages.size === packages.length;
  const isIndeterminate = selectedPackages.size > 0 && selectedPackages.size < packages.length;

  const handleSeedPackages = async () => {
    if (!clinicId) return;
    if (!confirm("Are you sure you want to seed 5 demo skin care packages?")) return;
    
    try {
      setIsSeeding(true);
      const demoPackages = [
        { name: "Laser Hair Removal - 6 Sessions", description: "Full body laser hair removal", price: 50000, walletCreditAmount: 50000, totalSessions: 6 },
        { name: "Acne Scar Treatment - 4 Sessions", description: "Microneedling & Chemical Peels", price: 25000, walletCreditAmount: 25000, totalSessions: 4 },
        { name: "Bridal Glow Package", description: "Complete skin rejuvenation before wedding", price: 35000, walletCreditAmount: 35000, totalSessions: 5 },
        { name: "Anti-Aging Botox Plan", description: "Annual botox maintenance package", price: 60000, walletCreditAmount: 60000, totalSessions: 1 },
        { name: "Pigmentation & Melasma Pack", description: "Q-Switch laser + Topicals", price: 30000, walletCreditAmount: 30000, totalSessions: 5 },
      ];

      for (const pkg of demoPackages) {
        await packageService.createPackage({
          ...pkg,
          clinicId,
          branchId,
          isActive: true,
          createdBy: "system"
        });
      }
      
      addToast({ title: "Seeded", description: "5 Demo Packages created successfully", color: "success" });
      loadPackages();
    } catch (error) {
      addToast({ title: "Error", description: "Failed to seed packages", color: "danger" });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="clarity-page-header">
        <div>
          <h1 className="clarity-page-title">Treatment Packages</h1>
          <p className="clarity-page-subtitle">Manage bulk session packages that fund patient wallets</p>
        </div>
        <div className="flex gap-2">
          {selectedPackages.size > 0 && (
            <Button 
              color="danger" 
              variant="flat" 
              onClick={handleBatchDelete} 
              isLoading={isBatchDeleting}
            >
              Delete Selected ({selectedPackages.size})
            </Button>
          )}
          <Button color="warning" variant="flat" startContent={<IoAddOutline className="w-4 h-4"/>} onClick={handleSeedPackages} isLoading={isSeeding}>
            Seed 5 Packages
          </Button>
          <Button color="primary" startContent={<IoAddOutline className="w-4 h-4"/>} onClick={() => handleOpenModal()}>
            Add Package
          </Button>
        </div>
      </div>

      <div className="bg-surface border border-border-base rounded-[10px] overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-text-muted">Loading...</div>
        ) : packages.length === 0 ? (
          <div className="p-8 text-center text-text-muted">No packages defined. Click "Add Package" to create one.</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-2/50 border-b border-border-base text-[11px] uppercase tracking-wider text-text-muted">
                <th className="px-5 py-3 font-medium w-[40px]">
                  <input 
                    type="checkbox"
                    className="w-4 h-4 rounded border-border-base text-primary focus:ring-primary cursor-pointer"
                    checked={isAllSelected}
                    ref={input => {
                      if (input) input.indeterminate = isIndeterminate && !isAllSelected;
                    }}
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
              {packages.map(pkg => (
                <tr key={pkg.id} className="border-b border-border-base last:border-0 hover:bg-surface-2/30 transition-colors">
                  <td className="px-5 py-3">
                    <input 
                      type="checkbox"
                      className="w-4 h-4 rounded border-border-base text-primary focus:ring-primary cursor-pointer"
                      checked={selectedPackages.has(pkg.id)}
                      onChange={(e) => handleSelectPackage(pkg.id, e.target.checked)}
                    />
                  </td>
                  <td className="px-2 py-3 text-[13px] font-semibold text-text-main">{pkg.name}</td>
                  <td className="px-5 py-3 text-[12px] text-text-muted">{pkg.description || "-"}</td>
                  <td className="px-5 py-3 text-[13px]">NPR {pkg.price.toLocaleString()}</td>
                  <td className="px-5 py-3 text-[13px] text-emerald-600 font-medium">NPR {pkg.walletCreditAmount.toLocaleString()}</td>
                  <td className="px-5 py-3 text-[13px] text-center font-bold">{pkg.totalSessions || "-"}</td>
                  <td className="px-5 py-3 text-[13px] text-center">{pkg.validityDays ? `${pkg.validityDays} Days` : "Lifetime"}</td>
                  <td className="px-5 py-3 text-right">
                    <Button size="sm" variant="bordered" onClick={() => handleOpenModal(pkg)}>Edit</Button>
                    <Button size="sm" color="danger" variant="light" className="ml-2" onClick={() => handleDelete(pkg.id)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} size="2xl">
        <ModalContent>
          <form onSubmit={handleSave}>
            <ModalHeader>
                <h3>{editingPkg ? "Edit Package" : "Add Package"}</h3>
              </ModalHeader>
              <ModalBody className="space-y-4 py-4">
                <Input 
                  label="Package Name" 
                  isRequired 
                  value={formData.name} 
                  onChange={e => setFormData(prev => ({...prev, name: e.target.value}))} 
                  placeholder="e.g. Laser Hair Removal - 6 Sessions"
                />
                <Input 
                  label="Description (Optional)" 
                  value={formData.description} 
                  onChange={e => setFormData(prev => ({...prev, description: e.target.value}))} 
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input 
                    label="Price (Patient Pays)" 
                    type="number" 
                    isRequired 
                    startContent={<div className="pointer-events-none flex items-center"><span className="text-default-400 text-small">NPR</span></div>}
                    value={formData.price} 
                    onChange={e => setFormData(prev => ({...prev, price: e.target.value}))} 
                  />
                  <Input 
                    label="Wallet Credit Amount" 
                    type="number" 
                    isRequired 
                    startContent={<div className="pointer-events-none flex items-center"><span className="text-default-400 text-small">NPR</span></div>}
                    description="Amount deposited into wallet"
                    value={formData.walletCreditAmount} 
                    onChange={e => setFormData(prev => ({...prev, walletCreditAmount: e.target.value}))} 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Input 
                    label="Total Sessions (Optional)" 
                    type="number" 
                    description="Visual tracking for multi-session packages"
                    value={formData.totalSessions} 
                    onChange={e => setFormData(prev => ({...prev, totalSessions: e.target.value}))} 
                  />
                  <Input 
                    label="Validity in Days (Optional)" 
                    type="number" 
                    description="Leave empty for lifetime validity"
                    value={formData.validityDays} 
                    onChange={e => setFormData(prev => ({...prev, validityDays: e.target.value}))} 
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button color="default" variant="flat" onClick={() => setIsModalOpen(false)} isDisabled={isSaving}>Cancel</Button>
                <Button color="primary" type="submit" isLoading={isSaving}>Save Package</Button>
              </ModalFooter>
            </form>
        </ModalContent>
      </Modal>
    </div>
  );
}
