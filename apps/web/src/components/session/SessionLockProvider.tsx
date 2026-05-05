"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Lock, LogOut, ShieldCheck } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

const LOCK_EVENT = "klasse:lock-screen";
const LOCK_STORAGE_KEY = "klasse:screen-lock:v1";
const LAST_ACTIVITY_KEY = "klasse:last-activity:v1";
const AUTO_LOCK_MS = 5 * 60 * 1000;
const WARNING_BEFORE_LOCK_MS = 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];

type SessionUser = {
  id: string;
  email: string | null;
  name: string;
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
  const lastActivityRef = useRef(Date.now());
  const excluded = isLockExcludedPath(pathname);

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

      const metadata = (authUser.user_metadata ?? {}) as { full_name?: string; name?: string };
      setUser({
        id: authUser.id,
        email: authUser.email ?? null,
        name: metadata.full_name || metadata.name || authUser.email || "Utilizador",
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
      const metadata = (authUser.user_metadata ?? {}) as { full_name?: string; name?: string };
      setUser({
        id: authUser.id,
        email: authUser.email ?? null,
        name: metadata.full_name || metadata.name || authUser.email || "Utilizador",
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
    window.addEventListener(LOCK_EVENT, handleLockEvent);
    return () => window.removeEventListener(LOCK_EVENT, handleLockEvent);
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
      if (idleFor >= AUTO_LOCK_MS) {
        lock();
        return;
      }
      setWarningVisible(idleFor >= AUTO_LOCK_MS - WARNING_BEFORE_LOCK_MS);
    }, 30_000);

    markActivity();
    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, markActivity));
      window.clearInterval(interval);
    };
  }, [excluded, lock, locked, user]);

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
              <p className="text-sm font-bold text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>

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
    </>
  );
}
