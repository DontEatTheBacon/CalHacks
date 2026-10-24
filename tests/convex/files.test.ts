// File storage and authenticated download (CV-3, spec 5.9, scenario 18).
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { as, setup, student, threeCounselors, type T } from "./setup";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const PDF = new TextEncoder().encode("%PDF-1.4\n% SAMPLE - FICTIONAL transcript\n%%EOF\n");

async function upload(t: T, owner: Id<"users">, name: string, bytes: Uint8Array<ArrayBuffer>, type = "application/octet-stream") {
  const storageId = await t.run((ctx) => ctx.storage.store(new Blob([bytes], { type })));
  const result = await as(t, owner).mutation(api.files.finishUpload, { storageId, name });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  return { storageId, result };
}

const download = (t: T, who: Id<"users"> | null, fileId: string, variant = "") => {
  const path = `/files/download?id=${fileId}${variant}`;
  return who ? as(t, who).fetch(path) : t.fetch(path);
};

describe("upload validation", () => {
  test("a real PDF becomes ready", async () => {
    const t = setup();
    const nadia = await student(t, "nadia@student.test");
    const { result } = await upload(t, nadia, "Transkrip Nadia.pdf", PDF);
    expect(result.ok).toBe(true);
    const [file] = await as(t, nadia).query(api.files.listMine, {});
    expect(file).toMatchObject({ name: "Transkrip Nadia.pdf", state: "ready", scanState: "not_scanned", sharedWithCounselor: false });
  });

  test("content that does not match the extension is rejected and its blob deleted", async () => {
    const t = setup();
    const nadia = await student(t, "nadia@student.test");
    const { storageId } = await upload(t, nadia, "fake.pdf", new TextEncoder().encode("<html>not a pdf</html>"));
    const [file] = await as(t, nadia).query(api.files.listMine, {});
    expect(file).toMatchObject({ state: "rejected", rejectReason: "Not a PDF file" });
    expect(await t.run((ctx) => ctx.storage.get(storageId))).toBeNull();
  });

  test("disallowed types (.docm, .exe) are refused and not kept", async () => {
    const t = setup();
    const nadia = await student(t, "nadia@student.test");
    for (const name of ["macro.docm", "setup.exe"]) {
      const { storageId, result } = await upload(t, nadia, name, PDF);
      expect(result.ok).toBe(false);
      expect(await t.run((ctx) => ctx.storage.get(storageId))).toBeNull();
    }
    expect(await as(t, nadia).query(api.files.listMine, {})).toEqual([]);
  });

  test("files over 10 MB are refused", async () => {
    const t = setup();
    const nadia = await student(t, "nadia@student.test");
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    big.set(PDF);
    const { result } = await upload(t, nadia, "big.pdf", big);
    expect(result).toMatchObject({ ok: false, error: "File is larger than 10 MB" });
  });

  test("someone else's upload cannot be claimed twice", async () => {
    const t = setup();
    const nadia = await student(t, "nadia@student.test");
    const other = await student(t, "other@student.test");
    const { storageId } = await upload(t, nadia, "t.pdf", PDF);
    await expect(as(t, other).mutation(api.files.finishUpload, { storageId, name: "mine.pdf" })).rejects.toThrow(/already registered/);
  });
});

describe("authenticated download (scenario 18)", () => {
  async function scene() {
    const t = setup();
    const { ayu, budi } = await threeCounselors(t);
    const nadia = await student(t, "nadia@student.test");
    const other = await student(t, "other@student.test");
    await as(t, nadia).mutation(api.counseling.request, { stage: "workspace" }); // assigned to Ayu
    const { result } = await upload(t, nadia, "Transkrip.pdf", PDF);
    if (!result.ok) throw new Error("upload failed");
    return { t, ayu, budi, nadia, other, fileId: result.fileId };
  }

  test("owner downloads as an attachment with safe headers", async () => {
    const { t, nadia, fileId } = await scene();
    const res = await download(t, nadia, fileId);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toMatch(/^attachment;/);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PDF);
  });

  test("a copied URL does not work without the owner's sign-in", async () => {
    const { t, other, budi, ayu, fileId } = await scene();
    expect((await download(t, null, fileId)).status).toBe(401);
    expect((await download(t, other, fileId)).status).toBe(404);
    expect((await download(t, budi, fileId)).status).toBe(404);
    // Assignment alone does not share files.
    expect((await download(t, ayu, fileId)).status).toBe(404);
  });

  test("the assigned counselor can open a file only after it is shared, and not after it is unshared", async () => {
    const { t, nadia, ayu, budi, fileId } = await scene();
    await as(t, nadia).mutation(api.files.share, { fileId });
    expect((await download(t, ayu, fileId)).status).toBe(200);
    expect((await download(t, budi, fileId)).status).toBe(404);
    expect(await as(t, ayu).query(api.files.listShared, { studentId: nadia })).toHaveLength(1);
    await as(t, nadia).mutation(api.files.unshare, { fileId });
    expect((await download(t, ayu, fileId)).status).toBe(404);
    expect(await as(t, ayu).query(api.files.listShared, { studentId: nadia })).toEqual([]);
  });

  test("only the owner can share or remove a file; removal deletes the blob", async () => {
    const { t, nadia, other, fileId } = await scene();
    await expect(as(t, other).mutation(api.files.share, { fileId })).rejects.toThrow(/Not your file/);
    await expect(as(t, other).mutation(api.files.remove, { fileId })).rejects.toThrow(/Not your file/);
    const storageId = await t.run(async (ctx) => (await ctx.db.get(fileId))!.storageId);
    await as(t, nadia).mutation(api.files.remove, { fileId });
    expect(await t.run((ctx) => ctx.storage.get(storageId))).toBeNull();
    expect((await download(t, nadia, fileId)).status).toBe(404);
  });

  test("garbage or unknown IDs answer 404, the same as someone else's file", async () => {
    const { t, nadia } = await scene();
    expect((await download(t, nadia, "not-an-id")).status).toBe(404);
  });
});
