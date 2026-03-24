import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb } from "./db";

export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  adapter: DrizzleAdapter(getDb()),
  providers: [Google],
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    signIn({ profile }) {
      return profile?.email?.endsWith("@micro-agi.com") ?? false;
    },
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
}));
