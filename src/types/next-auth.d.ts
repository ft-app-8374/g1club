import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      email: string;
      role: string;
      isFinancial: boolean;
    };
  }

  interface User {
    username: string;
    role: string;
    isFinancial: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    role: string;
    isFinancial: boolean;
  }
}
