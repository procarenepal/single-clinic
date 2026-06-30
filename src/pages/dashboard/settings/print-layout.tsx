import { useState, useEffect, useRef } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input, Textarea } from "@heroui/input";
import { Button } from "@heroui/button";
import { Switch } from "@heroui/switch";
import { Select, SelectItem } from "@heroui/select";
import { Divider } from "@heroui/divider";
import { Spinner } from "@heroui/spinner";
import {
  IoSaveOutline,
  IoImageOutline,
  IoPrintOutline,
  IoEyeOutline,
  IoArrowBackOutline,
  IoBusinessOutline,
  IoCallOutline,
  IoMailOutline,
  IoGlobeOutline,
  IoTrashOutline,
  IoColorPaletteOutline,
} from "react-icons/io5";
import { useNavigate } from "react-router-dom";
import { addToast } from "@heroui/toast";
import { Progress } from "@heroui/progress";

import { uploadImage } from "@/services/appwriteStorageService";
import { clinicService } from "@/services/clinicService";
import {
  getPrintBrandingCSS,
  getPrintHeaderHTML,
  getPrintFooterHTML,
} from "@/utils/printBranding";
import { useAuthContext } from "@/context/AuthContext";
import { title } from "@/components/primitives";
import {
  PrintLayoutConfig,
  createPrintLayoutConfig,
} from "@/types/printLayout";
import { PrintLayoutTemplate } from "@/components/PrintLayoutTemplate";

export default function PrintLayoutPage() {
  const navigate = useNavigate();
  const { clinicId, currentUser } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [clinic, setClinic] = useState<any>(null); // Store clinic object
  const [isPrinting, setIsPrinting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [zoom, setZoom] = useState(0.85); // Default zoom logic
  const containerRef = useRef<HTMLDivElement>(null);

  const [layoutConfig, setLayoutConfig] = useState<PrintLayoutConfig>(
    createPrintLayoutConfig(clinicId || "", currentUser?.uid || ""),
  );

  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const loadLayoutConfig = async () => {
      if (!clinicId) return;
      try {
        setLoading(true);
        // Always load clinic info
        const clinicObj = await clinicService.getClinicById(clinicId);

        setClinic(clinicObj);
        // Load existing print layout config
        const config = await clinicService.getPrintLayoutConfig(clinicId);

        if (config) {
          setLayoutConfig({
            ...config,
            clinicName: config.clinicName ?? clinicObj?.name ?? "",
            phone: config.phone ?? clinicObj?.phone ?? "",
            email: config.email ?? clinicObj?.email ?? "",
            // Use existing address or provide a clean default
            address: config.address ?? "",
            city: config.city ?? clinicObj?.city ?? "Kathmandu",
            state: config.state ?? "Bagmati",
            zipCode: config.zipCode ?? "44600",
            country: config.country ?? "Nepal",
            logoUrl: config.logoUrl ?? clinicObj?.logo,
          });
        } else if (clinicObj) {
          // New configuration: Compose everything for the user
          const defaultCity = clinicObj.city || "Kathmandu";
          const defaultState = "Bagmati";
          const defaultZip = "44600";

          setLayoutConfig((prev) => ({
            ...prev,
            clinicName: clinicObj.name ?? "",
            city: defaultCity,
            state: defaultState,
            zipCode: defaultZip,
            country: "Nepal",
            phone: clinicObj.phone ?? "",
            email: clinicObj.email ?? "",
            // Compose the full address string for the Studio by default
            address: `${clinicObj.address || "Street Address"}\n${defaultCity}, ${defaultState} ${defaultZip}\nNepal`,
            logoUrl: clinicObj.logo,
          }));
        }
      } catch (error) {
        console.error("Error loading layout config:", error);
        addToast({
          title: "Error",
          description: "Failed to load print layout configuration",
          color: "danger",
        });
      } finally {
        setLoading(false);
      }
    };

    loadLayoutConfig();
  }, [clinicId]);

  const handleSave = async () => {
    if (!clinicId || !currentUser) return;

    try {
      setSaving(true);

      const configData = {
        ...layoutConfig,
        clinicId,
        updatedBy: currentUser.uid,
      };

      await clinicService.savePrintLayoutConfig(configData);

      addToast({
        title: "Success",
        description: "Print layout configuration saved successfully!",
        color: "success",
      });
    } catch (error) {
      console.error("Error saving layout config:", error);
      addToast({
        title: "Error",
        description: "Failed to save print layout configuration",
        color: "danger",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCoordinateChange = (
    elementId:
      | "logo"
      | "clinicName"
      | "tagline"
      | "address"
      | "phone"
      | "email"
      | "website",
    pos: { x: number; y: number },
  ) => {
    setLayoutConfig((prev) => ({
      ...prev,
      [`${elementId}Pos`]: pos,
    }));
  };

  const handleTextChange = (field: string, text: string) => {
    setLayoutConfig((prev) => ({
      ...prev,
      [field]: text,
    }));
  };

  const handleWidthChange = (elementId: string, width: number) => {
    if (elementId === "logo") {
      setLayoutConfig((prev) => ({
        ...prev,
        logoWidth: Math.max(40, width),
      }));
    }
  };

  const handleLogoUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      addToast({
        title: "Invalid File Type",
        description: "Please select a valid image file (JPG, PNG, GIF, SVG)",
        color: "danger",
      });

      return;
    }

    // Validate file size (max 1MB)
    if (file.size > 1 * 1024 * 1024) {
      addToast({
        title: "File Too Large",
        description: "Image size should be less than 1MB",
        color: "danger",
      });

      return;
    }

    try {
      setIsUploading(true);

      // Show uploading toast with more details
      addToast({
        title: "Uploading Logo",
        description: `Uploading ${file.name}...`,
        color: "primary",
      });

      // Upload to Appwrite with optimization (max 800px width for logos)
      const uploadResult = await uploadImage(
        file,
        `clinic-${clinicId}-logo-${Date.now()}`,
        800, // max width
        800, // max height
      );

      // Update layout config with the new URL
      setLayoutConfig((prev) => ({
        ...prev,
        logoUrl: uploadResult.fileUrl,
        logoFileId: uploadResult.fileId, // Store file ID for future deletion if needed
      }));

      addToast({
        title: "Upload Successful!",
        description: `Logo uploaded and optimized. File size: ${(uploadResult.fileSize / 1024).toFixed(1)}KB`,
        color: "success",
      });
    } catch (error) {
      console.error("Error uploading logo:", error);
      addToast({
        title: "Upload Failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to upload logo. Please try again.",
        color: "danger",
      });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const handlePrint = () => {
    if (!layoutConfig) return;
    setIsPrinting(true);

    // Create hidden iframe for printing
    const iframeId = "print-layout-iframe";
    let iframe = document.getElementById(iframeId) as HTMLIFrameElement;

    if (iframe) {
      document.body.removeChild(iframe);
    }

    iframe = document.createElement("iframe");
    iframe.id = iframeId;
    iframe.style.position = "absolute";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;

    if (!doc) {
      setIsPrinting(false);

      return;
    }

    const headerHeight =
      layoutConfig.headerHeight === "compact"
        ? 140
        : layoutConfig.headerHeight === "expanded"
          ? 220
          : 180;

    const primaryColor = layoutConfig.primaryColor || "#0ea5e9";
    const fontSize = layoutConfig.fontSize || "medium";

    const brandingCSS = getPrintBrandingCSS(layoutConfig);
    const headerHTML = getPrintHeaderHTML(layoutConfig, clinic);
    const footerHTML = getPrintFooterHTML(layoutConfig);

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Layout - ${clinic?.name || "Clinic"}</title>
        <style>
          @page { margin: 0; size: A4; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            height: 100%;
            width: 210mm;
            background: white;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            overflow: hidden !important;
          }
          .print-container {
            width: 210mm;
            height: 100%;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            position: relative;
            background: white;
          }
          
          ${brandingCSS}

          .content-area {
            flex: 1;
            padding: 20mm 15mm;
          }
          .placeholder-box {
            padding: 60px;
            border: 2px dashed #e5e7eb;
            border-radius: 16px;
            text-align: center;
            color: #cbd5e1;
          }
        </style>
      </head>
      <body>
        <div class="print-container">
          ${headerHTML}

          <div class="content-area">
            <div class="placeholder-box">
              <h2 style="margin: 0 0 12px 0; color: #94a3b8; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.01em;">Document Content Area</h2>
              <p style="margin: 4px 0; font-size: 13px;">This represents where your clinical findings, prescriptions,</p>
              <p style="margin: 4px 0; font-size: 13px;">and pathology reports will be rendered automatically.</p>
            </div>
          </div>

          ${footerHTML}
        </div>
      </body>
      </html>
    `;

    doc.open();
    doc.write(printHtml);
    doc.close();

    // Small delay to ensure styles and fonts are loaded (especially for Inter)
    setTimeout(() => {
      if (iframe.contentWindow) {
        // Setup cleanup listeners BEFORE calling print()
        const handleAfterPrint = () => {
          setIsPrinting(false);
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
          window.removeEventListener("focus", handleAfterPrint);
        };

        // Listen for the dialog closing (either Print or Cancel)
        iframe.contentWindow.addEventListener("afterprint", handleAfterPrint);
        window.addEventListener("focus", handleAfterPrint, { once: true });

        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }
    }, 1000);
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Button
            isIconOnly
            variant="flat"
            onPress={() => navigate("/dashboard/settings")}
          >
            <IoArrowBackOutline />
          </Button>
          <div>
            <h1 className={title({ size: "lg" })}>
              Print Layout Configuration
            </h1>
            <p className="text-default-500 mt-1">Loading configuration...</p>
          </div>
        </div>
        <Card>
          <CardBody className="flex items-center justify-center py-12">
            <Spinner label="Loading layout configuration..." size="lg" />
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <Button
              isIconOnly
              variant="flat"
              onPress={() => navigate("/dashboard/settings")}
            >
              <IoArrowBackOutline />
            </Button>
            <div>
              <h1 className={title({ size: "lg" })}>
                Print Layout Configuration
              </h1>
              <p className="text-default-500 mt-1">
                Configure clinic letterhead and layout for all printable
                documents
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              color="secondary"
              startContent={<IoEyeOutline />}
              variant="bordered"
              onPress={() => setPreviewMode(!previewMode)}
            >
              {previewMode ? "Edit Configuration" : "Preview Mode"}
            </Button>
            {!previewMode && (
              <Button
                color="default"
                isDisabled={isPrinting}
                isLoading={isPrinting}
                startContent={<IoPrintOutline />}
                variant="bordered"
                onPress={handlePrint}
              >
                {isPrinting ? "Printing..." : "Print Layout"}
              </Button>
            )}
            <Button
              color="primary"
              isDisabled={saving}
              isLoading={saving}
              startContent={<IoSaveOutline />}
              onPress={handleSave}
            >
              {saving ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Preview Mode Info - Show when in preview mode */}
          {previewMode && (
            <div className="lg:col-span-2">
              <Card className="border-l-4 border-l-primary">
                <CardBody className="py-4">
                  <div className="flex items-center gap-3">
                    <IoEyeOutline className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium text-primary">
                        Preview Mode Active
                      </p>
                      <p className="text-sm text-default-500">
                        You're viewing the print layout preview. Click "Edit" to
                        modify the configuration or "Print" to test the layout.
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {/* Configuration Form - Hide in preview mode */}
          {!previewMode && (
            <div className="space-y-6">
              {/* Clinic Information */}
              <Card>
                <CardHeader className="bg-default-50 border-b border-default-200">
                  <div className="flex items-center gap-2">
                    <IoBusinessOutline className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold">
                      Clinic Information
                    </h3>
                  </div>
                </CardHeader>
                <CardBody className="space-y-4">
                  <Input
                    description={
                      clinic?.name
                        ? `Default: ${clinic.name}`
                        : "You can override the clinic name for printing"
                    }
                    label="Clinic Name"
                    placeholder="Clinic name to show on print"
                    value={layoutConfig.clinicName || ""}
                    onChange={(e) =>
                      setLayoutConfig((prev) => ({
                        ...prev,
                        clinicName: e.target.value,
                      }))
                    }
                  />

                  <Input
                    label="Tagline"
                    placeholder="Your clinic's tagline or motto"
                    value={layoutConfig.tagline || ""}
                    onChange={(e) =>
                      setLayoutConfig((prev) => ({
                        ...prev,
                        tagline: e.target.value,
                      }))
                    }
                  />

                  <Textarea
                    isRequired
                    label="Address *"
                    minRows={2}
                    placeholder="Enter full address"
                    value={layoutConfig.address}
                    onChange={(e) =>
                      setLayoutConfig((prev) => ({
                        ...prev,
                        address: e.target.value,
                      }))
                    }
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      description="You can override the city from clinic profile"
                      label="City (from clinic profile)"
                      placeholder="Loaded from clinic profile"
                      value={layoutConfig.city}
                      onChange={(e) =>
                        setLayoutConfig((prev) => ({
                          ...prev,
                          city: e.target.value,
                        }))
                      }
                    />
                    <Input
                      label="State/Province"
                      placeholder="State"
                      value={layoutConfig.state}
                      onChange={(e) =>
                        setLayoutConfig((prev) => ({
                          ...prev,
                          state: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="ZIP/Postal Code"
                      placeholder="ZIP Code"
                      value={layoutConfig.zipCode}
                      onChange={(e) =>
                        setLayoutConfig((prev) => ({
                          ...prev,
                          zipCode: e.target.value,
                        }))
                      }
                    />
                    <Input
                      label="Country"
                      placeholder="Country"
                      value={layoutConfig.country}
                      onChange={(e) =>
                        setLayoutConfig((prev) => ({
                          ...prev,
                          country: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      description={
                        clinic?.phone
                          ? `Default: ${clinic.phone}`
                          : "You can override the phone from clinic profile"
                      }
                      label="Phone (from clinic profile)"
                      placeholder={
                        clinic?.phone || "Loaded from clinic profile"
                      }
                      startContent={
                        <IoCallOutline className="text-default-400" />
                      }
                      value={
                        layoutConfig.phone !== ""
                          ? layoutConfig.phone
                          : clinic?.phone || ""
                      }
                      onChange={(e) =>
                        setLayoutConfig((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                    />
                    <Input
                      description={
                        clinic?.email
                          ? `Default: ${clinic.email}`
                          : "You can override the email from clinic profile"
                      }
                      label="Email (from clinic profile)"
                      placeholder={
                        clinic?.email || "Loaded from clinic profile"
                      }
                      startContent={
                        <IoMailOutline className="text-default-400" />
                      }
                      type="email"
                      value={
                        layoutConfig.email !== ""
                          ? layoutConfig.email
                          : clinic?.email || ""
                      }
                      onChange={(e) =>
                        setLayoutConfig((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <Input
                    label="Website"
                    placeholder="https://www.yourclinic.com"
                    startContent={
                      <IoGlobeOutline className="text-default-400" />
                    }
                    value={layoutConfig.website || ""}
                    onChange={(e) =>
                      setLayoutConfig((prev) => ({
                        ...prev,
                        website: e.target.value,
                      }))
                    }
                  />
                </CardBody>
              </Card>

              {/* Typography & Colors */}
              <Card>
                <CardHeader className="bg-default-50 border-b border-default-200">
                  <div className="flex items-center gap-2">
                    <IoColorPaletteOutline className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold">
                      Typography & Colors
                    </h3>
                  </div>
                </CardHeader>
                <CardBody className="space-y-4">
                  <Select
                    label="Font Family"
                    selectedKeys={
                      layoutConfig.fontFamily
                        ? [layoutConfig.fontFamily]
                        : ["'Inter', sans-serif"]
                    }
                    onSelectionChange={(keys) => {
                      const font = Array.from(keys)[0] as string;

                      setLayoutConfig((prev) => ({
                        ...prev,
                        fontFamily: font,
                      }));
                    }}
                  >
                    <SelectItem key="'Inter', sans-serif">
                      Inter (Modern)
                    </SelectItem>
                    <SelectItem key="'Nunito', sans-serif">
                      Nunito (Friendly)
                    </SelectItem>
                    <SelectItem key="'Plus Jakarta Sans', sans-serif">
                      Jakarta Sans (Tech)
                    </SelectItem>
                    <SelectItem key="'Roboto', sans-serif">
                      Roboto (Classic)
                    </SelectItem>
                    <SelectItem key="'Outfit', sans-serif">
                      Outfit (Premium)
                    </SelectItem>
                    <SelectItem key="Arial, sans-serif">Arial</SelectItem>
                    <SelectItem key="'Times New Roman', serif">
                      Times New Roman
                    </SelectItem>
                  </Select>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Title Color"
                      type="color"
                      value={layoutConfig.titleColor || "#1e293b"}
                      onChange={(e) =>
                        setLayoutConfig((prev) => ({
                          ...prev,
                          titleColor: e.target.value,
                        }))
                      }
                    />
                    <Input
                      label="Text/Label Color"
                      type="color"
                      value={layoutConfig.textColor || "#475569"}
                      onChange={(e) =>
                        setLayoutConfig((prev) => ({
                          ...prev,
                          textColor: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Brand Primary Color"
                      type="color"
                      value={layoutConfig.primaryColor || "#0ea5e9"}
                      onChange={(e) =>
                        setLayoutConfig((prev) => ({
                          ...prev,
                          primaryColor: e.target.value,
                        }))
                      }
                    />
                    <Input
                      label="Content Font Size (px)"
                      max={18}
                      min={8}
                      type="number"
                      value={layoutConfig.contentFontSize?.toString() || "12"}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);

                        setLayoutConfig((prev) => ({
                          ...prev,
                          contentFontSize: isNaN(val) ? 12 : val,
                        }));
                      }}
                    />
                  </div>
                </CardBody>
              </Card>

              {/* Logo and Branding */}
              <Card>
                <CardHeader className="bg-default-50 border-b border-default-200">
                  <div className="flex items-center gap-2">
                    <IoImageOutline className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold">Logo & Branding</h3>
                  </div>
                </CardHeader>
                <CardBody className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-default-700 mb-2">
                      Upload Logo
                    </label>
                    <div className="space-y-3">
                      {/* File Drop Zone */}
                      <div
                        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                          isUploading
                            ? "border-primary bg-primary/5 opacity-50"
                            : "border-default-300 hover:border-default-400 cursor-pointer"
                        }`}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                            const file = e.dataTransfer.files[0];

                            if (file.type.startsWith("image/")) {
                              // Create a synthetic event-like object
                              const fileList = { 0: file, length: 1 };
                              const syntheticEvent = {
                                target: { files: fileList },
                              };

                              handleLogoUpload(syntheticEvent as any);
                            } else {
                              addToast({
                                title: "Invalid File Type",
                                description: "Please drop a valid image file",
                                color: "danger",
                              });
                            }
                          }
                        }}
                      >
                        <IoImageOutline className="w-10 h-10 mx-auto mb-3 text-default-400" />
                        <p className="text-default-600 mb-2">
                          Drag & drop a logo here, or click to select
                        </p>
                        <p className="text-xs text-default-500 mb-3">
                          Supports: JPG, PNG, GIF, SVG (Max 1MB)
                        </p>
                        <input
                          accept="image/*"
                          className="hidden"
                          disabled={isUploading}
                          id="logo-upload"
                          type="file"
                          onChange={handleLogoUpload}
                        />
                        <Button
                          as="label"
                          className="cursor-pointer"
                          color="primary"
                          htmlFor="logo-upload"
                          isDisabled={isUploading}
                          size="sm"
                          variant="flat"
                          onPress={() => document.getElementById("logo-upload")?.click()}
                        >
                          {isUploading ? "Uploading..." : "Choose Logo"}
                        </Button>
                      </div>

                      {isUploading && (
                        <div className="bg-default-100 rounded-lg p-4">
                          <div className="flex items-center gap-2 text-sm text-default-600 mb-2">
                            <Spinner size="sm" />
                            <span>Uploading logo...</span>
                          </div>
                          <Progress
                            isIndeterminate
                            className="mb-2"
                            color="primary"
                            value={85}
                          />
                          <p className="text-xs text-default-500">
                            Your logo will be optimized and stored securely
                          </p>
                        </div>
                      )}

                      {layoutConfig.logoUrl && !isUploading && (
                        <div className="bg-success-50 border border-success-200 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <img
                              alt="Logo preview"
                              className="h-16 w-auto object-contain bg-white border border-default-200 rounded-lg p-2 flex-shrink-0"
                              src={layoutConfig.logoUrl}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-success-800 mb-1">
                                ✅ Logo uploaded successfully
                              </p>
                              <p className="text-xs text-success-600 mb-2">
                                Stored securely in cloud storage
                              </p>
                              <div className="flex gap-2">
                                <Button
                                  color="primary"
                                  size="sm"
                                  startContent={
                                    <IoEyeOutline className="w-3 h-3" />
                                  }
                                  variant="flat"
                                  onClick={() =>
                                    window.open(layoutConfig.logoUrl, "_blank")
                                  }
                                >
                                  View
                                </Button>
                                <Button
                                  color="danger"
                                  size="sm"
                                  startContent={
                                    <IoTrashOutline className="w-3 h-3" />
                                  }
                                  variant="flat"
                                  onClick={() => {
                                    setLayoutConfig((prev) => ({
                                      ...prev,
                                      logoUrl: undefined,
                                    }));
                                    addToast({
                                      title: "Logo removed",
                                      description:
                                        "Logo removed from layout. Don't forget to save changes.",
                                      color: "warning",
                                    });
                                  }}
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Select
                      label="Logo Position"
                      selectedKeys={[layoutConfig.logoPosition]}
                      onSelectionChange={(keys) => {
                        const position = Array.from(keys)[0] as
                          | "left"
                          | "center"
                          | "right";

                        setLayoutConfig((prev) => ({
                          ...prev,
                          logoPosition: position,
                        }));
                      }}
                    >
                      <SelectItem key="left">Left</SelectItem>
                      <SelectItem key="center">Center</SelectItem>
                      <SelectItem key="right">Right</SelectItem>
                    </Select>

                    <Select
                      label="Logo Size"
                      selectedKeys={[layoutConfig.logoSize]}
                      onSelectionChange={(keys) => {
                        const size = Array.from(keys)[0] as
                          | "small"
                          | "medium"
                          | "large";

                        const width =
                          size === "small" ? 60 : size === "large" ? 140 : 100;

                        setLayoutConfig((prev) => ({
                          ...prev,
                          logoSize: size,
                          logoWidth: width,
                        }));
                      }}
                    >
                      <SelectItem key="small">Small</SelectItem>
                      <SelectItem key="medium">Medium</SelectItem>
                      <SelectItem key="large">Large</SelectItem>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Primary Color"
                      type="color"
                      value={layoutConfig.primaryColor}
                      onChange={(e) =>
                        setLayoutConfig((prev) => ({
                          ...prev,
                          primaryColor: e.target.value,
                        }))
                      }
                    />
                    <Input
                      label="Secondary Color"
                      type="color"
                      value={layoutConfig.secondaryColor}
                      onChange={(e) =>
                        setLayoutConfig((prev) => ({
                          ...prev,
                          secondaryColor: e.target.value,
                        }))
                      }
                    />
                  </div>
                </CardBody>
              </Card>

              {/* Layout Settings */}
              <Card>
                <CardHeader className="bg-default-50 border-b border-default-200">
                  <div className="flex items-center gap-2">
                    <IoPrintOutline className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold">Layout Settings</h3>
                  </div>
                </CardHeader>
                <CardBody className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Show Footer</p>
                        <p className="text-sm text-default-500">
                          Display footer information on printed documents
                        </p>
                      </div>
                      <Switch
                        isSelected={layoutConfig.showFooter}
                        onValueChange={(value) =>
                          setLayoutConfig((prev) => ({
                            ...prev,
                            showFooter: value,
                          }))
                        }
                      />
                    </div>

                    {layoutConfig.showFooter && (
                      <Textarea
                        label="Footer Text"
                        minRows={2}
                        placeholder="Enter footer text (e.g., Thank you for choosing our clinic)"
                        value={layoutConfig.footerText || ""}
                        onChange={(e) =>
                          setLayoutConfig((prev) => ({
                            ...prev,
                            footerText: e.target.value,
                          }))
                        }
                      />
                    )}
                  </div>

                  <Divider />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            Default: print pathology reports without letterhead
                          </p>
                          <p className="text-xs text-default-500">
                            When enabled, pathology reports will skip the
                            header/footer and use the top margin below.
                          </p>
                        </div>
                        <Switch
                          isSelected={
                            layoutConfig.defaultPathologyPrintWithoutLetterhead ??
                            false
                          }
                          size="sm"
                          onValueChange={(value) =>
                            setLayoutConfig((prev) => ({
                              ...prev,
                              defaultPathologyPrintWithoutLetterhead: value,
                            }))
                          }
                        />
                      </div>
                    </div>

                    <Input
                      description="Used when printing without letterhead (e.g., onto preprinted paper)."
                      label="Top margin for preprinted letterhead (mm)"
                      type="number"
                      value={
                        layoutConfig.contentTopMarginWithoutLetterheadMm !==
                        undefined
                          ? layoutConfig.contentTopMarginWithoutLetterheadMm.toString()
                          : "20"
                      }
                      onChange={(e) => {
                        const value = parseFloat(e.target.value);

                        setLayoutConfig((prev) => ({
                          ...prev,
                          contentTopMarginWithoutLetterheadMm: Number.isNaN(
                            value,
                          )
                            ? undefined
                            : Math.max(value, 0),
                        }));
                      }}
                    />
                  </div>
                </CardBody>
              </Card>

              {/* Printer & Paper Settings */}
              <Card>
                <CardHeader className="bg-default-50 border-b border-default-200">
                  <div className="flex items-center gap-2">
                    <IoPrintOutline className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold">
                      Printer & Paper Settings
                    </h3>
                  </div>
                </CardHeader>
                <CardBody className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Select
                      label="Default Format"
                      selectedKeys={[layoutConfig.defaultPrintFormat || "A4"]}
                      onSelectionChange={(keys) => {
                        const format = Array.from(keys)[0] as string;

                        setLayoutConfig((prev) => ({
                          ...prev,
                          defaultPrintFormat: format,
                        }));
                      }}
                    >
                      <SelectItem key="A4">A4 Full Page</SelectItem>
                      <SelectItem key="A4_HALF">A4 Half (A5)</SelectItem>
                      <SelectItem key="THERMAL_80MM">Thermal 80mm</SelectItem>
                      <SelectItem key="THERMAL_58MM">Thermal 58mm</SelectItem>
                      <SelectItem key="THERMAL_4INCH">
                        Label (4-inch)
                      </SelectItem>
                    </Select>

                    <Select
                      label="Standard Paper Size"
                      selectedKeys={[layoutConfig.paperSize]}
                      onSelectionChange={(keys) => {
                        const size = Array.from(keys)[0] as
                          | "A4"
                          | "Letter"
                          | "A5";

                        setLayoutConfig((prev) => ({
                          ...prev,
                          paperSize: size,
                        }));
                      }}
                    >
                      <SelectItem key="A4">A4 (210 x 297 mm)</SelectItem>
                      <SelectItem key="A5">A5 (148 x 210 mm)</SelectItem>
                      <SelectItem key="Letter">US Letter</SelectItem>
                    </Select>
                  </div>

                  <div className="bg-default-50 p-3 rounded-lg border border-default-200">
                    <p className="text-sm font-medium mb-2">
                      Thermal Printer Configuration
                    </p>
                    <div className="grid grid-cols-1 gap-4">
                      <Input
                        description="Specify your thermal printer's paper width in millimeters. Standard is 80 or 58."
                        label="Thermal Paper Width (mm)"
                        placeholder="80"
                        type="number"
                        value={
                          layoutConfig.thermalPaperWidthMm?.toString() || "80"
                        }
                        onChange={(e) => {
                          const val = parseInt(e.target.value);

                          setLayoutConfig((prev) => ({
                            ...prev,
                            thermalPaperWidthMm: isNaN(val) ? 80 : val,
                          }));
                        }}
                      />
                    </div>
                  </div>
                </CardBody>
              </Card>
            </div>
          )}

          {/* Preview - Full width in preview mode */}
          <div
            className={`lg:sticky lg:top-6 ${previewMode ? "lg:col-span-2" : ""}`}
          >
            <Card>
              <CardHeader className="bg-default-50 border-b border-default-200">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <IoEyeOutline className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold whitespace-nowrap">
                      Print Layout Preview
                    </h3>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      <Button
                        isIconOnly
                        className="h-7 w-7 min-w-0"
                        size="sm"
                        variant="light"
                        onPress={() =>
                          setZoom((prev) => Math.max(0.4, prev - 0.1))
                        }
                      >
                        -
                      </Button>
                      <span className="text-[10px] font-bold text-slate-500 w-12 text-center">
                        {Math.round(zoom * 100)}%
                      </span>
                      <Button
                        isIconOnly
                        className="h-7 w-7 min-w-0"
                        size="sm"
                        variant="light"
                        onPress={() =>
                          setZoom((prev) => Math.min(1.5, prev + 0.1))
                        }
                      >
                        +
                      </Button>
                    </div>

                    {previewMode && (
                      <div className="flex gap-2">
                        <Button
                          color="default"
                          isDisabled={isPrinting}
                          isLoading={isPrinting}
                          size="sm"
                          startContent={<IoPrintOutline />}
                          variant="flat"
                          onPress={handlePrint}
                        >
                          {isPrinting ? "Printing..." : "Print"}
                        </Button>
                        <Button
                          color="primary"
                          size="sm"
                          startContent={<IoEyeOutline />}
                          variant="flat"
                          onPress={() => setPreviewMode(false)}
                        >
                          Edit
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardBody className="p-0 overflow-auto bg-slate-50 flex justify-center">
                <div
                  ref={containerRef}
                  className="relative p-10 transition-all duration-300 origin-top"
                  style={{
                    transform: `scale(${zoom})`,
                  }}
                >
                  <PrintLayoutTemplate
                    className="min-h-[842px] print-preview shadow-2xl"
                    isDesignMode={!previewMode}
                    layoutConfig={layoutConfig}
                    selectedElementId={selectedElementId}
                    showInPrint={false}
                    zoom={zoom}
                    onCoordinateChange={handleCoordinateChange}
                    onElementClick={setSelectedElementId}
                    onTextChange={handleTextChange}
                    onWidthChange={handleWidthChange}
                  >
                    {/* Sample Content - This will take up the remaining space */}
                    <div className="flex-1 flex items-center justify-center p-10">
                      <div className="text-center w-full max-w-md">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-slate-200">
                          <IoBusinessOutline className="w-8 h-8 text-slate-300" />
                        </div>
                        <h2 className="text-stat-sm font-bold text-slate-400 mb-2 uppercase tracking-tight">
                          Document Content Area
                        </h2>
                        <div className="h-0.5 w-12 bg-slate-100 mx-auto mb-4" />
                        <p className="text-sm text-slate-400 leading-relaxed">
                          This area represents where your clinical findings,
                          prescriptions, and reports will be rendered. The
                          header and footer above are what you are currently
                          customizing.
                        </p>
                      </div>
                    </div>
                  </PrintLayoutTemplate>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
