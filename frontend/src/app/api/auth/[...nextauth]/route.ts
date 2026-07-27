import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Development Login",
      credentials: {},
      async authorize() {
        // Here we create fake user
        return {
          id: "1",
          name: "UniMe Admin",
          email: "admin@unime.it",
          role: "admin"
        };
      }
    })
  ],
  pages: {
    signIn: "/login", 
  },
  callbacks: {
    // Save the fake token and role in session 
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
      }
      return session;
    }
  },
  secret: "super-secret-dev-key", // Secret key for local development
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };