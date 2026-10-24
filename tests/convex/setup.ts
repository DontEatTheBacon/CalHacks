// Test harness for Convex functions (convex-test runs them in memory against the real schema).
import { convexTest } from "convex-test";
import schema from "../../convex/schema";
import type { Id } from "../../convex/_generated/dataModel";
import { internal } from "../../convex/_generated/api";

export const modules = import.meta.glob(["../../convex/**/*.ts", "../../convex/**/*.js", "!../../convex/**/*.d.ts"]);

export const WORKER_SECRET = "test-worker-secret-0123456789abcdef0123456789";

export function setup() {
  process.env.WORKER_SECRET = WORKER_SECRET;
  process.env.SITE_URL = "http://localhost:3000";
  return convexTest(schema, modules);
}
export type T = ReturnType<typeof setup>;

/** A signed-in client for a user row, using Convex Auth's "userId|sessionId" subject format. */
export function as(t: T, userId: Id<"users">) {
  return t.withIdentity({ subject: `${userId}|test-session`, tokenIdentifier: `test|${userId}` });
}

export async function student(t: T, email: string) {
  return t.run((ctx) => ctx.db.insert("users", { email, name: email.split("@")[0], role: "student" }));
}

export async function counselor(t: T, email: string, displayName: string, rotationOrder: number) {
  const userId = await t.run((ctx) => ctx.db.insert("users", { email, name: displayName }));
  await t.mutation(internal.admin.makeCounselor, { email, displayName, rotationOrder });
  return userId;
}

/** The three fictional demo counselors, rotation Ayu → Budi → Citra. */
export async function threeCounselors(t: T) {
  return {
    ayu: await counselor(t, "ayu@counselor.test", "Counselor Ayu", 1),
    budi: await counselor(t, "budi@counselor.test", "Counselor Budi", 2),
    citra: await counselor(t, "citra@counselor.test", "Counselor Citra", 3),
  };
}
