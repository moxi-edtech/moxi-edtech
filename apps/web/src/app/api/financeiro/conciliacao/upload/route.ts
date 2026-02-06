// apps/web/src/app/api/financeiro/conciliacao/upload/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveEscolaIdForUser } from '@/lib/tenant/resolveEscolaIdForUser';
import * as XLSX from 'xlsx';
import crypto from 'crypto'; // Node.js crypto module

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } = {} } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    const escolaId = await resolveEscolaIdForUser(supabase, user.id);
    if (!escolaId) {
      return NextResponse.json({ error: 'Escola não identificada' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const banco = formData.get('banco') as string;
    const conta = formData.get('conta') as string;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }
    if (!banco) {
      return NextResponse.json({ error: 'Banco não informado.' }, { status: 400 });
    }
    // Conta can be optional if not all banks provide it

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const importId = crypto.randomUUID();
    const filePath = `${escolaId}/${importId}-${file.name}`;

    // 1. Salvar o arquivo original no Storage
    const { error: storageError } = await supabase.storage
      .from('conciliacao-extratos') // Nome do bucket
      .upload(filePath, fileBuffer, {
        contentType: file.type,
      });

    if (storageError) {
      console.error('Erro ao salvar arquivo no Storage:', storageError);
      return NextResponse.json({ error: 'Falha ao salvar o arquivo do extrato.' }, { status: 500 });
    }

    // 2. Criar registro de controle do upload
    const { data: uploadRecord, error: uploadRecordError } = await supabase
      .from('conciliacao_uploads')
      .insert({
        id: importId,
        escola_id: escolaId,
        file_name: file.name,
        file_path: filePath,
        file_size_kb: Math.round(file.size / 1024),
        banco: banco,
        conta: conta,
        status: 'pending_parsing',
        uploaded_by: user.id,
      })
      .select('id')
      .single();

    if (uploadRecordError) {
      console.error('Erro ao criar registro de upload:', uploadRecordError);
      return NextResponse.json({ error: 'Falha ao registrar o upload.' }, { status: 500 });
    }
    
    // 3. Auditoria do Upload
    // Note: This could also be a DB trigger on the `conciliacao_uploads` table
    const { error: auditError } = await supabase.from('audit_logs').insert({
        escola_id: escolaId,
        actor_id: user.id,
        action: 'CONCILIACAO_EXTRATO_UPLOAD',
        entity: 'conciliacao_uploads',
        entity_id: importId,
        portal: 'financeiro',
        details: { filename: file.name, size: file.size, banco, conta },
    });

    if (auditError) {
      console.warn('Falha ao criar log de auditoria para upload de extrato:', auditError);
    }

    // --- Lógica de Parsing (mantida por enquanto) ---
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    const transactionsToInsert: Array<any> = [];

    if (jsonData.length > 1) {
      const headers = jsonData[0] as string[];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (row.length === 0 || row.every(cell => !cell)) continue;

        const transactionRaw: any = {};
        headers.forEach((header, index) => {
          if (header) {
            transactionRaw[header.trim().toLowerCase()] = row[index];
          }
        });

        try {
          const valorRaw = transactionRaw.valor || transactionRaw.amount || transactionRaw.montante || 0;
          const valor = parseFloat(String(valorRaw).replace(',', '.') || '0');
          const tipo = valor >= 0 ? 'credito' : 'debito';

          const rawDate = transactionRaw.data || transactionRaw.date || transactionRaw.dt || transactionRaw['data da transacao'];
          let parsedDate;
          if (rawDate) {
            if (typeof rawDate === 'number') {
              parsedDate = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
            } else {
              parsedDate = new Date(rawDate);
            }
          }

          transactionsToInsert.push({
            escola_id: escolaId,
            import_id: importId,
            data: parsedDate ? parsedDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            descricao: transactionRaw.descricao || transactionRaw.description || transactionRaw.narrative || transactionRaw.detalhes || '',
            referencia: transactionRaw.referencia || transactionRaw.ref || transactionRaw.nr_doc || '',
            valor: valor,
            tipo: tipo,
            banco: banco,
            conta: conta,
            status: 'pendente',
            match_confianca: 0,
            raw_data: transactionRaw,
          });
        } catch (parseError) {
          console.warn(`⚠️ Erro ao processar linha do extrato: ${JSON.stringify(transactionRaw)}`, parseError);
        }
      }
    }
    
    if (transactionsToInsert.length === 0) {
      await supabase.from('conciliacao_uploads').update({ status: 'parsed', processed_at: new Date().toISOString() }).eq('id', importId);
      return NextResponse.json({ ok: true, message: 'Nenhuma transação válida encontrada no arquivo.' });
    }

    const { data: insertedTransactions, error: insertError } = await (supabase as any)
      .from('financeiro_transacoes_importadas')
      .insert(transactionsToInsert as any)
      .select();

    if (insertError) {
      await supabase.from('conciliacao_uploads').update({ status: 'error', error_details: insertError.message }).eq('id', importId);
      console.error('Erro ao inserir transações no banco de dados:', insertError);
      throw insertError;
    }

    // Atualiza o status do upload para 'parsed'
    await supabase.from('conciliacao_uploads').update({ status: 'parsed', processed_at: new Date().toISOString() }).eq('id', importId);

    return NextResponse.json({ ok: true, transactions: insertedTransactions, importId: importId });
  } catch (e: any) {
    console.error('Erro no upload de extrato:', e);
    return NextResponse.json({ error: e.message || 'Erro interno do servidor ao processar extrato.' }, { status: 500 });
  }
}
