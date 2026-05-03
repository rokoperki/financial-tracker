"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Account = { id: string; name: string; currency: string };

export default function NewTransactionPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then(setAccounts);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: form.get("accountId"),
        amount: form.get("amount"),
        currency: form.get("currency"),
        type: form.get("type"),
        description: form.get("description"),
        date: form.get("date"),
      }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/transactions");
    } else {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
    }
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold mb-6">New transaction</h1>
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Account</label>
          <select
            name="accountId"
            required
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white"
          >
            <option value="">Select account…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Amount</label>
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Currency</label>
            <input
              name="currency"
              defaultValue="EUR"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Type</label>
          <select
            name="type"
            required
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white"
          >
            <option value="EXPENSE">Expense</option>
            <option value="INCOME">Income</option>
            <option value="TRANSFER">Transfer</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Date</label>
          <input
            name="date"
            type="date"
            defaultValue={today}
            required
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Description</label>
          <input
            name="description"
            placeholder="Optional"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            {loading ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
