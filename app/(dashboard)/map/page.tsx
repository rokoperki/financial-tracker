"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import { iso2ToNumeric } from "@/lib/country-codes";
import { countryByCode } from "@/lib/countries";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

type CountryData = {
  country: string;
  expenses: number;
  income: number;
  txCount: number;
  cities: string[];
};

type Account = { id: string; name: string };

function fmt(n: number) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}
function fmtFull(n: number) {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);
}

function getColor(expenses: number, max: number, isDark: boolean): string {
  if (expenses === 0) return isDark ? "#27272a" : "#e4e4e7";
  const t = Math.pow(expenses / max, 0.45);
  if (isDark) {
    const r = Math.round(80 + t * (239 - 80));
    const g = Math.round(30 - t * 30);
    const b = Math.round(30 - t * 30);
    return `rgb(${r},${Math.max(0, g)},${Math.max(0, b)})`;
  }
  const r = Math.round(254 - t * (254 - 185));
  const g = Math.round(202 - t * (202 - 28));
  const b = Math.round(202 - t * (202 - 28));
  return `rgb(${r},${g},${b})`;
}

const W = 960;
const H = 500;

export default function MapPage() {
  const [geoData, setGeoData] = useState<{ id: string; key: string; path: string }[]>([]);
  const [data, setData] = useState<CountryData[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<CountryData | null>(null);
  const [isDark, setIsDark] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  // Load topojson once
  useEffect(() => {
    fetch(GEO_URL)
      .then((r) => r.json())
      .then((topo: Topology) => {
        const proj = geoNaturalEarth1().scale(153).translate([W / 2, H / 2]);
        const path = geoPath(proj);
        const countries = feature(topo, topo.objects.countries as GeometryCollection);
        const paths = (countries.features as any[]).map((f, i) => ({
          id: f.id != null ? String(f.id).padStart(3, "0") : "",
          key: f.id != null ? String(f.id).padStart(3, "0") : `geo-${i}`,
          path: path(f) ?? "",
        }));
        setGeoData(paths);
      });
  }, []);

  useEffect(() => {
    fetch("/api/accounts").then((r) => r.json()).then(setAccounts);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (accountId) params.set("accountId", accountId);
    fetch(`/api/reports/map?${params}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  const numericToIso2 = Object.fromEntries(Object.entries(iso2ToNumeric).map(([k, v]) => [v, k]));
  const countryMap = Object.fromEntries(data.map((d) => [d.country, d]));
  const maxExpenses = Math.max(...data.map((d) => d.expenses), 1);

  const totalExpenses = data.reduce((s, d) => s + d.expenses, 0);
  const totalIncome = data.reduce((s, d) => s + d.income, 0);
  const totalTxs = data.reduce((s, d) => s + d.txCount, 0);
  const topCountries = [...data].sort((a, b) => b.expenses - a.expenses).slice(0, 8);

  const borderColor = isDark ? "#3f3f46" : "#d4d4d8";
  const gradientFrom = isDark ? "#27272a" : "#e4e4e7";
  const gradientTo = isDark ? "rgb(239,68,68)" : "rgb(185,28,28)";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">World Map</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">Spending by country</p>
        </div>
        <select
          value={accountId}
          onChange={(e) => { setAccountId(e.target.value); setSelected(null); }}
          className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-1.5 text-sm dark:text-zinc-100"
        >
          <option value="">All accounts</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Countries visited", value: String(data.length) },
          { label: "Transactions", value: String(totalTxs) },
          { label: "Total spent", value: fmt(totalExpenses), color: "text-red-500 dark:text-red-400" },
          { label: "Total received", value: fmt(totalIncome), color: "text-emerald-600 dark:text-emerald-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
            <p className={`text-xl font-semibold mt-1 tabular-nums ${color ?? ""}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Map + sidebar */}
      <div className="flex gap-4 flex-col lg:flex-row">
        {/* Map */}
        <div className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <p className="text-sm text-zinc-400 dark:text-zinc-500">Loading…</p>
            </div>
          )}

          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: "100%", height: "auto", display: "block" }}
          >
            {geoData.map(({ id, key, path }) => {
              const iso2 = numericToIso2[id];
              const d = iso2 ? countryMap[iso2] : undefined;
              const isSelected = selected?.country === iso2;
              const isHovered = hovered === iso2;

              let fill = isDark ? "#27272a" : "#e4e4e7";
              if (isSelected) fill = "#f59e0b";
              else if (isHovered && d) fill = isDark ? "#facc15" : "#fbbf24";
              else if (d) fill = getColor(d.expenses, maxExpenses, isDark);

              return (
                <path
                  key={key}
                  d={path}
                  fill={fill}
                  stroke={borderColor}
                  strokeWidth={0.5}
                  style={{ cursor: d ? "pointer" : "default", transition: "fill 0.15s" }}
                  onMouseEnter={() => iso2 && d && setHovered(iso2)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => {
                    if (!d) return;
                    setSelected(selected?.country === iso2 ? null : d);
                  }}
                />
              );
            })}
          </svg>

          {/* Hover label */}
          {hovered && countryMap[hovered] && !selected && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
              <div className="rounded-lg bg-[var(--card)] border border-[var(--border)] shadow-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap">
                {countryByCode[hovered] ?? hovered} · {fmt(countryMap[hovered].expenses)}
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="absolute top-3 right-3 rounded-lg bg-[var(--card)]/90 border border-[var(--border)] px-3 py-2">
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-1 font-medium uppercase tracking-wide">Spending</p>
            <div className="w-20 h-2 rounded-full" style={{ background: `linear-gradient(to right, ${gradientFrom}, ${gradientTo})` }} />
            <div className="flex justify-between text-[10px] text-zinc-400 mt-0.5">
              <span>Low</span><span>High</span>
            </div>
          </div>

          {!loading && data.length > 0 && !selected && (
            <p className="absolute bottom-3 right-3 text-[10px] text-zinc-400/60 dark:text-zinc-500/60">
              Click a country for details
            </p>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:w-72 space-y-3">
          {selected ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
                <div>
                  <p className="font-semibold">{countryByCode[selected.country] ?? selected.country}</p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{selected.txCount} transaction{selected.txCount !== 1 ? "s" : ""}</p>
                </div>
                <button onClick={() => setSelected(null)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1">
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="px-4 py-3 space-y-3">
                {selected.expenses > 0 && (
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Spent</p>
                    <p className="text-2xl font-semibold text-red-500 dark:text-red-400 tabular-nums">{fmtFull(selected.expenses)}</p>
                    <div className="mt-1.5 h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div className="h-full rounded-full bg-red-400 dark:bg-red-500" style={{ width: `${(selected.expenses / totalExpenses) * 100}%` }} />
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">{((selected.expenses / totalExpenses) * 100).toFixed(1)}% of total</p>
                  </div>
                )}
                {selected.income > 0 && (
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Received</p>
                    <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtFull(selected.income)}</p>
                  </div>
                )}
                {selected.cities.length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">Cities</p>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.cities.map((city) => (
                        <span key={city} className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs font-medium">{city}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-700 px-4 py-6 text-center">
              <p className="text-sm text-zinc-400 dark:text-zinc-500">Click a country to see details</p>
            </div>
          )}

          {topCountries.length > 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] divide-y divide-[var(--border)]">
              <p className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Top countries</p>
              {topCountries.map((d, i) => (
                <button
                  key={d.country}
                  onClick={() => setSelected(selected?.country === d.country ? null : d)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors ${selected?.country === d.country ? "bg-amber-50 dark:bg-amber-950/30" : ""}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xs text-zinc-400 w-4 flex-shrink-0">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{countryByCode[d.country] ?? d.country}</p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">{d.txCount} tx</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-red-500 dark:text-red-400 tabular-nums flex-shrink-0 ml-2">{fmt(d.expenses)}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {data.length === 0 && !loading && (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">No location data yet.</p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">Add a location when creating or editing transactions.</p>
        </div>
      )}
    </div>
  );
}
