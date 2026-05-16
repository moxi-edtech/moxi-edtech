"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Lock, LogOut, ShieldCheck } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

const LOCK_EVENT = "klasse:lock-screen";
const CONFIG_EVENT = "klasse:session-config";
const LOCK_STORAGE_KEY = "klasse:screen-lock:v1";
const LAST_ACTIVITY_KEY = "klasse:last-activity:v1";
const DEFAULT_AUTO_LOCK_MINUTES = 15;
const WARNING_BEFORE_LOCK_MS = 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];

type SessionUser = {
  id: string;
  email: string | null;
  name: string;
  idleTimeoutMinutes: number;
};

function isLockExcludedPath(pathname: string | null) {
  const path = pathname || "";
  return (
    !path ||
    path === "/" ||
    path.startsWith("/login") ||
    path.startsWith("/redirect") ||
    path.startsWith("/forgot-password") ||
    path.startsWith("/reset-password") ||
    path.startsWith("/mudar-senha") ||
    path.includes("/print") ||
    path.startsWith("/admissoes")
  );
}

export function requestScreenLock() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(LOCK_EVENT));
}

export function requestSessionConfig() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(CONFIG_EVENT));
}

export default function SessionLockProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [locked, setLocked] = useState(false);
  const [warningVisible, setWarningVisible] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const excluded = isLockExcludedPath(pathname);

  const autoLockMs = useMemo(() => {
    const minutes = user?.idleTimeoutMinutes ?? DEFAULT_AUTO_LOCK_MINUTES;
    return minutes * 60 * 1000;
  }, [user?.idleTimeoutMinutes]);

  const lock = useCallback(() => {
    // Para bloqueio manual ou automático, o único lugar proibido é a tela de login/auth
    if (pathname?.startsWith("/login") || pathname?.startsWith("/forgot-password") || pathname?.startsWith("/reset-password")) {
      return;
    }
    
    setWarningVisible(false);
    setLocked(true);
    setPassword("");
    setError(null);
    try {
      localStorage.setItem(LOCK_STORAGE_KEY, "1");
    } catch {}
  }, [pathname]);

  const unlock = useCallback(() => {
    setLocked(false);
    setWarningVisible(false);
    setPassword("");
    setError(null);
    lastActivityRef.current = Date.now();
    try {
      localStorage.removeItem(LOCK_STORAGE_KEY);
      localStorage.setItem(LAST_ACTIVITY_KEY, String(lastActivityRef.current));
    } catch {}
  }, []);

  const continueSession = useCallback(() => {
    setWarningVisible(false);
    lastActivityRef.current = Date.now();
    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(lastActivityRef.current));
    } catch {}
  }, []);

  const updateIdleTimeout = useCallback(async (minutes: number) => {
    if (!user) return;
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: { idle_timeout: minutes }
      });
      if (updateError) throw updateError;
      setUser(prev => prev ? { ...prev, idleTimeoutMinutes: minutes } : null);
      setShowConfig(false);
    } catch (err: any) {
      console.error("Erro ao atualizar timeout:", err);
    } finally {
      setBusy(false);
    }
  }, [supabase, user]);

  useEffect(() => {
    let mounted = true;
    
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      const authUser = data.user;
      
      if (!authUser) {
        setUser(null);
        // Se não houver usuário, não podemos bloquear a tela de forma útil (não haverá como desbloquear)
        setLocked(false);
        try { localStorage.removeItem(LOCK_STORAGE_KEY); } catch {}
        return;
      }

      const metadata = (authUser.user_metadata ?? {}) as { full_name?: string; name?: string; idle_timeout?: number };
      setUser({
        id: authUser.id,
        email: authUser.email ?? null,
        name: metadata.full_name || metadata.name || authUser.email || "Utilizador",
        idleTimeoutMinutes: metadata.idle_timeout ?? DEFAULT_AUTO_LOCK_MINUTES,
      });

      try {
        const shouldRestoreLock = localStorage.getItem(LOCK_STORAGE_KEY) === "1";
        // Só restaura o bloqueio se não estiver em rotas de auth
        const onAuthRoute = pathname?.startsWith("/login") || pathname?.startsWith("/forgot-password");
        if (shouldRestoreLock && !onAuthRoute) setLocked(true);
      } catch {}
    }

    loadUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const authUser = session?.user ?? null;
      if (!authUser) {
        setUser(null);
        setLocked(false);
        return;
      }
      const metadata = (authUser.user_metadata ?? {}) as { full_name?: string; name?: string; idle_timeout?: number };
      setUser({
        id: authUser.id,
        email: authUser.email ?? null,
        name: metadata.full_name || metadata.name || authUser.email || "Utilizador",
        idleTimeoutMinutes: metadata.idle_timeout ?? DEFAULT_AUTO_LOCK_MINUTES,
      });
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase, pathname]);

  const lockRef = useRef(lock);
  lockRef.current = lock;

  useEffect(() => {
    const handleLockEvent = () => {
      lockRef.current();
    };
    const handleConfigEvent = () => {
      setShowConfig(true);
    };
    window.addEventListener(LOCK_EVENT, handleLockEvent);
    window.addEventListener(CONFIG_EVENT, handleConfigEvent);
    return () => {
      window.removeEventListener(LOCK_EVENT, handleLockEvent);
      window.removeEventListener(CONFIG_EVENT, handleConfigEvent);
    };
  }, []);

  useEffect(() => {
    if (excluded || !user || locked) return;

    const markActivity = () => {
      if (locked) return;
      const now = Date.now();
      lastActivityRef.current = now;
      try {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      } catch {}
    };

    ACTIVITY_EVENTS.forEach((eventName) => window.addEventListener(eventName, markActivity, { passive: true }));
    const interval = window.setInterval(() => {
      if (locked) return;
      const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || lastActivityRef.current);
      const idleFor = Date.now() - last;
      if (idleFor >= autoLockMs) {
        lock();
        return;
      }
      setWarningVisible(idleFor >= autoLockMs - WARNING_BEFORE_LOCK_MS);
    }, 10_000); // Check more frequently for better accuracy

    markActivity();
    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, markActivity));
      window.clearInterval(interval);
    };
  }, [excluded, lock, locked, user, autoLockMs]);

  async function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user?.email) {
      setError("Esta conta não tem e-mail associado para revalidar a sessão.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });

      if (signInError || !data.user || data.user.id !== user.id) {
        setError("Senha inválida. Tente novamente.");
        return;
      }

      unlock();
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    try {
      await supabase.auth.signOut();
      try {
        localStorage.removeItem(LOCK_STORAGE_KEY);
      } catch {}
      router.replace("/");
    } finally {
      setBusy(false);
    }
  }

  const TIMEOUT_OPTIONS = [
    { label: "5 min", value: 5 },
    { label: "15 min", value: 15 },
    { label: "30 min", value: 30 },
    { label: "1 hora", value: 60 },
    { label: "4 horas", value: 240 },
  ];

  return (
    <>
      {children}
      {locked && user ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/85 px-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-klasse-green/10 text-klasse-green">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-400">Sessão protegida</p>
                <h1 className="mt-1 text-xl font-black text-slate-950">Tela bloqueada</h1>
                <p className="mt-1 text-sm text-slate-500">Confirme a senha para continuar a operação.</p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfig(!showConfig)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                  title="Configurações de sessão"
                >
                  <ShieldCheck className="h-4 w-4" />
                </button>
              </div>
            </div>

            {showConfig && (
              <div className="mt-4 rounded-xl border border-klasse-green/20 bg-klasse-green/5 p-4 animate-in fade-in slide-in-from-top-2">
                <p className="text-xs font-bold uppercase tracking-widest text-klasse-green-900 mb-3">Tempo para bloqueio</p>
                <div className="flex flex-wrap gap-2">
                  {TIMEOUT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={busy}
                      onClick={() => updateIdleTimeout(opt.value)}
                      className={`
                        flex-1 min-w-[70px] rounded-lg px-2 py-2 text-xs font-bold transition-all
                        ${user.idleTimeoutMinutes === opt.value
                          ? "bg-klasse-green text-white shadow-md shadow-klasse-green/20"
                          : "bg-white text-slate-600 border border-slate-200 hover:border-klasse-green/40 hover:text-klasse-green"
                        }
                      `}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-klasse-green-800/70 italic">
                  * Alteração salva no seu perfil.
                </p>
              </div>
            )}

            <form className="mt-5 space-y-3" onSubmit={handleUnlock}>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-widest text-slate-500">Senha</span>
                <input
                  autoFocus
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-klasse-green focus:ring-4 focus:ring-klasse-green/10"
                  placeholder="Digite a sua senha"
                />
              </label>

              {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}

              <button
                type="submit"
                disabled={busy || password.length < 1}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-klasse-green px-4 py-3 text-sm font-black text-white transition hover:bg-klasse-green/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ShieldCheck className="h-4 w-4" />
                {busy ? "A validar..." : "Desbloquear"}
              </button>
            </form>

            <button
              type="button"
              onClick={handleLogout}
              disabled={busy}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <LogOut className="h-4 w-4" />
              Sair da conta
            </button>
          </div>
        </div>
      ) : null}
      {warningVisible && !locked && user ? (
        <div className="fixed bottom-4 right-4 z-[9998] w-[min(420px,calc(100vw-2rem))] rounded-2xl border border-amber-200 bg-white p-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Lock className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-slate-950">Sessão prestes a bloquear</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Sem atividade recente. A tela será bloqueada em menos de 1 minuto.
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={continueSession}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-klasse-green px-3 py-2 text-xs font-black text-white transition hover:bg-klasse-green/90"
            >
              Continuar sessão
            </button>
            <button
              type="button"
              onClick={lock}
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Bloquear agora
            </button>
          </div>
        </div>
      ) : null}

      {/* Standalone Config Modal (Unlocked) */}
      {showConfig && !locked && user ? (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4 mb-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-klasse-green/10 text-klasse-green">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-black text-slate-950">Sessão</h1>
                <p className="text-sm text-slate-500">Ajuste o tempo de inatividade.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Tempo para bloqueio</p>
                <div className="flex flex-wrap gap-2">
                  {TIMEOUT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={busy}
                      onClick={() => updateIdleTimeout(opt.value)}
                      className={`
                        flex-1 min-w-[80px] rounded-xl px-2 py-2.5 text-xs font-bold transition-all
                        ${user.idleTimeoutMinutes === opt.value
                          ? "bg-klasse-green text-white shadow-md shadow-klasse-green/20"
                          : "bg-slate-50 text-slate-600 border border-slate-200 hover:border-klasse-green/40 hover:text-klasse-green"
                        }
                      `}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfig(false)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
