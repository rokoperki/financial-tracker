import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CategoryType } from "@/lib/generated/prisma/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const categories = await prisma.category.findMany({
    where: { userId: session.user.id },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, type, color, icon } = await req.json();
  if (!name || !type) {
    return NextResponse.json({ error: "Name and type required" }, { status: 400 });
  }

  const category = await prisma.category.create({
    data: {
      userId: session.user.id,
      name,
      type: type as CategoryType,
      color: color ?? "#6366f1",
      icon: icon ?? null,
    },
  });

  return NextResponse.json(category, { status: 201 });
}
