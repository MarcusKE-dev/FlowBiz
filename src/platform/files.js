// src/platform/files.js
//
// GETTING A FILE OUT OF FLOWBIZ — a receipt PDF, a report, a CSV, a backup.
//
// In a browser that is a download (an <a download> click) or a print
// window. Inside the Android app neither exists: a WebView ignores
// download links, cannot print, and a blob: URL opened with window.open()
// replaces the whole app with a page it cannot render. So on Android a
// file is written to the app's cache and handed to the system share
// sheet, from which the user saves it to Files or Drive, prints it,
// or sends it by WhatsApp or email. That is also what a person on a phone
// expects "download" and "print" to do.
//
// Every export path in the app goes through saveFile() or openForPrint();
// none of them touch document.createElement('a') or window.open(bloburl)
// directly any more.

import { isNativeApp, hasNativePlugin } from './platform.js';

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read the file.'));
    reader.readAsDataURL(blob);
  });
}

function safeFileName(name) {
  const cleaned = String(name || 'flowbiz-file').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned.slice(0, 120) || 'flowbiz-file';
}

async function shareNative(blob, fileName, { title, text } = {}) {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ]);
  const path = `shared/${Date.now()}-${safeFileName(fileName)}`;
  const written = await Filesystem.writeFile({
    path,
    data: await blobToBase64(blob),
    directory: Directory.Cache,
    recursive: true,
  });
  try {
    await Share.share({
      title: title || fileName,
      text: text || undefined,
      files: [written.uri],
      dialogTitle: title || 'Save or share',
    });
  } catch (err) {
    // Dismissing the share sheet is not an error the user needs told about.
    if (/cancel/i.test(String(err?.message || err))) return { cancelled: true };
    throw err;
  }
  return { shared: true };
}

function downloadInBrowser(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeFileName(fileName);
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoked on a delay: some browsers start the download asynchronously.
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return { downloaded: true };
}

/**
 * Save a file. Browser: download. Android: share sheet (Save to Files,
 * Drive, WhatsApp, Print…). Resolves { downloaded | shared | cancelled }.
 */
export async function saveFile(blob, fileName, options = {}) {
  if (isNativeApp() && hasNativePlugin('Filesystem') && hasNativePlugin('Share')) {
    return shareNative(blob, fileName, options);
  }
  return downloadInBrowser(blob, fileName);
}

/**
 * Share a file where the platform can (native share sheet, or the Web
 * Share API on a phone browser), falling back to a download.
 */
export async function shareFile(blob, fileName, options = {}) {
  if (isNativeApp() && hasNativePlugin('Filesystem') && hasNativePlugin('Share')) {
    return shareNative(blob, fileName, options);
  }
  try {
    const file = new File([blob], safeFileName(fileName), { type: blob.type || 'application/octet-stream' });
    if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: options.title, text: options.text });
      return { shared: true };
    }
  } catch (err) {
    if (err?.name === 'AbortError') return { cancelled: true };
  }
  return downloadInBrowser(blob, fileName);
}

/**
 * Print a PDF. Browser: open it in a tab that prints itself (jsPDF's
 * autoPrint). Android: a WebView cannot print, so hand the PDF to the
 * share sheet, where Android's own "Print" and every PDF viewer are.
 * `pdfDoc` is a jsPDF document.
 */
export async function openForPrint(pdfDoc, fileName) {
  if (isNativeApp()) {
    return saveFile(pdfDoc.output('blob'), fileName, { title: 'Print or share' });
  }
  pdfDoc.autoPrint();
  const opened = window.open(pdfDoc.output('bloburl'), '_blank');
  if (!opened) {
    // A blocked popup: fall back to a download rather than doing nothing.
    return downloadInBrowser(pdfDoc.output('blob'), fileName);
  }
  return { printed: true };
}

/** Save a jsPDF document. */
export function savePdf(pdfDoc, fileName, options) {
  return saveFile(pdfDoc.output('blob'), fileName, options);
}
