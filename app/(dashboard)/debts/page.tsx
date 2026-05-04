"use client";

import { useEffect, useRef, useState } from "react";

type Payment = {
  id: string;
  amount: number;
  date: string;
  note: string | null;
  transactionId: string | null;
  transaction: { description: string | null; date: string; account: { name: string } } | null;
};

type Debt = {
  id: string;
  name: string;
  direction: "I_OWE" | "THEY_OWE";
  totalAmount: number;
  dueDate: string | null;
  description: string | null;
  isSettled: boolean;
  payments: Payment[];
};

type TxOption = {
  id: string;
  description: string | null;
  amount: number;
  amountEur: number;
  type: string;
  date: string;
  account: { name: string };
};

function fmt(n: number) {
  return n.toLocaleString("en-IE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function paidAmount(debt: Debt) {
  return debt.payments.reduce((s, p) => s + p.amount, 0);
}

function pct(debt: Debt) {
  return Math.min(100, Math.round((paidAmount(debt) / debt.totalAmount) * 100));
}

function ProgressBar({ value }: { value: number }) {
  const color =
    value >= 100 ? "bg-emerald-500" : value >= 60 ? "bg-blue-500" : value >= 30 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-700">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
}

type Category = { id: string; name: string; color: string };

// Searchable transaction picker with debounce
function TransactionPicker({
  value,
  onChange,
  filterAmount,
  filterDate,
  filterType,
}: {
  value: TxOption | null;
  onChange: (tx: TxOption | null) => void;
  filterAmount?: string;
  filterDate?: string;
  filterType?: "EXPENSE" | "INCOME";
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TxOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Load categories once on first open
  useEffect(() => {
    if (!open || categories.length > 0) return;
    fetch("/api/categories").then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      const type = filterType === "INCOME" ? "INCOME" : "EXPENSE";
      setCategories(
        (data as Category[]).filter((c: any) => c.type === type)
      );
    });
  }, [open, filterType, categories.length]);

  // Debounced search — re-runs when query, filterAmount, filterDate, filterType, or selectedCategoryId change
  useEffect(() => {
    if (!open) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      const params = new URLSearchParams({ page: "1" });
      if (query.trim()) params.set("search", query.trim());
      if (filterType) params.set("type", filterType);
      if (selectedCategoryId) params.set("categoryId", selectedCategoryId);
      if (filterDate) {
        params.set("dateFrom", filterDate);
        params.set("dateTo", filterDate);
      }
      const res = await fetch(`/api/transactions?${params}`);
      if (res.ok) {
        const data = await res.json();
        let txs: TxOption[] = (data.transactions ?? []).map((tx: any) => ({
          id: tx.id,
          description: tx.description,
          amount: Number(tx.amount),
          amountEur: Number(tx.amountEur),
          type: tx.type,
          date: tx.date,
          account: { name: tx.account.name },
        }));
        // Narrow by amount client-side (compare EUR amount with tolerance)
        if (filterAmount && Number(filterAmount) > 0) {
          const target = Number(filterAmount);
          txs = txs.filter((tx) => Math.abs(Math.abs(tx.amountEur) - target) < 0.015);
        }
        setResults(txs);
      }
      setLoading(false);
    }, 250);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, open, filterAmount, filterDate, filterType, selectedCategoryId]);

  function openPicker() {
    setOpen(true);
    setQuery("");
    setSelectedCategoryId(null);
  }

  function select(tx: TxOption) {
    onChange(tx);
    setOpen(false);
    setQuery("");
    setSelectedCategoryId(null);
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(null);
  }

  const typeColor = (type: string) =>
    type === "INCOME"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-rose-600 dark:text-rose-400";

  return (
    <div ref={containerRef} className="relative">
      {/* Selected chip or empty state */}
      {value ? (
        <div className="flex items-center gap-2 rounded-lg border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/40 px-3 py-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-[var(--foreground)] truncate">
                {value.description || "No description"}
              </span>
              <span className={`text-xs font-semibold ${typeColor(value.type)}`}>
                {value.type === "INCOME" ? "+" : "−"}€{fmt(Math.abs(value.amountEur))}
              </span>
            </div>
            <div className="text-xs text-zinc-400 mt-0.5">
              {new Date(value.date).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}
              {" · "}{value.account.name}
            </div>
          </div>
          <button
            type="button"
            onClick={clear}
            className="flex-shrink-0 p-1 rounded text-zinc-400 hover:text-rose-500 hover:bg-white dark:hover:bg-zinc-800"
            title="Remove link"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          className="w-full flex items-center gap-2 rounded-lg border border-dashed border-[var(--border)] px-3 py-2 text-sm text-zinc-400 dark:text-zinc-500 hover:border-blue-400 hover:text-blue-500 dark:hover:border-blue-600 dark:hover:text-blue-400 transition-colors"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Link a transaction (optional)
        </button>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-[var(--border)] space-y-2">
            <input
              autoFocus
              type="text"
              placeholder="Search by description…"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm outline-none focus:border-blue-400"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {/* Category pills */}
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {categories.map((cat) => {
                  const active = selectedCategoryId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategoryId(active ? null : cat.id)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${
                        active
                          ? "text-white border-transparent"
                          : "bg-transparent border-[var(--border)] text-zinc-500 dark:text-zinc-400 hover:border-zinc-400"
                      }`}
                      style={active ? { backgroundColor: cat.color, borderColor: cat.color } : {}}
                    >
                      {!active && (
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                      )}
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Results */}
          <div className="max-h-56 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-4 text-xs text-center text-zinc-400">Searching…</div>
            ) : results.length === 0 ? (
              <div className="px-3 py-4 text-xs text-center text-zinc-400">No transactions found</div>
            ) : (
              results.map((tx) => (
                <button
                  key={tx.id}
                  type="button"
                  onClick={() => select(tx)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors"
                >
                  {/* Type indicator */}
                  <span className={`flex-shrink-0 text-xs font-bold w-6 text-center ${typeColor(tx.type)}`}>
                    {tx.type === "INCOME" ? "+" : "−"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-[var(--foreground)] truncate">
                        {tx.description || <span className="italic text-zinc-400">No description</span>}
                      </span>
                      <span className={`text-sm font-semibold flex-shrink-0 ${typeColor(tx.type)}`}>
                        €{fmt(Math.abs(tx.amountEur))}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      {new Date(tx.date).toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}
                      {" · "}{tx.account.name}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DebtCard({
  debt,
  onUpdate,
}: {
  debt: Debt;
  onUpdate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showPayForm, setShowPayForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [linkedTx, setLinkedTx] = useState<TxOption | null>(null);
  const [payForm, setPayForm] = useState({ amount: "", date: "", note: "" });
  const [editForm, setEditForm] = useState({
    name: debt.name,
    totalAmount: String(debt.totalAmount),
    dueDate: debt.dueDate ? debt.dueDate.slice(0, 10) : "",
    description: debt.description ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const paid = paidAmount(debt);
  const remaining = debt.totalAmount - paid;
  const progress = pct(debt);

  async function addPayment() {
    if (!payForm.amount || !payForm.date) return;
    setSaving(true);
    await fetch(`/api/debts/${debt.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(payForm.amount),
        date: payForm.date,
        transactionId: linkedTx?.id ?? null,
        note: payForm.note || null,
      }),
    });
    setSaving(false);
    setPayForm({ amount: "", date: "", note: "" });
    setLinkedTx(null);
    setShowPayForm(false);
    onUpdate();
  }

  async function deletePayment(paymentId: string) {
    await fetch(`/api/debts/${debt.id}/payments/${paymentId}`, { method: "DELETE" });
    onUpdate();
  }

  async function settle() {
    await fetch(`/api/debts/${debt.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isSettled: true }),
    });
    onUpdate();
  }

  async function unsettle() {
    await fetch(`/api/debts/${debt.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isSettled: false }),
    });
    onUpdate();
  }

  async function saveEdit() {
    setSaving(true);
    await fetch(`/api/debts/${debt.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name,
        totalAmount: Number(editForm.totalAmount),
        dueDate: editForm.dueDate || null,
        description: editForm.description || null,
      }),
    });
    setSaving(false);
    setShowEditForm(false);
    onUpdate();
  }

  async function deleteDebt() {
    if (!confirm(`Delete "${debt.name}"? This will also remove all its payments.`)) return;
    setDeleting(true);
    await fetch(`/api/debts/${debt.id}`, { method: "DELETE" });
    setDeleting(false);
    onUpdate();
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[var(--foreground)]">{debt.name}</span>
            {debt.isSettled && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                Settled
              </span>
            )}
            {debt.dueDate && !debt.isSettled && (
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                Due {new Date(debt.dueDate).toLocaleDateString("en-IE", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            )}
          </div>
          {debt.description && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{debt.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => { setShowEditForm(!showEditForm); setExpanded(true); }}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={deleteDebt}
            disabled={deleting}
            className="p-1.5 rounded-md text-zinc-400 hover:text-rose-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Amounts row */}
      <div className="flex items-center gap-4 text-sm">
        <div>
          <span className="text-zinc-500 dark:text-zinc-400">Total </span>
          <span className="font-medium">€{fmt(debt.totalAmount)}</span>
        </div>
        <div>
          <span className="text-zinc-500 dark:text-zinc-400">Paid </span>
          <span className="font-medium text-emerald-600 dark:text-emerald-400">€{fmt(paid)}</span>
        </div>
        <div>
          <span className="text-zinc-500 dark:text-zinc-400">Remaining </span>
          <span className="font-medium text-rose-600 dark:text-rose-400">€{fmt(Math.max(0, remaining))}</span>
        </div>
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <ProgressBar value={progress} />
        <div className="text-xs text-zinc-500 dark:text-zinc-400 text-right">{progress}%</div>
      </div>

      {/* Edit form */}
      {showEditForm && (
        <div className="border-t border-[var(--border)] pt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="block text-xs text-zinc-500 mb-1">Name</label>
              <input
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Total Amount (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                value={editForm.totalAmount}
                onChange={(e) => setEditForm((f) => ({ ...f, totalAmount: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Due Date</label>
              <input
                type="date"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                value={editForm.dueDate}
                onChange={(e) => setEditForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-zinc-500 mb-1">Description</label>
              <input
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowEditForm(false)}
              className="px-3 py-1.5 text-sm rounded-md border border-[var(--border)] hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              onClick={saveEdit}
              disabled={saving}
              className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {!debt.isSettled && (
          <button
            onClick={() => { setShowPayForm(!showPayForm); setExpanded(true); }}
            className="px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            + Add Payment
          </button>
        )}
        <button
          onClick={debt.isSettled ? unsettle : settle}
          className={`px-3 py-1.5 text-xs rounded-md border border-[var(--border)] transition-colors ${
            debt.isSettled
              ? "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              : progress >= 100
              ? "bg-emerald-600 text-white border-transparent hover:bg-emerald-700"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          }`}
        >
          {debt.isSettled ? "Reopen" : "Mark Settled"}
        </button>
        {debt.payments.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="px-3 py-1.5 text-xs rounded-md border border-[var(--border)] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            {expanded ? "Hide payments" : `${debt.payments.length} payment${debt.payments.length !== 1 ? "s" : ""}`}
          </button>
        )}
      </div>

      {/* Add payment form */}
      {showPayForm && !debt.isSettled && (
        <div className="border-t border-[var(--border)] pt-3 space-y-3">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">New Payment</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Amount (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                value={payForm.amount}
                onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Date</label>
              <input
                type="date"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                value={payForm.date}
                onChange={(e) => setPayForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-zinc-500 mb-1">Link Transaction</label>
              <TransactionPicker
                value={linkedTx}
                onChange={(tx) => {
                  setLinkedTx(tx);
                  if (tx) {
                    setPayForm((f) => ({
                      ...f,
                      amount: String(Math.abs(tx.amountEur)),
                      date: tx.date.slice(0, 10),
                    }));
                  }
                }}
                filterAmount={payForm.amount}
                filterDate={payForm.date}
                filterType={debt.direction === "I_OWE" ? "EXPENSE" : "INCOME"}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-zinc-500 mb-1">Note (optional)</label>
              <input
                placeholder="e.g. Cash repayment"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                value={payForm.note}
                onChange={(e) => setPayForm((f) => ({ ...f, note: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setShowPayForm(false); setLinkedTx(null); }}
              className="px-3 py-1.5 text-sm rounded-md border border-[var(--border)] hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              onClick={addPayment}
              disabled={saving || !payForm.amount}
              className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Add Payment"}
            </button>
          </div>
        </div>
      )}

      {/* Payments list */}
      {expanded && debt.payments.length > 0 && (
        <div className="border-t border-[var(--border)] pt-3 space-y-1.5">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Payments</p>
          {debt.payments.map((p) => (
            <div key={p.id} className="flex items-start justify-between gap-2 text-sm">
              <div className="flex-1 min-w-0">
                <span className="font-medium text-emerald-600 dark:text-emerald-400">€{fmt(p.amount)}</span>
                <span className="text-zinc-500 dark:text-zinc-400 ml-2 text-xs">
                  {new Date(p.date).toLocaleDateString("en-IE", { month: "short", day: "numeric", year: "numeric" })}
                </span>
                {p.transaction && (
                  <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">
                    ↗ {p.transaction.description || "Tx"} ({p.transaction.account.name})
                  </span>
                )}
                {p.note && <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500 italic">{p.note}</span>}
              </div>
              <button
                onClick={() => deletePayment(p.id)}
                className="flex-shrink-0 p-1 rounded text-zinc-300 hover:text-rose-500 dark:text-zinc-600 dark:hover:text-rose-400"
              >
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DebtsPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showSettled, setShowSettled] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "",
    direction: "I_OWE" as "I_OWE" | "THEY_OWE",
    totalAmount: "",
    dueDate: "",
    description: "",
  });
  const [addSaving, setAddSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/debts");
    const data = res.ok ? await res.json() : [];
    setDebts(
      (Array.isArray(data) ? data : []).map((d: any) => ({
        ...d,
        totalAmount: Number(d.totalAmount),
        payments: d.payments.map((p: any) => ({ ...p, amount: Number(p.amount) })),
      }))
    );
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createDebt() {
    if (!addForm.name || !addForm.totalAmount) return;
    setAddSaving(true);
    await fetch("/api/debts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: addForm.name,
        direction: addForm.direction,
        totalAmount: Number(addForm.totalAmount),
        dueDate: addForm.dueDate || null,
        description: addForm.description || null,
      }),
    });
    setAddSaving(false);
    setAddForm({ name: "", direction: "I_OWE", totalAmount: "", dueDate: "", description: "" });
    setShowAddForm(false);
    await load();
  }

  const active = debts.filter((d) => !d.isSettled);
  const settled = debts.filter((d) => d.isSettled);
  const iOwe = active.filter((d) => d.direction === "I_OWE");
  const theyOwe = active.filter((d) => d.direction === "THEY_OWE");
  const totalIOwe = iOwe.reduce((s, d) => s + Math.max(0, d.totalAmount - paidAmount(d)), 0);
  const totalTheyOwe = theyOwe.reduce((s, d) => s + Math.max(0, d.totalAmount - paidAmount(d)), 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Debts</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Track money you owe and money owed to you</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
        >
          + New Debt
        </button>
      </div>

      {/* Summary cards */}
      {!loading && (iOwe.length > 0 || theyOwe.length > 0) && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">I Owe</p>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">€{fmt(totalIOwe)}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{iOwe.length} active debt{iOwe.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">They Owe Me</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">€{fmt(totalTheyOwe)}</p>
            <p className="text-xs text-zinc-400 mt-0.5">{theyOwe.length} active debt{theyOwe.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
      )}

      {/* Add debt form */}
      {showAddForm && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
          <p className="text-sm font-semibold text-[var(--foreground)]">New Debt</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-zinc-500 mb-1">Name / Person</label>
              <input
                placeholder="e.g. John, Rent loan…"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Direction</label>
              <select
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                value={addForm.direction}
                onChange={(e) => setAddForm((f) => ({ ...f, direction: e.target.value as "I_OWE" | "THEY_OWE" }))}
              >
                <option value="I_OWE">I owe them</option>
                <option value="THEY_OWE">They owe me</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Total Amount (€)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                value={addForm.totalAmount}
                onChange={(e) => setAddForm((f) => ({ ...f, totalAmount: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Due Date (optional)</label>
              <input
                type="date"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                value={addForm.dueDate}
                onChange={(e) => setAddForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Description (optional)</label>
              <input
                className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
                value={addForm.description}
                onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-sm rounded-md border border-[var(--border)] hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              onClick={createDebt}
              disabled={addSaving || !addForm.name || !addForm.totalAmount}
              className="px-4 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {addSaving ? "Creating…" : "Create"}
            </button>
          </div>
        </div>
      )}

      {loading && <div className="text-center py-16 text-zinc-400">Loading…</div>}

      {!loading && debts.length === 0 && (
        <div className="text-center py-16">
          <p className="text-zinc-400 dark:text-zinc-500 text-sm">No debts yet. Add one to start tracking.</p>
        </div>
      )}

      {/* I Owe section */}
      {iOwe.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wide">I Owe</h2>
            <span className="text-xs text-zinc-400">{iOwe.length} debt{iOwe.length !== 1 ? "s" : ""}</span>
          </div>
          {iOwe.map((d) => <DebtCard key={d.id} debt={d} onUpdate={load} />)}
        </section>
      )}

      {/* They Owe section */}
      {theyOwe.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-[var(--foreground)] uppercase tracking-wide">They Owe Me</h2>
            <span className="text-xs text-zinc-400">{theyOwe.length} debt{theyOwe.length !== 1 ? "s" : ""}</span>
          </div>
          {theyOwe.map((d) => <DebtCard key={d.id} debt={d} onUpdate={load} />)}
        </section>
      )}

      {/* Settled section */}
      {settled.length > 0 && (
        <section className="space-y-3">
          <button
            onClick={() => setShowSettled(!showSettled)}
            className="flex items-center gap-2 text-sm font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide hover:text-zinc-900 dark:hover:text-zinc-200"
          >
            <svg
              width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
              className={`transition-transform ${showSettled ? "rotate-90" : ""}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Settled ({settled.length})
          </button>
          {showSettled && settled.map((d) => <DebtCard key={d.id} debt={d} onUpdate={load} />)}
        </section>
      )}
    </div>
  );
}
