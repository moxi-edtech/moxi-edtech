// Operator-only: local files, never a public token-minting endpoint or a messaging sender.
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { generateKeyPairSync, createPublicKey, randomUUID } from 'node:crypto';
import { join, resolve } from 'node:path';
import { flowConfig, testToken, TEST_FLOW, TEST_PHONE, TEST_SCHOOL } from '../apps/web/src/lib/server/payments/providers/appypay/whatsapp-crypto';
async function main() {
  const dir = resolve(process.argv[2] ?? '/private/tmp/klasse-appypay-homologacao');
  await mkdir(dir, { recursive: true, mode: 0o700 }); await chmod(dir, 0o700);
  const privatePath = join(dir, 'flow-private-key.pem');
  let privateKey: string;
  try { privateKey = await readFile(privatePath, 'utf8'); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    privateKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    await writeFile(privatePath, privateKey, { mode: 0o600, flag: 'wx' });
  }
  await chmod(privatePath, 0o600);
  const publicKey = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).toString();
  await writeFile(join(dir, 'flow-public-key.pem'), publicKey, { mode: 0o600 });
  let appSecret: string;
  try { appSecret = (await readFile(join(dir, 'meta-app-secret.txt'), 'utf8')).trim(); } catch { appSecret = ''; }
  if (!appSecret) { console.log('Chave de encriptação preparada. Falta o Meta App Secret no ficheiro privado meta-app-secret.txt.'); return; }
  const config = flowConfig(JSON.stringify({ schoolId: TEST_SCHOOL, flowId: TEST_FLOW, phoneId: TEST_PHONE, appSecret, privateKey }));
  await writeFile(join(dir, 'flow-config.json'), JSON.stringify(config), { mode: 0o600 });
  if (process.argv[3] !== 'message') { console.log('Configuração privada preparada; nenhuma mensagem enviada.'); return; }
  const recipient = (await readFile(join(dir, 'recipient.txt'), 'utf8')).trim();
  if (!/^\+[1-9]\d{7,14}$/.test(recipient)) throw new Error('Destinatário de teste inválido');
  const payload = { messaging_product: 'whatsapp', recipient_type: 'individual', to: recipient.slice(1), type: 'interactive', interactive: {
    type: 'flow', body: { text: 'Teste KLASSE/AppyPay: referência fictícia de 100 AOA. Não movimenta dinheiro real.' },
    action: { name: 'flow', parameters: { mode: 'draft', flow_message_version: '3', flow_id: TEST_FLOW,
      flow_token: testToken(randomUUID(), config), flow_cta: 'Testar AppyPay', flow_action: 'data_exchange' } } } };
  await writeFile(join(dir, 'flow-message.json'), JSON.stringify(payload), { mode: 0o600 });
  console.log('Payload de teste preparado, válido por 30 minutos. Nenhuma mensagem enviada.');
}
main().catch(() => { console.error('Não foi possível preparar a configuração privada.'); process.exitCode = 1; });
