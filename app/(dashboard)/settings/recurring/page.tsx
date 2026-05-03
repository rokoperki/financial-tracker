"use client";
import { useEffect, useState } from "react";

type Account = { id: string; name: string; currency: string };
type Category = { id: string; name: string };
type Rule = {
  id: string;
  accountId: string;
  categoryId: string | null;
  amount: string;
  currency: string;
  frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  description: string | null;
  isActive: boolean;
  nextRunDate: string;
};

const FREQ_LABELS: Record<string, string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

function fmt(amount: string, currency: string) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(Number(amount));
}

export default function RecurringPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [frequency, setFrequency] = useState("MONTHLY");

  async function load() {
    const [rRes, aRes, cRes] = await Promise.all([
      fetch("/api/recurring"),
      fetch("/api/accounts"),
      fetch("/api/categories"),
    ]);
    if (rRes.ok) setRules(await rRes.json());
    if (aRes.ok) setAccounts(await aRes.json());
    if (cRes.ok) setCategories(await cRes.json());
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    await fetch("/api/recurring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: form.get("accountId"),
        categoryId: form.get("categoryId") || null,
        amount: form.get("amount"),
        currency: form.get("currency") || undefined,
        frequency: form.get("frequency"),
        dayOfWeek: form.get("dayOfWeek") ? parseInt(form.get("dayOfWeek") as string) : null,
        dayOfMonth: form.get("dayOfMonth") ? parseInt(form.get("dayOfMonth") as string) : null,
        monthOfYear: form.get("monthOfYear") ? parseInt(form.get("monthOfYear") as string) : null,
        description: form.get("description"),
        nextRunDate: form.get("nextRunDate"),
      }),
    });
    setLoading(false);
    setShowForm(false);
    (e.target as HTMLFormElement).reset();
    load();
  }

  async function toggleActive(rule: Rule) {
    await fetch(`/api/recurring/${rule.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !rule.isActive }),
    });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this recurring rule?")) return;
    await fetch(`/api/recurring/${id}`, { method: "DELETE" });
    load();
  }

  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Recurring transactions</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Triggered via <code className="text-xs bg-zinc-100 px-1 py-0.5 rounded">POST /api/recurring/run</code>
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Add rule
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border border-zinc-200 bg-white p-6 space-y-4">
          <h2 className="font-medium">New recurring rule</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Account</label>
              <select name="accountId" required className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white">
                <option value="">Select…</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Category</label>
              <select name="categoryId" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white">
                <option value="">None</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Amount</label>
              <input name="amount" type="number" step="0.01" min="0.01" required className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Currency</label>
              <input name="currency" defaultValue="EUR" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Frequency</label>
              <select
                name="frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white"
              >
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="YEARLY">Yearly</option>
              </select>
            </div>
            {frequency === "WEEKLY" && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Day of week</label>
                <select name="dayOfWeek" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white">
                  {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((d, i) => (
                    <option key={i} value={i}>{d}</option>
                  ))}
                </select>
              </div>
            )}
            {(frequency === "MONTHLY" || frequency === "YEARLY") && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Day of month</label>
                <input name="dayOfMonth" type="number" min="1" max="31" defaultValue={1} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
              </div>
            )}
            {frequency === "YEARLY" && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Month</label>
                <select name="monthOfYear" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm bg-white">
                  {["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">First run date</label>
              <input name="nextRunDate" type="date" required className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-zinc-700 mb-1">Description</label>
              <input name="description" placeholder="Optional" className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50">
              {loading ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
              Cancel
            </button>
          </div>
        </form>
      )}

      {rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-12 text-center">
          <p className="text-zinc-500">No recurring rules yet.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-100">
          {rules.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="font-medium text-sm">{r.description ?? "Recurring expense"}</p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {accountMap[r.accountId]?.name} · {FREQ_LABELS[r.frequency]} · next: {new Date(r.nextRunDate).toLocaleDateString("en-IE")}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold tabular-nums text-red-500">
                  −{fmt(r.amount, r.currency)}
                </span>
                <button
                  onClick={() => toggleActive(r)}
                  className={`text-xs px-2 py-1 rounded-full font-medium ${r.isActive ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}
                >
                  {r.isActive ? "Active" : "Paused"}
                </button>
                <button onClick={() => handleDelete(r.id)} className="text-xs text-zinc-400 hover:text-red-500">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
