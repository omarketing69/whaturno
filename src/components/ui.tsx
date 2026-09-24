"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, className = "btn-primary", pendingText }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? (pendingText ?? "Guardando…") : children}
    </button>
  );
}

export function FormMessage({ state }: { state?: { error?: string; ok?: boolean; message?: string } }) {
  if (state?.error) return <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">{state.error}</p>;
  if (state?.ok && state.message) return <p className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700" role="status">{state.message}</p>;
  return null;
}
