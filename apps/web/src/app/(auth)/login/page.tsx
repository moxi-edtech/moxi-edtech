'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearSupabaseCookies, clearAllAuthData, getCookiesForDebug } from '@/utils/cookieUtils';

export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    setErro('');

    console.log('=== INÍCIO DO LOGIN DEBUG ===');
    console.log('Tentando login com:', { email, senha: '***' });

    // 🔥 LIMPAR COOKIES CORROMPIDOS ANTES DO LOGIN
    clearSupabaseCookies();
    console.log('Cookies após limpeza:', getCookiesForDebug());

    try {
      console.log('Fazendo fetch para /api/auth/login...');
      
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email: email.trim(), 
          password: senha 
        }),
      });

      console.log('✅ Fetch completo. Status:', res.status, res.statusText);

      const textResponse = await res.text();
      console.log('Resposta bruta:', textResponse);

      let data;
      try {
        data = textResponse ? JSON.parse(textResponse) : {};
        console.log('✅ JSON parseado com sucesso:', data);
      } catch (parseError) {
        console.error('❌ Erro ao parsear JSON:', parseError);
        console.error('Resposta que falhou:', textResponse);
        setErro('Resposta inválida do servidor');
        return;
      }

      if (!res.ok) {
        console.error('❌ Erro HTTP:', res.status, data);
        setErro(data.error || data.message || `Erro ${res.status}: ${res.statusText}`);
      } else if (!data.ok) {
        console.error('❌ Erro na resposta:', data);
        setErro(data.error || 'Credenciais inválidas. Verifique seus dados.');
      } else {
        console.log('🎉 Login bem-sucedido! Dados:', data);
        console.log('Redirecionando para /redirect...');
        
        // Forçar recarregamento completo para limpar estados
        window.location.href = '/redirect';
      }
    } catch (error) {
      console.error('❌ Erro na requisição:', error);
      setErro('Erro de conexão com o servidor. Verifique sua conexão.');
    } finally {
      setCarregando(false);
      console.log('=== FIM DO LOGIN DEBUG ===');
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-teal-500 to-sky-600 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-teal-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">MN</span>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Moxi Nexa</h1>
          <p className="text-sm text-slate-500">Sistema de Gestão Escolar</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Usuário (e-mail ou número)
            </label>
            <input
              type="text"
              id="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 shadow-sm focus:border-teal-600 focus:ring-teal-600"
              placeholder="seu@email.com ou 1234567"
              disabled={carregando}
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
              disabled={carregando}
            />
          </div>

          {erro && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600 font-medium">{erro}</p>
              <button
                type="button"
                onClick={() => {
                  clearAllAuthData();
                  alert('Todos os dados de autenticação foram limpos! Recarregue a página.');
                }}
                className="text-xs text-blue-500 underline mt-2"
              >
                Limpar tudo e recarregar
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white py-2 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {/* Área de debug para testes manuais */}
        <div className="border-t pt-4 mt-4">
          <p className="text-xs text-gray-500 mb-2">Debug:</p>
          <button
            onClick={() => {
              console.log('Cookies atuais:', getCookiesForDebug());
              console.log('LocalStorage:', { ...localStorage });
            }}
            className="text-xs text-blue-500 underline mr-4"
          >
            Ver cookies
          </button>
          <button
            onClick={() => {
              clearAllAuthData();
              console.log('Todos os dados de autenticação limpos');
            }}
            className="text-xs text-blue-500 underline"
          >
            Limpar tudo
          </button>
        </div>

        <p className="text-center text-xs text-slate-400">
          &copy; {new Date().getFullYear()} Moxi Nexa
        </p>
      </div>
    </main>
  );
}