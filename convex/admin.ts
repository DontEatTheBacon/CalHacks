// Server-only administration. These are internal functions: run them with `npx convex run`,
// never from the browser. Counselor role is granted only here (CV-2).
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

export const makeCounselor = internalMutation({
  args: { email: v.string(), displayName: v.string(), rotationOrder: v.number(), active: v.optional(v.boolean()) },
  handler: async (ctx, { email, displayName, rotationOrder, active }) => {
    const user = await ctx.db.query("users").withIndex("email", (q) => q.eq("email", email.trim().toLowerCase())).unique();
    if (!user) throw new Error(`No account for ${email}; sign up in the app first`);
    await ctx.db.patch(user._id, { role: "counselor" });
    const existing = await ctx.db.query("counselors").withIndex("by_user", (q) => q.eq("userId", user._id)).unique();
    if (existing) await ctx.db.patch(existing._id, { displayName, rotationOrder, active: active ?? true });
    else await ctx.db.insert("counselors", { userId: user._id, displayName, rotationOrder, active: active ?? true });
    await ctx.db.insert("actionHistory", { actor: "admin", action: "counselor_granted", userId: user._id, at: Date.now() });
    if (active ?? true) await ctx.scheduler.runAfter(0, internal.counseling.assignPending, {});
    return user._id;
  },
});

export const setCounselorActive = internalMutation({
  args: { email: v.string(), active: v.boolean() },
  handler: async (ctx, { email, active }) => {
    const user = await ctx.db.query("users").withIndex("email", (q) => q.eq("email", email.trim().toLowerCase())).unique();
    const counselor = user && (await ctx.db.query("counselors").withIndex("by_user", (q) => q.eq("userId", user._id)).unique());
    if (!counselor) throw new Error(`No counselor for ${email}`);
    await ctx.db.patch(counselor._id, { active });
    if (active) await ctx.scheduler.runAfter(0, internal.counseling.assignPending, {});
  },
});
