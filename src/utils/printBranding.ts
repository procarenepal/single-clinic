import { PrintLayoutConfig } from "@/types/printLayout";

/**
 * Generates the CSS styles for the centralized clinical branding.
 * Uses the Slate-600 palette and centered-stack layout model.
 */
export const getPrintBrandingCSS = (
  config: PrintLayoutConfig,
  isThermal: boolean = false,
) => {
  const primaryColor = config.primaryColor || "#0ea5e9";
  const fontSize = config.fontSize || "medium";
  const headerHeight =
    config.headerHeight === "compact"
      ? 140
      : config.headerHeight === "expanded"
        ? 220
        : 180;

  const effectiveLogoPosition = isThermal
    ? "center"
    : config.logoPosition || "center";
  const fontFamily = config.fontFamily || "'Inter', sans-serif";
  const titleColor = config.titleColor || "#1e293b";
  const textColor = config.textColor || "#475569";
  const contentFontSize =
    config.contentFontSize ||
    (fontSize === "small" ? 10 : fontSize === "large" ? 14 : 12);

  return `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Nunito:wght@400;600;700;800&family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Roboto:wght@400;500;700&family=Outfit:wght@400;600;700&display=swap');

    * { box-sizing: border-box; }

    body {
      font-family: ${fontFamily} !important;
      color: ${textColor} !important;
      font-size: ${contentFontSize}px !important;
      line-height: 1.5;
      margin: 0 !important;
      padding: 0 !important;
      background: white;
      -webkit-print-color-adjust: exact;
      margin: 0 !important;
      padding: 0 !important;
      background: white;
      -webkit-print-color-adjust: exact;
    }

    .header {
      position: relative;
      width: 100%;
      height: ${headerHeight}px;
      background: #fff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border-bottom: 1px solid #f1f5f9;
      overflow: hidden;
    }

    .identity-stack {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 0 80px;
      width: 100%;
      gap: 6px;
      z-index: 50;
      box-sizing: border-box;
    }

    .logo-container {
      position: ${effectiveLogoPosition === "center" ? "relative" : "absolute"};
      z-index: 100;
      width: ${config.logoWidth || 80}px;
      top: 20px;
    }

    .logo {
      width: 100%;
      height: auto;
      display: block;
    }

    .clinic-name {
      font-size: ${config.fontSize === "small" ? "18px" : config.fontSize === "large" ? "26px" : "22px"};
      margin: 0;
      font-weight: 500;
      color: ${primaryColor};
      text-transform: uppercase;
      letter-spacing: 0.05em;
      line-height: 1.1;
      text-align: center;
    }

    .tagline {
      font-size: 10px;
      font-weight: 400;
      color: ${textColor};
      text-transform: uppercase;
      letter-spacing: 0.12em;
      margin: 4px 0 0 0;
      text-align: center;
    }

    .address-container {
      margin-top: 10px;
      text-align: center;
    }

    .address {
      font-size: 10px;
      color: ${textColor};
      line-height: 1.4;
      text-align: center;
      white-space: pre-wrap;
    }

    .contact-row {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-top: 4px;
      justify-content: center;
      width: 100%;
    }

    .contact-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .contact-label {
      font-size: 10px;
      font-weight: 400;
      color: #64748b;
      text-transform: uppercase;
    }

    .contact-value {
      font-size: 11px;
      font-weight: 500;
      color: #334155;
    }

    .website {
      font-size: 11px;
      font-weight: 500;
      color: ${textColor};
      margin-top: 2px;
      text-align: center;
    }

    .pos-logo { 
      position: absolute;
      top: 20px;
      transform: ${isThermal ? "none" : `translate(${config.logoPos?.x || 0}px, ${config.logoPos?.y || 0}px)`};
      left: ${effectiveLogoPosition === "left" ? "40px" : effectiveLogoPosition === "right" ? "auto" : "50%"};
      right: ${effectiveLogoPosition === "right" ? "40px" : "auto"};
      margin-left: ${effectiveLogoPosition === "center" ? `-${(config.logoWidth || 80) / 2}px` : "0px"};
      z-index: 100;
    }
    .pos-clinicName { transform: ${isThermal ? "none" : `translate(${config.clinicNamePos?.x || 0}px, ${config.clinicNamePos?.y || 0}px)`}; position: relative; }
    .pos-tagline { transform: ${isThermal ? "none" : `translate(${config.taglinePos?.x || 0}px, ${config.taglinePos?.y || 0}px)`}; position: relative; }
    .pos-address { transform: ${isThermal ? "none" : `translate(${config.addressPos?.x || 0}px, ${config.addressPos?.y || 0}px)`}; position: relative; }
    .pos-contacts { transform: ${isThermal ? "none" : `translate(${config.phonePos?.x || 0}px, ${config.phonePos?.y || 0}px)`}; position: relative; width: 100%; display: flex; justify-content: center; }
    .pos-website { transform: ${isThermal ? "none" : `translate(${config.websitePos?.x || 0}px, ${config.websitePos?.y || 0}px)`}; position: relative; }

    .footer-section {
      border-top: 1px solid #f1f5f9;
      padding: 15px 40px;
      text-align: center;
      background: #fff;
      width: 100%;
    }

    .footer-text {
      font-size: 9px;
      font-weight: 400;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.15em;
    }
  `;
};

/**
 * Generates the HTML for the clinical branding header.
 */
export const getPrintHeaderHTML = (
  config: PrintLayoutConfig,
  clinic: any,
  isThermal: boolean = false,
) => {
  const logoUrl = config.logoUrl || clinic?.logoUrl;
  const logoWidth = config.logoWidth || 80;

  return `
    <div class="header">
      ${
        logoUrl
          ? `
        <div class="pos-logo logo-container">
          <img src="${logoUrl}" style="width: ${logoWidth}px;" alt="Logo" />
        </div>
      `
          : ""
      }

      <div class="identity-stack">
        <h1 class="clinic-name pos-clinicName">${config.clinicName || clinic?.name || "Clinic Name"}</h1>
        
        ${
          config.showTagline !== false && (config.tagline || clinic?.tagline)
            ? `
          <div class="pos-tagline">
            <p class="tagline">${config.tagline || clinic?.tagline || ""}</p>
          </div>
        `
            : ""
        }

        ${
          config.showAddress !== false && (config.address || clinic?.address)
            ? `
          <div class="pos-address">
            <div class="address">${config.address || clinic?.address || ""}</div>
          </div>
        `
            : ""
        }

        ${
          (config.showPhone !== false && (config.phone || clinic?.phone)) ||
          (config.showEmail !== false && (config.email || clinic?.email))
            ? `
          <div class="pos-contacts">
            <div class="contact-row">
              ${
                config.showPhone !== false && (config.phone || clinic?.phone)
                  ? `
                <div class="contact-item">
                  <span class="contact-label" style="text-transform: lowercase;">phone:</span>
                  <span class="contact-value">${config.phone || clinic?.phone}</span>
                </div>
              `
                  : ""
              }
              ${
                config.showEmail !== false && (config.email || clinic?.email)
                  ? `
                <div class="contact-item">
                  <span class="contact-label" style="text-transform: lowercase;">email:</span>
                  <span class="contact-value">${config.email || clinic?.email}</span>
                </div>
              `
                  : ""
              }
            </div>
          </div>
        `
            : ""
        }

        ${
          config.showWebsite !== false && (config.website || clinic?.website)
            ? `
          <div class="pos-website">
            <div class="contact-item">
              <span class="contact-label" style="text-transform: lowercase;">website:</span>
              <span class="contact-value">${config.website || clinic?.website}</span>
            </div>
          </div>
        `
            : ""
        }
      </div>
    </div>
  `;
};

/**
 * Generates the HTML for the clinical branding footer.
 */
export const getPrintFooterHTML = (config: PrintLayoutConfig) => {
  if (!config.showFooter || !config.footerText) return "";

  return `
    <footer class="footer-section">
      <p class="footer-text">${config.footerText}</p>
    </footer>
  `;
};
