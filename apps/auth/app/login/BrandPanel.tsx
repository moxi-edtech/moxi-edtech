export default function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden md:block">
      <div className="absolute inset-0 bg-klasse-green" />

      <svg className="absolute inset-0 h-full w-full opacity-[0.10]" viewBox="0 0 800 800" aria-hidden="true">
        <defs>
          <pattern id="klassePattern" width="80" height="80" patternUnits="userSpaceOnUse">
            <path d="M0 40 L40 0 L80 40 L40 80 Z" fill="none" stroke="currentColor" strokeWidth="6" />
            <circle cx="40" cy="40" r="8" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="800" height="800" fill="url(#klassePattern)" className="text-klasse-green-800" />
      </svg>

      <div className="absolute bottom-0 left-0 right-0 h-16 bg-klasse-green-800/40" />

      <div className="relative z-10 flex h-full items-center p-12">
        <div className="max-w-md">
          <div className="flex items-center gap-4">
            <img src="/logo-klasse-auth.png" alt="Klasse" width={72} height={72} className="shrink-0 object-contain" />
            <div className="text-white">
              <div className="text-4xl font-semibold leading-none tracking-tight">KLASSE</div>
              <div className="text-lg opacity-90">gestão escolar</div>
            </div>
          </div>

          <p className="mt-6 text-sm leading-relaxed text-white/80">
            Local. Autêntico. Orgulhoso. Uma plataforma moderna para gestão escolar em Angola.
          </p>
        </div>
      </div>
    </div>
  );
}
