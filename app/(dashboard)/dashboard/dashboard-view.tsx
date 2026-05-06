"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { COUNTRIES, countryByCode } from "@/lib/countries";

const TYPE_LABELS: Record<string, string> = {
  BANK: "Bank", REVOLUT: "Revolut", CASH: "Cash", SOLFLARE: "Solflare", KAST: "Kast",
};

function fmt(n: number, currency = "EUR") {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(n);
}

function Money({ n, currency = "EUR", hidden }: { n: number; currency?: string; hidden: boolean }) {
  if (hidden) return <span className="tracking-widest select-none">••••••</span>;
  return <>{fmt(n, currency)}</>;
}

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.every((v) => v === 0)) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const W = 100, H = 28;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * W},${H - ((v - min) / range) * (H - 2) - 1}`)
    .join(" ");
  const last = data[data.length - 1];
  const color = last >= 0 ? "#22c55e" : "#f87171";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" className="mt-2 opacity-80">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

type Category = { id: string; name: string; type: string; color: string };
type Location = { latitude: number; longitude: number; city: string; country: string };

function QuickAddModal({ accounts, onClose, onSaved }: {
  accounts: { id: string; name: string; currency: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    accountId: accounts[0]?.id ?? "",
    type: "EXPENSE",
    amount: "",
    description: "",
    categoryId: "",
    date: today,
    city: "",
    country: "",
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [location, setLocation] = useState<Location | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then(setCategories);
  }, []);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function detectLocation() {
    if (!navigator.geolocation) { setGeoError("Not supported"); return; }
    setGeoLoading(true);
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );
          const geo = await res.json();
          const country = geo.countryCode || "";
          const city = geo.city || geo.locality || "";
          setLocation({ latitude, longitude, city, country });
          setForm((f) => ({ ...f, city, country }));
        } catch {
          setLocation({ latitude, longitude, city: "", country: "" });
        }
        setGeoLoading(false);
      },
      () => { setGeoError("Permission denied"); setGeoLoading(false); }
    );
  }

  const filteredCats = categories.filter((c) => c.type === form.type);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || !form.accountId) return;
    const account = accounts.find((a) => a.id === form.accountId);
    setSaving(true);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: form.accountId,
        type: form.type,
        amount: Number(form.amount),
        currency: account?.currency ?? "EUR",
        description: form.description || null,
        categoryId: form.categoryId || null,
        date: form.date,
        city: form.city || null,
        country: form.country || null,
        ...(location && { latitude: location.latitude, longitude: location.longitude }),
      }),
    });
    setSaving(false);
    if (res.ok) onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-[var(--foreground)]">Quick Add Transaction</h2>
          <button onClick={onClose} className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300">
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {/* Type toggle */}
          <div className="flex rounded-lg border border-[var(--border)] overflow-hidden">
            {["EXPENSE", "INCOME"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: t, categoryId: "" }))}
                className={`flex-1 py-1.5 text-sm font-medium transition-colors ${
                  form.type === t
                    ? t === "EXPENSE"
                      ? "bg-red-500 text-white"
                      : "bg-emerald-500 text-white"
                    : "text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                {t === "EXPENSE" ? "Expense" : "Income"}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-medium">
              {accounts.find((a) => a.id === form.accountId)?.currency ?? "EUR"}
            </span>
            <input
              ref={firstRef}
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              required
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pl-12 pr-3 py-2 text-lg font-semibold"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {/* Account */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Account</label>
              <select
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                value={form.accountId}
                onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            {/* Date */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Date</label>
              <input
                type="date"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            {/* Category */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Category</label>
              <select
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              >
                <option value="">— None —</option>
                {filteredCats.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {/* Description */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Description</label>
              <input
                placeholder="Optional"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            {/* City */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1">City</label>
              <input
                placeholder="Optional"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </div>
            {/* Country */}
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Country</label>
              <select
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
              >
                <option value="">— None —</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Detect location */}
          <button
            type="button"
            onClick={detectLocation}
            disabled={geoLoading}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /><circle cx="12" cy="12" r="10" />
            </svg>
            {geoLoading ? "Detecting…" : location ? `${[form.city, form.country ? countryByCode[form.country] : ""].filter(Boolean).join(", ")} — re-detect` : "Detect my location"}
          </button>
          {geoError && <p className="text-xs text-red-500 -mt-2">{geoError}</p>}

          <button
            type="submit"
            disabled={saving || !form.amount}
            className={`w-full py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
              form.type === "EXPENSE" ? "bg-red-500 hover:bg-red-600" : "bg-emerald-500 hover:bg-emerald-600"
            }`}
          >
            {saving ? "Saving…" : `Add ${form.type === "EXPENSE" ? "Expense" : "Income"}`}
          </button>
        </form>
      </div>
    </div>
  );
}

export type DashboardData = {
  netWorth: number;
  income: number;
  expenses: number;
  currentMonthLabel: string;
  insights: { catId: string; name: string; pct: number; thisMonth: number; lastMonth: number }[];
  accounts: { id: string; name: string; type: string; balance: number; currency: string; sparkline: number[] }[];
  recentTxs: {
    id: string;
    description: string | null;
    type: string;
    amountEur: number;
    date: string;
    account: { name: string };
    category: { name: string; color: string } | null;
  }[];
};

export function DashboardView(props: DashboardData) {
  const { netWorth, income, expenses, currentMonthLabel, insights, accounts, recentTxs } = props;
  const [hidden, setHidden] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("dashboard-amounts-hidden");
    if (stored !== null) setHidden(stored === "true");
  }, []);

  function toggle() {
    const next = !hidden;
    setHidden(next);
    localStorage.setItem("dashboard-amounts-hidden", String(next));
  }

  async function recalculate() {
    setRecalculating(true);
    await fetch("/api/accounts/recalculate", { method: "POST" });
    setRecalculating(false);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-0.5 text-sm">{currentMonthLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={recalculate}
            disabled={recalculating}
            className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-50"
          >
            {recalculating ? "Recalculating…" : "Recalculate"}
          </button>
          <button
            onClick={toggle}
            className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            {hidden ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            )}
            {hidden ? "Show" : "Hide"}
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Net worth", value: netWorth, color: "" },
          { label: "Income this month", value: income, color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Expenses this month", value: expenses, color: "text-red-500 dark:text-red-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{label}</p>
            <p className={`text-3xl font-semibold mt-1 ${color}`}>
              <Money n={value} hidden={hidden} />
            </p>
          </div>
        ))}
      </div>

      {/* Spending insights */}
      {insights.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="font-semibold mb-3 text-sm uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Insights
          </h2>
          <div className="space-y-2">
            {insights.map((ins) => (
              <div key={ins.catId} className="flex items-center justify-between text-sm">
                <span className="text-zinc-700 dark:text-zinc-300">
                  <span className="font-medium">{ins.name}</span>
                  {ins.pct > 0 ? ` up ${ins.pct}% vs last month` : ` down ${Math.abs(ins.pct)}% vs last month`}
                </span>
                <span className={`tabular-nums font-medium ${ins.pct > 0 ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  <Money n={ins.thisMonth} hidden={false} />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accounts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Accounts</h2>
          <Link href="/accounts" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            Manage →
          </Link>
        </div>
        {accounts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
            <p className="text-zinc-500 mb-3">No accounts yet</p>
            <Link href="/accounts" className="text-sm font-medium underline">Add your first account</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {accounts.map((a) => (
              <div key={a.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 flex flex-col">
                <p className="text-xs text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">
                  {TYPE_LABELS[a.type] ?? a.type}
                </p>
                <p className="font-medium mt-1 truncate text-sm">{a.name}</p>
                <p className="text-xl font-semibold mt-2">
                  <Money n={a.balance} currency={a.currency} hidden={hidden} />
                </p>
                <Sparkline data={a.sparkline} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent transactions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Recent transactions</h2>
          <Link href="/transactions" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            View all →
          </Link>
        </div>
        {recentTxs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
            <p className="text-zinc-500 mb-3">No transactions yet</p>
            <Link href="/transactions/new" className="text-sm font-medium underline">Add a transaction</Link>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] divide-y divide-[var(--border)]">
            {recentTxs.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{tx.description ?? tx.category?.name ?? "—"}</p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                    {tx.account.name} · {new Date(tx.date).toLocaleDateString("en-IE")}
                  </p>
                </div>
                <p className={`text-sm font-semibold tabular-nums ${
                  tx.type === "INCOME" ? "text-emerald-600 dark:text-emerald-400"
                  : tx.type === "EXPENSE" ? "text-red-500 dark:text-red-400"
                  : "text-zinc-500"
                }`}>
                  {tx.type === "EXPENSE" ? "−" : tx.type === "INCOME" ? "+" : ""}
                  <Money n={tx.amountEur} hidden={false} />
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick add floating button */}
      <button
        onClick={() => setShowQuickAdd(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 active:scale-95 transition-transform flex items-center justify-center z-40"
        title="Quick add transaction"
      >
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {showQuickAdd && (
        <QuickAddModal
          accounts={accounts}
          onClose={() => setShowQuickAdd(false)}
          onSaved={() => { setShowQuickAdd(false); router.refresh(); }}
        />
      )}
    </div>
  );
}
