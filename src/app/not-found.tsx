import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-6xl font-black text-slate-300">404</p>
      <p className="text-lg text-slate-600">No encontramos esta página.</p>
      <Link href="/" className="btn-secondary mt-2">Ir al inicio</Link>
    </main>
  );
}
