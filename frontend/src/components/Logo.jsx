// Marca GIM · ESAP — monograma en SVG (sin dependencias externas).
// `variant="mark"` = solo el ícono (para espacios reducidos / favicon).
// `variant="full"` (default) = ícono + wordmark, para el topbar y el login.
export default function Logo({ variant = 'full', className = '' }) {
  const mark = (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <defs>
        <linearGradient id="gim-mark-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#132242" />
          <stop offset="1" stopColor="#0A1730" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="url(#gim-mark-grad)" />
      <rect x="0.5" y="0.5" width="39" height="39" rx="9.5" stroke="#C8970A" strokeOpacity="0.35" />
      {/* Columnas estilizadas — institución / infraestructura */}
      <g fill="#C8970A">
        <rect x="10" y="14" width="3.4" height="16" rx="1" />
        <rect x="18.3" y="10" width="3.4" height="20" rx="1" />
        <rect x="26.6" y="17" width="3.4" height="13" rx="1" />
      </g>
      <rect x="9" y="30.5" width="22" height="2.2" rx="1.1" fill="#C8970A" />
    </svg>
  )

  if (variant === 'mark') return <div className={className}>{mark}</div>

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {mark}
      <div className="leading-tight">
        <div className="font-serif text-[19px] font-semibold text-white tracking-tight">
          GIM <span className="text-gold">·</span> ESAP
        </div>
        <div className="font-mono text-[9.5px] tracking-[0.18em] text-white/50 uppercase font-medium -mt-0.5">
          Gestión de Infraestructura
        </div>
      </div>
    </div>
  )
}
