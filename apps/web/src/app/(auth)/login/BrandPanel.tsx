export default function BrandPanel() {
  return (
    <div className="relative hidden md:block overflow-hidden">
      {/* Base verde */}
      <div className="absolute inset-0 bg-[#1F6B3B]" />

      {/* Pattern (SVG inline, leve e escalável) */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.10]"
        viewBox="0 0 800 800"
        aria-hidden="true"
      >
        <defs>
          <pattern id="klassePattern" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M0 40 L40 0 L80 40 L40 80 Z" fill="none" stroke="#0B3F24" strokeWidth="6" />
            <circle cx="40" cy="40" r="8" fill="#0B3F24" />
          </pattern>
        </defs>
        <rect width="800" height="800" fill="url(#klassePattern)" />
      </svg>

      {/* Faixa inferior (toque cultural sutil) */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-[#0B3F24]/40" />

      {/* Conteúdo */}
      <div className="relative h-full p-12 flex items-end">
        <div>
          {/* Troque por seu SVG oficial */}
          <div className="text-white">
            <div className="text-4xl font-semibold tracking-tight">KLASSE</div>
            <div className="text-lg opacity-90">gestão escolar</div>
          </div>

          <p className="mt-6 max-w-md text-white/80 text-sm leading-relaxed">
            Local. Autêntico. Orgulhoso. Uma plataforma moderna para gestão escolar em Angola.
          </p>
        </div>
      </div>
    </div>
  );
}