import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function CopyButton({ value, label = 'Copy', copiedLabel = 'Copied', size = 'sm', variant = 'secondary', describe }: { value: string; label?: string; copiedLabel?: string; size?: 'sm' | 'md'; variant?: 'secondary' | 'ghost' | 'primary'; describe?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onClick = async () => {
    const ok = await copyText(value);
    setState(ok ? 'copied' : 'failed');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 2200);
  };

  return (
    <>
      <Button variant={variant} size={size} onClick={() => void onClick()} aria-label={describe ? `${label} ${describe}` : undefined}>
        {state === 'copied' ? copiedLabel : state === 'failed' ? 'Copy failed' : label}
      </Button>
      <span className="sr-only" role="status">
        {state === 'copied' ? 'Copied to clipboard' : state === 'failed' ? 'Could not copy' : ''}
      </span>
    </>
  );
}
