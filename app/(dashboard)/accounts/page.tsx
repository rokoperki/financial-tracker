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

const inputCls = "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent dark:bg-zinc-800/50 px-3 py-2 text-sm dark:text-zinc-100";
const selectCls = "w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm dark:text-zinc-100";
const labelCls = "block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1";
const btnPrimary = "rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50";
const btnOutline = "rounded-lg border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800";

type EditForm = { name: string; currency: string; balance: string; walletAddress: string };

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: "", currency: "", balance: "", walletAddress: "" });
  const [editSaving, setEditSaving] = useState(false);

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

  async function handleTransfer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    await fetch("/api/accounts/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromAccountId: form.get("fromAccountId"),
        toAccountId: form.get("toAccountId"),
        amount: form.get("amount"),
        currency: form.get("currency") || undefined,
        date: form.get("date"),
        description: form.get("description") || undefined,
      }),
    });
    setLoading(false);
    setShowTransfer(false);
    (e.target as HTMLFormElement).reset();
    load();
  }

  function startEdit(a: Account) {
    setEditingId(a.id);
    setEditForm({ name: a.name, currency: a.currency, balance: a.balance, walletAddress: a.walletAddress ?? "" });
  }

  async function saveEdit(id: string) {
    setEditSaving(true);
    const res = await fetch(`/api/accounts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name,
        currency: editForm.currency,
        walletAddress: editForm.walletAddress || null,
        balance: editForm.balance,
      }),
    });
    setEditSaving(false);
    if (res.ok) {
      const updated = await res.json();
      setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated } : a)));
      setEditingId(null);
    }
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
        <div className="flex gap-2">
          <button onClick={() => setShowForm(!showForm)} className={btnPrimary}>
            Add account
          </button>
          <button onClick={() => setShowTransfer(!showTransfer)} className={btnOutline}>
            Transfer
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4"
        >
          <h2 className="font-medium">New account</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Name</label>
              <input name="name" required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select name="type" required className={selectCls}>
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <input name="currency" defaultValue="EUR" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>
                Wallet address <span className="text-zinc-400">(crypto only)</span>
              </label>
              <input name="walletAddress" className={inputCls} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className={btnPrimary}>
              {loading ? "Creating…" : "Create"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className={btnOutline}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {showTransfer && (
        <form
          onSubmit={handleTransfer}
          className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 space-y-4"
        >
          <h2 className="font-medium">Transfer between accounts</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>From</label>
              <select name="fromAccountId" required className={selectCls}>
                <option value="">Select…</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>To</label>
              <select name="toAccountId" required className={selectCls}>
                <option value="">Select…</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Amount</label>
              <input name="amount" type="number" step="0.01" min="0.01" required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Currency</label>
              <input name="currency" defaultValue="EUR" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input name="date" type="date" defaultValue={new Date().toISOString().split("T")[0]} required className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <input name="description" placeholder="Optional" className={inputCls} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className={btnPrimary}>
              {loading ? "Transferring…" : "Transfer"}
            </button>
            <button type="button" onClick={() => setShowTransfer(false)} className={btnOutline}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">No accounts yet. Add one above.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] divide-y divide-[var(--border)]">
          {accounts.map((a) => {
            const isEditing = editingId === a.id;
            return (
              <div key={a.id}>
                <div className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="font-medium">{a.name}</p>
                    <p className="text-sm text-zinc-400 dark:text-zinc-500">
                      {TYPE_LABELS[a.type]} · {a.currency}
                    </p>
                    {a.walletAddress && (
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 font-mono mt-0.5 truncate max-w-xs">
                        {a.walletAddress}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-6">
                    <p className="text-lg font-semibold">
                      {fmt(Number(a.balance), a.currency)}
                    </p>
                    <button
                      onClick={() => isEditing ? setEditingId(null) : startEdit(a)}
                      className="text-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                    >
                      {isEditing ? "Cancel" : "Edit"}
                    </button>
                    <button
                      onClick={() => handleDelete(a.id)}
                      className="text-sm text-red-500 hover:text-red-700 dark:hover:text-red-400"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                {isEditing && (
                  <div className="px-6 pb-4 pt-1 bg-zinc-50 dark:bg-zinc-800/50 border-t border-[var(--border)]">
                    <div className="flex flex-wrap gap-3 items-end">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">Name</span>
                        <input
                          value={editForm.name}
                          onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                          className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent dark:bg-zinc-800/50 px-3 py-1.5 text-sm dark:text-zinc-100 min-w-[160px]"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">Currency</span>
                        <input
                          value={editForm.currency}
                          onChange={(e) => setEditForm((f) => ({ ...f, currency: e.target.value.toUpperCase() }))}
                          className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent dark:bg-zinc-800/50 px-3 py-1.5 text-sm dark:text-zinc-100 w-20"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">Balance</span>
                        <input
                          type="number"
                          step="0.01"
                          value={editForm.balance}
                          onChange={(e) => setEditForm((f) => ({ ...f, balance: e.target.value }))}
                          className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent dark:bg-zinc-800/50 px-3 py-1.5 text-sm dark:text-zinc-100 w-32"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">Wallet address</span>
                        <input
                          value={editForm.walletAddress}
                          onChange={(e) => setEditForm((f) => ({ ...f, walletAddress: e.target.value }))}
                          placeholder="Optional"
                          className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent dark:bg-zinc-800/50 px-3 py-1.5 text-sm dark:text-zinc-100 min-w-[200px]"
                        />
                      </div>
                      <button
                        onClick={() => saveEdit(a.id)}
                        disabled={editSaving}
                        className="self-end rounded-lg bg-zinc-900 dark:bg-zinc-100 px-3 py-1.5 text-xs font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50"
                      >
                        {editSaving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
