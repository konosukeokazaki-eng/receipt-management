import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db, users, authUsers, accounts, sessions, verificationTokens } from "@/db";
import { eq } from "drizzle-orm";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: authUsers,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session:{ strategy: "jwt"},
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // ドメイン制限チェック
      const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN;
      if (allowedDomain && user.email) {
        const emailDomain = user.email.split("@")[1];
        if (emailDomain !== allowedDomain) {
          return false;
        }
      }

      // usersテーブルに登録・または確認
      if (user.email) {
        const existingUser = await db
          .select()
          .from(users)
          .where(eq(users.email, user.email))
          .limit(1);

        if (existingUser.length === 0) {
          // 初回ログイン: usersテーブルに自動登録
          await db
            .insert(users)
            .values({
              email: user.email,
              displayName: user.name || user.email.split("@")[0],
              image: user.image,
              isActive: true,
            })
            .onConflictDoNothing();
        } else if (!existingUser[0].isActive) {
          return false;
        }
      }

      return true;
    },
    async session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
