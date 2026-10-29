import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BookOpen, GraduationCap, HeartHandshake, Lightbulb, MousePointer2, Sparkles } from "lucide-react";
import styles from "./impacto.module.css";

export const metadata: Metadata = {
  title: "KLASSE Impact | O futuro da educação constrói-se com todos",
  description: "A frente institucional do KLASSE para escutar escolas, promover competências digitais e apoiar a transformação da educação angolana.",
};

const pillars = [
  { number: "01", name: "Comunidade educativa", description: "Dar voz a quem vive a escola: estudantes, professores, famílias e diretores.", icon: HeartHandshake },
  { number: "02", name: "Competências digitais", description: "Partilhar ferramentas úteis para aprender, ensinar e trabalhar com tecnologia.", icon: GraduationCap },
  { number: "03", name: "Escolas mais digitais", description: "Conhecer os desafios administrativos e testar melhorias com as escolas.", icon: MousePointer2 },
  { number: "04", name: "Conhecimento e impacto", description: "Documentar experiências, reconhecer limites e aprender com resultados reais.", icon: Lightbulb },
];

const initiatives = [
  { number: "01", category: "ESCUTA & COMUNIDADE", title: "Vozes da Escola", copy: "Antes de propor respostas, queremos ouvir quem vive a educação todos os dias.", className: styles.voice, icon: HeartHandshake },
  { number: "02", category: "APRENDIZAGEM DIGITAL", title: "KLASSE Digital Academy", copy: "Oficinas e experiências práticas para aproximar estudantes e docentes da tecnologia.", className: styles.academy, icon: BookOpen },
  { number: "03", category: "TRANSFORMAÇÃO NA PRÁTICA", title: "Escola Sem Papel", copy: "Testar processos mais simples, com diagnóstico, acompanhamento e avaliação.", className: styles.paperless, icon: Sparkles },
];

export default function ImpactoPage() {
  return (
    <main className={styles.page} id="topo">
      <a className={styles.skipLink} href="#conteudo">Saltar para o conteúdo</a>
      <header className={styles.header}>
        <Link className={styles.brand} href="#topo" aria-label="KLASSE Impact — início">
          KLASSE<span>impact<span className={styles.brandDot}>.</span></span>
        </Link>
        <nav className={styles.nav} aria-label="Navegação principal">
          <a href="#proposito">Propósito</a>
          <a href="#iniciativas">Iniciativas</a>
          <a href="#participar" className={styles.navCta}>Colaborar <ArrowUpRight size={16} aria-hidden /></a>
        </nav>
      </header>

      <section className={styles.hero} id="conteudo" aria-labelledby="impact-title">
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}><span className={styles.sunDot} /> TECNOLOGIA AO SERVIÇO DA EDUCAÇÃO ANGOLANA</span>
          <h1 id="impact-title">O futuro da <em>educação</em> constrói-se <span>com todos<span className={styles.period}>.</span></span></h1>
          <p>Uma iniciativa do KLASSE para ouvir as escolas, partilhar conhecimento e construir caminhos para uma educação mais digital e próxima das pessoas.</p>
          <div className={styles.heroActions}>
            <a className={styles.primary} href="#iniciativas">Conhecer as iniciativas <ArrowUpRight size={18} aria-hidden /></a>
            <a className={styles.textLink} href="#proposito">O nosso propósito <ArrowDownRight size={18} aria-hidden /></a>
          </div>
        </div>
        <div className={styles.heroArt} aria-label="Composição gráfica representando educação, diálogo e transformação digital">
          <div className={styles.artGreen}><span className={styles.artTiny}>A ESCOLA É FEITA DE PESSOAS</span><span className={styles.artStars} aria-hidden="true">✳</span><strong>Ideias que ganham vida.</strong></div>
          <div className={styles.artYellow}><span className={styles.handDrawn} aria-hidden="true">↗</span><span>Aprender.<br/>Partilhar.<br/>Transformar.</span></div>
          <div className={styles.artNote}><span aria-hidden="true">✦</span> Angola, a nossa sala de aula.</div>
          <div className={styles.artRing} aria-hidden="true" />
        </div>
        <div className={styles.heroBottom}><span>UM PROJECTO INSTITUCIONAL KLASSE</span><a href="#proposito">Explorar <ArrowDownRight size={16} aria-hidden /></a></div>
      </section>

      <section className={styles.marquee} aria-label="Princípios do KLASSE Impact">
        <div>OUVIR <span>✳</span> APRENDER <span>✳</span> CRIAR <span>✳</span> PARTILHAR <span>✳</span> TRANSFORMAR <span>✳</span></div>
      </section>

      <section className={styles.purpose} id="proposito" aria-labelledby="purpose-heading">
        <div className={styles.sectionMarker}>01 / O NOSSO PROPÓSITO</div>
        <div className={styles.purposeIntro}><h2 id="purpose-heading">A transformação começa <em>por escutar.</em></h2><p>A tecnologia só faz sentido quando responde a necessidades reais. Por isso, queremos aproximar escolas, estudantes, famílias e instituições para experimentar, aprender e melhorar juntos.</p></div>
        <div className={styles.pillarGrid}>{pillars.map(({number,name,description,icon:Icon})=><article key={number} className={styles.pillar}><div className={styles.pillarTop}><span>{number}</span><Icon size={28} strokeWidth={1.7} aria-hidden /></div><h3>{name}</h3><p>{description}</p></article>)}</div>
      </section>

      <section className={styles.initiatives} id="iniciativas" aria-labelledby="initiatives-heading">
        <div className={styles.sectionMarker}>02 / IDEIAS PARA COMEÇAR</div>
        <div className={styles.initiativesHeading}><h2 id="initiatives-heading">Pequenos passos.<br/><em>Grandes possibilidades.</em></h2><p>Três propostas prioritárias para a primeira fase. Ainda não são resultados executados nem programas lançados.</p></div>
        <div className={styles.initiativeGrid}>{initiatives.map(({number,category,title,copy,className,icon:Icon})=><article key={number} className={`${styles.initiativeCard} ${className}`}><div className={styles.cardTop}><span>{number} / {category}</span><span className={styles.proposed}>PROPOSTA</span></div><div className={styles.cardIllustration}><Icon size={92} strokeWidth={1} aria-hidden /><span aria-hidden="true">✳</span></div><h3>{title}</h3><p>{copy}</p><span className={styles.cardFoot}>Conhecer a ideia <ArrowUpRight size={18} aria-hidden /></span></article>)}</div>
      </section>

      <section className={styles.manifesto} aria-labelledby="manifesto-heading"><span className={styles.sectionMarker}>03 / COMO QUEREMOS TRABALHAR</span><h2 id="manifesto-heading">Não basta falar de mudança.<br/><em>É preciso construí-la,</em> medir e partilhar o que aprendemos.</h2><p>Começar pequeno. Trabalhar com autorização e transparência. Mostrar resultados verificáveis, incluindo o que ainda precisa de melhorar.</p><span className={styles.manifestoStar} aria-hidden="true">✳</span></section>

      <section className={styles.participate} id="participar" aria-labelledby="participate-heading"><div className={styles.sectionMarker}>04 / FAZER PARTE</div><div className={styles.participateGrid}><div><h2 id="participate-heading">A tua escola também tem <em>algo a dizer.</em></h2><p>Queremos conversar com escolas, universidades, organizações e pessoas que acreditam numa educação angolana mais preparada para o futuro.</p><a className={styles.primary} href="mailto:contacto@klasse.ao?subject=KLASSE%20Impact%20-%20Colabora%C3%A7%C3%A3o">Propor uma colaboração <ArrowUpRight size={18} aria-hidden /></a></div><div className={styles.participateArt} aria-hidden="true"><HeartHandshake size={120} strokeWidth={1} /><span>Juntos<br/>fazemos<br/>mais.</span></div></div></section>

      <footer className={styles.footer}><Link className={styles.brand} href="#topo">KLASSE<span>impact<span className={styles.brandDot}>.</span></span></Link><p>Uma iniciativa institucional da Moxi EdTech / KLASSE. Não é uma ONG ou programa governamental.</p><div><a href="https://klasse.ao" target="_blank" rel="noopener noreferrer">Conhecer a plataforma KLASSE <ArrowUpRight size={16} aria-hidden /></a><a href="#topo">Voltar ao topo <ArrowRight size={16} aria-hidden /></a></div></footer>
    </main>
  );
}
