// Private student files (spec 5.9, CV-3). Storage URLs are never returned to clients;
// downloads go through the authenticated HTTP action in convex/http.ts.
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalAction, internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import limits from "../config/limits.json" with { type: "json" };
import { activeAssignment, canReadFile, requireStudent, requireStudentReader } from "./lib/access";
import { checkSignature, extensionOf, MIME, sanitizeName, type AllowedExt } from "./lib/fileSignature.ts";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireStudent(ctx);
    const mine = await ctx.db.query("files").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).collect();
    if (mine.length >= limits.upload.maxFiles) throw new Error(`At most ${limits.upload.maxFiles} files`);
    return ctx.storage.generateUploadUrl();
  },
});

/** Registers an uploaded blob, checks type and size limits, then schedules the content-signature check. */
export const finishUpload = mutation({
  args: { storageId: v.id("_storage"), name: v.string() },
  handler: async (ctx, { storageId, name }) => {
    const user = await requireStudent(ctx);
    const claimed = await ctx.db.query("files").withIndex("by_storage", (q) => q.eq("storageId", storageId)).first();
    if (claimed) throw new Error("Upload already registered");
    const meta = await ctx.db.system.get(storageId);
    if (!meta) throw new Error("Upload not found");
    // Rejections return instead of throwing: a throw would roll back the blob deletion.
    const reject = async (error: string) => {
      await ctx.storage.delete(storageId);
      return { ok: false as const, error };
    };
    const ext = extensionOf(name);
    if (!ext) return reject("File type not accepted. Use PDF, Word (.doc/.docx), JPEG, PNG or HEIC/HEIF.");
    if (meta.size > limits.upload.maxBytes) return reject("File is larger than 10 MB");
    const mine = await ctx.db.query("files").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).collect();
    const used = mine.reduce((sum, f) => sum + f.size, 0);
    if (mine.length >= limits.upload.maxFiles || used + meta.size > limits.upload.maxTotalBytes) {
      return reject("Storage limit reached (50 files or 100 MB)");
    }
    const fileId = await ctx.db.insert("files", {
      ownerId: user._id, name: sanitizeName(name), ext, storageId, mime: MIME[ext], size: meta.size,
      state: "validating", scanState: "not_scanned",
      previewState: ext === "heic" || ext === "heif" ? "converting" : "none",
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.files.validate, { fileId });
    return { ok: true as const, fileId };
  },
});

export const validate = internalAction({
  args: { fileId: v.id("files") },
  handler: async (ctx, { fileId }) => {
    const file = await ctx.runQuery(internal.files.getInternal, { fileId });
    if (!file || file.state !== "validating") return;
    const blob = await ctx.storage.get(file.storageId);
    const reason = blob ? checkSignature(file.ext as AllowedExt, new Uint8Array(await blob.arrayBuffer())) : "Upload missing";
    await ctx.runMutation(internal.files.setValidation, { fileId, reason: reason ?? undefined });
  },
});

export const getInternal = internalQuery({
  args: { fileId: v.id("files") },
  handler: (ctx, { fileId }) => ctx.db.get(fileId),
});

export const setValidation = internalMutation({
  args: { fileId: v.id("files"), reason: v.optional(v.string()) },
  handler: async (ctx, { fileId, reason }) => {
    const file = await ctx.db.get(fileId);
    if (!file) return;
    if (reason) {
      await ctx.storage.delete(file.storageId);
      await ctx.db.patch(fileId, { state: "rejected", rejectReason: reason });
    } else {
      await ctx.db.patch(fileId, { state: "ready" });
    }
  },
});

/** The HEIC preview copy is made in the browser and attached here (spec 5.9); its JPEG signature is checked before use. */
export const attachPreview = mutation({
  args: { fileId: v.id("files"), storageId: v.optional(v.id("_storage")) },
  handler: async (ctx, { fileId, storageId }) => {
    const user = await requireStudent(ctx);
    const file = await ctx.db.get(fileId);
    if (!file || file.ownerId !== user._id) throw new Error("Not your file");
    if (!storageId) return ctx.db.patch(fileId, { previewState: "unavailable" });
    const claimed = await ctx.db.query("files").withIndex("by_storage", (q) => q.eq("storageId", storageId)).first();
    if (claimed || file.derivativeStorageId) throw new Error("Preview already registered");
    await ctx.db.patch(fileId, { derivativeStorageId: storageId, previewState: "converting" });
    await ctx.scheduler.runAfter(0, internal.files.validatePreview, { fileId });
  },
});

export const validatePreview = internalAction({
  args: { fileId: v.id("files") },
  handler: async (ctx, { fileId }) => {
    const file = await ctx.runQuery(internal.files.getInternal, { fileId });
    if (!file?.derivativeStorageId) return;
    const blob = await ctx.storage.get(file.derivativeStorageId);
    const ok = !!blob && blob.size <= limits.upload.maxBytes && checkSignature("jpg", new Uint8Array(await blob.slice(0, 16).arrayBuffer())) === null;
    await ctx.runMutation(internal.files.setPreview, { fileId, ok });
  },
});

export const setPreview = internalMutation({
  args: { fileId: v.id("files"), ok: v.boolean() },
  handler: async (ctx, { fileId, ok }) => {
    const file = await ctx.db.get(fileId);
    if (!file?.derivativeStorageId) return;
    if (ok) return ctx.db.patch(fileId, { previewState: "ok" });
    await ctx.storage.delete(file.derivativeStorageId);
    await ctx.db.patch(fileId, { derivativeStorageId: undefined, previewState: "unavailable" });
  },
});

function publicView(f: { _id: Id<"files">; name: string; ext: string; mime: string; size: number; state: string; rejectReason?: string; previewState: string; scanState: string; createdAt: number }) {
  return { id: f._id, name: f.name, ext: f.ext, mime: f.mime, size: f.size, state: f.state, rejectReason: f.rejectReason ?? null, previewState: f.previewState, scanState: f.scanState, createdAt: f.createdAt };
}

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireStudent(ctx);
    const files = await ctx.db.query("files").withIndex("by_owner", (q) => q.eq("ownerId", user._id)).order("desc").collect();
    const assignment = await activeAssignment(ctx, user._id);
    return Promise.all(files.map(async (f) => {
      const shares = await ctx.db.query("fileShares").withIndex("by_file", (q) => q.eq("fileId", f._id)).collect();
      const sharedWithCounselor = !!assignment && shares.some((s) => s.counselorId === assignment.counselorId && s.revokedAt === undefined);
      return { ...publicView(f), sharedWithCounselor };
    }));
  },
});

/** Assigned counselor: only files the student explicitly shared. */
export const listShared = query({
  args: { studentId: v.id("users") },
  handler: async (ctx, { studentId }) => {
    const access = await requireStudentReader(ctx, studentId);
    if (access.as !== "counselor") throw new Error("Counselor view only");
    const shares = await ctx.db.query("fileShares").withIndex("by_counselor", (q) => q.eq("counselorId", access.counselor._id)).collect();
    const out = [];
    for (const s of shares) {
      if (s.revokedAt !== undefined) continue;
      const f = await ctx.db.get(s.fileId);
      if (f && f.ownerId === studentId && f.state === "ready") out.push(publicView(f));
    }
    return out;
  },
});

/** Sharing is explicit, per file, and only with the currently assigned counselor. Assignment alone shares nothing. */
export const share = mutation({
  args: { fileId: v.id("files") },
  handler: async (ctx, { fileId }) => {
    const user = await requireStudent(ctx);
    const file = await ctx.db.get(fileId);
    if (!file || file.ownerId !== user._id) throw new Error("Not your file");
    if (file.state !== "ready") throw new Error("File is not ready");
    const assignment = await activeAssignment(ctx, user._id);
    if (!assignment) throw new Error("No counselor assigned");
    const shares = await ctx.db.query("fileShares").withIndex("by_file", (q) => q.eq("fileId", fileId)).collect();
    if (shares.some((s) => s.counselorId === assignment.counselorId && s.revokedAt === undefined)) return;
    await ctx.db.insert("fileShares", { fileId, counselorId: assignment.counselorId, sharedAt: Date.now() });
    await ctx.db.insert("actionHistory", { actor: "student", action: "file_shared", userId: user._id, target: fileId, at: Date.now() });
  },
});

export const unshare = mutation({
  args: { fileId: v.id("files") },
  handler: async (ctx, { fileId }) => {
    const user = await requireStudent(ctx);
    const file = await ctx.db.get(fileId);
    if (!file || file.ownerId !== user._id) throw new Error("Not your file");
    const shares = await ctx.db.query("fileShares").withIndex("by_file", (q) => q.eq("fileId", fileId)).collect();
    for (const s of shares) if (s.revokedAt === undefined) await ctx.db.patch(s._id, { revokedAt: Date.now() });
  },
});

export async function deleteFile(ctx: MutationCtx, fileId: Id<"files">) {
  const file = await ctx.db.get(fileId);
  if (!file) return;
  if (file.state !== "rejected") await ctx.storage.delete(file.storageId);
  if (file.derivativeStorageId) await ctx.storage.delete(file.derivativeStorageId);
  for (const s of await ctx.db.query("fileShares").withIndex("by_file", (q) => q.eq("fileId", fileId)).collect()) await ctx.db.delete(s._id);
  await ctx.db.delete(fileId);
}

export const remove = mutation({
  args: { fileId: v.id("files") },
  handler: async (ctx, { fileId }) => {
    const user = await requireStudent(ctx);
    const file = await ctx.db.get(fileId);
    if (!file || file.ownerId !== user._id) throw new Error("Not your file");
    await deleteFile(ctx, fileId);
  },
});

/** Used by the download HTTP action. Returns null unless the caller may read the file. */
export const authorizeDownload = internalQuery({
  args: { fileId: v.string(), userId: v.id("users"), preview: v.boolean() },
  handler: async (ctx, { fileId, userId, preview }) => {
    const id = ctx.db.normalizeId("files", fileId);
    if (!id) return null;
    const file = await ctx.db.get(id);
    if (!file || !(await canReadFile(ctx, userId, file))) return null;
    if (preview) {
      if (!file.derivativeStorageId || file.previewState !== "ok") return null;
      return { storageId: file.derivativeStorageId, name: file.name.replace(/\.[^.]+$/, "") + ".jpg", mime: "image/jpeg", word: false };
    }
    return { storageId: file.storageId, name: file.name, mime: file.mime, word: file.ext === "doc" || file.ext === "docx" };
  },
});
