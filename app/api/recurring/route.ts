import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Frequency } from "@/lib/generated/prisma/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rules = await prisma.recurringRule.findMany({
    where: { accountId: { in: await userAccountIds(session.user.id) } },
    orderBy: { nextRunDate: "asc" },
  });

  return NextResponse.json(JSON.parse(JSON.stringify(rules)));
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { accountId, categoryId, amount, currency, frequency, dayOfWeek, dayOfMonth, monthOfYear, description, nextRunDate } = await req.json();

  if (!accountId || !amount || !frequency || !nextRunDate) {
    return NextResponse.json({ error: "accountId, amount, frequency, and nextRunDate required" }, { status: 400 });
  }

  const account = await prisma.account.findFirst({ where: { id: accountId, userId: session.user.id } });
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const rule = await prisma.recurringRule.create({
    data: {
      accountId,
      categoryId: categoryId || null,
      amount,
      currency: currency ?? account.currency,
      frequency: frequency as Frequency,
      dayOfWeek: dayOfWeek ?? null,
      dayOfMonth: dayOfMonth ?? null,
      monthOfYear: monthOfYear ?? null,
      description: description || null,
      nextRunDate: new Date(nextRunDate),
    },
  });

  return NextResponse.json(JSON.parse(JSON.stringify(rule)), { status: 201 });
}

async function userAccountIds(userId: string) {
  const accounts = await prisma.account.findMany({ where: { userId, isActive: true }, select: { id: true } });
  return accounts.map((a) => a.id);
}
