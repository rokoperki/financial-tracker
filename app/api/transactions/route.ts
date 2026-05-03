import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TransactionType } from "@/lib/generated/prisma/client";
import { toEur } from "@/lib/exchange-rates";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const accountId = searchParams.get("accountId") ?? undefined;
  const categoryId = searchParams.get("categoryId") ?? undefined;
  const type = (searchParams.get("type") as TransactionType) ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  const where = {
    account: { userId: session.user.id },
    ...(accountId && { accountId }),
    ...(categoryId && { categoryId }),
    ...(type && { type }),
    ...(search && { description: { contains: search, mode: "insensitive" as const } }),
    ...((dateFrom || dateTo) && {
      date: {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo + "T23:59:59") }),
      },
    }),
  };

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: { account: true, category: true },
      orderBy: { date: "desc" },
      take: 20,
      skip: (page - 1) * 20,
    }),
    prisma.transaction.count({ where }),
  ]);

  return NextResponse.json({
    transactions: JSON.parse(JSON.stringify(transactions)),
    total,
    page,
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { accountId, categoryId, amount, currency, type, description, date } = await req.json();

  if (!accountId || !amount || !type || !date) {
    return NextResponse.json(
      { error: "accountId, amount, type, and date are required" },
      { status: 400 }
    );
  }

  const account = await prisma.account.findFirst({
    where: { id: accountId, userId: session.user.id, isActive: true },
  });
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const txCurrency = currency ?? account.currency;
  const amountEur = await toEur(Number(amount), txCurrency);

  const transaction = await prisma.transaction.create({
    data: {
      accountId,
      categoryId: categoryId ?? null,
      amount,
      amountEur,
      currency: txCurrency,
      type: type as TransactionType,
      description: description || null,
      date: new Date(date),
    },
    include: { account: true, category: true },
  });

  const delta = type === "INCOME" ? Number(amount) : -Number(amount);
  if (type !== "TRANSFER") {
    await prisma.account.update({
      where: { id: accountId },
      data: { balance: { increment: delta } },
    });
  }

  return NextResponse.json(JSON.parse(JSON.stringify(transaction)), { status: 201 });
}
