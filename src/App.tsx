import { Route, Routes } from "react-router-dom";
import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "react-hot-toast";
import { lazy as reactLazy } from "react";

import { Spinner } from "@/components/ui/spinner";
import { initScrollbarThemeObserver } from "@/utils/scrollbarTheme";

// Layouts (keep default layout as regular import, lazy others)
const DefaultLayout = reactLazy(() => import("@/layouts/default"));
const AuthProviders = reactLazy(() => import("@/providers/auth-providers"));
const DashboardLayout = reactLazy(() => import("@/layouts/dashboard"));
const SystemOwnerRoute = reactLazy(() =>
  import("@/components/rbac/SystemOwnerRoute").then((m) => ({
    default: m.SystemOwnerRoute,
  })),
);
const RbacProtectedRoute = reactLazy(() =>
  import("@/components/rbac/ProtectedRoute").then((m) => ({
    default: m.ProtectedRoute,
  })),
);
const BasicProtectedRoute = reactLazy(() =>
  import("@/components/protected-route").then((m) => ({
    default: m.ProtectedRoute,
  })),
);

// Protected route components (now lazy-loaded above as wrappers)
const ScrollToTop = reactLazy(() =>
  import("@/components/ScrollToTop").then((m) => ({ default: m.ScrollToTop })),
);

// Loading component
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <Spinner label="Loading page..." size="lg" />
  </div>
);

// Lazy load public pages
const IndexPage = lazy(() => import("@/pages/index"));
const FeaturesPage = lazy(() => import("@/pages/features"));
const DocsPage = lazy(() => import("@/pages/docs"));
const PricingPage = lazy(() => import("@/pages/pricing"));
const BlogPage = lazy(() => import("@/pages/blog"));
const AboutPage = lazy(() => import("@/pages/about"));
const ContactPage = lazy(() => import("@/pages/contact"));
const LoginPage = lazy(() => import("./pages/login"));
const ForgotPasswordPage = lazy(() => import("./pages/forgot-password"));
const ResetPasswordPage = lazy(() => import("./pages/reset-password"));
const DemoPage = lazy(() => import("./pages/demo"));
const AppwriteTestPage = lazy(() => import("./pages/appwrite-test"));
const SMSTesterPage = lazy(() => import("./pages/sms-tester"));
const SMSBackendTesterPage = lazy(() => import("./pages/sms-backend-tester"));

// Lazy load dashboard pages
const DashboardIndexPage = lazy(() => import("@/pages/dashboard/index"));
const PatientsPage = lazy(() => import("@/pages/dashboard/patients"));
const PatientDetailPage = lazy(
  () => import("@/pages/dashboard/patients/[patientId]/index"),
);
const PatientEditPage = lazy(
  () => import("@/pages/dashboard/patients/[patientId]/edit"),
);
const DoctorsPage = lazy(() => import("@/pages/dashboard/doctors"));
const DoctorProfilePage = lazy(
  () => import("@/pages/dashboard/doctors/[doctorId]/index"),
);
const AppointmentsPage = lazy(() => import("@/pages/dashboard/appointments"));
const AppointmentBillingPage = lazy(
  () => import("@/pages/dashboard/appointments-billing"),
);
const InvoiceDetailPage = lazy(
  () => import("@/pages/dashboard/appointments-billing/[id]"),
);
const EditInvoicePage = lazy(
  () => import("@/pages/dashboard/appointments-billing/[id]/edit"),
);
const NewPatientPage = lazy(() => import("@/pages/dashboard/new-patient"));
const NewDoctorPage = lazy(() => import("@/pages/dashboard/new-doctor"));
const SettingsPage = lazy(() => import("@/pages/dashboard/settings/index"));
const AppointmentSettingsPage = lazy(
  () => import("@/pages/dashboard/settings/appointments"),
);
const PackagesSettingsPage = lazy(
  () => import("@/pages/dashboard/settings/packages"),
);
const ClinicSettingsPage = lazy(
  () => import("@/pages/dashboard/settings/clinic"),
);
const ThemeSettingsPage = lazy(
  () => import("@/pages/dashboard/settings/theme"),
);
const StaffManagementPage = lazy(
  () => import("@/pages/dashboard/settings/staff"),
);
const DoctorSpecialityPage = lazy(
  () => import("@/pages/dashboard/settings/doctor-speciality"),
);
const MedicalReportFieldsPage = lazy(
  () => import("@/pages/dashboard/settings/medical-report-fields"),
);
const NotesSectionsPage = lazy(
  () => import("@/pages/dashboard/settings/notes-sections"),
);
const PrintLayoutPage = lazy(
  () => import("@/pages/dashboard/settings/print-layout"),
);
const NewAppointmentPage = lazy(
  () => import("@/pages/dashboard/appointments/new"),
);
const AppointmentDetailsPage = lazy(
  () => import("@/pages/dashboard/appointments/[id]"),
);
const EditAppointmentPage = lazy(
  () => import("@/pages/dashboard/appointments/[id]/edit"),
);
const MedicineManagementPage = lazy(
  () => import("@/pages/dashboard/medicine-management/index"),
);
const PharmacyPage = lazy(() => import("@/pages/dashboard/pharmacy"));
const PurchaseDetailPage = lazy(
  () => import("@/pages/dashboard/pharmacy/purchase-detail"),
);
const PurchaseEditPage = lazy(
  () => import("@/pages/dashboard/pharmacy/purchase-edit"),
);
const PurchaseReturnPage = lazy(
  () => import("@/pages/dashboard/pharmacy/purchase-return"),
);
const PathologyPage = lazy(() => import("@/pages/dashboard/pathology"));
const BedManagementPage = lazy(
  () => import("@/pages/dashboard/bed-management/index"),
);
const RbacPage = lazy(() => import("@/pages/dashboard/settings/rbac/index"));
const EnquiriesPage = lazy(() => import("@/pages/dashboard/enquiry"));
const ReferralPartnersPage = lazy(
  () => import("@/pages/dashboard/referral-partners"),
);
const NewReferralPartnerPage = lazy(
  () => import("@/pages/dashboard/new-referral-partner"),
);
const ReferralPartnerProfilePage = lazy(
  () => import("@/pages/dashboard/referral-partners/profile"),
);

// Lazy load branch management pages
const BranchManagementPage = lazy(
  () => import("@/pages/dashboard/branches/index"),
);
const NewBranchPage = lazy(() => import("@/pages/dashboard/new-branch"));
const SystemOwnerDashboard = lazy(
  () => import("@/pages/dashboard/system-owner"),
);

// Lazy load reports page
const ReportsPage = lazy(() => import("@/pages/dashboard/reports/index"));
const DailyReportPage = lazy(
  () => import("@/pages/dashboard/daily-report/index"),
);

// Lazy load Front Office pages
const ManageVisitorsPage = lazy(
  () => import("@/pages/dashboard/front-office/manage-visitors"),
);
const ManageCallLogsPage = lazy(
  () => import("@/pages/dashboard/front-office/manage-call-logs"),
);
const FrontOfficeDeskPage = lazy(
  () => import("@/pages/dashboard/front-office/front-office-desk"),
);
const FollowupsPage = lazy(() => import("@/pages/dashboard/follow-ups/index"));
const TestCommissionPage = lazy(() => import("@/pages/dashboard/test-commission"));

// Lazy load invitation handler
const InvitationPage = lazy(() => import("@/pages/invitation/index"));

// Lazy load text editor pages
const TextEditorPage = lazy(
  () => import("@/pages/dashboard/text-editor/index"),
);
const EditTextDocumentPage = lazy(
  () => import("@/pages/dashboard/text-editor/[documentId]/edit"),
);

// Lazy load 404 pages
const NotFoundPage = lazy(() => import("@/pages/not-found"));
const DashboardNotFoundPage = lazy(() => import("@/pages/dashboard/not-found"));
const NewPrescriptionPage = lazy(
  () => import("@/pages/dashboard/prescriptions/new"),
);
const PrescriptionsPage = lazy(
  () => import("@/pages/dashboard/prescriptions/index"),
);
const PrescriptionDetailPage = lazy(
  () => import("@/pages/dashboard/prescriptions/[prescriptionId]/index"),
);
const EditPrescriptionPage = lazy(
  () => import("@/pages/dashboard/prescriptions/[prescriptionId]/edit"),
);

// Lazy load inventory page
const InventoryPage = lazy(() => import("@/pages/dashboard/inventory"));
const CommunicationPage = lazy(
  () => import("@/pages/dashboard/communication/index"),
);

// Lazy load edit doctor page
const EditDoctorPage = lazy(
  () => import("@/pages/dashboard/doctors/[doctorId]/edit"),
);
const ExpertsPage = lazy(() => import("@/pages/dashboard/experts"));
const NewExpertPage = lazy(() => import("@/pages/dashboard/experts/new"));
const ExpertProfilePage = lazy(
  () => import("@/pages/dashboard/experts/[expertId]/index"),
);
const EditExpertPage = lazy(
  () => import("@/pages/dashboard/experts/[expertId]/edit"),
);
const ProfilePage = lazy(() => import("@/pages/dashboard/profile"));
const ActivityLogPage = lazy(() => import("@/pages/dashboard/activity-log"));
const HomepageSettingsPage = lazy(
  () => import("@/pages/dashboard/settings/homepage"),
);
const AccountsPage = lazy(() => import("@/pages/dashboard/accounts/index"));
const HRPage = lazy(() => import("@/pages/dashboard/hr/index"));

export default function App() {
  // Initialize scrollbar theme observer during idle time to avoid blocking first paint
  useEffect(() => {
    const run = () => initScrollbarThemeObserver();

    // @ts-ignore - requestIdleCallback may not exist on Window typing
    if (typeof window !== "undefined" && window.requestIdleCallback) {
      // @ts-ignore
      window.requestIdleCallback(run);
    } else {
      setTimeout(run, 0);
    }
  }, []);

  // Auth preloading moved into protected route chunks to avoid pulling auth into initial bundle

  return (
    <>
      <Toaster position="top-right" />
      <Suspense fallback={null}>
        <ScrollToTop />
      </Suspense>
      <Suspense fallback={<LoadingSpinner />}>
        <AuthProviders>
          <Routes>
            {/* Public routes with DefaultLayout */}
            <Route
              element={
                <DefaultLayout>
                  <Suspense fallback={<LoadingSpinner />}>
                    <IndexPage />
                  </Suspense>
                </DefaultLayout>
              }
              path="/"
            />
            <Route
              element={
                <DefaultLayout>
                  <Suspense fallback={<LoadingSpinner />}>
                    <FeaturesPage />
                  </Suspense>
                </DefaultLayout>
              }
              path="/features"
            />
            <Route
              element={
                <DefaultLayout>
                  <Suspense fallback={<LoadingSpinner />}>
                    <DocsPage />
                  </Suspense>
                </DefaultLayout>
              }
              path="/docs"
            />
            <Route
              element={
                <DefaultLayout>
                  <Suspense fallback={<LoadingSpinner />}>
                    <PricingPage />
                  </Suspense>
                </DefaultLayout>
              }
              path="/pricing"
            />
            <Route
              element={
                <DefaultLayout>
                  <Suspense fallback={<LoadingSpinner />}>
                    <BlogPage />
                  </Suspense>
                </DefaultLayout>
              }
              path="/blog"
            />
            <Route
              element={
                <DefaultLayout>
                  <Suspense fallback={<LoadingSpinner />}>
                    <AboutPage />
                  </Suspense>
                </DefaultLayout>
              }
              path="/about"
            />
            <Route
              element={
                <DefaultLayout>
                  <Suspense fallback={<LoadingSpinner />}>
                    <ContactPage />
                  </Suspense>
                </DefaultLayout>
              }
              path="/contact"
            />
            <Route
              element={
                <Suspense fallback={<LoadingSpinner />}>
                  <BasicProtectedRoute>
                    <DashboardLayout>
                      <Suspense fallback={<LoadingSpinner />}>
                        <SMSTesterPage />
                      </Suspense>
                    </DashboardLayout>
                  </BasicProtectedRoute>
                </Suspense>
              }
              path="/sms-tester"
            />
            <Route
              element={
                <Suspense fallback={<LoadingSpinner />}>
                  <BasicProtectedRoute>
                    <DashboardLayout>
                      <Suspense fallback={<LoadingSpinner />}>
                        <SMSBackendTesterPage />
                      </Suspense>
                    </DashboardLayout>
                  </BasicProtectedRoute>
                </Suspense>
              }
              path="/sms-backend-tester"
            />
            <Route
              element={
                <DefaultLayout>
                  <Suspense fallback={<LoadingSpinner />}>
                    <LoginPage />
                  </Suspense>
                </DefaultLayout>
              }
              path="/login"
            />
            <Route
              element={
                <DefaultLayout>
                  <Suspense fallback={<LoadingSpinner />}>
                    <ForgotPasswordPage />
                  </Suspense>
                </DefaultLayout>
              }
              path="/forgot-password"
            />
            <Route
              element={
                <DefaultLayout>
                  <Suspense fallback={<LoadingSpinner />}>
                    <ResetPasswordPage />
                  </Suspense>
                </DefaultLayout>
              }
              path="/reset-password"
            />
            <Route
              element={
                <DefaultLayout>
                  <Suspense fallback={<LoadingSpinner />}>
                    <DemoPage />
                  </Suspense>
                </DefaultLayout>
              }
              path="/demo"
            />

            {/* Invitation handling route */}
            <Route
              element={
                <DefaultLayout>
                  <Suspense fallback={<LoadingSpinner />}>
                    <InvitationPage />
                  </Suspense>
                </DefaultLayout>
              }
              path="/invitation/:id"
            />

            {/* Dashboard routes */}
            <Route
              element={
                <Suspense fallback={<LoadingSpinner />}>
                  <BasicProtectedRoute>
                    <DashboardLayout>
                      <Suspense fallback={<LoadingSpinner />}>
                        <Routes>
                          <Route
                            index
                            element={<DashboardIndexPage />}
                            path=""
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/patients">
                                <PatientsPage />
                              </RbacProtectedRoute>
                            }
                            path="patients"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/patients">
                                <NewPatientPage />
                              </RbacProtectedRoute>
                            }
                            path="patients/new"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/patients">
                                <PatientDetailPage />
                              </RbacProtectedRoute>
                            }
                            path="patients/:patientId"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/patients">
                                <PatientEditPage />
                              </RbacProtectedRoute>
                            }
                            path="patients/:patientId/edit"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/doctors">
                                <DoctorsPage />
                              </RbacProtectedRoute>
                            }
                            path="doctors"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/doctors">
                                <NewDoctorPage />
                              </RbacProtectedRoute>
                            }
                            path="doctors/new"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/doctors">
                                <DoctorProfilePage />
                              </RbacProtectedRoute>
                            }
                            path="doctors/:doctorId"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/doctors">
                                <EditDoctorPage />
                              </RbacProtectedRoute>
                            }
                            path="doctors/:doctorId/edit"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/experts">
                                <ExpertsPage />
                              </RbacProtectedRoute>
                            }
                            path="experts"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/experts">
                                <NewExpertPage />
                              </RbacProtectedRoute>
                            }
                            path="experts/new"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/experts">
                                <ExpertProfilePage />
                              </RbacProtectedRoute>
                            }
                            path="experts/:expertId"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/experts">
                                <EditExpertPage />
                              </RbacProtectedRoute>
                            }
                            path="experts/:expertId/edit"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/appointments">
                                <AppointmentsPage />
                              </RbacProtectedRoute>
                            }
                            path="appointments"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/appointments">
                                <NewAppointmentPage />
                              </RbacProtectedRoute>
                            }
                            path="appointments/new"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/appointments-billing">
                                <AppointmentBillingPage />
                              </RbacProtectedRoute>
                            }
                            path="appointments-billing"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/appointments-billing">
                                <InvoiceDetailPage />
                              </RbacProtectedRoute>
                            }
                            path="appointments-billing/:id"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/appointments-billing">
                                <EditInvoicePage />
                              </RbacProtectedRoute>
                            }
                            path="appointments-billing/:id/edit"
                          />
                          {/* Map the general /dashboard/billing route to the same component */}
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/billing">
                                <AppointmentBillingPage />
                              </RbacProtectedRoute>
                            }
                            path="billing"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/billing">
                                <InvoiceDetailPage />
                              </RbacProtectedRoute>
                            }
                            path="billing/:id"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/billing">
                                <EditInvoicePage />
                              </RbacProtectedRoute>
                            }
                            path="billing/:id/edit"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/appointments">
                                <AppointmentDetailsPage />
                              </RbacProtectedRoute>
                            }
                            path="appointments/:id"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/appointments">
                                <EditAppointmentPage />
                              </RbacProtectedRoute>
                            }
                            path="appointments/:id/edit"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/medicine-management">
                                <MedicineManagementPage />
                              </RbacProtectedRoute>
                            }
                            path="medicine-management"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/pharmacy">
                                <PharmacyPage />
                              </RbacProtectedRoute>
                            }
                            path="pharmacy"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/enquiries">
                                <EnquiriesPage />
                              </RbacProtectedRoute>
                            }
                            path="enquiries"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/pharmacy">
                                <PurchaseDetailPage />
                              </RbacProtectedRoute>
                            }
                            path="pharmacy/purchase/:purchaseId"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/pharmacy">
                                <PurchaseEditPage />
                              </RbacProtectedRoute>
                            }
                            path="pharmacy/purchase-edit/:purchaseId"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/pharmacy">
                                <PurchaseReturnPage />
                              </RbacProtectedRoute>
                            }
                            path="pharmacy/purchase/:purchaseId/return"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/inventory">
                                <InventoryPage />
                              </RbacProtectedRoute>
                            }
                            path="inventory"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/pathology">
                                <PathologyPage />
                              </RbacProtectedRoute>
                            }
                            path="pathology"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/bed-management">
                                <BedManagementPage />
                              </RbacProtectedRoute>
                            }
                            path="bed-management"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/accounts">
                                <AccountsPage />
                              </RbacProtectedRoute>
                            }
                            path="accounts"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/hr">
                                <HRPage />
                              </RbacProtectedRoute>
                            }
                            path="hr"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/communication">
                                <CommunicationPage />
                              </RbacProtectedRoute>
                            }
                            path="communication"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/prescriptions">
                                <PrescriptionsPage />
                              </RbacProtectedRoute>
                            }
                            path="prescriptions"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/prescriptions">
                                <NewPrescriptionPage />
                              </RbacProtectedRoute>
                            }
                            path="prescriptions/new"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/prescriptions">
                                <PrescriptionDetailPage />
                              </RbacProtectedRoute>
                            }
                            path="prescriptions/:prescriptionId"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/prescriptions">
                                <EditPrescriptionPage />
                              </RbacProtectedRoute>
                            }
                            path="prescriptions/:prescriptionId/edit"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/front-office">
                                <FrontOfficeDeskPage />
                              </RbacProtectedRoute>
                            }
                            path="front-office"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/front-office/manage-visitors">
                                <ManageVisitorsPage />
                              </RbacProtectedRoute>
                            }
                            path="front-office/manage-visitors"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/front-office/call-logs">
                                <ManageCallLogsPage />
                              </RbacProtectedRoute>
                            }
                            path="front-office/call-logs"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/front-office">
                                <FollowupsPage />
                              </RbacProtectedRoute>
                            }
                            path="follow-ups"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/billing">
                                <TestCommissionPage />
                              </RbacProtectedRoute>
                            }
                            path="test-commission"
                          />
                          {/* Core Settings Routes - No RBAC needed for basic settings */}
                          <Route element={<SettingsPage />} path="settings" />
                          <Route element={<ProfilePage />} path="profile" />
                          <Route
                            element={<ActivityLogPage />}
                            path="activity-log"
                          />
                          <Route
                            element={<ClinicSettingsPage />}
                            path="settings/clinic"
                          />
                          <Route
                            element={<ThemeSettingsPage />}
                            path="settings/theme"
                          />
                          <Route
                            element={<HomepageSettingsPage />}
                            path="settings/homepage"
                          />

                          {/* Feature-specific Settings Routes - Keep RBAC protection */}
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/settings/appointments">
                                <AppointmentSettingsPage />
                              </RbacProtectedRoute>
                            }
                            path="settings/appointments"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/settings/packages">
                                <PackagesSettingsPage />
                              </RbacProtectedRoute>
                            }
                            path="settings/packages"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/settings/doctor-speciality">
                                <DoctorSpecialityPage />
                              </RbacProtectedRoute>
                            }
                            path="settings/doctor-speciality"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/settings/medical-report-fields">
                                <MedicalReportFieldsPage />
                              </RbacProtectedRoute>
                            }
                            path="settings/medical-report-fields"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/settings/notes-sections">
                                <NotesSectionsPage />
                              </RbacProtectedRoute>
                            }
                            path="settings/notes-sections"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/settings/print-layout">
                                <PrintLayoutPage />
                              </RbacProtectedRoute>
                            }
                            path="settings/print-layout"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/settings/staff">
                                <RbacPage />
                              </RbacProtectedRoute>
                            }
                            path="settings/staff"
                          />

                          {/* Referral Partner Routes nested under settings */}
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/settings/referral-partners">
                                <ReferralPartnersPage />
                              </RbacProtectedRoute>
                            }
                            path="settings/referral-partners"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/settings/referral-partners">
                                <NewReferralPartnerPage />
                              </RbacProtectedRoute>
                            }
                            path="settings/referral-partners/new"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/settings/referral-partners">
                                <NewReferralPartnerPage />
                              </RbacProtectedRoute>
                            }
                            path="settings/referral-partners/:partnerId/edit"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/settings/referral-partners">
                                <ReferralPartnerProfilePage />
                              </RbacProtectedRoute>
                            }
                            path="settings/referral-partners/:partnerId"
                          />

                          {/* System Owner Branch Management Routes */}
                          <Route
                            element={
                              <SystemOwnerRoute>
                                <SystemOwnerDashboard />
                              </SystemOwnerRoute>
                            }
                            path="clinic-overview"
                          />
                          <Route
                            element={
                              <SystemOwnerRoute>
                                <BranchManagementPage />
                              </SystemOwnerRoute>
                            }
                            path="branches"
                          />
                          <Route
                            element={
                              <SystemOwnerRoute>
                                <NewBranchPage />
                              </SystemOwnerRoute>
                            }
                            path="branches/new"
                          />

                          {/* Reports Route */}
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/daily-report">
                                <DailyReportPage />
                              </RbacProtectedRoute>
                            }
                            path="daily-report"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/reports">
                                <ReportsPage />
                              </RbacProtectedRoute>
                            }
                            path="reports"
                          />

                          {/* Text Editor Routes */}
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/text-editor">
                                <TextEditorPage />
                              </RbacProtectedRoute>
                            }
                            path="text-editor"
                          />
                          <Route
                            element={
                              <RbacProtectedRoute pagePath="/dashboard/text-editor">
                                <EditTextDocumentPage />
                              </RbacProtectedRoute>
                            }
                            path="text-editor/:documentId/edit"
                          />

                          {/* Dashboard catch-all route for 404 Not Found */}
                          <Route element={<DashboardNotFoundPage />} path="*" />
                        </Routes>
                      </Suspense>
                    </DashboardLayout>
                  </BasicProtectedRoute>
                </Suspense>
              }
              path="/dashboard/*"
            />

            {/* Catch-all route for 404 Not Found */}
            <Route
              element={
                <DefaultLayout>
                  <Suspense fallback={<LoadingSpinner />}>
                    <NotFoundPage />
                  </Suspense>
                </DefaultLayout>
              }
              path="*"
            />
          </Routes>
        </AuthProviders>
      </Suspense>
    </>
  );
}
