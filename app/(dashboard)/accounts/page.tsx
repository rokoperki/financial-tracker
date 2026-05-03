"use client";
import { useEffect, useState } from "react";

const ACCOUNT_TYPES = ["BANK", "REVOLUT", "CASH", "SOLFLARE", "KAST"] as const;
const TYPE_LABELS: Record<string, string> = {
  BANK: "Bank",
  REVOLUT: "Revolut",
  CASH: "Cash",
  SOLFLARE: "Solflare",
  KAST: "Kast",
};

type Account = {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: string;
  walletAddress: string | null;
};

function fmt(amount: number, currency = "EUR") {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(amount);
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/accounts");
    if (res.ok) setAccounts(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        type: form.get("type"),
        currency: form.get("currency") || "EUR",
        walletAddress: form.get("walletAddress") || null,
      }),
    });
    setLoading(false);
    setShowForm(false);
    (e.target as HTMLFormElement).reset();
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Deactivate this account?")) return;
    await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Add account
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4"
        >
          <h2 className="font-medium">New account</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Name</label>
              <input
                name="name"
                required
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Type</label>
              <select
                name="type"
                required
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white"
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Currency</label>
              <input
                name="currency"
                defaultValue="EUR"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Wallet address <span className="text-zinc-400">(crypto only)</span>
              </label>
              <input
                name="walletAddress"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
            >
              {loading ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center">
          <p className="text-zinc-500">No accounts yet. Add one above.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100">
          {accounts.map((a) => (
            <div key={a.id} className="flex items-center justify-between px-6 py-4">
              <div>
                <p className="font-medium">{a.name}</p>
                <p className="text-sm text-zinc-400">
                  {TYPE_LABELS[a.type]} · {a.currency}
                </p>
                {a.walletAddress && (
                  <p className="text-xs text-zinc-400 font-mono mt-0.5 truncate max-w-xs">
                    {a.walletAddress}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-6">
                <p className="text-lg font-semibold">
                  {fmt(Number(a.balance), a.currency)}
                </p>
                <button
                  onClick={() => handleDelete(a.id)}
                  className="text-sm text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
