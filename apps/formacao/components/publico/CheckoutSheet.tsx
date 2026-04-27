"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { CheckCircle2, Loader2, UploadCloud } from "lucide-react";
import { checkoutSchema, type CheckoutSchemaInput } from "@/lib/validations/checkoutSchema";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { submeterCheckoutAction } from "@/app/actions/submeterCheckoutAction";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { trackFunnelClient } from "@/lib/funnel-client";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  curso: {
    id: string;
    cohortRef: string;
    title: string;
    price: number;
  };
  tenant: {
    id: string;
    slug: string;
    nome: string;
    iban?: string | null;
  };
};

type CheckoutFormValues = CheckoutSchemaInput;

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function CheckoutSheet({ open, onOpenChange, curso, tenant }: Props) {
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const query = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const form = useForm<CheckoutFormValues>({
    mode: "onChange",
    defaultValues: {
      nome_completo: "",
      identificacao: "",
      telefone: "",
      comprovativo_url: "",
    },
  });

  const comprovativoUrl = form.watch("comprovativo_url");
  const submitDisabled = useMemo(
    () => !form.formState.isValid || !comprovativoUrl || uploading || submitting,
    [comprovativoUrl, form.formState.isValid, uploading, submitting]
  );

  async function handleUpload(file: File) {
    const isAccepted = ["application/pdf", "image/jpeg", "image/png", "image/jpg"].includes(file.type);
    if (!isAccepted) {
      setUploadError("Formato inválido. Use PDF, JPG ou PNG.");
      return;
    }

    setUploadError(null);
    setUploading(true);
    setUploadName(file.name);

    try {
      const supabase = getSupabaseBrowserClient();
      const timestamp = Date.now();
      const cleanName = sanitizeFileName(file.name);
      const path = `${tenant.id}/${curso.id}/${timestamp}_${cleanName}`;

      const { error: uploadErr } = await supabase.storage
        .from("formacao-comprovativos")
        .upload(path, file, { upsert: false, contentType: file.type });

      if (uploadErr) throw uploadErr;

      const {
        data: { publicUrl },
      } = supabase.storage.from("formacao-comprovativos").getPublicUrl(path);

      form.setValue("comprovativo_url", publicUrl, { shouldValidate: true, shouldDirty: true });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Falha no upload do comprovativo.");
      form.setValue("comprovativo_url", "", { shouldValidate: true });
      setUploadName(null);
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(values: CheckoutFormValues) {
    const validation = checkoutSchema.safeParse(values);
    if (!validation.success) {
      for (const issue of validation.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string") {
          form.setError(field as keyof CheckoutFormValues, { type: "manual", message: issue.message });
        }
      }
      return;
    }

    setSubmitting(true);
    setUploadError(null);
    trackFunnelClient({
      event: "mentor_cta_click",
      stage: "checkout",
      source: "checkout_submit_clicked",
      details: { cohort_ref: curso.cohortRef, tenant_slug: tenant.slug },
    });

    try {
      const result = await submeterCheckoutAction({
        centro_slug: tenant.slug,
        cohort_ref: curso.cohortRef,
        nome_completo: validation.data.nome_completo,
        identificacao: validation.data.identificacao,
        telefone: validation.data.telefone,
        comprovativo_url: validation.data.comprovativo_url,
      });

      if (!result.ok) {
        trackFunnelClient({
          event: "mentor_checkout_submit_failed",
          stage: "checkout",
          source: "checkout_submit_action",
          details: { cohort_ref: curso.cohortRef, tenant_slug: tenant.slug, reason: result.error },
        });
        setUploadError(result.error);
        return;
      }

      trackFunnelClient({
        event: "mentor_checkout_submit_success",
        stage: "checkout",
        source: "checkout_submit_action",
        details: { cohort_ref: curso.cohortRef, tenant_slug: tenant.slug },
      });
      form.reset();
      setUploadName(null);
      onOpenChange(false);
      setSuccessOpen(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side={isMobile ? "bottom" : "right"}
          className={isMobile ? "h-[90vh] rounded-t-2xl p-0" : "w-[400px] max-w-[400px] p-0"}
        >
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-slate-200 p-5">
              <SheetTitle>Checkout</SheetTitle>
              <SheetDescription>Conclua a matrícula com o envio do comprovativo.</SheetDescription>
            </SheetHeader>

            <div className="border-b border-slate-100 bg-slate-50 p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Curso</p>
              <h3 className="mt-1 text-base font-semibold text-slate-900">{curso.title}</h3>
              <p className="mt-1 text-lg font-black text-slate-900 [font-family:var(--font-geist-mono)]">
                {new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA", maximumFractionDigits: 0 }).format(
                  curso.price
                )}
              </p>
            </div>

            <div className="space-y-4 bg-slate-950 p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-klasse-gold">Dados para Pagamento</p>
                  <h3 className="mt-1 text-sm font-bold text-white">{tenant.nome}</h3>
                </div>
                <div className="h-10 w-10 rounded-xl bg-klasse-gold/10 p-2 text-klasse-gold">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
                  </svg>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">IBAN para Transferência</p>
                <p className="mt-1 select-all font-mono text-sm font-black tracking-wider text-klasse-gold">
                  {tenant.iban || "IBAN indisponível. Contacte a secretaria."}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-medium text-slate-400">Instruções:</p>
                <ul className="space-y-2 text-[11px] text-slate-400">
                  <li className="flex gap-2">
                    <span className="font-bold text-klasse-gold">1.</span>
                    Efetue a transferência ou depósito do valor exato.
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-klasse-gold">2.</span>
                    Tire uma foto ou guarde o comprovativo digital.
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-klasse-gold">3.</span>
                    Anexe o ficheiro abaixo para validar a sua vaga.
                  </li>
                </ul>
              </div>
            </div>

            <Form form={form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 space-y-4 overflow-y-auto p-5">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Nome completo</label>
                  <Input {...form.register("nome_completo")} placeholder="Ex: Maria Antónia Jorge" />
                  <p className="text-xs text-rose-600">{form.formState.errors.nome_completo?.message ?? ""}</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Identificação (Email ou BI)</label>
                  <Input {...form.register("identificacao")} placeholder="exemplo@email.com ou BI123456" />
                  <p className="text-xs text-rose-600">{form.formState.errors.identificacao?.message ?? ""}</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Telefone</label>
                  <Input {...form.register("telefone")} placeholder="9xx xxx xxx" />
                  <p className="text-xs text-rose-600">{form.formState.errors.telefone?.message ?? ""}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700">Comprovativo</label>
                  <label className="relative flex min-h-28 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center hover:border-klasse-gold">
                    <input
                      type="file"
                      className="absolute inset-0 opacity-0"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleUpload(file);
                      }}
                    />
                    {uploading ? (
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Loader2 size={16} className="animate-spin" />
                        A enviar comprovativo...
                      </div>
                    ) : comprovativoUrl ? (
                      <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
                        <CheckCircle2 size={16} />
                        {uploadName || "Comprovativo anexado"}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <UploadCloud size={18} />
                        Selecionar PDF/JPG/PNG
                      </div>
                    )}
                  </label>
                  {uploadError ? <p className="text-xs text-rose-600">{uploadError}</p> : null}
                </div>
              </form>
            </Form>

            <div className="border-t border-slate-200 p-5">
              <Button
                type="button"
                className="w-full bg-klasse-gold text-white hover:brightness-110"
                disabled={submitDisabled}
                onClick={form.handleSubmit(onSubmit)}
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : "Confirmar Matrícula"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Matrícula recebida!</DialogTitle>
            <DialogDescription>
              A secretaria está a analisar o seu talão. Receberá o acesso por e-mail/SMS em breve.
            </DialogDescription>
          </DialogHeader>
          <Button className="mt-4 w-full" onClick={() => setSuccessOpen(false)}>
            Fechar
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
