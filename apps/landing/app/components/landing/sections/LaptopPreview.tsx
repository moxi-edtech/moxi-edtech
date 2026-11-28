'use client'

import Image from 'next/image'
import styles from './LaptopPreview.module.css'

export function LaptopPreview() {
  return (
    <div className={styles.preview}>
      <figure className={styles.laptop}>
        <div className={styles.display}>
          <div className={styles.camera} aria-hidden="true" />
          <div className={styles.screen}>
            <Image
              src="/assets/dashboard-notebook.png"
              alt="Dashboard KLASSE com indicadores académicos e financeiros da escola"
              width={2868}
              height={1646}
              sizes="(max-width: 900px) 94vw, 58vw"
              priority
            />
          </div>
        </div>
        <div className={styles.hinge} aria-hidden="true" />
        <div className={styles.base} aria-hidden="true">
          <span />
        </div>
        <figcaption className="sr-only">Painel de gestão escolar do KLASSE.</figcaption>
      </figure>
      <div className={styles.caption}>
        <span>Portal da direcção</span>
        <strong>Indicadores académicos e financeiros</strong>
      </div>
    </div>
  )
}
