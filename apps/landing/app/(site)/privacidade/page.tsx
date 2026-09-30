import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidade — KLASSE',
  description: 'Política de Privacidade da plataforma KLASSE.',
  alternates: { canonical: 'https://klasse.ao/privacidade' },
}

export default function Page() {
  return (
    <article className="legal-page container">
      <a href="/" className="legal-back">← Voltar ao início</a>
      <h1>Política de Privacidade — KLASSE</h1>
      <p className="legal-updated"><strong>Última atualização: <time dateTime="2026-09-23">23 de setembro de 2026</time></strong></p>
      <p>A KLASSE é um produto da <strong>MOXI SOLUÇÕES - COMERCIO GERAL E PRESTAÇÃO DE SERVIÇOS, (SU), LDA.</strong>, NIF <strong>5002637618</strong>, com sede no Bairro Azul, Rua dos Bombeiros, N.º S/N, Município de Menongue, Província do Cubango, Angola.</p>
      <h2>1. Dados tratados</h2>
      <p>A KLASSE pode tratar dados fornecidos pelas instituições de ensino e pelos utilizadores da plataforma, incluindo:</p>
      <ul>
      <li>dados de identificação e contacto;</li>
      <li>dados de alunos e encarregados de educação;</li>
      <li>dados académicos e escolares;</li>
      <li>informações de matrícula, turma, frequência e avaliação;</li>
      <li>informações financeiras relacionadas com propinas, pagamentos e saldos;</li>
      <li>dados de professores e colaboradores;</li>
      <li>dados de acesso e utilização da plataforma;</li>
      <li>comunicações realizadas através de funcionalidades integradas.</li>
      </ul>
      <p>A escola é responsável pela legitimidade dos dados que insere na plataforma e pela definição dos utilizadores autorizados.</p>
      <h2>2. Para que utilizamos os dados</h2>
      <p>Os dados são tratados para:</p>
      <ul>
      <li>disponibilizar e operar a plataforma KLASSE;</li>
      <li>autenticar utilizadores e controlar permissões;</li>
      <li>executar processos académicos, administrativos e financeiros;</li>
      <li>prestar suporte e manutenção;</li>
      <li>emitir documentos e relatórios;</li>
      <li>enviar notificações e comunicações configuradas pela escola;</li>
      <li>proteger a plataforma contra acessos indevidos e fraude;</li>
      <li>realizar cópias de segurança e recuperação de dados;</li>
      <li>cumprir obrigações legais e contratuais.</li>
      </ul>
      <h2>3. Uso e acesso aos dados</h2>
      <p>A KLASSE <strong>não comercializa dados escolares</strong> e não utiliza essas informações para finalidades incompatíveis com a prestação do serviço.</p>
      <p>O acesso aos dados é limitado a utilizadores autorizados e, quando necessário, a pessoal ou prestadores que precisem dessas informações para operação, suporte ou segurança.</p>
      <p>Cada utilizador deve utilizar a sua própria conta e manter as suas credenciais protegidas.</p>
      <h2>4. Segurança</h2>
      <p>A KLASSE adota medidas técnicas e organizacionais compatíveis com o serviço, incluindo:</p>
      <ul>
      <li>autenticação e controlo de acesso;</li>
      <li>segregação lógica entre instituições;</li>
      <li>gestão de permissões;</li>
      <li>registos de auditoria e monitorização;</li>
      <li>proteção de credenciais;</li>
      <li>cópias de segurança;</li>
      <li>práticas de prevenção e resposta a incidentes.</li>
      </ul>
      <p>Nenhum sistema pode garantir segurança absoluta. Em caso de suspeita de acesso indevido ou comprometimento de credenciais, a instituição deve contactar a KLASSE imediatamente.</p>
      <h2>5. Fornecedores tecnológicos</h2>
      <p>Para operar a plataforma, a KLASSE utiliza fornecedores tecnológicos que podem processar dados em nosso nome, incluindo:</p>
      <ul>
      <li><strong>Supabase</strong> — base de dados, autenticação e armazenamento;</li>
      <li><strong>Vercel</strong> — alojamento e execução da aplicação;</li>
      <li><strong>Cloudflare</strong> — segurança de rede, proteção de tráfego e entrega de conteúdo;</li>
      <li><strong>Inngest</strong> — processamento de filas, eventos e tarefas automáticas;</li>
      <li><strong>WhatsApp / Meta</strong> — envio e receção de mensagens quando essas funcionalidades são utilizadas.</li>
      </ul>
      <p>A lista de fornecedores poderá ser atualizada conforme as necessidades técnicas e operacionais da plataforma.</p>
      <h2>6. Transferências internacionais</h2>
      <p>Alguns fornecedores utilizados pela KLASSE operam infraestrutura fora de Angola. Por essa razão, determinados dados poderão ser processados, armazenados ou transmitidos fora do território angolano, de acordo com a arquitetura utilizada e as condições dos respetivos fornecedores.</p>
      <h2>7. Retenção dos dados</h2>
      <p>Durante a vigência da contratação, os dados permanecem disponíveis conforme o funcionamento normal da plataforma e as condições do plano contratado.</p>
      <p>Após o encerramento do serviço, aplicam-se as condições descritas na nossa <a href="/exclusao-de-dados"><strong>Política de Exclusão de Dados</strong></a>.</p>
      <h2>8. Direitos relacionados aos dados</h2>
      <p>Quando aplicável, pedidos relacionados com acesso, correção, oposição ou eliminação de dados poderão ser apresentados à instituição de ensino responsável pelos dados.</p>
      <p>Quando a KLASSE receber diretamente um pedido relacionado com dados controlados por uma escola, poderá encaminhá-lo à respetiva instituição para tratamento.</p>
      <h2>9. Contacto</h2>
      <p>Para questões relacionadas com privacidade ou proteção de dados:</p>
      <address>
      <strong>MOXI SOLUÇÕES - COMERCIO GERAL E PRESTAÇÃO DE SERVIÇOS, (SU), LDA.</strong><br />
      Produto: KLASSE<br />
      NIF: 5002637618<br />
      E-mail: <a href="mailto:contato@klasse.ao">contato@klasse.ao</a><br />
      WhatsApp: <a href="https://wa.me/244933349106">+244 933 349 106</a>
      </address>
    </article>
  )
}
