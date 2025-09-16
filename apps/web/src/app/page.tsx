'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import Image from 'next/image';

export default function Page() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setCarregando(true);
  setErro('');

  console.log('🔐 Tentando login com:', { email, senha });

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  console.log('📋 Resposta do Supabase:', { data, error });

  if (error) {
    console.log('❌ Erro de login:', error.message);
    setErro('Credenciais inválidas. Verifique seus dados.');
  } else {
    console.log('✅ Login bem-sucedido! Redirecionando para /redirect...');
    console.log('👤 Usuário:', data.user);
    
    // ⚠️ SOLUÇÃO: Força recarregamento completo para garantir cookies/sessão
    window.location.href = '/redirect';
  }

  setCarregando(false);
};
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-500 to-sky-600 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 space-y-6">
        {/* Logo e título */}
        <div className="flex flex-col items-center gap-3">
          <Image src="/moxinexa-logo.svg" alt="Moxi Nexa" width={42} height={42} />
          <h1 className="text-3xl font-bold text-slate-900">Moxi Nexa</h1>
          <p className="text-sm text-slate-500">Sistema de Gestão Escolar</p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              E-mail institucional
            </label>
            <input
              type="email"
              id="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-teal-600 focus:ring-teal-600"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label htmlFor="senha" className="block text-sm font-medium text-slate-700">
              Senha
            </label>
            <input
              type="password"
              id="senha"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-teal-600 focus:ring-teal-600"
              placeholder="••••••••"
            />
          </div>

          {erro && (
            <p className="text-center text-sm text-red-500 font-medium">{erro}</p>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {/* Rodapé */}
        <p className="text-center text-xs text-slate-400">
          &copy; {new Date().getFullYear()} Moxi Nexa. Criamos sistemas que escalam.
        </p>
      </div>
    </main>
  );
}
