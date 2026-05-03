"use client";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-semibold mb-6">Sign in</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Email</label>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent dark:bg-zinc-800/50 px-3 py-2 text-sm dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Password</label>
          <input
            name="password"
            type="password"
            required
            className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-transparent dark:bg-zinc-800/50 px-3 py-2 text-sm dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-400"
          />
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
        No account?{" "}
        <Link href="/register" className="text-zinc-900 dark:text-zinc-100 font-medium">
          Register
        </Link>
      </p>
    </div>
  );
}
