import { v } from "convex/values";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { AccessDenied, activeAssignment, requireUser } from "./lib/access";

/** Only the student and the counselor of this conversation, while still assigned, may use it. */
async function requireParticipant(ctx: QueryCtx, conversationId: Id<"conversations">) {
  const user = await requireUser(ctx);
  const conversation = await ctx.db.get(conversationId);
  if (!conversation) throw new AccessDenied("forbidden", "No such conversation");
  if (user.role === "student") {
    if (conversation.studentId !== user._id) throw new AccessDenied("forbidden", "Not your conversation");
    return { user, conversation, senderType: "student" as const };
  }
  const counselor = await ctx.db.query("counselors").withIndex("by_user", (q) => q.eq("userId", user._id)).unique();
  const assignment = await activeAssignment(ctx, conversation.studentId);
  if (!counselor || conversation.counselorId !== counselor._id || assignment?.counselorId !== counselor._id) {
    throw new AccessDenied("forbidden", "Not assigned to this conversation");
  }
  return { user, conversation, senderType: "counselor" as const };
}

export const list = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    await requireParticipant(ctx, conversationId);
    return ctx.db.query("messages").withIndex("by_conversation", (q) => q.eq("conversationId", conversationId)).collect();
  },
});

export const send = mutation({
  args: { conversationId: v.id("conversations"), body: v.string(), programRef: v.optional(v.id("programs")) },
  handler: async (ctx, { conversationId, body, programRef }) => {
    const { user, senderType } = await requireParticipant(ctx, conversationId);
    const text = body.trim();
    if (!text) throw new Error("Message is empty");
    if (text.length > 5000) throw new Error("Message is too long");
    return ctx.db.insert("messages", { conversationId, senderType, senderId: user._id, body: text, programRef, fileRefs: [], createdAt: Date.now() });
  },
});
