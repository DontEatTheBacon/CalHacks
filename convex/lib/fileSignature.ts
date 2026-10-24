// Server-side upload checks (spec 5.9): the content signature must match the extension,
// macro-enabled Word files are rejected, names are sanitized. Pure functions; no storage access.
import limits from "../../config/limits.json" with { type: "json" };

export type AllowedExt = "pdf" | "doc" | "docx" | "jpg" | "jpeg" | "png" | "heic" | "heif";

export const MIME: Record<AllowedExt, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  heif: "image/heif",
};

export function extensionOf(name: string): AllowedExt | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return (limits.upload.allowed as string[]).includes(ext) ? (ext as AllowedExt) : null;
}

/** Display name only; files are stored under generated IDs, never this name. */
export function sanitizeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, "").replace(/[^\p{L}\p{N} ._()-]/gu, "_").replace(/^\.+/, "").trim();
  if (!clean) return "file";
  if (clean.length <= 120) return clean;
  const dot = clean.lastIndexOf(".");
  const ext = dot > 0 ? clean.slice(dot) : "";
  return clean.slice(0, 120 - ext.length) + ext;
}

const startsWith = (b: Uint8Array, sig: number[], offset = 0) => sig.every((x, i) => b[offset + i] === x);
const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.slice(from, to));

function containsAscii(b: Uint8Array, needle: string): boolean {
  const n = Array.from(needle, (c) => c.charCodeAt(0));
  outer: for (let i = 0; i + n.length <= b.length; i++) {
    for (let j = 0; j < n.length; j++) if (b[i + j] !== n[j]) continue outer;
    return true;
  }
  return false;
}

const HEIF_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1", "heif"]);

/**
 * Returns null when the bytes match the extension, otherwise the rejection reason.
 * For .docx the whole file is needed: ZIP entry names are stored uncompressed, so the
 * Word part and any VBA macro part can be found by name.
 */
export function checkSignature(ext: AllowedExt, bytes: Uint8Array): string | null {
  switch (ext) {
    case "pdf":
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]) ? null : "Not a PDF file";
    case "png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) ? null : "Not a PNG image";
    case "jpg":
    case "jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]) ? null : "Not a JPEG image";
    case "doc":
      return startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) ? null : "Not a Word .doc file";
    case "docx":
      if (!startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return "Not a Word .docx file";
      if (containsAscii(bytes, "vbaProject.bin") || containsAscii(bytes, "macroEnabled")) return "Macro-enabled Word files are not accepted";
      return containsAscii(bytes, "word/document.xml") ? null : "Not a Word .docx file";
    case "heic":
    case "heif":
      return bytes.length >= 12 && ascii(bytes, 4, 8) === "ftyp" && HEIF_BRANDS.has(ascii(bytes, 8, 12)) ? null : "Not a HEIC/HEIF image";
  }
}
