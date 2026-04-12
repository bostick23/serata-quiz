import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { uniqueEmailsCol, usersCol } from "@/lib/firebase/collections";
import { verifyPassword } from "./helpers";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = (credentials.email as string).toLowerCase().trim();
        const password = credentials.password as string;

        // Look up userId via uniqueEmails collection
        const emailDoc = await uniqueEmailsCol().doc(email).get();
        if (!emailDoc.exists) return null;

        const { userId } = emailDoc.data()!;
        const userDoc = await usersCol().doc(userId).get();
        if (!userDoc.exists) return null;

        const user = userDoc.data()!;

        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) return null;

        if (!user.emailVerified) return null;

        return {
          id: userDoc.id,
          email: user.email,
          name: user.displayName,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as unknown as { role: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
