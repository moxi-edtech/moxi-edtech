"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Label } from "@/components/ui/Label";
import { Spinner } from "@/components/ui/Spinner";
import { Select } from "@/components/ui/Select";
import { toast } from "sonner";
import { Send, Paperclip, X, Layout } from "lucide-react";

type Template = { id: string; label: string };

export default function ComunicacaoPage() {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [formData, setFormData] = useState({
    to: "",
    cc: "",
    subject: "",
    message: "",
    isHtml: true,
  });
  const [files, setFiles] = useState<File[]>([]);

  useEffect(() => {
    fetch("/api/super-admin/mailer/templates")
      .then(res => res.json())
      .then(data => {
        if (data.ok) setTemplates(data.templates);
      });
  }, []);

  const handleTemplateSelect = async (id: string) => {
    if (!id) return;
    try {
      const res = await fetch(`/api/super-admin/mailer/templates?id=${id}`);
      const data = await res.json();
      if (data.ok) {
        setFormData({
          ...formData,
          subject: data.template.subject,
          message: data.template.html || data.template.text,
        });
        toast.info(`Template "${id}" carregado.`);
      }
    } catch {
      toast.error("Erro ao carregar template.");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles([...files, ...Array.from(e.target.files)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.to || !formData.subject || !formData.message) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    setLoading(true);
    try {
      const data = new FormData();
      data.append("to", formData.to);
      data.append("cc", formData.cc);
      data.append("subject", formData.subject);
      data.append("message", formData.message);
      data.append("isHtml", String(formData.isHtml));
      
      files.forEach((file) => {
        data.append("attachments", file);
      });

      const res = await fetch("/api/super-admin/mailer/send", {
        method: "POST",
        body: data,
      });

      const result = await res.json();
      if (result.ok) {
        toast.success("E-mail enviado com sucesso!");
        setFormData({ to: "", cc: "", subject: "", message: "", isHtml: true });
        setFiles([]);
      } else {
        toast.error(result.error || "Erro ao enviar e-mail.");
      }
    } catch (error) {
      toast.error("Erro na comunicação com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Comunicador</h1>
        <p className="text-slate-500">Envie e-mails customizados ou utilize templates pré-definidos.</p>
      </div>

      <Card className="border-klasse-gold/20 bg-klasse-gold/[0.02]">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-klasse-gold">
            <Layout className="h-5 w-5" />
            <CardTitle className="text-lg">Templates Rápidos</CardTitle>
          </div>
          <CardDescription>Selecione um modelo para preencher o e-mail automaticamente.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <Select 
              options={[
                { value: "", label: "Escolha um template..." },
                ...templates.map(t => ({ value: t.id, label: t.label })),
              ]}
              onChange={(event) => handleTemplateSelect(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nova Mensagem</CardTitle>
          <CardDescription>
            Personalize o conteúdo abaixo antes de enviar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="to">Para (To) <span className="text-red-500">*</span></Label>
                <input
                  id="to" 
                  className="w-full p-3 border rounded-lg transition-colors duration-200 border-gray-300 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="email@exemplo.com, outro@exemplo.com" 
                  value={formData.to}
                  onChange={(e) => setFormData({ ...formData, to: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cc">Cópia (CC)</Label>
                <input
                  id="cc" 
                  className="w-full p-3 border rounded-lg transition-colors duration-200 border-gray-300 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="copia@exemplo.com" 
                  value={formData.cc}
                  onChange={(e) => setFormData({ ...formData, cc: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Assunto <span className="text-red-500">*</span></Label>
              <input
                id="subject" 
                className="w-full p-3 border rounded-lg transition-colors duration-200 border-gray-300 focus:ring-teal-500 focus:border-teal-500"
                placeholder="Assunto da mensagem" 
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Mensagem <span className="text-red-500">*</span></Label>
              <textarea
                id="message"
                className="flex min-h-[300px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
                placeholder="Escreva sua mensagem aqui (suporta HTML)..."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Anexos</Label>
              <div className="flex items-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById("file-upload")?.click()}
                  className="flex items-center gap-2"
                >
                  <Paperclip className="h-4 w-4" />
                  Adicionar Ficheiros
                </Button>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
              
              {files.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-full text-xs text-slate-700">
                      <span>{file.name}</span>
                      <button type="button" onClick={() => removeFile(index)} className="hover:text-red-500">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-4 flex justify-end">
              <Button type="submit" disabled={loading} className="gap-2 bg-klasse-gold hover:bg-klasse-gold/90 text-slate-900">
                {loading ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                Enviar Mensagem
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
