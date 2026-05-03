import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

async function requireOwned(ruleId: string, userId: string) {
  const accountIds = await prisma.account
    .findMany({ where: { userId, isActive: true }, select: { id: true } })
    .then((a) => a.map((x) => x.id));
  return prisma.recurringRule.findFirst({ where: { id: ruleId, accountId: { in: accountIds } } });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const rule = await requireOwned(id, session.user.id);
  if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { isActive, amount, description, nextRunDate } = await req.json();
  const updated = await prisma.recurringRule.update({
    where: { id },
    data: {
      ...(isActive !== undefined && { isActive }),
      ...(amount !== undefined && { amount }),
      ...(description !== undefined && { description }),
      ...(nextRunDate !== undefined && { nextRunDate: new Date(nextRunDate) }),
    },
  });

  return NextResponse.json(JSON.parse(JSON.stringify(updated)));
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const rule = await requireOwned(id, session.user.id);
  if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.recurringRule.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
