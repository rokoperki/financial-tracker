import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toEur } from "@/lib/exchange-rates";
import { RecurringRule } from "@/lib/generated/prisma/client";

function advanceDate(rule: RecurringRule): Date {
  const d = new Date(rule.nextRunDate);
  switch (rule.frequency) {
    case "DAILY":
      d.setDate(d.getDate() + 1);
      break;
    case "WEEKLY":
      d.setDate(d.getDate() + 7);
      break;
    case "MONTHLY":
      d.setMonth(d.getMonth() + 1);
      if (rule.dayOfMonth) {
        const max = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(rule.dayOfMonth, max));
      }
      break;
    case "YEARLY":
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d;
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = new Date();
  const due = await prisma.recurringRule.findMany({
    where: { isActive: true, nextRunDate: { lte: now } },
  });

  let created = 0;
  for (const rule of due) {
    const amountEur = await toEur(Number(rule.amount), rule.currency);
    await prisma.$transaction([
      prisma.transaction.create({
        data: {
          accountId: rule.accountId,
          categoryId: rule.categoryId,
          amount: rule.amount,
          amountEur,
          currency: rule.currency,
          type: "EXPENSE",
          description: rule.description ?? "Recurring transaction",
          date: rule.nextRunDate,
          isRecurring: true,
          recurringId: rule.id,
        },
      }),
      prisma.account.update({
        where: { id: rule.accountId },
        data: { balance: { increment: -Number(rule.amount) } },
      }),
      prisma.recurringRule.update({
        where: { id: rule.id },
        data: { nextRunDate: advanceDate(rule) },
      }),
    ]);
    created++;
  }

  return NextResponse.json({ processed: due.length, created });
}
