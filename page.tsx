"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface Prediccion {
  hora_optima: string;
  confianza: number;
  congestion_actual: number;
  tiempo_espera_min: number;
  horarios: { hora: string; carga: number }[];
  recomendacion: string;
}

type EstadoFetch = "idle" | "loading" | "success" | "error";

interface Tramite {
  id: string;
  nombre: string;
  icono: string;
  categoria: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const TRAMITES: Tramite[] = [
  { id: "carnet", nombre: "Renovación CI", icono: "🪪", categoria: "Identidad" },
  { id: "licencia", nombre: "Licencia de Conducir", icono: "🚗", categoria: "Transporte" },
  { id: "pasaporte", nombre: "Pasaporte", icono: "📘", categoria: "Identidad" },
  { id: "Registro Civil", nombre: "Registro Civil", icono: "📜", categoria: "Legal" },
  { id: "impuestos", nombre: "Pago de impuestos", icono: "🏠", categoria: "Propiedad" },
  { id: "certificado", nombre: "Certificado", icono: "🧾", categoria: "Tributario" },
];

// Fallback demo data cuando el backend no está disponible
const DEMO_DATA: Prediccion = {
  hora_optima: "07:30",
  confianza: 94,
  congestion_actual: 62,
  tiempo_espera_min: 8,
  horarios: [
    { hora: "07:00", carga: 12 },
    { hora: "08:00", carga: 41 },
    { hora: "09:00", carga: 87 },
    { hora: "10:00", carga: 95 },
    { hora: "11:00", carga: 78 },
    { hora: "12:00", carga: 55 },
    { hora: "13:00", carga: 28 },
    { hora: "14:00", carga: 22 },
    { hora: "15:00", carga: 60 },
    { hora: "16:00", carga: 82 },
    { hora: "17:00", carga: 45 },
    { hora: "18:00", carga: 9 },
  ],
  recomendacion:
    "El mejor momento para realizar tu trámite es temprano en la mañana entre 07:00 y 08:00.",
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function PulsingDot({ color = "bg-emerald-400" }: { color?: string }) {
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-60`} />
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${color}`} />
    </span>
  );
}

function GlowCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl
        transition-all duration-300 hover:bg-white/[0.06] hover:border-white/[0.14]
        hover:shadow-2xl hover:shadow-blue-950/40 ${className}`}
    >
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="relative w-14 h-14">
        <div className="absolute inset-0 rounded-full border-2 border-blue-500/20" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-400 animate-spin" />
        <div
          className="absolute inset-2 rounded-full border border-transparent border-t-cyan-300 animate-spin"
          style={{ animationDuration: "0.65s", animationDirection: "reverse" }}
        />
      </div>
      <p className="text-sm text-slate-500 animate-pulse">Consultando modelo IA…</p>
    </div>
  );
}

function DonutChart({
  value,
  color,
  size = 80,
}: {
  value: number;
  color: string;
  size?: number;
}) {
  const r = size * 0.38;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth={size * 0.1}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={size * 0.1}
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 1.4s cubic-bezier(0.34,1.56,0.64,1)" }}
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function Home() {
  const [tramiteActivo, setTramiteActivo] = useState<Tramite>(TRAMITES[0]);
  const [prediccion, setPrediccion] = useState<Prediccion | null>(null);
  const [estado, setEstado] = useState<EstadoFetch>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);
  const dashRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = () => setNavScrolled(window.scrollY > 50);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  // ── Fetch from FastAPI backend ──────────────────────────────────────────────
  const fetchPrediccion = useCallback(async (tramite: Tramite) => {
    setEstado("loading");
    setPrediccion(null);
    setErrorMsg("");
    setDemoMode(false);
    try {
      const res = await fetch(`:https://gestion-publica.onrender.com/predict/${tramite.id}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
      const data: Prediccion = await res.json();
      setPrediccion(data);
      setEstado("success");
    } catch (err: unknown) {
      // Backend offline → graceful fallback with demo data
      console.warn("Backend no disponible, usando datos demo:", err);
      setPrediccion(DEMO_DATA);
      setEstado("success");
      setDemoMode(true);
    }
  }, []);

  useEffect(() => {
    fetchPrediccion(tramiteActivo);
  }, [tramiteActivo, fetchPrediccion]);

  const handleSelect = (t: Tramite) => {
    setTramiteActivo(t);
    setTimeout(() => dashRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  // Congestion helpers
  const congColor =
    prediccion
      ? prediccion.congestion_actual < 35
        ? "#10b981"
        : prediccion.congestion_actual < 65
        ? "#f59e0b"
        : "#ef4444"
      : "#3b82f6";

  const congLabel =
    prediccion
      ? prediccion.congestion_actual < 35
        ? "Baja"
        : prediccion.congestion_actual < 65
        ? "Moderada"
        : "Alta"
      : "—";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-[#04080f] text-white overflow-x-hidden"
      style={{ fontFamily: "'Sora', 'Segoe UI', system-ui, sans-serif" }}
    >
      {/* Fonts + keyframes */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800;900&display=swap');
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        .fade-up { animation: fadeUp 0.75s cubic-bezier(0.22,1,0.36,1) both; }
        .d1 { animation-delay: 0.05s; }
        .d2 { animation-delay: 0.15s; }
        .d3 { animation-delay: 0.25s; }
        .d4 { animation-delay: 0.35s; }
        .d5 { animation-delay: 0.45s; }
      `}</style>

      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-56 -left-56 w-[700px] h-[700px] rounded-full bg-blue-700/10 blur-[140px]" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full bg-cyan-600/6 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 w-[600px] h-[350px] rounded-full bg-indigo-700/8 blur-[100px]" />
        <svg className="absolute inset-0 w-full h-full opacity-[0.024]">
          <defs>
            <pattern id="g" width="52" height="52" patternUnits="userSpaceOnUse">
              <path d="M52 0L0 0 0 52" fill="none" stroke="#60a5fa" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#g)" />
        </svg>
      </div>

      {/* ═════════════════════════════════════ NAVBAR */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          navScrolled
            ? "bg-[#04080f]/88 backdrop-blur-2xl border-b border-white/[0.06] shadow-2xl shadow-black/50"
            : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 flex items-center justify-center">
              <div className="absolute inset-0 bg-blue-500 rounded-lg opacity-20 rotate-12" />
              <span className="text-lg relative z-10">🏛</span>
            </div>
            <div className="leading-none">
              <p className="text-[10px] text-blue-400 font-bold tracking-[0.2em] uppercase">Sistema Nacional</p>
              <p className="text-sm font-bold text-white">GPI · Bolivia</p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-7">
            {["Inicio", "Predicciones", "Estadísticas", "Oficinas", "Soporte"].map((l) => (
              <a
                key={l}
                href="#"
                className="text-sm text-slate-400 hover:text-white transition-colors relative group"
              >
                {l}
                <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-blue-400 transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <PulsingDot />
              <span className="text-xs text-emerald-400 font-semibold">IA Activa</span>
            </div>
            <button className="px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-500 rounded-xl transition-all shadow-lg shadow-blue-900/40 hover:-translate-y-0.5">
              Ingresar
            </button>
          </div>
        </div>
      </nav>

      {/* ═════════════════════════════════════ HERO */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center text-center px-6 pt-24 pb-20">
        <div className="fade-up inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-500/25 bg-blue-500/8 text-blue-300 text-xs font-bold tracking-widest uppercase mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          Predicción con Inteligencia Artificial
        </div>

        <h1 className="fade-up d1 text-5xl sm:text-7xl font-black tracking-tight leading-[1.02] mb-6 max-w-5xl">
          <span className="text-white">Gestión Pública</span>
          <br />
          <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-sky-400 bg-clip-text text-transparent">
            Inteligente
          </span>
        </h1>

        <p className="fade-up d2 text-lg sm:text-xl text-slate-400 max-w-2xl leading-relaxed mb-10">
          Usa IA y análisis de datos para conocer el mejor horario para tus trámites públicos.
          Elimina filas, ahorra tiempo y mejora tu experiencia ciudadana.
        </p>

        <div className="fade-up d3 flex flex-wrap justify-center gap-4 mb-20">
          <button
            onClick={() => dashRef.current?.scrollIntoView({ behavior: "smooth" })}
            className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-base transition-all shadow-xl shadow-blue-900/50 hover:-translate-y-0.5"
          >
            Ver Predicciones →
          </button>
          <button className="px-8 py-3.5 border border-white/10 hover:border-white/25 rounded-xl font-semibold text-base text-slate-400 hover:text-white transition-all">
            ¿Cómo funciona?
          </button>
        </div>

        {/* Tramite selector on hero */}
        <div className="fade-up d4 w-full max-w-3xl">
          <p className="text-xs text-slate-600 uppercase tracking-widest font-semibold mb-4">
            Selecciona un trámite para comenzar
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {TRAMITES.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelect(t)}
                className={`flex items-center gap-3 p-4 rounded-2xl border text-left transition-all duration-200 ${
                  tramiteActivo.id === t.id
                    ? "bg-blue-600/20 border-blue-500/40 shadow-lg shadow-blue-900/20"
                    : "bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.07] hover:border-white/15"
                }`}
              >
                <span className="text-2xl">{t.icono}</span>
                <div>
                  <p
                    className={`text-sm font-semibold leading-tight ${
                      tramiteActivo.id === t.id ? "text-blue-300" : "text-white"
                    }`}
                  >
                    {t.nombre}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5">{t.categoria}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════════════════════════════════ DASHBOARD */}
      <section ref={dashRef} className="relative z-10 max-w-7xl mx-auto px-6 pb-32">

        {/* Header */}
        <div className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs text-blue-400 font-bold uppercase tracking-widest mb-2">
              Panel de Predicción IA
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-white">
              {tramiteActivo.icono} {tramiteActivo.nombre}
            </h2>
            <p className="text-slate-500 mt-1 text-sm">
              Conectado a{" "}
              <code className="text-blue-400 text-xs bg-blue-500/10 px-1.5 py-0.5 rounded">
                https://gestion-publica.onrender.com/predict/{tramiteActivo.id}
              </code>
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {demoMode && (
              <span className="text-xs px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 font-semibold">
                ⚠ Modo Demo — Backend offline
              </span>
            )}
            {!demoMode && estado === "success" && (
              <span className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-semibold">
                <PulsingDot /> Backend conectado
              </span>
            )}
            <button
              onClick={() => fetchPrediccion(tramiteActivo)}
              disabled={estado === "loading"}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            >
              <span className={estado === "loading" ? "animate-spin inline-block" : ""}>🔄</span>
              Actualizar
            </button>
          </div>
        </div>

        {/* Loading */}
        {estado === "loading" && (
          <GlowCard className="p-6">
            <Spinner />
          </GlowCard>
        )}

        {/* Error */}
        {estado === "error" && (
          <GlowCard className="p-10 text-center">
            <p className="text-5xl mb-4">⚠️</p>
            <p className="text-white font-bold text-xl mb-2">Error al conectar con el backend</p>
            <p className="text-slate-500 text-sm mb-6 max-w-md mx-auto">{errorMsg}</p>
            <button
              onClick={() => fetchPrediccion(tramiteActivo)}
              className="px-7 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-bold transition"
            >
              Reintentar
            </button>
          </GlowCard>
        )}

        {/* Success */}
        {estado === "success" && prediccion && (
          <div className="space-y-6">

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  icon: "⏰",
                  label: "Hora Óptima",
                  value: prediccion.hora_optima,
                  sub: "Recomendada por IA",
                  valueColor: "text-cyan-300",
                },
                {
                  icon: "⏱",
                  label: "Tiempo de Espera",
                  value: `${prediccion.tiempo_espera_min} min`,
                  sub: "En hora óptima",
                  valueColor: "text-emerald-300",
                },
                {
                  icon: "🎯",
                  label: "Confianza IA",
                  value: `${prediccion.confianza}%`,
                  sub: "Precisión del modelo",
                  valueColor: "text-blue-300",
                },
                {
                  icon: "📊",
                  label: "Congestión",
                  value: congLabel,
                  sub: `${prediccion.congestion_actual}% de capacidad`,
                  valueColor:
                    prediccion.congestion_actual < 35
                      ? "text-emerald-300"
                      : prediccion.congestion_actual < 65
                      ? "text-amber-300"
                      : "text-red-300",
                },
              ].map((c) => (
                <GlowCard key={c.label} className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-2xl">{c.icon}</span>
                    <PulsingDot color="bg-blue-400" />
                  </div>
                  <p className={`text-2xl font-black ${c.valueColor}`}>{c.value}</p>
                  <p className="text-xs font-semibold text-slate-300 mt-1">{c.label}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{c.sub}</p>
                </GlowCard>
              ))}
            </div>

            {/* Main Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Heatmap */}
              <GlowCard className="lg:col-span-2 p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="font-bold text-white">Mapa de Demanda Horaria</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Predicción del día · {tramiteActivo.nombre}
                    </p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-semibold">
                    Hoy
                  </span>
                </div>

                <div className="space-y-0.5">
                  {prediccion?.horarios?.map((slot) => (
                    <div
                      key={slot.hora}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.04] transition-all"
                    >
                      <span className="font-mono text-xs text-slate-500 w-12 shrink-0">{slot.hora}</span>
                      <div className="flex-1 h-5 bg-white/[0.05] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r ${
                            slot.carga < 35
                              ? "from-emerald-400 to-emerald-500"
                              : slot.carga < 65
                              ? "from-amber-400 to-orange-400"
                              : "from-red-500 to-rose-500"
                          }`}
                          style={{ width: `${slot.carga}%` }}
                        />
                      </div>
                      <span
                        className={`text-xs font-semibold w-16 text-right ${
                          slot.carga < 35
                            ? "text-emerald-400"
                            : slot.carga < 65
                            ? "text-amber-400"
                            : "text-red-400"
                        }`}
                      >
                        {slot.carga < 35 ? "Óptimo" : slot.carga < 65 ? "Moderado" : "Ocupado"}
                      </span>
                      <span className="text-xs text-slate-600 w-8 text-right font-mono">
                        {slot.carga}%
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap gap-5 pt-4 border-t border-white/[0.06]">
                  {[
                    ["bg-emerald-400", "Óptimo (< 35%)"],
                    ["bg-amber-400", "Moderado (35–65%)"],
                    ["bg-red-500", "Ocupado (> 65%)"],
                  ].map(([c, l]) => (
                    <div key={l} className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${c}`} />
                      <span className="text-xs text-slate-500">{l}</span>
                    </div>
                  ))}
                </div>
              </GlowCard>

              {/* Right column */}
              <div className="flex flex-col gap-5">

                {/* IA Recommendation */}
                <GlowCard className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center text-sm">
                      🤖
                    </div>
                    <p className="text-sm font-bold text-white">Recomendación IA</p>
                  </div>

                  <div className="bg-gradient-to-br from-blue-600/15 to-cyan-600/10 border border-blue-500/20 rounded-xl p-4 mb-4">
                    <p className="text-3xl font-black text-white mb-0.5">{prediccion.hora_optima}</p>
                    <p className="text-xs text-blue-300 font-semibold">⭐ Hora Óptima Recomendada</p>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">{prediccion.recomendacion}</p>

                  <div className="mt-4 flex items-center justify-between text-xs">
                    <span className="text-slate-600">Confianza del modelo</span>
                    <span className="text-blue-400 font-bold">{prediccion.confianza}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-1000"
                      style={{ width: `${prediccion.confianza}%` }}
                    />
                  </div>
                </GlowCard>

                {/* Congestion donut */}
                <GlowCard className="p-5">
                  <p className="text-sm font-bold text-white mb-4">Congestión Actual</p>
                  <div className="flex items-center gap-4">
                    <div className="relative shrink-0">
                      <DonutChart value={prediccion.congestion_actual} color={congColor} size={80} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-sm font-black text-white">
                          {prediccion.congestion_actual}%
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-lg font-black" style={{ color: congColor }}>
                        {congLabel}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">Nivel de demanda</p>
                      <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                        {prediccion.congestion_actual < 35
                          ? "Excelente momento para tu trámite."
                          : prediccion.congestion_actual < 65
                          ? "Considera esperar al horario óptimo."
                          : "Alta demanda. Te recomendamos el horario sugerido."}
                      </p>
                    </div>
                  </div>
                </GlowCard>

                <button
                  onClick={() => fetchPrediccion(tramiteActivo)}
                  className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-cyan-500 rounded-2xl font-bold text-sm transition-all shadow-xl shadow-blue-900/40 hover:shadow-blue-700/50 hover:-translate-y-0.5"
                >
                  🔄 Actualizar Predicción
                </button>
              </div>
            </div>

            {/* Bottom Stats */}
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
              {[
                { icon: "📋", label: "Trámites Hoy", value: "3,421", delta: "+8.2%", pos: true },
                { icon: "🏢", label: "Oficinas Activas", value: "47", delta: "+3 nuevas", pos: true },
                { icon: "⚡", label: "Tiempo Ahorrado", value: "31 min", delta: "por ciudadano", pos: true },
                { icon: "🌐", label: "Cobertura Nacional", value: "94%", delta: "+2.1%", pos: true },
              ].map((s) => (
                <GlowCard key={s.label} className="p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-xl shrink-0">
                    {s.icon}
                  </div>
                  <div>
                    <p className="text-xl font-black text-white">{s.value}</p>
                    <p className="text-xs text-slate-500">{s.label}</p>
                    <p
                      className={`text-xs font-semibold mt-0.5 ${
                        s.pos ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {s.delta}
                    </p>
                  </div>
                </GlowCard>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ═════════════════════════════════════ FOOTER */}
      <footer className="relative z-10 border-t border-white/[0.05] bg-gradient-to-b from-transparent to-[#020509]">
        <div className="max-w-7xl mx-auto px-6 py-14 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-3">
            Proyecto Universitario · Bolivia
          </p>
          <h2 className="text-2xl sm:text-3xl font-black text-white mb-3 max-w-lg mx-auto leading-tight">
            Modernizando el Servicio Público con IA
          </h2>
          <p className="text-slate-600 text-xs">
            Backend: FastAPI · Frontend: Next.js + TailwindCSS · Modelo: Machine Learning
          </p>
        </div>
        <div className="border-t border-white/[0.05] py-5 px-6 max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-700">
          <p>© 2025 Gestión Pública Inteligente · Proyecto Académico</p>
          <div className="flex items-center gap-2">
            <PulsingDot />
            <span className="text-emerald-700 text-xs">Sistema operativo</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
