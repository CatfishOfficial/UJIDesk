import { useId, type ClipboardEvent, type ReactNode, type RefObject } from 'react';
import { MathView } from '../../ui/MathView';

/**
 * Small input building blocks shared by the problem tools, so every tool
 * reads the same: a label, a forgiving text box, and a live "reads as" line.
 */
export function ExprField({
  label,
  value,
  onChange,
  placeholder,
  invalid,
  inputRef,
  preview,
  hint,
  onPaste,
  size = 'lg',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  invalid?: boolean;
  inputRef?: RefObject<HTMLInputElement>;
  /** Markup for how the input was understood, or null while it doesn't parse. */
  preview?: string | null;
  hint?: ReactNode;
  onPaste?: (e: ClipboardEvent<HTMLInputElement>) => void;
  size?: 'lg' | 'md';
}) {
  const id = useId();
  return (
    <div className="eq-field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        className={`field field-math ${size === 'lg' ? 'field-lg' : ''} ${invalid ? 'is-invalid' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={onPaste}
        placeholder={placeholder}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        aria-invalid={invalid}
        aria-describedby={`${id}-hint`}
      />
      {(preview !== undefined || hint) && (
        <div className="eq-preview" id={`${id}-hint`} aria-live="polite">
          {preview ? (
            <>
              <span className="muted small">Reads as</span> <MathView m={preview} />
            </>
          ) : (
            <span className="muted small">{hint}</span>
          )}
        </div>
      )}
    </div>
  );
}

/** A labelled box for one number, laid out in a grid with its siblings. */
export function NumField({
  label,
  value,
  onChange,
  invalid,
  inputRef,
  placeholder = '',
  suffix,
  optional,
}: {
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  inputRef?: RefObject<HTMLInputElement>;
  placeholder?: string;
  suffix?: string;
  optional?: boolean;
}) {
  return (
    <label className={`num-field ${optional ? 'is-optional' : ''}`}>
      <span className="field-label">
        {label}
        {optional && <span className="num-field-opt"> optional</span>}
      </span>
      <span className="num-field-box">
        <input
          ref={inputRef}
          className={`field field-math ${invalid ? 'is-invalid' : ''}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          aria-invalid={invalid}
        />
        {suffix && <span className="num-field-suffix">{suffix}</span>}
      </span>
    </label>
  );
}

/** A coordinate pair: ( x , y ). Typing a comma hops to the y box. */
export function PointField({
  legend,
  x,
  y,
  onX,
  onY,
  invalidX,
  invalidY,
  inputRef,
  sub,
  onPaste,
}: {
  legend: string;
  x: string;
  y: string;
  onX: (v: string) => void;
  onY: (v: string) => void;
  invalidX?: boolean;
  invalidY?: boolean;
  inputRef?: RefObject<HTMLInputElement>;
  sub: string;
  onPaste?: (e: ClipboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <fieldset className="point-field">
      <legend className="field-label">{legend}</legend>
      <div className="point-row">
        <span className="paren" aria-hidden="true">
          (
        </span>
        <span className="coord">
          <input
            ref={inputRef}
            className={`field field-math ${invalidX ? 'is-invalid' : ''}`}
            value={x}
            onChange={(e) => onX(e.target.value)}
            onPaste={onPaste}
            onKeyDown={(e) => {
              if (e.key === ',') {
                e.preventDefault();
                (e.currentTarget.closest('.point-row')?.querySelectorAll('input')[1] as HTMLInputElement | undefined)?.focus();
              }
            }}
            placeholder={`x${sub}`}
            aria-label={`x${sub}`}
            aria-invalid={invalidX}
            autoComplete="off"
          />
          <span className="comma" aria-hidden="true">
            ,
          </span>
        </span>
        <span className="coord">
          <input
            className={`field field-math ${invalidY ? 'is-invalid' : ''}`}
            value={y}
            onChange={(e) => onY(e.target.value)}
            placeholder={`y${sub}`}
            aria-label={`y${sub}`}
            aria-invalid={invalidY}
            autoComplete="off"
          />
        </span>
        <span className="paren" aria-hidden="true">
          )
        </span>
      </div>
    </fieldset>
  );
}

/** Segmented choice, like Alpha / Beta / Positron. */
export function Seg<T extends string>({ value, options, onChange, label, className = '' }: { value: T; options: { id: T; label: string; title?: string }[]; onChange: (v: T) => void; label: string; className?: string }) {
  return (
    <div className={`seg seg-wrap ${className}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} aria-pressed={value === o.id} title={o.title} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
