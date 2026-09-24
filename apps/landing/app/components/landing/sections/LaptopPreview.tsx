'use client'

import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import styles from './LaptopPreview.module.css'

export function LaptopPreview() {
  const reducedMotion = useReducedMotion()

  return (
    <div className={styles.preview}>
      <motion.figure
        className={styles.laptop}
        animate={reducedMotion ? undefined : { y: [0, -7, 0], rotateZ: [0, -0.2, 0] }}
        transition={{ duration: 7, ease: 'easeInOut', repeat: Infinity }}
      >
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
        <figcaption className="sr-only">Uma visão clara para cada decisão da direção escolar.</figcaption>
      </motion.figure>
      <div className={styles.caption}>
        <span>Dashboard real do KLASSE</span>
        <strong>Uma visão para cada decisão</strong>
      </div>
    </div>
  )
}
