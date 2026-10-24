import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      // Only email and name come from the client; role is never taken from sign-up input.
      profile(params) {
        return {
          email: String(params.email).trim().toLowerCase(),
          ...(typeof params.name === "string" && params.name.trim() ? { name: params.name.trim().slice(0, 80) } : {}),
        };
      },
      validatePasswordRequirements(password) {
        if (password.length < 8) throw new Error("Password must be at least 8 characters");
      },
    }),
  ],
  callbacks: {
    // New accounts are always students. Counselors are promoted by internal admin functions.
    async afterUserCreatedOrUpdated(ctx, { userId, existingUserId }) {
      if (existingUserId !== null) return;
      const user = await ctx.db.get(userId);
      if (user && !user.role) await ctx.db.patch(userId, { role: "student", locale: "id" });
    },
  },
});
