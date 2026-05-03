import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/accounts/:path*",
    "/transactions/:path*",
    "/budgets/:path*",
    "/categories/:path*",
    "/reports/:path*",
    "/settings/:path*",
  ],
};
