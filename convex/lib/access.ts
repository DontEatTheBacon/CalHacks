// Every public function resolves the caller here first (spec 3.1, CV-2). The client is never trusted.
import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export class AccessDenied extends ConvexError<{ code: "forbidden" | "unauthenticated"; message: string }> {
  constructor(code: "forbidden" | "unauthenticated", message: string) {
    super({ code, message });
  }
}

export async function requireUser(ctx: QueryCtx): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new AccessDenied("unauthenticated", "Sign in required");
  const user = await ctx.db.get(userId);
  if (!user || !user.role) throw new AccessDenied("forbidden", "Account has no role");
  return user;
}

export async function requireStudent(ctx: QueryCtx): Promise<Doc<"users">> {
  const user = await requireUser(ctx);
  if (user.role !== "student") throw new AccessDenied("forbidden", "Students only");
  return user;
}

export async function requireCounselor(ctx: QueryCtx): Promise<{ user: Doc<"users">; counselor: Doc<"counselors"> }> {
  const user = await requireUser(ctx);
  if (user.role !== "counselor") throw new AccessDenied("forbidden", "Counselors only");
  const counselor = await ctx.db.query("counselors").withIndex("by_user", (q) => q.eq("userId", user._id)).unique();
  if (!counselor) throw new AccessDenied("forbidden", "No counselor record");
  return { user, counselor };
}

/** The counselor currently assigned to a student, if any. */
export async function activeAssignment(ctx: QueryCtx, studentId: Id<"users">) {
  return ctx.db.query("assignments").withIndex("by_student", (q) => q.eq("studentId", studentId).eq("active", true)).first();
}

/**
 * Owner or the currently assigned counselor may read a student's context. Anyone else is denied:
 * other students and unassigned counselors get nothing (spec 3.1).
 */
export async function requireStudentReader(ctx: QueryCtx, studentId: Id<"users">) {
  const user = await requireUser(ctx);
  if (user.role === "student") {
    if (user._id !== studentId) throw new AccessDenied("forbidden", "Not your record");
    return { user, as: "owner" as const };
  }
  const { counselor } = await requireCounselor(ctx);
  const assignment = await activeAssignment(ctx, studentId);
  if (!assignment || assignment.counselorId !== counselor._id) throw new AccessDenied("forbidden", "Not assigned to this student");
  return { user, as: "counselor" as const, counselor };
}

/** A file is readable by its owner, or by a counselor with an unrevoked share who is still assigned. */
export async function canReadFile(ctx: QueryCtx, userId: Id<"users">, file: Doc<"files">): Promise<boolean> {
  if (file.state !== "ready") return false;
  if (file.ownerId === userId) return true;
  const counselor = await ctx.db.query("counselors").withIndex("by_user", (q) => q.eq("userId", userId)).unique();
  if (!counselor) return false;
  const assignment = await activeAssignment(ctx, file.ownerId);
  if (!assignment || assignment.counselorId !== counselor._id) return false;
  const shares = await ctx.db.query("fileShares").withIndex("by_file", (q) => q.eq("fileId", file._id)).collect();
  return shares.some((s) => s.counselorId === counselor._id && s.revokedAt === undefined);
}
