import { describe, it, expect, vi, beforeEach } from 'vitest';
import { medicineService } from '../medicineService';
import { collection, addDoc, updateDoc, setDoc, doc, Timestamp, getDocs, query, where, getDoc } from 'firebase/firestore';

// Mock Firebase
vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore');
  return {
    ...actual,
    collection: vi.fn(),
    addDoc: vi.fn(),
    updateDoc: vi.fn(),
    setDoc: vi.fn(),
    doc: vi.fn(),
    getDocs: vi.fn().mockResolvedValue({ docs: [] }),
    query: vi.fn(),
    where: vi.fn(),
    getDoc: vi.fn(),
    Timestamp: {
      now: vi.fn(() => ({ toMillis: () => Date.now() })),
      fromDate: vi.fn((date) => ({ toMillis: () => date.getTime() }))
    }
  };
});

vi.mock('@/config/firebase', () => ({
  db: {}
}));

describe('Medicine Refill and Adjustment Engine (Unit Tests)', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should correctly create a purchase transaction for stock additions', async () => {
    const mockTransaction = {
      medicineId: "med_123",
      type: "purchase" as const,
      quantity: 50,
      previousStock: 10,
      newStock: 60,
      expiryDate: new Date('2028-01-01'),
      isSchemeStock: false,
      clinicId: "clinic_1",
      branchId: "",
      createdBy: "user_1"
    };

    (addDoc as any).mockResolvedValueOnce({ id: 'trans_123' });

    const result = await medicineService.createStockTransaction(mockTransaction);
    expect(addDoc).toHaveBeenCalledTimes(1);
    expect(result).toBe('trans_123');
  });

  it('should correctly create an adjustment transaction for stock subtractions', async () => {
    const mockTransaction = {
      medicineId: "med_123",
      type: "adjustment" as const,
      quantity: -5,
      previousStock: 60,
      newStock: 55,
      expiryDate: new Date('2028-01-01'),
      isSchemeStock: false,
      clinicId: "clinic_1",
      branchId: "",
      createdBy: "user_1"
    };

    (addDoc as any).mockResolvedValueOnce({ id: 'trans_456' });

    const result = await medicineService.createStockTransaction(mockTransaction);
    expect(addDoc).toHaveBeenCalledTimes(1);
    expect(result).toBe('trans_456');
  });

  it('should update the global medicine catalog with new batch pricing on addition', async () => {
    const mockMedicineUpdate = {
      price: 250,
      costPrice: 200,
      batchNumber: "BATCH-500",
      expiryDate: new Date('2029-01-01')
    };

    (doc as any).mockReturnValue('mock_doc_ref');
    (updateDoc as any).mockResolvedValueOnce(undefined);

    await medicineService.updateMedicine("med_123", mockMedicineUpdate);
    expect(updateDoc).toHaveBeenCalledWith('mock_doc_ref', {
      ...mockMedicineUpdate,
      updatedAt: expect.anything()
    });
  });

  it('should create a paid supplier purchase record when a supplier is provided during addition', async () => {
    const mockPurchaseData = {
      supplierId: "sup_1",
      supplierName: "Pharma Corp",
      purchaseDate: new Date(),
      billNumber: "INV-001",
      totalAmount: 10000,
      paidAmount: 10000,
      dueAmount: 0,
      paymentStatus: "paid" as const,
      paymentDone: true,
      notes: "Stock refill for Paracetamol",
      items: [{
        name: "Paracetamol",
        qty: 50,
        costPrice: 200,
        vatPercentage: 0,
        total: 10000
      }],
      clinicId: "clinic_1",
      branchId: "",
      createdBy: "user_1"
    };

    (addDoc as any).mockResolvedValue({ id: 'purch_123' });

    const result = await medicineService.createSupplierPurchaseRecord(mockPurchaseData);
    expect(addDoc).toHaveBeenCalledTimes(2); // Once for purchase, once for ledger entry
    expect(result).toBe('purch_123');
  });

});
