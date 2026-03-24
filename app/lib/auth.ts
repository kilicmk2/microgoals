import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ profile }) {
      return profile?.email?.endsWith("@micro-agi.com") ?? false;
    },
    async jwt({ token, user, profile }) {
      if (user) {
        token.sub = user.id;
      }
      if (profile) {
        token.email = profile.email;
        token.name = profile.name;
        token.picture = profile.picture as string | undefined;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.email = token.email ?? "";
        session.user.name = token.name ?? "";
      }
      return session;
    },
  },
});
