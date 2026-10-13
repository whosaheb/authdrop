export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="logo-mark">
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <path d="M16 5.5c-3.6 4.6-6.5 8.1-6.5 12a6.5 6.5 0 0 0 13 0c0-3.9-2.9-7.4-6.5-12Z" fill="#fff" />
      <path d="M13 18.5a3 3 0 0 0 3 3" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <LogoMark />
      <span>AuthDrop</span>
    </span>
  );
}
