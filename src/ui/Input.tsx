import type { InputHTMLAttributes, ReactNode } from "react";

/**
 * Text input.
 *
 * Inset rather than raised — the inverse of Button. Controls you press stand out of the
 * page; controls you fill are cut into it. That is the whole depth system.
 *
 * The boundary uses `--color-line-strong` (3.6:1) rather than the decorative divider
 * colour, because the edge of an input carries meaning and has to clear the 3:1 bar for
 * non-text contrast.
 */

// `prefix` is omitted alongside `size` because it already exists on HTMLAttributes as
// the RDFa attribute, typed as string.
export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> {
  size?: "md" | "lg";
  /** Renders in the signal colour and wires up aria-invalid. */
  invalid?: boolean;
  /** Fixed content inside the field — the `@` on a handle, a status tick. */
  prefix?: ReactNode;
  suffix?: ReactNode;
}

export function Input({
  size = "md",
  invalid = false,
  prefix,
  suffix,
  className = "",
  disabled,
  ...rest
}: InputProps) {
  return (
    <div
      className={`bg-ink-inset flex items-center gap-2 rounded-md border
                  ${invalid ? "border-signal" : "border-line-strong"}
                  ${size === "lg" ? "px-4" : "px-3"}
                  ${disabled ? "opacity-50" : ""}
                  focus-within:border-paper transition-colors ${className}`}
    >
      {prefix && <span className="text-muted shrink-0">{prefix}</span>}
      <input
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={`placeholder:text-muted min-w-0 flex-1 bg-transparent outline-none
                    ${size === "lg" ? "text-body-lg min-h-13" : "text-body min-h-11"}`}
        {...rest}
      />
      {suffix && <span className="shrink-0">{suffix}</span>}
    </div>
  );
}

/**
 * Field wrapper.
 *
 * Label above, help or error below. Error text uses `--color-signal-text` (6.4:1), not
 * `--color-signal` (4.1:1) — the same meaning needs a lighter value to stay legible at
 * body size.
 */
export function Field({
  label,
  htmlFor,
  help,
  error,
  optional,
  count,
  children,
}: {
  label: string;
  htmlFor: string;
  help?: string;
  error?: string | null;
  optional?: boolean;
  /** e.g. "24/80" — right-aligned against the label. */
  count?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={htmlFor}
          className="text-label text-secondary font-semibold tracking-[0.12em] uppercase"
        >
          {label}
          {optional && <span className="text-muted ml-1.5 normal-case">— optional</span>}
        </label>
        {count && <span className="text-label text-muted tabular-nums">{count}</span>}
      </div>

      {children}

      {error ? (
        <p className="text-body-sm text-signal-text">{error}</p>
      ) : help ? (
        <p className="text-body-sm text-muted">{help}</p>
      ) : null}
    </div>
  );
}
