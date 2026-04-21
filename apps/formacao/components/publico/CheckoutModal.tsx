"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Upload, X, CheckCircle2, CreditCard, User, ArrowRight, Loader2 } from "lucide-react";

const checkoutSchema = z.object({
  nome: z.string().min(3, "Nome completo é obrigatório"),
  bi_numero: z.string().min(6, "Número de identificação inválido"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  telefone: z.string().min(9, "Telefone inválido"),
});

type CheckoutForm = z.infer<typeof checkoutSchema>;

type Props = {
  course: {
    id: string;
    nome: string;
    curso_nome: string;
    valor_referencia: number;
    vagas: number;
    vagas_ocupadas: number;
  };
  center: {
    id: string;
    nome: string;
    iban?: string;
  };
  onClose: () => void;
};

export function CheckoutModal({ course, center, onClose }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutSchema),
  });

  const onSubmit = async (data: CheckoutForm) => {
    if (step === 1) {
      setStep(2);
      return;
    }

    if (!file) {
      alert("Por favor, anexe o comprovativo de pagamento.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("escola_id", center.id);
      formData.append("cohort_id", course.id);
      formData.append("nome", data.nome);
      formData.append("bi_numero", data.bi_numero);
      formData.append("email", data.email || "");
      formData.append("telefone", data.telefone);
      formData.append("file", file);

      const res = await fetch("/api/formacao/publico/inscrever", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Falha ao enviar inscrição");
      }

      setSuccess(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ocorreu um erro inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" }).format(val);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
      >
        {success ? (
          <div className="p-8 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
              <CheckCircle2 size={48} />
            </div>
            <h2 className="text-2xl font-black text-slate-900">Inscrição Enviada!</h2>
            <p className="mt-4 text-slate-600 leading-relaxed">
              Obrigado pela sua confiança. A secretaria do <strong>{center.nome}</strong> irá validar o seu comprovativo e ativar o seu acesso em breve.
            </p>
            <button
              onClick={onClose}
              className="mt-8 w-full rounded-2xl bg-slate-900 py-4 text-sm font-bold text-white transition-all hover:bg-slate-800"
            >
              Fechar
            </button>
          </div>
        ) : (
          <>
            {/* Header Modal */}
            <header className="relative border-b border-slate-100 bg-slate-50/50 p-6">
              <button
                onClick={onClose}
                className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-white hover:text-slate-600"
              >
                <X size={20} />
              </button>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-klasse-gold text-white shadow-lg shadow-klasse-gold/20">
                  {step === 1 ? <User size={20} /> : <CreditCard size={20} />}
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-klasse-gold">Checkout</h3>
                  <p className="text-xs font-semibold text-slate-600">
                    {step === 1 ? "Dados Pessoais" : "Pagamento e Confirmação"}
                  </p>
                </div>
              </div>
            </header>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6">
              <AnimatePresence mode="wait">
                {step === 1 ? (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-4"
                  >
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Curso Selecionado</p>
                      <h4 className="mt-1 font-bold text-slate-900">{course.curso_nome}</h4>
                      <p className="text-xs text-slate-500">{course.nome} · {formatCurrency(course.valor_referencia)}</p>
                    </div>

                    <div className="space-y-3">
                      <div className="grid gap-1.5">
                        <label className="text-xs font-bold text-slate-700">Nome Completo</label>
                        <input
                          {...register("nome")}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/5"
                          placeholder="Ex: João Manuel dos Santos"
                        />
                        {errors.nome && <p className="text-[10px] font-bold text-rose-500">{errors.nome.message}</p>}
                      </div>

                      <div className="grid gap-1.5">
                        <label className="text-xs font-bold text-slate-700">Bilhete de Identidade (BI)</label>
                        <input
                          {...register("bi_numero")}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/5"
                          placeholder="Número do documento"
                        />
                        {errors.bi_numero && <p className="text-[10px] font-bold text-rose-500">{errors.bi_numero.message}</p>}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="grid gap-1.5">
                          <label className="text-xs font-bold text-slate-700">Telefone</label>
                          <input
                            {...register("telefone")}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/5"
                            placeholder="9xx xxx xxx"
                          />
                        </div>
                        <div className="grid gap-1.5">
                          <label className="text-xs font-bold text-slate-700">E-mail (Opcional)</label>
                          <input
                            {...register("email")}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-all focus:border-klasse-gold focus:ring-4 focus:ring-klasse-gold/5"
                            placeholder="seu@email.com"
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="rounded-2xl border-2 border-dashed border-klasse-gold/20 bg-klasse-gold/5 p-5 text-center">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-klasse-gold">Transferência Bancária</p>
                      <h4 className="mt-2 text-lg font-black tracking-tight text-slate-900">{center.iban || "AO06 0000 0000 0000 0000 0000 0"}</h4>
                      <p className="mt-1 text-xs text-slate-500">Destinatário: {center.nome}</p>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Anexar Comprovativo (Talão)</label>
                      <div
                        className={`group relative flex flex-col items-center justify-center rounded-[2.5rem] border-4 border-dashed min-h-[220px] transition-all duration-500 ${
                          file ? "border-emerald-500 bg-emerald-50/30" : "border-slate-100 bg-slate-50 hover:border-klasse-gold hover:bg-white"
                        }`}
                      >
                        <input
                          type="file"
                          onChange={(e) => setFile(e.target.files?.[0] || null)}
                          className="absolute inset-0 cursor-pointer opacity-0 z-10"
                          accept="image/*,.pdf"
                        />
                        {file ? (
                          <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="flex flex-col items-center p-6">
                            <CheckCircle2 className="text-emerald-500 mb-4" size={64} />
                            <p className="text-sm font-black text-slate-900">{file.name}</p>
                            <span className="mt-2 text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Documento Carregado</span>
                          </motion.div>
                        ) : (
                          <div className="flex flex-col items-center p-6 text-center">
                            <div className="h-20 w-20 bg-white rounded-3xl flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform duration-500">
                              <Upload className="text-slate-300 group-hover:text-klasse-gold" size={32} />
                            </div>
                            <p className="text-sm font-black text-slate-900">Solta aqui o teu talão</p>
                            <p className="text-xs text-slate-400 mt-1 max-w-[180px]">Formatos aceites: JPG, PNG ou PDF (Máx 5MB)</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-8 flex gap-3">
                {step === 2 && (
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 rounded-2xl border border-slate-200 bg-white py-4 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50"
                  >
                    Voltar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-klasse-gold py-4 text-sm font-bold text-white shadow-xl shadow-klasse-gold/20 transition-all hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] disabled:opacity-70"
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <>
                      {step === 1 ? "Próximo Passo" : "Concluir Inscrição"}
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
