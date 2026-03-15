export function KlasseSidebarIcon({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g fill="currentColor">
        <rect x="6" y="6" width="14" height="14" rx="3" />
        <rect x="6" y="25" width="14" height="14" rx="3" />
        <rect x="6" y="44" width="14" height="14" rx="3" />
        <rect x="25" y="25" width="14" height="14" rx="3" />
        <path d="M44 6H58L48.5 20H34.5L44 6Z" />
        <path d="M34.5 44H48.5L58 58H44L34.5 44Z" />
      </g>
    </svg>
  );
}
