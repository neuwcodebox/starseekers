import { NextAuthOptions } from "next-auth";
import GitHubProvider from "next-auth/providers/github";

const clientId = process.env.GITHUB_ID ?? "";
const clientSecret = process.env.GITHUB_SECRET ?? "";

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId,
      clientSecret,
      authorization: { params: { scope: "read:user public_repo" } },
      profile(profile) {
        return {
          id: profile.id?.toString() ?? profile.login,
          name: profile.name ?? profile.login,
          email: profile.email,
          image: profile.avatar_url,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.accessToken = (token as { accessToken?: string }).accessToken;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
};
