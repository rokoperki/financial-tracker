import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TransactionType } from "@/lib/generated/prisma/client";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId") ?? undefined;
  const categoryId = searchParams.get("categoryId") ?? undefined;
  const type = (searchParams.get("type") as TransactionType) ?? undefined;
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const where = {
    account: { userId: session.user.id },
    ...(accountId && { accountId }),
    ...(categoryId && { categoryId }),
    ...(type && { type }),
    ...((dateFrom || dateTo) && {
      date: {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo + "T23:59:59") }),
      },
    }),
  };

  const transactions = await prisma.transaction.findMany({
    where,
    include: { account: true, category: true },
    orderBy: { date: "desc" },
  });

  const header = ["Date", "Description", "Amount", "Currency", "Amount EUR", "Type", "Account", "Category"];
  const rows = transactions.map((tx) => [
    new Date(tx.date).toISOString().split("T")[0],
    `"${(tx.description ?? "").replace(/"/g, '""')}"`,
    Number(tx.amount).toFixed(2),
    tx.currency,
    Number(tx.amountEur).toFixed(2),
    tx.type,
    `"${tx.account.name.replace(/"/g, '""')}"`,
    `"${(tx.category?.name ?? "").replace(/"/g, '""')}"`,
  ]);

  const csv = [header, ...rows].map((r) => r.join(",")).join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="transactions-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
}
