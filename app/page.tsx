
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "No fue posible iniciar sesión.");
        return;
      }

      router.replace("/catalog");
      router.refresh();
    } catch {
      setError("Error de conexión. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12 text-slate-900">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-700 text-3xl font-bold text-white shadow-lg">
            S
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight">
            Shop<span className="text-blue-700">Online</span>
          </h1>

          <p className="mt-2 text-slate-500">
            Tu tienda mayorista de tecnología
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl"
        >
          <h2 className="mb-2 text-2xl font-bold">
            Iniciar sesión
          </h2>

          <p className="mb-7 text-sm text-slate-500">
            Ingresa tus credenciales para continuar.
          </p>

          <label
            htmlFor="username"
            className="mb-2 block text-sm font-semibold"
          >
            Usuario
          </label>

          <input
            id="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Nombre de usuario"
            required
            className="mb-5 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          />

          <label
            htmlFor="password"
            className="mb-2 block text-sm font-semibold"
          >
            Contraseña
          </label>

          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Tu contraseña"
            required
            className="mb-5 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          />

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-700 px-4 py-3 font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Ingresando..." : "Ingresar a ShopOnline"}
          </button>
        </form>

        <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-5 text-sm">
          <h3 className="mb-3 font-bold text-blue-900">
            Usuarios disponibles para QA
          </h3>

          <div className="space-y-3 text-slate-700">
            {[
              ["standard_user", "Sistema funcional"],
              ["checkout_bug_user", "Errores de checkout"],
              ["inventory_bug_user", "Errores de inventario"],
              ["discount_user", "Pruebas del descuento del 10 %"],
            ].map(([user, description]) => (
              <div
                key={user}
                className="flex flex-wrap items-center justify-between gap-2"
              >
                <code className="font-semibold text-blue-800">
                  {user}
                </code>
                <span className="text-xs">{description}</span>
              </div>
            ))}
          </div>

          <p className="mt-4 border-t border-blue-200 pt-3 text-xs text-slate-500">
            Utiliza la contraseña de QA configurada para las cuentas. discount_user tiene la misma contraseña de standard_user.
          </p>
        </div>
      </div>
    </main>
  );
}
