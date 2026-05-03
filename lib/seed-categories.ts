import { prisma } from "./prisma";

const DEFAULT_CATEGORIES = [
  { name: "Food & groceries", type: "EXPENSE" as const, color: "#22c55e" },
  { name: "Dining out", type: "EXPENSE" as const, color: "#f97316" },
  { name: "Rent / housing", type: "EXPENSE" as const, color: "#6366f1" },
  { name: "Utilities", type: "EXPENSE" as const, color: "#0ea5e9" },
  { name: "Transport", type: "EXPENSE" as const, color: "#eab308" },
  { name: "Entertainment", type: "EXPENSE" as const, color: "#ec4899" },
  { name: "Shopping", type: "EXPENSE" as const, color: "#8b5cf6" },
  { name: "Health", type: "EXPENSE" as const, color: "#ef4444" },
  { name: "Subscriptions", type: "EXPENSE" as const, color: "#14b8a6" },
  { name: "Education", type: "EXPENSE" as const, color: "#f59e0b" },
  { name: "Travel", type: "EXPENSE" as const, color: "#10b981" },
  { name: "Other", type: "EXPENSE" as const, color: "#94a3b8" },
  { name: "Salary", type: "INCOME" as const, color: "#22c55e" },
  { name: "Freelance", type: "INCOME" as const, color: "#3b82f6" },
  { name: "Investment returns", type: "INCOME" as const, color: "#8b5cf6" },
  { name: "Crypto gains", type: "INCOME" as const, color: "#f97316" },
  { name: "Other income", type: "INCOME" as const, color: "#94a3b8" },
];

export async function seedDefaultCategories(userId: string) {
  await prisma.category.createMany({
    data: DEFAULT_CATEGORIES.map((c) => ({ ...c, userId })),
    skipDuplicates: true,
  });
}
