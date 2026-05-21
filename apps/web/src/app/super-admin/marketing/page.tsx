"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  Plus, 
  Trash2, 
  Edit3, 
  Image as ImageIcon, 
  Video, 
  FileText, 
  Upload, 
  Check, 
  X,
  Loader2,
  ChevronRight,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { toast } from "sonner";

interface MarketingAsset {
  id: string;
  tipo: 'image' | 'video' | 'script' | 'document';
  titulo: string;
  descricao: string;
  url: string | null;
  conteudo: string | null;
  is_active: boolean;
}

export default function MarketingAssetsPage() {
  const [assets, setAssets] = useState<MarketingAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formData, setFormData] = useState<Partial<MarketingAsset>>({
    tipo: 'image',
    titulo: '',
    descricao: '',
    conteudo: '',
    url: '',
    is_active: true
  });

  const supabase = createClient();

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('marketing_assets')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) toast.error("Erro ao carregar materiais");
    else setAssets(data || []);
    setLoading(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      // Criar bucket se não existir (ou assumir que existe: 'marketing-assets')
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `assets/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('marketing-assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('marketing-assets')
        .getPublicUrl(filePath);

      setFormData({ ...formData, url: data.publicUrl });
      toast.success("Ficheiro carregado!");
    } catch (error) {
      toast.error("Erro no upload");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase
      .from('marketing_assets')
      .insert([formData]);

    if (error) toast.error("Erro ao salvar");
    else {
      toast.success("Material adicionado!");
      setShowModal(false);
      loadAssets();
      setFormData({ tipo: 'image', titulo: '', descricao: '', conteudo: '', url: '', is_active: true });
    }
  };

  const toggleStatus = async (id: string, current: boolean) => {
    const { error } = await supabase
      .from('marketing_assets')
      .update({ is_active: !current })
      .eq('id', id);
    if (!error) loadAssets();
  };

  const deleteAsset = async (id: string) => {
    if (!confirm("Tem a certeza?")) return;
    const { error } = await supabase
      .from('marketing_assets')
      .delete()
      .eq('id', id);
    if (!error) loadAssets();
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              <span>Super Admin</span>
              <ChevronRight size={10} />
              <span className="text-klasse-green">Marketing de Afiliados</span>
            </nav>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Materiais para Afiliados</h1>
            <p className="text-sm text-slate-500 font-medium">Faça upload de banners, scripts e vídeos que os parceiros verão nos portais.</p>
          </div>
          <Button onClick={() => setShowModal(true)} className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl gap-2 font-bold px-6">
            <Plus size={18} />
            NOVO MATERIAL
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-20 bg-white rounded-3xl border border-slate-200">
            <Loader2 className="w-8 h-8 animate-spin text-klasse-green" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {assets.map(asset => (
              <Card key={asset.id} className={`rounded-3xl border-slate-200 overflow-hidden bg-white shadow-sm flex flex-col ${!asset.is_active && 'opacity-60'}`}>
                <div className="p-6 flex-1 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-600 border border-slate-100">
                        {asset.tipo === 'image' && <ImageIcon size={18} />}
                        {asset.tipo === 'video' && <Video size={18} />}
                        {asset.tipo === 'script' && <FileText size={18} />}
                      </div>
                      <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest">{asset.tipo}</Badge>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => toggleStatus(asset.id, asset.is_active)} className={`p-2 rounded-lg transition-colors ${asset.is_active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}>
                        {asset.is_active ? <Check size={16} /> : <X size={16} />}
                      </button>
                      <button onClick={() => deleteAsset(asset.id)} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{asset.titulo}</h4>
                    <p className="text-xs text-slate-500 mt-1">{asset.descricao}</p>
                  </div>
                  {asset.tipo === 'script' && asset.conteudo && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600 font-medium italic truncate">
                      "{asset.conteudo}"
                    </div>
                  )}
                  {asset.url && (
                    <a href={asset.url} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-blue-600 flex items-center gap-1 hover:underline">
                      <ExternalLink size={10} />
                      Ver Ficheiro/Link
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Modal Simples */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6 backdrop-blur-sm">
            <div className="bg-white rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="p-8 space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-black text-slate-900">Novo Material</h3>
                  <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X /></button>
                </div>

                <form onSubmit={handleSave} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-slate-400">Tipo</label>
                      <select 
                        className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-klasse-green"
                        value={formData.tipo}
                        onChange={e => setFormData({ ...formData, tipo: e.target.value as any })}
                      >
                        <option value="image">Imagem / Banner</option>
                        <option value="script">Script (Texto)</option>
                        <option value="video">Vídeo</option>
                        <option value="document">Documento PDF</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-slate-400">Título</label>
                      <input 
                        required
                        className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-klasse-green"
                        value={formData.titulo}
                        onChange={e => setFormData({ ...formData, titulo: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase text-slate-400">Descrição Curta</label>
                    <input 
                      className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-klasse-green"
                      value={formData.descricao}
                      onChange={e => setFormData({ ...formData, descricao: e.target.value })}
                    />
                  </div>

                  {formData.tipo === 'script' ? (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-slate-400">Conteúdo do Script</label>
                      <textarea 
                        rows={4}
                        className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-klasse-green resize-none"
                        value={formData.conteudo}
                        onChange={e => setFormData({ ...formData, conteudo: e.target.value })}
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase text-slate-400">Ficheiro ou Link</label>
                      <div className="flex gap-2">
                        <input 
                          className="flex-1 p-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-klasse-green"
                          placeholder="URL externa ou use o botão de upload"
                          value={formData.url || ''}
                          onChange={e => setFormData({ ...formData, url: e.target.value })}
                        />
                        <div className="relative">
                          <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileUpload} />
                          <Button disabled={isUploading} type="button" className="bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl px-4 h-full border-none">
                            {isUploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button type="submit" className="w-full py-4 bg-klasse-green hover:bg-klasse-green/90 text-white rounded-xl font-black text-sm mt-4 shadow-lg shadow-klasse-green/10">
                    PUBLICAR PARA AFILIADOS
                  </Button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
