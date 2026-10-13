import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { sanitiseOtp } from '../../lib/validators';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  label?: string;
  describedBy?: string;
}

const LENGTH = 6;

/** Six single-digit boxes behaving like one field: typing advances, backspace retreats, paste fills all. */
export function OtpInput({ value, onChange, onComplete, disabled, invalid, autoFocus, label = 'One-time code', describedBy }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const focus = (i: number) => refs.current[Math.max(0, Math.min(LENGTH - 1, i))]?.focus();

  const commit = (next: string, focusIndex: number) => {
    onChange(next);
    if (next.length === LENGTH) onComplete?.(next);
    else focus(focusIndex);
  };

  const onInput = (i: number, raw: string) => {
    const digits = sanitiseOtp(raw);
    if (!digits) {
      // cleared this box
      onChange(value.slice(0, i) + value.slice(i + 1));
      return;
    }
    const chars = value.padEnd(LENGTH, ' ').split('');
    let pos = i;
    for (const d of digits) {
      if (pos >= LENGTH) break;
      chars[pos++] = d;
    }
    const next = chars.join('').replace(/ /g, '').slice(0, LENGTH);
    commit(next, pos);
  };

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) {
      e.preventDefault();
      onChange(value.slice(0, i - 1) + value.slice(i));
      focus(i - 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focus(i - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focus(i + 1);
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const digits = sanitiseOtp(e.clipboardData.getData('text'));
    if (digits) commit(digits, digits.length);
  };

  return (
    <div className="otp" role="group" aria-label={label} aria-describedby={describedBy}>
      {Array.from({ length: LENGTH }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className="otp-box"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={LENGTH}
          aria-label={`${label}, digit ${i + 1} of ${LENGTH}`}
          aria-invalid={invalid || undefined}
          value={value[i] ?? ''}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          onChange={(e) => onInput(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={onPaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
