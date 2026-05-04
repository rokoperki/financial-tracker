import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; paymentId: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, paymentId } = await params;

  const payment = await prisma.debtPayment.findFirst({
    where: { id: paymentId, debtId: id, debt: { userId: session.user.id } },
  });
  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.debtPayment.delete({ where: { id: paymentId } });
  return NextResponse.json({ ok: true });
}
