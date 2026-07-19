import { describe, it, expect } from "vitest";
import { generateInvoiceHTML, generateAppointmentInvoiceHTML } from "../../../src/utils/invoicePrinting";
import { PrintLayoutConfig } from "../../../src/types/printLayout";

describe("Invoice Printing Utility Footer/Quote Tests", () => {
  const mockClinic = {
    name: "Test Clinic",
    address: "Kathmandu",
    phone: "9800000000",
  };

  const mockPatient = {
    name: "John Doe",
    mobile: "9812345678",
    address: "Lalitpur",
  };

  const mockLayoutConfig: PrintLayoutConfig = {
    clinicId: "clinic_1",
    clinicName: "Test Clinic",
    address: "Kathmandu",
    city: "Kathmandu",
    state: "Bagmati",
    zipCode: "44600",
    country: "Nepal",
    phone: "9800000000",
    email: "test@clinic.com",
    logoPosition: "center",
    logoSize: "medium",
    logoWidth: 80,
    headerHeight: "standard",
    showFooter: true,
    footerText: "General Footer Quote",
    pathologyFooterText: "Pathology Specific Quote",
    pharmacyFooterText: "Pharmacy Specific Quote",
    appointmentFooterText: "Appointment Specific Quote",
    paperSize: "A4",
    margins: "normal",
    fontSize: "medium",
    contentFontSize: 12,
    fontFamily: "'Inter', sans-serif",
    showTagline: true,
    showAddress: true,
    showPhone: true,
    showEmail: true,
    showWebsite: true,
    updatedBy: "system",
  };

  it("should render pathology-specific footerText in generateInvoiceHTML when showFooter is true", () => {
    const mockBilling: any = {
      invoiceNumber: "INV-101",
      invoiceDate: new Date().toISOString(),
      patientName: "John Doe",
      items: [
        {
          testName: "CBC",
          quantity: 1,
          price: 500,
          amount: 500,
        },
      ],
      subtotal: 500,
      totalAmount: 500,
      paidAmount: 500,
      balanceAmount: 0,
    };

    const html = generateInvoiceHTML(mockBilling, "THERMAL_80MM", mockClinic, mockLayoutConfig);
    expect(html).toContain("Pathology Specific Quote");
    expect(html).not.toContain("General Footer Quote");
  });

  it("should render appointment-specific footerText in generateAppointmentInvoiceHTML when showFooter is true", () => {
    const mockInvoice: any = {
      invoiceNumber: "INV-202",
      invoiceDate: new Date().toISOString(),
      patientName: "John Doe",
      items: [
        {
          appointmentTypeName: "Consultation",
          quantity: 1,
          price: 1000,
          amount: 1000,
        },
      ],
      subtotal: 1000,
      totalAmount: 1000,
      paidAmount: 1000,
      balanceAmount: 0,
    };

    // Test on Thermal format
    const htmlThermal = generateAppointmentInvoiceHTML(
      mockInvoice,
      mockClinic,
      mockLayoutConfig,
      mockPatient,
      "THERMAL_80MM"
    );
    expect(htmlThermal).toContain("Appointment Specific Quote");
    expect(htmlThermal).not.toContain("General Footer Quote");

    // Test on A4 format
    const htmlA4 = generateAppointmentInvoiceHTML(
      mockInvoice,
      mockClinic,
      mockLayoutConfig,
      mockPatient,
      "A4"
    );
    expect(htmlA4).toContain("Appointment Specific Quote");
    expect(htmlA4).not.toContain("General Footer Quote");
  });

  it("should fallback to general footerText if section-specific footer is empty", () => {
    const fallbackConfig = {
      ...mockLayoutConfig,
      pathologyFooterText: "",
      appointmentFooterText: "",
    };

    const mockInvoice: any = {
      invoiceNumber: "INV-202",
      invoiceDate: new Date().toISOString(),
      patientName: "John Doe",
      items: [
        {
          appointmentTypeName: "Consultation",
          quantity: 1,
          price: 1000,
          amount: 1000,
        },
      ],
      subtotal: 1000,
      totalAmount: 1000,
      paidAmount: 1000,
      balanceAmount: 0,
    };

    const html = generateAppointmentInvoiceHTML(
      mockInvoice,
      mockClinic,
      fallbackConfig,
      mockPatient,
      "A4"
    );
    expect(html).toContain("General Footer Quote");
  });
});
