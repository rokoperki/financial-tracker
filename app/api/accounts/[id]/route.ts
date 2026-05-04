import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

async function requireOwned(accountId: string, userId: string) {
  return prisma.account.findFirst({
    where: { id: accountId, userId, isActive: true },
  });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const account = await requireOwned(id, session.user.id);
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name, currency, walletAddress, balance } = await req.json();
  const updated = await prisma.account.update({
    where: { id },
    data: {
      name,
      currency,
      walletAddress,
      ...(balance !== undefined && { balance: Number(balance) }),
    },
  });

  return NextResponse.json(JSON.parse(JSON.stringify(updated)));
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const account = await requireOwned(id, session.user.id);
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.account.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
