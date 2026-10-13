import type { ReactNode } from 'react';

export function Table({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label={caption}>
      <table className="table">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}
