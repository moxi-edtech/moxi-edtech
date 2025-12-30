import Image from "next/image";

export default function BrandPanel() {
  return (
    <div className="relative hidden md:block overflow-hidden">
      {/* Base */}
      <div className="absolute inset-0 bg-klasse-green" />

      {/* Pattern */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.10]"
        viewBox="0 0 800 800"
        aria-hidden="true"
      >
        <defs>
          <pattern id="klassePattern" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M0 40 L40 0 L80 40 L40 80 Z" fill="none" stroke="currentColor" strokeWidth="6" />
            <circle cx="40" cy="40" r="8" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="800" height="800" fill="url(#klassePattern)" className="text-klasse-green-800" />
      </svg>

      {/* Faixa inferior */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-klasse-green-800/40" />

      {/* Conteúdo (FRONT) */}
      <div className="relative z-10 h-full p-12 flex items-center">
        <div className="max-w-md">
          {/* Bloco de marca: LOGO + TEXTO */}
          <div className="flex items-center gap-4">
            <Image
              src="/logo-klasse.svg"
              alt="Klasse"
              width={72}
              height={72}
              className="shrink-0"
              priority
            />

            <div className="text-white">
              <div className="text-4xl font-semibold tracking-tight leading-none">KLASSE</div>
              <div className="text-lg opacity-90">gestão escolar</div>
            </div>
          </div>

          <p className="mt-6 text-white/80 text-sm leading-relaxed">
            Local. Autêntico. Orgulhoso. Uma plataforma moderna para gestão escolar em Angola.
          </p>
        </div>
      </div>
    </div>
  );
}