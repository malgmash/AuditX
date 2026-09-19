import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role?: "EMPLOYEE" | "ADMIN";
  }
  interface Session {
    user: { id: string; role?: "EMPLOYEE" | "ADMIN" } & import("next-auth").DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: "EMPLOYEE" | "ADMIN";
  }
}
