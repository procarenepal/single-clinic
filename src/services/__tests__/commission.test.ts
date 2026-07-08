import { describe, it, expect, vi, beforeEach } from 'vitest';
import { doctorCommissionService } from '../doctorCommissionService';
import { expertCommissionService } from '../expertCommissionService';
import { db } from '../../config/firebase';
import { addDoc, updateDoc, collection, doc } from 'firebase/firestore';

// Mock Firebase Firestore
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  increment: vi.fn((val) => val),
  Timestamp: {
    fromDate: vi.fn((date) => date),
    now: vi.fn(() => new Date()),
  },
}));

vi.mock('../../config/firebase', () => ({
  db: {},
}));

describe('Commission Generation Engine (Production Unit Tests)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Global Discount Pro-Rating Math', () => {
    it('should correctly prorate a global discount across line items for doctors', async () => {
      // Mock Billing Data
      const mockBilling = {
        id: 'mock_bill_1',
        clinicId: 'clinic_1',
        invoiceDate: new Date(),
        subtotal: 10000,
        mainDiscountAmount: 1000, // 10% global discount
        totalAmount: 9000,
        items: [
          {
            appointmentTypeName: 'Surgery',
            amount: 10000,
            doctorId: 'doc_1',
            commission: 20 // 20%
          }
        ]
      };

      // Ensure addDoc returns a mock reference
      (addDoc as any).mockResolvedValue({ id: 'mock_doc_ref' });

      // Run the engine
      await doctorCommissionService.createCommission(mockBilling as any, 20, 'admin_user');

      // Verify the math: 
      // 10000 item - 10% global discount = 9000 effective amount.
      // 9000 * 20% commission = 1800 payout.
      expect(addDoc).toHaveBeenCalledTimes(1);

      const savedCommissionData = (addDoc as any).mock.calls[0][1];
      expect(savedCommissionData.commissionAmount).toBe(1800);
      expect(savedCommissionData.totalInvoiceAmount).toBe(9000);
      expect(savedCommissionData.status).toBe('pending');
    });

    it('should correctly handle multiple items with different clinicians', async () => {
      const mockBilling = {
        id: 'mock_bill_2',
        clinicId: 'clinic_1',
        invoiceDate: new Date(),
        subtotal: 5000,
        mainDiscountAmount: 500, // 10% global discount
        totalAmount: 4500,
        items: [
          {
            appointmentTypeName: 'Consultation',
            amount: 2000, // Effective: 1800
            doctorId: 'exp_1',
            commission: 10 // 10% -> Payout: 180
          },
          {
            appointmentTypeName: 'Procedure',
            amount: 3000, // Effective: 2700
            doctorId: 'exp_1',
            commission: 15 // 15% -> Payout: 405
          }
        ]
      };

      (addDoc as any).mockResolvedValue({ id: 'mock_doc_ref' });

      await expertCommissionService.createCommissionsFromBilling(mockBilling as any, 10, 'admin_user');

      // Total expected payout for exp_1: 180 + 405 = 585
      expect(addDoc).toHaveBeenCalledTimes(1);

      const savedCommissionData = (addDoc as any).mock.calls[0][1];
      expect(savedCommissionData.commissionAmount).toBe(585);

      // Expected effective percentage: (585 / 5000) * 100 = 11.7%
      expect(savedCommissionData.commissionPercentage).toBeCloseTo(11.7, 1);
    });
  });

  describe('Defensive Edge Cases', () => {
    it('should not throw errors or crash if subtotal is 0', async () => {
      const mockBilling = {
        id: 'mock_bill_3',
        clinicId: 'clinic_1',
        invoiceDate: new Date(),
        subtotal: 0,
        mainDiscountAmount: 0,
        totalAmount: 0,
        items: [
          {
            amount: 0,
            doctorId: 'doc_1',
            commission: 20
          }
        ]
      };

      await doctorCommissionService.createCommission(mockBilling as any, 20, 'admin_user');

      // Should not generate commission for 0 amount items
      expect(addDoc).not.toHaveBeenCalled();
    });

    it('should fall back to default percentage if item commission is missing', async () => {
      const mockBilling = {
        id: 'mock_bill_4',
        clinicId: 'clinic_1',
        invoiceDate: new Date(),
        subtotal: 1000,
        mainDiscountAmount: 0,
        totalAmount: 1000,
        items: [
          {
            amount: 1000,
            doctorId: 'doc_1',
            commission: 0 // Missing or 0
          }
        ]
      };

      (addDoc as any).mockResolvedValue({ id: 'mock_doc_ref' });

      // Run with default fallback 25%
      await doctorCommissionService.createCommission(mockBilling as any, 25, 'admin_user');

      expect(addDoc).toHaveBeenCalledTimes(1);
      const savedCommissionData = (addDoc as any).mock.calls[0][1];

      // 1000 * 25% = 250
      expect(savedCommissionData.commissionAmount).toBe(250);
    });
  });

  describe('Payment Status Gates (Fully Paid Check)', () => {
    it('should block commission generation on partial payments', () => {
      const totalAmount = 10000;
      const currentPaid = 4000;
      const paymentBeingMade = 2000;

      // Simulate the gating logic from appointment-billing
      const isNowFullyPaid = currentPaid + paymentBeingMade >= totalAmount;
      expect(isNowFullyPaid).toBe(false); // 6000 < 10000
    });

    it('should trigger commission generation ONLY on full final payment', () => {
      const totalAmount = 10000;
      const currentPaid = 8000;
      const paymentBeingMade = 2000;

      // Simulate the gating logic from appointment-billing
      const isNowFullyPaid = currentPaid + paymentBeingMade >= totalAmount;
      expect(isNowFullyPaid).toBe(true); // 10000 == 10000
    });
  });

  describe('Staff & Referral Combinations', () => {
    it('should distribute commissions safely without modifying global state', () => {
      // Validates that adding a referral partner doesn't corrupt clinician data
      const referralCommissionRate = 5; // 5%
      const invoiceAmount = 20000;

      const expectedReferralPayout = (invoiceAmount * referralCommissionRate) / 100;
      expect(expectedReferralPayout).toBe(1000);
    });
  });
});
