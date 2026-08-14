import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { getNepaliFiscalYear, syncInvoiceToIRD, SyncInvoiceParams } from './irdCbmsService';
import { ClinicSettings, Clinic } from '../types/models';

// Mock axios since the service uses it to proxy the request
vi.mock('axios');
const mockedAxios = vi.mocked(axios, true);

describe('irdCbmsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getNepaliFiscalYear', () => {
    it('should calculate fiscal year for dates before Shrawan (e.g., Baishakh)', () => {
      // Baishakh is the 1st month. Before Shrawan (4th month), it falls in the previous fiscal year.
      // Example: 2080-01-01 BS (approx mid April 2023)
      const date = new Date('2023-04-14'); 
      const fy = getNepaliFiscalYear(date);
      // If year is 2080 and month is 1, fiscal year should be 2079.80
      expect(fy).toMatch(/\d{4}\.\d{2}/);
    });

    it('should calculate fiscal year for dates after Shrawan (e.g., Mangsir)', () => {
      // Example: 2080-08-01 BS (approx mid Nov 2023)
      const date = new Date('2023-11-17');
      const fy = getNepaliFiscalYear(date);
      // If year is 2080 and month is 8, fiscal year should be 2080.81
      expect(fy).toMatch(/\d{4}\.\d{2}/);
    });
  });

  describe('syncInvoiceToIRD', () => {
    const mockClinicSettings: ClinicSettings = {
      id: 'settings_123',
      clinicId: 'clinic_123',
      sellsMedicines: false,
      enableInventoryManagement: false,
      enableLowStockAlerts: false,
      allowNegativeStock: false,
      requireBatchTracking: false,
      requireExpiryTracking: false,
      autoGenerateBarcode: false,
      irdEnabled: true,
      irdApiUrl: 'https://cbapi.ird.gov.np',
      irdApiUsername: 'user123',
      irdApiPassword: 'password123',
      createdAt: new Date(),
      updatedAt: new Date(),
      updatedBy: 'system',
    };

    const mockClinic: Clinic = {
      id: 'clinic_123',
      name: 'Test Clinic',
      city: 'Kathmandu',
      clinicType: 'type1',
      phone: '1234567890',
      email: 'test@clinic.com',
      panNumber: '123456789',
      subscriptionStatus: 'active',
      subscriptionPlan: 'plan1',
      subscriptionStartDate: new Date(),
      subscriptionType: 'monthly',
      isMultiBranchEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockInvoiceData = {
      buyerName: 'John Doe',
      invoiceNumber: 'INV-001',
      invoiceDate: new Date(),
      totalAmount: 1130,
      taxAmount: 130, // VAT amount
      isTaxEnabled: true,
    };

    it('should return failure if irdEnabled is false', async () => {
      const settings = { ...mockClinicSettings, irdEnabled: false };
      const result = await syncInvoiceToIRD({
        clinicSettings: settings,
        clinic: mockClinic,
        invoiceData: mockInvoiceData,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('IRD Sync is disabled');
    });

    it('should return failure if API credentials are not fully configured', async () => {
      const settings = { ...mockClinicSettings, irdApiUrl: '' };
      const result = await syncInvoiceToIRD({
        clinicSettings: settings,
        clinic: mockClinic,
        invoiceData: mockInvoiceData,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('IRD API credentials are not fully configured');
    });

    it('should return failure if PAN is not available', async () => {
      const clinicWithoutPan = { ...mockClinic, panNumber: undefined };
      const result = await syncInvoiceToIRD({
        clinicSettings: mockClinicSettings,
        clinic: clinicWithoutPan,
        invoiceData: mockInvoiceData,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Clinic PAN is required');
    });

    it('should return success immediately if mock URL is used', async () => {
      const settings = { ...mockClinicSettings, irdApiUrl: 'test' }; // "test" triggers mock
      const result = await syncInvoiceToIRD({
        clinicSettings: settings,
        clinic: mockClinic,
        invoiceData: mockInvoiceData,
      });

      expect(result.success).toBe(true);
      expect(result.responseCode).toBe('200');
      expect(result.message).toContain('MOCK: Successfully synced');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('should successfully proxy the request to Firebase functions', async () => {
      // Mock the Firebase Function proxy response
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          success: true,
          data: {
            ResponseCode: 200,
            Message: 'Successfully synced with IRD',
          },
        },
      });

      const result = await syncInvoiceToIRD({
        clinicSettings: mockClinicSettings,
        clinic: mockClinic,
        invoiceData: mockInvoiceData,
      });

      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      
      // Ensure the proxy URL and payload were passed correctly
      const [url, payload] = mockedAxios.post.mock.calls[0];
      expect(url).toContain('irdProxy');
      expect(payload).toHaveProperty('endpoint', 'https://cbapi.ird.gov.np/api/bill');
      expect(payload).toHaveProperty('payload');
      expect((payload as any).payload).toHaveProperty('seller_pan', '123456789');

      expect(result.success).toBe(true);
      expect(result.responseCode).toBe('200');
      expect(result.message).toBe('Successfully synced with IRD');
    });

    it('should handle proxy failure gracefully', async () => {
      // Mock proxy network error
      mockedAxios.post.mockRejectedValueOnce(new Error('Network Error'));

      const result = await syncInvoiceToIRD({
        clinicSettings: mockClinicSettings,
        clinic: mockClinic,
        invoiceData: mockInvoiceData,
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Network Error');
    });

    it('should handle negative response from IRD through proxy', async () => {
      // Mock proxy success but IRD API failure (e.g., validation error from IRD)
      mockedAxios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          success: true,
          data: {
            ResponseCode: 400,
            Message: 'Invalid PAN Number',
          },
        },
      });

      const result = await syncInvoiceToIRD({
        clinicSettings: mockClinicSettings,
        clinic: mockClinic,
        invoiceData: mockInvoiceData,
      });

      expect(result.success).toBe(false);
      expect(result.responseCode).toBe('400');
      expect(result.message).toBe('Invalid PAN Number');
    });
  });
});
