import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

type UserWithRole = {
  id?: string;
  name?: string | null;
  email?: string | null;
  role?: string;
};

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Development Login",
      credentials: {},
      async authorize() {
        return {
          id: "1",
          name: "UniMe Admin",
          email: "admin@unime.it",
          role: "admin",
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as UserWithRole).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as UserWithRole).role = token.role as string | undefined;
      }
      return session;
    },
  },
  secret: "super-secret-dev-key",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
