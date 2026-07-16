import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { PrintLayoutConfig } from "@/types/printLayout";

const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Nunito:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Roboto:wght@400;500;700&family=Outfit:wght@400;600;700&display=swap";

const SNAP_GRID = 5;
const snapToGrid = (val: number) => Math.round(val / SNAP_GRID) * SNAP_GRID;

interface PrintLayoutTemplateProps {
  layoutConfig: PrintLayoutConfig;
  clinicName?: string;
  documentTitle?: string;
  documentSubtitle?: string;
  documentNumber?: string;
  documentDate?: string;
  children: React.ReactNode;
  showInPrint?: boolean;
  className?: string;
  isDesignMode?: boolean;
  selectedElementId?: string | null;
  onElementClick?: (elementId: string) => void;
  onTextChange?: (field: string, text: string) => void;
  zoom?: number;
  onCoordinateChange?: (
    elementId: string,
    pos: { x: number; y: number },
  ) => void;
  onWidthChange?: (elementId: string, width: number) => void;
}

const getFieldStyle = (
  layoutConfig: PrintLayoutConfig,
  field: string,
  defaults: React.CSSProperties = {},
): React.CSSProperties => ({
  ...defaults,
  color:
    (layoutConfig.fieldColors?.[field] as string) ||
    (defaults.color as string) ||
    "inherit",
  fontSize: layoutConfig.fieldSizes?.[field]
    ? `${layoutConfig.fieldSizes[field]}px`
    : (defaults.fontSize as string),
  fontFamily:
    layoutConfig.fontFamily || (defaults.fontFamily as string) || "inherit",
  fontWeight: layoutConfig.boldFields?.includes(field)
    ? "bold"
    : (defaults.fontWeight as string | number),
  textAlign:
    (layoutConfig.fieldAlignments?.[field] as any) ||
    (defaults.textAlign as any) ||
    "center",
});

const DesignHandle: React.FC<{
  elementId: string;
  selectedElementId?: string | null;
  isDesignMode: boolean;
  label: string;
  x: number;
  y: number;
  onElementClick?: (id: string) => void;
  onDragEnd?: (info: { offset: { x: number; y: number } }) => void;
  onResize?: (width: number) => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  showResizeHandle?: boolean;
  currentZoom?: number;
}> = ({
  elementId,
  selectedElementId,
  isDesignMode,
  label,
  x,
  y,
  onElementClick,
  onDragEnd,
  onResize,
  children,
  className = "",
  style = {},
  showResizeHandle = false,
  currentZoom = 1,
}) => {
  const isSelected = selectedElementId === elementId;
  const [isHovered, setIsHovered] = useState(false);
  const startWidthRef = useRef(0);

  return (
    <motion.div
      className={`group ${isDesignMode ? "cursor-move" : ""} ${className}`}
      drag={isDesignMode}
      dragElastic={0}
      dragMomentum={false}
      style={{ x, y, ...style }}
      onClick={(e) => {
        if (!isDesignMode) return;
        e.stopPropagation();
        onElementClick?.(elementId);
      }}
      onDragEnd={(_, info) => {
        if (!isDesignMode || !onDragEnd) return;
        onDragEnd(info);
      }}
      onHoverEnd={() => setIsHovered(false)}
      onHoverStart={() => setIsHovered(true)}
    >
      <AnimatePresence>
        {isDesignMode && (
          <motion.div
            animate={{ opacity: 1 }}
            className={`absolute -inset-2 rounded-lg pointer-events-none transition-all ${
              isSelected
                ? "border-2 border-primary bg-primary/5 shadow-lg"
                : isHovered
                  ? "border border-dashed border-primary/40 bg-primary/2"
                  : "border border-dashed border-slate-200/50"
            }`}
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
          >
            {isSelected && (
              <div className="absolute -top-7 left-0 bg-primary text-white text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider z-[100]">
                {label}
              </div>
            )}
            {showResizeHandle && (
              <motion.div
                className="absolute -bottom-2 -right-2 w-6 h-6 bg-primary rounded-full cursor-nwse-resize shadow-lg z-[200] border-2 border-white flex items-center justify-center hover:bg-primary-600 transition-colors"
                drag="x"
                dragMomentum={false}
                whileDrag={{ scale: 1.5 }}
                onDrag={(_, info) => {
                  const delta = info.offset.x / currentZoom;

                  onResize?.(startWidthRef.current + delta);
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  startWidthRef.current = (style.width as number) || 80;
                }}
              >
                <div className="w-2 h-2 bg-white rounded-full" />
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </motion.div>
  );
};

export const PrintLayoutTemplate: React.FC<PrintLayoutTemplateProps> = ({
  layoutConfig,
  clinicName,
  documentTitle,
  documentSubtitle,
  documentNumber,
  documentDate,
  children,
  showInPrint = false,
  className = "",
  isDesignMode = false,
  selectedElementId,
  onElementClick,
  onTextChange,
  onCoordinateChange,
  onWidthChange,
  zoom = 1,
}) => {
  // Inject Google Fonts <link> into the document head so the live preview
  // renders the same font as the actual print output.
  useEffect(() => {
    const id = "print-layout-google-fonts";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = GOOGLE_FONTS_URL;
      document.head.appendChild(link);
    }
  }, []);

  const isEditable = !showInPrint && !!onTextChange;

  const logoX = layoutConfig.logoPos?.x || 0;
  const logoY = layoutConfig.logoPos?.y || 0;

  const logoBaseWidth =
    layoutConfig.logoSize === "small"
      ? 60
      : layoutConfig.logoSize === "large"
        ? 140
        : 100;

  const currentLogoWidth = layoutConfig.logoWidth || logoBaseWidth;

  // Use fresh coordinate IDs for clinical info to reset any "off-center" drags
  const clinicNameX = layoutConfig.clinicNamePos?.x || 0;
  const clinicNameY = layoutConfig.clinicNamePos?.y || 0;
  const taglineX = layoutConfig.taglinePos?.x || 0;
  const taglineY = layoutConfig.taglinePos?.y || 0;
  const addressX = layoutConfig.addressPos?.x || 0;
  const addressY = layoutConfig.addressPos?.y || 0;
  const contactsX = layoutConfig.phonePos?.x || 0;
  const contactsY = layoutConfig.phonePos?.y || 0;
  const websiteX = layoutConfig.websitePos?.x || 0;
  const websiteY = layoutConfig.websitePos?.y || 0;

  const headerHeight =
    layoutConfig.headerHeight === "compact"
      ? 140
      : layoutConfig.headerHeight === "expanded"
        ? 220
        : 180;

  const clinicNameStyle = getFieldStyle(layoutConfig, "clinicName", {
    fontSize:
      layoutConfig.fontSize === "small"
        ? "18px"
        : layoutConfig.fontSize === "large"
          ? "26px"
          : "22px",
    fontWeight: "800",
    color: layoutConfig.titleColor || layoutConfig.primaryColor || "#1e3a8a",
    lineHeight: "1.1",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    textAlign: "center",
    fontFamily: layoutConfig.fontFamily || "'Inter', sans-serif",
  });

  const baseFontSize = layoutConfig.contentFontSize || 11;
  const fontFamily = layoutConfig.fontFamily || "'Inter', sans-serif";

  const taglineStyle = getFieldStyle(layoutConfig, "tagline", {
    fontSize: `${baseFontSize}px`,
    fontWeight: "700",
    color: layoutConfig.textColor || "#64748b",
    letterSpacing: "0.15em",
    fontFamily,
  });

  const addressStyle = getFieldStyle(layoutConfig, "address", {
    fontSize: `${baseFontSize}px`,
    lineHeight: "1.4",
    color: layoutConfig.textColor || "#475569",
    textAlign: "center" as any,
    fontFamily,
  });

  return (
    <div
      className={`bg-white shadow-2xl mx-auto overflow-hidden flex flex-col ${className}`}
      style={{ width: "210mm", minHeight: "297mm", position: "relative" }}
    >
      <div
        className="relative flex-shrink-0 border-b border-gray-100"
        style={{ height: `${headerHeight}px`, background: "#fff" }}
      >
        {/* LOGO (High Priority Interaction) */}
        {layoutConfig.logoUrl && (
          <DesignHandle
            className="absolute z-[100]"
            currentZoom={zoom}
            elementId="logo"
            isDesignMode={isDesignMode}
            label="Logo"
            selectedElementId={selectedElementId}
            showResizeHandle={true}
            style={{
              left:
                layoutConfig.logoPosition === "left"
                  ? "40px"
                  : layoutConfig.logoPosition === "right"
                    ? "auto"
                    : "50%",
              right: layoutConfig.logoPosition === "right" ? "40px" : "auto",
              top: "20px",
              marginLeft:
                layoutConfig.logoPosition === "center"
                  ? `-${currentLogoWidth / 2}px`
                  : "0px",
              cursor: isDesignMode ? "move" : "default",
              pointerEvents: "auto",
              width: currentLogoWidth,
            }}
            x={logoX}
            y={logoY}
            onDragEnd={(info) =>
              onCoordinateChange?.("logo", {
                x: snapToGrid(logoX + info.offset.x),
                y: snapToGrid(logoY + info.offset.y),
              })
            }
            onElementClick={onElementClick}
            onResize={(newWidth) =>
              onWidthChange?.("logo", Math.round(newWidth))
            }
          >
            <motion.img
              draggable={false} // Prevent native dragging
              src={layoutConfig.logoUrl}
              style={{ width: "100%", height: "auto" }}
              whileHover={isDesignMode ? { scale: 1.02 } : {}}
              whileTap={isDesignMode ? { scale: 0.98, cursor: "grabbing" } : {}}
            />
          </DesignHandle>
        )}

        {/* IDENTITY STACK (Perfectly Centered) */}
        <div
          className="flex flex-col items-center justify-center h-full px-20"
          style={{ gap: "6px" }}
        >
          {/* 1. Clinic Name */}
          <DesignHandle
            elementId="clinic_name_pos"
            isDesignMode={isDesignMode}
            label="Clinic Name"
            selectedElementId={selectedElementId}
            style={{ position: "relative", zIndex: 30 }}
            x={clinicNameX}
            y={0}
            onDragEnd={(info) =>
              onCoordinateChange?.("clinicName", {
                x: snapToGrid(clinicNameX + info.offset.x),
                y: 0,
              })
            }
            onElementClick={onElementClick}
          >
            <h1
              suppressContentEditableWarning
              contentEditable={isEditable}
              style={{ ...clinicNameStyle, textAlign: "center" }}
              onBlur={(e) =>
                onTextChange?.("clinicName", e.currentTarget.textContent || "")
              }
            >
              {clinicName || layoutConfig.clinicName}
            </h1>
          </DesignHandle>

          {/* 2. Tagline */}
          {layoutConfig.tagline && (
            <DesignHandle
              elementId="tagline_pos"
              isDesignMode={isDesignMode}
              label="Tagline"
              selectedElementId={selectedElementId}
              style={{ position: "relative", zIndex: 29, marginTop: "4px" }}
              x={taglineX}
              y={0}
              onDragEnd={(info) =>
                onCoordinateChange?.("tagline", {
                  x: snapToGrid(taglineX + info.offset.x),
                  y: 0,
                })
              }
              onElementClick={onElementClick}
            >
              <p
                suppressContentEditableWarning
                contentEditable={isEditable}
                style={{ ...taglineStyle, textAlign: "center" }}
                onBlur={(e) =>
                  onTextChange?.("tagline", e.currentTarget.textContent || "")
                }
              >
                {layoutConfig.tagline}
              </p>
            </DesignHandle>
          )}

          {/* 3. Address */}
          <DesignHandle
            elementId="address_pos"
            isDesignMode={isDesignMode}
            label="Address"
            selectedElementId={selectedElementId}
            style={{ position: "relative", zIndex: 28, marginTop: "12px" }}
            x={addressX}
            y={0}
            onDragEnd={(info) =>
              onCoordinateChange?.("address", {
                x: snapToGrid(addressX + info.offset.x),
                y: 0,
              })
            }
            onElementClick={onElementClick}
          >
            <div className="flex flex-col items-center text-center">
              <div
                suppressContentEditableWarning
                contentEditable={isEditable}
                style={{
                  ...addressStyle,
                  textAlign: "center",
                  whiteSpace: "pre-wrap",
                }}
                onBlur={(e) =>
                  onTextChange?.("address", e.currentTarget.textContent || "")
                }
              >
                {layoutConfig.address}
              </div>
            </div>
          </DesignHandle>

          {/* 4. Contacts (Phone/Email) - Fresh ID to force horizontal center */}
          <DesignHandle
            elementId="contacts_pos"
            isDesignMode={isDesignMode}
            label="Contacts"
            selectedElementId={selectedElementId}
            style={{
              position: "relative",
              zIndex: 26,
              width: "100%",
              display: "flex",
              justifyContent: "center",
              marginTop: "16px",
            }}
            x={contactsX}
            y={0}
            onDragEnd={(info) =>
              onCoordinateChange?.("phone", {
                x: snapToGrid(contactsX + info.offset.x),
                y: 0,
              })
            }
            onElementClick={onElementClick}
          >
            <div className="flex items-center gap-6 pt-4 border-t border-gray-100 max-w-md w-full justify-center">
              {layoutConfig.phone && (
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: `${Math.max(baseFontSize - 1, 9)}px`, fontFamily, fontWeight: "bold", color: layoutConfig.textColor || "#94a3b8" }} className="lowercase">
                    phone:
                  </span>
                  <span
                    suppressContentEditableWarning
                    contentEditable={isEditable}
                    style={{ fontSize: `${baseFontSize}px`, fontFamily, fontWeight: "bold", color: layoutConfig.titleColor || "#475569" }}
                    onBlur={(e) =>
                      onTextChange?.("phone", e.currentTarget.textContent || "")
                    }
                  >
                    {layoutConfig.phone}
                  </span>
                </div>
              )}
              {layoutConfig.email && (
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: `${Math.max(baseFontSize - 1, 9)}px`, fontFamily, fontWeight: "bold", color: layoutConfig.textColor || "#94a3b8" }} className="lowercase">
                    email:
                  </span>
                  <span
                    suppressContentEditableWarning
                    contentEditable={isEditable}
                    style={{ fontSize: `${baseFontSize}px`, fontFamily, fontWeight: "bold", color: layoutConfig.titleColor || "#475569" }}
                    onBlur={(e) =>
                      onTextChange?.("email", e.currentTarget.textContent || "")
                    }
                  >
                    {layoutConfig.email}
                  </span>
                </div>
              )}
            </div>
          </DesignHandle>

          {/* 5. Website - Moved to the bottom of the stack */}
          {layoutConfig.website && (
            <DesignHandle
              elementId="website_pos"
              isDesignMode={isDesignMode}
              label="Website"
              selectedElementId={selectedElementId}
              style={{ position: "relative", zIndex: 27, marginTop: "8px" }}
              x={websiteX}
              y={0}
              onDragEnd={(info) =>
                onCoordinateChange?.("website", {
                  x: snapToGrid(websiteX + info.offset.x),
                  y: 0,
                })
              }
              onElementClick={onElementClick}
            >
              <div
                suppressContentEditableWarning
                contentEditable={isEditable}
                style={{
                  color: layoutConfig.primaryColor || "#475569",
                  fontWeight: "bold",
                  fontSize: `${baseFontSize}px`,
                  fontFamily,
                  textAlign: "center",
                }}
                onBlur={(e) =>
                  onTextChange?.("website", e.currentTarget.textContent || "")
                }
              >
                <span style={{ fontSize: `${Math.max(baseFontSize - 1, 9)}px`, fontFamily, fontWeight: "bold", color: layoutConfig.textColor || "#94a3b8" }} className="lowercase mr-1">
                  website:
                </span>
                {layoutConfig.website}
              </div>
            </DesignHandle>
          )}
        </div>
      </div>

      {/* DOCUMENT TITLE AREA */}
      {(documentTitle || documentSubtitle) && (
        <div className="text-center py-10 border-b border-gray-100">
          {documentTitle && (
            <h2 className="text-2xl font-black text-gray-900">
              {documentTitle.toUpperCase()}
            </h2>
          )}
          {documentSubtitle && (
            <p className="text-sm text-gray-500 mt-1">{documentSubtitle}</p>
          )}
          <div className="flex justify-center gap-10 mt-4 text-[9px] font-bold text-gray-400 uppercase tracking-widest">
            {documentNumber && <span>Reg No: {documentNumber}</span>}
            {documentDate && <span>Date: {documentDate}</span>}
          </div>
        </div>
      )}

      {/* CONTENT */}
      <div className="flex-1 p-10">{children}</div>

      {/* FOOTER */}
      {layoutConfig.showFooter && layoutConfig.footerText && (
        <div className="border-t border-gray-200 py-6 text-center mt-auto">
          <p
            suppressContentEditableWarning
            className="font-bold tracking-[0.3em] uppercase outline-none"
            contentEditable={isDesignMode}
            style={{ fontSize: `${Math.max(baseFontSize - 2, 8)}px`, fontFamily, color: layoutConfig.textColor || "#94a3b8" }}
            onBlur={(e) =>
              onTextChange?.("footerText", e.currentTarget.textContent || "")
            }
          >
            {layoutConfig.footerText}
          </p>
        </div>
      )}
    </div>
  );
};

export default PrintLayoutTemplate;
