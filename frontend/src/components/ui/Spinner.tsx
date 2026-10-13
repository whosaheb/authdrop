export function Spinner({ label, size = 20 }: { label?: string; size?: number }) {
  return (
    <span className="spinner-wrap" role={label ? 'status' : undefined}>
      <svg className="spinner" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.2" />
        <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label ? <span>{label}</span> : null}
    </span>
  );
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="page-loader">
      <Spinner label={label} size={24} />
    </div>
  );
}
