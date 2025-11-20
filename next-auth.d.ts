import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user?: {
      id?: number;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      accessToken?: string;
    };
  }

  interface User {
    id?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
  }
}
