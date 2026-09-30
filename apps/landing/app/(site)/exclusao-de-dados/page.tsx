import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Exclusão de Dados — KLASSE',
  description: 'Política de Exclusão de Dados da plataforma KLASSE.',
  alternates: { canonical: 'https://klasse.ao/exclusao-de-dados' },
}

export default function Page() {
  return (
    <article className="legal-page container">
      <a href="/" className="legal-back">← Voltar ao início</a>
      <h1>Política de Exclusão de Dados — KLASSE</h1>
      <p className="legal-updated"><strong>Última atualização: <time dateTime="2026-09-23">23 de setembro de 2026</time></strong></p>
      <p>Esta política explica como instituições e utilizadores podem solicitar a exclusão dos dados tratados através da plataforma KLASSE.</p>
      <h2>1. Solicitação de exclusão</h2>
      <p>Pedidos de exclusão de dados devem ser realizados por uma pessoa autorizada através dos canais oficiais da KLASSE:</p>
      <p><strong>E-mail:</strong> <a href="mailto:contato@klasse.ao">contato@klasse.ao</a><br /><strong>WhatsApp:</strong> <a href="https://wa.me/244933349106">+244 933 349 106</a></p>
      <p>Para proteger os dados da instituição e dos seus utilizadores, a KLASSE poderá solicitar informações adicionais para confirmar a identidade e a autorização da pessoa que efetuou o pedido.</p>
      <h2>2. Dados controlados pela escola</h2>
      <p>Nos dados tratados pela KLASSE em nome de uma instituição de ensino, a escola é responsável pelas decisões relacionadas com a utilização e manutenção dessas informações.</p>
      <p>Pedidos de alunos, encarregados de educação, professores ou outros titulares poderão ser encaminhados à respetiva instituição de ensino para validação.</p>
      <h2>3. Encerramento da contratação</h2>
      <p>Quando uma escola encerra a utilização do KLASSE:</p>
      <ol>
      <li>poderá solicitar a exportação dos dados disponíveis durante <strong>30 dias</strong> após o encerramento;</li>
      <li>terminado esse período, os dados poderão ser removidos dos sistemas ativos da KLASSE;</li>
      <li>cópias residuais poderão permanecer em sistemas de cópia de segurança por até <strong>90 dias</strong>, de acordo com os ciclos técnicos de retenção da infraestrutura.</li>
      </ol>
      <p>Essas cópias de segurança não são destinadas ao uso operacional normal e serão eliminadas conforme os respetivos ciclos de retenção.</p>
      <h2>4. Limitações à exclusão</h2>
      <p>Determinados dados poderão ser mantidos quando a conservação for necessária para:</p>
      <ul>
      <li>cumprimento de obrigações legais ou contratuais;</li>
      <li>segurança da plataforma;</li>
      <li>prevenção de fraude;</li>
      <li>faturação e registos financeiros;</li>
      <li>exercício ou defesa de direitos.</li>
      </ul>
      <p>Nesses casos, os dados serão mantidos apenas pelo período necessário à finalidade correspondente.</p>
      <h2>5. Confirmação do pedido</h2>
      <p>Após a validação de um pedido de exclusão, a KLASSE realizará as ações tecnicamente aplicáveis e poderá confirmar ao solicitante a conclusão do processo ou informar eventuais limitações justificadas.</p>
      <h2>6. Contacto</h2>
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
