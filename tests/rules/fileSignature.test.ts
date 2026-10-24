import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSignature, extensionOf, sanitizeName } from "../../convex/lib/fileSignature.ts";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? Array.from(p, (c) => c.charCodeAt(0)) : p)));

test("only the confirmed file types are accepted", () => {
  for (const n of ["a.pdf", "a.DOC", "a.docx", "a.jpg", "a.JPEG", "a.png", "a.heic", "a.heif"]) assert.ok(extensionOf(n), n);
  for (const n of ["a.docm", "a.dotm", "a.exe", "a.html", "a.svg", "noext", "a.pdf.exe"]) assert.equal(extensionOf(n), null, n);
});

test("signatures must match the extension", () => {
  assert.equal(checkSignature("pdf", bytes("%PDF-1.7")), null);
  assert.equal(checkSignature("pdf", bytes("<html>")), "Not a PDF file");
  assert.equal(checkSignature("png", bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a])), null);
  assert.equal(checkSignature("jpg", bytes([0xff, 0xd8, 0xff, 0xe0])), null);
  assert.equal(checkSignature("jpeg", bytes("%PDF-")), "Not a JPEG image");
  assert.equal(checkSignature("doc", bytes([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])), null);
  assert.equal(checkSignature("heic", bytes([0, 0, 0, 0x18], "ftypheic")), null);
  assert.equal(checkSignature("heif", bytes([0, 0, 0, 0x18], "ftypmif1")), null);
  assert.equal(checkSignature("heic", bytes([0, 0, 0, 0x18], "ftypisom")), "Not a HEIC/HEIF image");
});

test("docx must be a Word package and must not carry macros", () => {
  const zip = (...names: string[]) => bytes([0x50, 0x4b, 0x03, 0x04], ...names);
  assert.equal(checkSignature("docx", zip("[Content_Types].xml", "word/document.xml")), null);
  assert.equal(checkSignature("docx", zip("word/document.xml", "word/vbaProject.bin")), "Macro-enabled Word files are not accepted");
  assert.equal(checkSignature("docx", zip("xl/workbook.xml")), "Not a Word .docx file");
  assert.equal(checkSignature("docx", bytes("%PDF-")), "Not a Word .docx file");
});

test("names are sanitized for display", () => {
  assert.equal(sanitizeName("../../etc/passwd"), "passwd");
  assert.equal(sanitizeName("C:\\Users\\x\\Rapor Kelas 12.pdf"), "Rapor Kelas 12.pdf");
  assert.equal(sanitizeName("<script>.pdf"), "_script_.pdf");
  assert.equal(sanitizeName("...hidden"), "hidden");
  assert.equal(sanitizeName(""), "file");
  const long = sanitizeName("a".repeat(300) + ".docx");
  assert.equal(long.length, 120);
  assert.ok(long.endsWith(".docx"));
});
