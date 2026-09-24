"use client";

import { useEffect, useRef, useState } from "react";

type Ready = { number: string; readyAt: string | null };
type Props = { endpoint: string; initial: Ready[]; business: { name: string; logoUrl: string | null; brandColor: string } };

function chime(ctx: AudioContext) {
  const t = ctx.currentTime;
  [880, 1320].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t + i * 0.25);
    gain.gain.exponentialRampToValueAtTime(0.3, t + i * 0.25 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.25 + 0.6);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t + i * 0.25);
    osc.stop(t + i * 0.25 + 0.65);
  });
}

export function PublicDisplay({ endpoint, initial, business }: Props) {
  const [ready, setReady] = useState(initial);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [offline, setOffline] = useState(false);
  const [clock, setClock] = useState("");
  const known = useRef(new Set(initial.map((r) => r.number)));
  const audio = useRef<AudioContext | null>(null);
  const [soundOn, setSoundOn] = useState(false);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }));
    tick();
    const clockTimer = setInterval(tick, 10_000);

    async function poll() {
      try {
        const res = await fetch(endpoint, { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data: { ready: Ready[] } = await res.json();
        const newOnes = data.ready.filter((r) => !known.current.has(r.number)).map((r) => r.number);
        known.current = new Set(data.ready.map((r) => r.number));
        setReady(data.ready);
        setOffline(false);
        if (newOnes.length) {
          setFresh(new Set(newOnes));
          if (audio.current) chime(audio.current);
          setTimeout(() => setFresh(new Set()), 6000);
        }
      } catch {
        setOffline(true);
      }
    }
    const pollTimer = setInterval(poll, 3000);
    return () => { clearInterval(clockTimer); clearInterval(pollTimer); };
  }, [endpoint]);

  function enableSound() {
    audio.current ??= new AudioContext();
    chime(audio.current);
    setSoundOn(true);
  }

  function fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  }

  // Tamaño de los números según la cantidad, para que se lean a distancia
  const size = ready.length <= 4 ? "text-[min(16vw,12rem)]" : ready.length <= 9 ? "text-[min(11vw,8rem)]" : ready.length <= 16 ? "text-[min(8vw,6rem)]" : "text-[min(6vw,4rem)]";
  const cols = ready.length <= 1 ? "grid-cols-1" : ready.length <= 4 ? "grid-cols-2" : ready.length <= 9 ? "grid-cols-3" : "grid-cols-4";

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-white">
      <header className="flex items-center justify-between gap-4 px-6 py-4 sm:px-10" style={{ backgroundColor: business.brandColor }}>
        <div className="flex min-w-0 items-center gap-4">
          {business.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.logoUrl} alt="" className="h-12 w-12 rounded-xl bg-white object-contain p-1" />
          )}
          <p className="truncate text-2xl font-bold sm:text-3xl">{business.name}</p>
        </div>
        <div className="flex items-center gap-3">
          {!soundOn && <button onClick={enableSound} className="rounded-lg bg-white/15 px-3 py-2 text-sm font-medium hover:bg-white/25">🔔 Activar sonido</button>}
          <button onClick={fullscreen} className="rounded-lg bg-white/15 px-3 py-2 text-sm font-medium hover:bg-white/25">⛶ Pantalla completa</button>
          <span className="text-2xl font-semibold tabular-nums sm:text-3xl">{clock}</span>
        </div>
      </header>

      <h1 className="pt-8 text-center text-3xl font-extrabold uppercase tracking-[0.2em] text-emerald-400 sm:text-5xl">Pedidos listos</h1>

      <main className="flex flex-1 items-center justify-center p-6 sm:p-10">
        {ready.length === 0 ? (
          <p className="text-2xl text-slate-500 sm:text-4xl">Pronto verás aquí tu número</p>
        ) : (
          <div className={`grid w-full max-w-7xl gap-5 ${cols}`}>
            {ready.map((r) => (
              <div
                key={r.number}
                className={`rounded-3xl py-6 text-center font-black tabular-nums leading-none ${size} ${fresh.has(r.number) ? "animate-new-ready bg-emerald-500 text-slate-950" : "bg-white/10"}`}
              >
                #{r.number}
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="flex justify-between px-6 pb-4 text-sm text-slate-500 sm:px-10">
        <span>Acércate a recoger tu pedido cuando veas tu número</span>
        {offline && <span className="text-amber-400">Reconectando…</span>}
      </footer>
    </div>
  );
}
