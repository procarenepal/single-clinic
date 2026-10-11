/**
 * Prints an HTML document from a hidden iframe on the current page, instead
 * of a window.open() popup. A popup forces two separate surfaces to appear
 * in sequence — the new browser window, then the native print dialog on top
 * of it — which reads as two modals. This keeps everything to the single
 * native print dialog.
 */
export function printHtmlViaIframe(html: string, printDelayMs = 500) {
  const iframe = document.createElement("iframe");

  iframe.style.position = "absolute";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  iframe.style.visibility = "hidden";

  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;

  if (!iframeDoc) {
    console.error("Could not access iframe document for printing");
    document.body.removeChild(iframe);

    return;
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  const doPrint = () => {
    const win = iframe.contentWindow;

    if (!win) {
      document.body.removeChild(iframe);

      return;
    }

    const cleanup = () => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
      window.removeEventListener("focus", cleanup);
    };

    // "afterprint" covers Print/Cancel in most browsers; the window "focus"
    // fallback catches browsers where it doesn't fire for a hidden iframe.
    win.addEventListener("afterprint", cleanup);
    window.addEventListener("focus", cleanup, { once: true });

    win.focus();
    win.print();
  };

  // Wait for web fonts (e.g. the clinic's branding typeface) to finish
  // loading before measuring/printing — otherwise the first print can use
  // fallback-font metrics. fonts.ready resolves immediately if there's
  // nothing left to load, so this never adds delay beyond printDelayMs.
  const fonts = (iframeDoc as any).fonts;

  if (fonts?.ready) {
    fonts.ready.then(() => setTimeout(doPrint, printDelayMs));
  } else {
    setTimeout(doPrint, printDelayMs);
  }
}
