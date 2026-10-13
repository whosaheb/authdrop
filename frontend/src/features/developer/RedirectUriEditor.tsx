import { useId } from 'react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

interface Props {
  label: string;
  hint?: string;
  values: string[];
  onChange: (values: string[]) => void;
  /** Per-row problems, same length as values (null = fine). Shown only when `showErrors`. */
  problems: (string | null)[];
  listProblem?: string | null;
  showErrors: boolean;
  max?: number;
  addLabel?: string;
  placeholder?: string;
}

/** Dynamic list of URL inputs. Each row is labelled and announces its own error. */
export function RedirectUriEditor({ label, hint, values, onChange, problems, listProblem, showErrors, max = 10, addLabel = 'Add another URL', placeholder = 'https://app.example.com/callback' }: Props) {
  const id = useId();
  const set = (i: number, v: string) => onChange(values.map((x, j) => (j === i ? v : x)));
  return (
    <fieldset className="uri-editor">
      <legend className="field-label">{label}</legend>
      {hint ? <p className="field-hint">{hint}</p> : null}
      <ul className="uri-list">
        {values.map((v, i) => {
          const err = showErrors ? problems[i] : null;
          return (
            <li key={i}>
              <div className="uri-row">
                <Input id={`${id}-${i}`} aria-label={`${label} ${i + 1}`} aria-invalid={err ? true : undefined} aria-describedby={err ? `${id}-${i}-err` : undefined} type="url" inputMode="url" autoCapitalize="none" spellCheck={false} placeholder={placeholder} value={v} onChange={(e) => set(i, e.target.value)} />
                <Button variant="ghost" size="sm" onClick={() => onChange(values.filter((_, j) => j !== i))} aria-label={`Remove ${label} ${i + 1}`}>
                  Remove
                </Button>
              </div>
              <p className="field-error" id={`${id}-${i}-err`} role={err ? 'alert' : undefined}>
                {err ?? ''}
              </p>
            </li>
          );
        })}
      </ul>
      {showErrors && listProblem ? (
        <p className="field-error" role="alert">
          {listProblem}
        </p>
      ) : null}
      <Button variant="secondary" size="sm" disabled={values.length >= max} onClick={() => onChange([...values, ''])}>
        {addLabel}
      </Button>
    </fieldset>
  );
}
