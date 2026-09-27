alter table public.fiscal_documentos_eventos
  drop constraint fiscal_documentos_eventos_tipo_evento_check;

alter table public.fiscal_documentos_eventos
  add constraint fiscal_documentos_eventos_tipo_evento_check
  check (tipo_evento = any(array[
    'EMITIDO','RECTIFICADO','ANULADO','PDF_GERADO','REIMPRESSO',
    'SAFT_EXPORTADO','SUBMETIDO','CHAVE_ACTIVADA',
    'AGT_VALIDADO','AGT_REJEITADO'
  ]::text[]));
