"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";

// useSearchParams must sit inside a Suspense boundary (Next.js CSR bailout requirement),
// so the actual form lives in an inner component wrapped below.
export default function AdminLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError("Neispravan email ili lozinka.");
      setLoading(false);
      return;
    }

    const next = searchParams.get("next") || "/admin/tiketi";
    router.push(next);
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <Logo />
      <form className="card mt-6" onSubmit={handleSubmit}>
        <h1 className="text-lg font-bold text-gray-900">Prijava za podršku</h1>

        <div className="mt-5 space-y-4">
          <div>
            <label className="form-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="password">
              Lozinka
            </label>
            <input
              id="password"
              type="password"
              required
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="form-error">{error}</p>}
        </div>

        <button type="submit" className="btn-primary mt-6 w-full" disabled={loading}>
          {loading ? "Prijavljivanje..." : "Prijavi se"}
        </button>
      </form>
    </main>
  );
}
