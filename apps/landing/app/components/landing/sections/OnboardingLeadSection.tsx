'use client'

import { useMemo, useState } from 'react'

interface OnboardingLeadSectionProps {
  scheduleUrl: string
}

const initialState = {
  escola: '',
  provincia: '',
  municipio: '',
  alunos: '',
  contacto: '',
  website: '',
}

const FAIXAS_ALUNOS = [
  'Até 400 alunos',
  '401 a 800 alunos',
  '801 a 1200 alunos',
  'Mais de 1200 alunos',
]

const normalizeContato = (value: string) => {
  if (value.includes('@')) {
    return value
  }

  if (/[a-zA-Z]/.test(value)) {
    return value
  }

  const digits = value.replace(/\D/g, '')

  if (!digits) {
    return value.startsWith('+') ? '+' : ''
  }

  if (digits.startsWith('244')) {
    return `+244${digits.slice(3, 12)}`
  }

  return digits.slice(0, 9)
}

const MUNICIPIOS_POR_PROVINCIA: Record<string, string[]> = {
  Bengo: ['Ambriz', 'Bula Atumba', 'Dande', 'Dembos', 'Nambuangongo', 'Pango Aluquém'],
  Benguela: ['Balombo', 'Baía Farta', 'Benguela', 'Bocoio', 'Catumbela', 'Chongorói', 'Cubal', 'Ganda', 'Lobito'],
  'Bié': ['Andulo', 'Camacupa', 'Catabola', 'Chinguar', 'Chitembo', 'Cuemba', 'Cunhinga', 'Kuito', 'Nharea'],
  Cabinda: ['Belize', 'Buco-Zau', 'Cabinda', 'Cacongo'],
  'Cuando Cubango': ['Calai', 'Cuangar', 'Cuchi', 'Cuito Cuanavale', 'Dirico', 'Mavinga', 'Menongue', 'Nancova', 'Rivungo'],
  'Cuanza Norte': ['Ambaca', 'Banga', 'Bolongongo', 'Cambambe', 'Cazengo', 'Golungo Alto', 'Lucala', 'Ngonguembo', 'Quiculungo', 'Samba Caju'],
  'Cuanza Sul': ['Amboim', 'Cassongue', 'Cela', 'Conda', 'Ebo', 'Libolo', 'Mussende', 'Porto Amboim', 'Quibala', 'Quilenda', 'Seles', 'Sumbe'],
  Cunene: ['Cahama', 'Cuanhama', 'Curoca', 'Cuvelai', 'Namacunde', 'Ombadja'],
  Huambo: ['Bailundo', 'Caála', 'Catchiungo', 'Ecunha', 'Huambo', 'Londuimbali', 'Longonjo', 'Mungo', 'Tchicala Tcholoanga', 'Tchindjenje', 'Ukuma'],
  'Huíla': ['Caconda', 'Cacula', 'Caluquembe', 'Chiange', 'Chibia', 'Chicomba', 'Chipindo', 'Cuvango', 'Humpata', 'Jamba', 'Lubango', 'Matala', 'Quilengues', 'Quipungo'],
  Luanda: ['Belas', 'Cacuaco', 'Cazenga', 'Icolo e Bengo', 'Kilamba Kiaxi', 'Luanda', 'Maianga', 'Quissama', 'Rangel', 'Talatona', 'Viana'],
  'Lunda Norte': ['Cambulo', 'Capenda Camulemba', 'Caungula', 'Chitato', 'Cuango', 'Cuilo', 'Lubalo', 'Lucapa', 'Lóvua', 'Xá-Muteba'],
  'Lunda Sul': ['Cacolo', 'Dala', 'Muconda', 'Saurimo'],
  Malanje: ['Cacuso', 'Calandula', 'Cambundi-Catembo', 'Cangandala', 'Caombo', 'Cuaba Nzogo', 'Cunda-dia-Baze', 'Kiwaba Nzoji', 'Luquembo', 'Malanje', 'Marimba', 'Massango', 'Mucari', 'Quela', 'Quirima'],
  Moxico: ['Camanongue', 'Cameia', 'Cazombo', 'Luau', 'Luena', 'Luchazes', "Lumbala N'guimbo", 'Léua'],
  Namibe: ['Bibala', 'Camucuio', 'Moçâmedes', 'Tombwa', 'Virei'],
  'Uíge': ['Alto Cauale', 'Ambuila', 'Bembe', 'Buengas', 'Bungo', 'Damba', 'Maquela do Zombo', 'Mucaba', 'Negage', 'Puri', 'Quimbele', 'Quitexe', 'Songo', 'Uíge'],
  Zaire: ['Cuimba', "M'Banza Kongo", 'Noqui', 'Nzeto', 'Soyo', 'Tomboco'],
}

const PROVINCIAS = Object.keys(MUNICIPIOS_POR_PROVINCIA)

export function OnboardingLeadSection({ scheduleUrl }: OnboardingLeadSectionProps) {
  const [form, setForm] = useState(initialState)

  const whatsappLink = useMemo(() => {
    const message = [
      'Pedido de onboarding KLASSE',
      `Escola: ${form.escola || '-'}`,
      `Província: ${form.provincia || '-'}`,
      `Município: ${form.municipio || '-'}`,
      `Alunos: ${form.alunos || '-'}`,
      `Contacto: ${form.contacto || '-'}`,
    ].join('\n')

    const url = new URL(scheduleUrl)
    url.searchParams.set('text', message)
    return url.toString()
  }, [form, scheduleUrl])

  return (
    <section className="onboarding-lead z reveal section-accent" id="onboarding">
      <div className="container">
        <div className="onboarding-lead__header">
          <div className="sec-eyebrow">Onboarding público</div>
          <h2 className="sec-title">Comece o onboarding da sua escola</h2>
          <p className="sec-sub">
            Deixe os dados base da escola e a nossa equipa entra em contacto para ativar o sistema.
          </p>
        </div>

        <form
          className="onboarding-lead__form"
          onSubmit={async (event) => {
            event.preventDefault()
            try {
              await fetch('/api/onboarding-lead', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  escola: form.escola,
                  provincia: form.provincia,
                  municipio: form.municipio,
                  alunos: form.alunos,
                  contacto: form.contacto,
                  website: form.website,
                }),
              })
            } catch {
              // fallback to WhatsApp even if API fails
            }
            window.open(whatsappLink, '_blank', 'noopener,noreferrer')
          }}
        >
          <div className="onboarding-lead__grid">
            <label className="onboarding-lead__field">
              <span>Nome da escola</span>
              <input
                className="lead-input"
                value={form.escola}
                onChange={(event) => setForm((prev) => ({ ...prev, escola: event.target.value }))}
                placeholder="Ex: Colégio Horizonte"
                required
              />
            </label>
            <label className="onboarding-lead__field">
              <span>Província</span>
              <select
                className="lead-input"
                value={form.provincia}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, provincia: event.target.value, municipio: '' }))
                }
                required
              >
                <option value="">Seleccionar...</option>
                {PROVINCIAS.map((provincia) => (
                  <option key={provincia} value={provincia}>
                    {provincia}
                  </option>
                ))}
              </select>
            </label>
            <label className="onboarding-lead__field">
              <span>Município</span>
              <select
                className="lead-input"
                value={form.municipio}
                onChange={(event) => setForm((prev) => ({ ...prev, municipio: event.target.value }))}
                required
              >
                <option value="">Seleccionar...</option>
                {(MUNICIPIOS_POR_PROVINCIA[form.provincia] ?? []).map((municipio) => (
                  <option key={municipio} value={municipio}>
                    {municipio}
                  </option>
                ))}
              </select>
            </label>
            <label className="onboarding-lead__field">
              <span>Número de alunos</span>
              <select
                className="lead-input"
                value={form.alunos}
                onChange={(event) => setForm((prev) => ({ ...prev, alunos: event.target.value }))}
                required
              >
                <option value="">Seleccionar...</option>
                {FAIXAS_ALUNOS.map((faixa) => (
                  <option key={faixa} value={faixa}>
                    {faixa}
                  </option>
                ))}
              </select>
            </label>
            <label className="onboarding-lead__field onboarding-lead__field--full">
              <span>Contacto (WhatsApp ou email)</span>
              <input
                className="lead-input"
                value={form.contacto}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, contacto: normalizeContato(event.target.value) }))
                }
                placeholder="+2449XXXXXXXX ou email"
                required
              />
            </label>
            <label className="onboarding-lead__field onboarding-lead__field--honeypot" aria-hidden="true">
              <span>Website</span>
              <input
                className="lead-input"
                value={form.website}
                onChange={(event) => setForm((prev) => ({ ...prev, website: event.target.value }))}
                tabIndex={-1}
                autoComplete="off"
              />
            </label>
          </div>

          <div className="onboarding-lead__actions">
            <button className="btn-p" type="submit">
              Pedir demo
            </button>
            <a className="btn-s" href="https://app.klasse.ao/login" rel="noopener noreferrer">
              Aceder ao sistema
            </a>
          </div>
        </form>
      </div>
    </section>
  )
}
