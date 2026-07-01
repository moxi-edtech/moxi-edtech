"use client";

import { ImageIcon, Video, Download, ArrowRight, FileSpreadsheet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { type MarketingAsset } from "./partner-dashboard-model";

type MateriaisTabContentProps = {
  assets: MarketingAsset[];
  copyToClipboard: (text: string) => void;
  codigo: string;
  campaignUrl: string;
  onboardingUrl: string;
};

export function MateriaisTabContent({
  assets,
  copyToClipboard,
  codigo,
  campaignUrl,
  onboardingUrl,
}: MateriaisTabContentProps) {
  const nonScriptAssets = assets.filter((asset) => asset.tipo !== "script");

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {nonScriptAssets.map((asset) => (
          <Card key={asset.id} className="rounded-xl border-zinc-200/50 overflow-hidden bg-white shadow-sm flex flex-col">
            <div className="p-5 flex-1 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-zinc-50 flex items-center justify-center text-zinc-600 border border-zinc-100">
                  {asset.tipo === 'image' && <ImageIcon size={14} />}
                  {asset.tipo === 'video' && <Video size={14} />}
                </div>
                <Badge variant="outline" className="text-[9px] font-semibold uppercase tracking-wider">{asset.tipo}</Badge>
              </div>
              <div>
                <h4 className="font-bold text-zinc-900 text-sm">{asset.titulo}</h4>
                {asset.descricao && <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{asset.descricao}</p>}
              </div>
            </div>
            <div className="p-4 bg-zinc-50 border-t border-zinc-200/50">
              <Button 
                asChild
                className="w-full bg-white hover:bg-zinc-50 text-zinc-900 border border-zinc-200 rounded-lg font-semibold text-xs gap-2 h-9 shadow-none"
              >
                <a href={asset.url || '#'} target="_blank" rel="noreferrer" className="flex items-center justify-center w-full h-full no-underline">
                  {asset.tipo === 'image' ? <Download size={13} /> : <ArrowRight size={13} />}
                  {asset.tipo === 'image' ? 'Descarregar' : 'Abrir Link'}
                </a>
              </Button>
            </div>
          </Card>
        ))}
        {nonScriptAssets.length === 0 && (
          <div className="col-span-full p-20 text-center bg-white border border-dashed border-zinc-200 rounded-xl">
             <p className="text-zinc-400 font-medium italic text-xs">Nenhum material disponível de momento.</p>
          </div>
        )}
      </div>

      {/* Modelos de Planilhas e Importação */}
      <div className="space-y-4 pt-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Modelos de Planilhas para Onboarding</h3>
          <p className="text-xs text-zinc-500 font-medium">Use estes modelos para ajudar as escolas indicadas a estruturarem os dados de alunos e professores antes da carga técnica.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="rounded-xl border-zinc-200/50 overflow-hidden bg-white shadow-sm flex flex-col p-5 space-y-4">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
                  <FileSpreadsheet size={16} />
                </div>
                <Badge variant="outline" className="text-[9px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700 border-emerald-100 shadow-none">Alunos</Badge>
              </div>
              <div>
                <h4 className="font-bold text-zinc-900 text-sm">Planilha de Carga de Alunos</h4>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">Modelo padrão contendo colunas obrigatórias como Nome Completo, Gênero, Data de Nascimento, BI e NIF.</p>
              </div>
            </div>
            <div className="pt-2">
              <Button 
                asChild
                className="w-full bg-[#1F6B3B] hover:bg-[#1F6B3B]/90 text-white rounded-lg font-semibold text-xs gap-2 h-9 border-none"
              >
                <a href="/templates/KLASSE_Modelo_Importacao_Alunos_v1.xlsx" download="KLASSE_Modelo_Importacao_Alunos_v1.xlsx" className="flex items-center justify-center w-full h-full no-underline">
                  <Download size={13} />
                  Baixar Modelo (.xlsx)
                </a>
              </Button>
            </div>
          </Card>

          <Card className="rounded-xl border-zinc-200/50 overflow-hidden bg-white shadow-sm flex flex-col p-5 space-y-4">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 border border-purple-100">
                  <FileSpreadsheet size={16} />
                </div>
                <Badge variant="outline" className="text-[9px] font-semibold uppercase tracking-wider bg-purple-50 text-purple-700 border-purple-100 shadow-none">Professores</Badge>
              </div>
              <div>
                <h4 className="font-bold text-zinc-900 text-sm">Planilha de Carga de Professores</h4>
                <p className="text-xs text-zinc-500 mt-1 leading-relaxed">Modelo padrão para mapeamento do corpo docente, qualificações e disciplinas que lecionam.</p>
              </div>
            </div>
            <div className="pt-2">
              <Button 
                asChild
                className="w-full bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-xs gap-2 h-9 border-none"
              >
                <a href="/templates/06_professores_atribuicoes_template.xlsx" download="06_professores_atribuicoes_template.xlsx" className="flex items-center justify-center w-full h-full no-underline">
                  <Download size={13} />
                  Baixar Modelo (.xlsx)
                </a>
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl bg-[#09090b] border border-zinc-900 p-6 text-center md:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
          <h4 className="text-sm font-bold tracking-tight text-white uppercase">Link principal da campanha</h4>
          <div className="mx-auto flex max-w-md items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-1.5">
            <code className="flex-1 truncate px-3 text-left text-xs font-semibold text-amber-400 font-mono">
              klasse.ao/escola-moderna?ref={codigo}
            </code>
            <Button
              onClick={() => copyToClipboard(campaignUrl)}
              variant="ghost"
              className="h-8 rounded-md bg-white hover:bg-zinc-100 text-[10px] font-semibold text-zinc-950 px-3 border-none"
            >
              Copiar
            </Button>
          </div>
          <p className="text-[10px] text-zinc-500 font-medium">Use em posts, stories e mensagens para pais.</p>
        </div>

        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
          <h4 className="text-sm font-bold tracking-tight text-white uppercase">Link para diretores</h4>
          <div className="mx-auto flex max-w-md items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-1.5">
            <code className="flex-1 truncate px-3 text-left text-xs font-semibold text-zinc-300 font-mono">
              app.klasse.ao/onboarding?ref={codigo}
            </code>
            <Button
              onClick={() => copyToClipboard(onboardingUrl)}
              variant="ghost"
              className="h-8 rounded-md bg-white hover:bg-zinc-100 text-[10px] font-semibold text-zinc-950 px-3 border-none"
            >
              Copiar
            </Button>
          </div>
          <p className="text-[10px] text-zinc-500 font-medium">Use quando falar com diretores interessados.</p>
        </div>
      </div>
    </div>
  );
}
