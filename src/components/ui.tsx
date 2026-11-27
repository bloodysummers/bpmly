"use client";

import { useState, type ReactNode } from "react";

export function Panel({
  title,
  children,
  right,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-xl border border-line bg-panel ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">{title}</h2>
          {right}
        </header>
      )}
      <div className="min-w-0 p-4">{children}</div>
    </section>
  );
}

export function Button({
  children,
  onClick,
  variant = "default",
  size = "md",
  disabled,
  className = "",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "danger" | "ghost";
  size?: "md" | "sm";
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const styles: Record<string, string> = {
    default: "bg-panel-2 border-line text-foreground hover:border-muted/50",
    primary: "bg-accent/15 border-accent/60 text-accent hover:bg-accent/25",
    danger: "bg-playhead/10 border-playhead/50 text-playhead hover:bg-playhead/20",
    ghost: "bg-transparent border-transparent text-muted hover:text-foreground",
  };
  const sizes: Record<string, string> = { md: "px-3 py-1.5 text-sm", sm: "px-1.5 py-1 text-xs" };
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  value,
  onChange,
  type = "text",
  min,
  max,
  step,
}: {
  label: string;
  value: number | string;
  onChange: (v: number | string) => void;
  type?: "text" | "number";
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      <input
        data-testid={label}
        type={type}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(type === "number" ? Number(e.target.value) : e.target.value)}
        className="h-8 w-full rounded-md border border-line bg-ink px-2 text-sm text-foreground outline-none focus:border-accent/60"
      />
    </label>
  );
}

/**
 * Campo numérico que valida y aplica al perder el foco (o con Enter), no en cada
 * tecla. Así se puede escribir «120» sin que el primer dígito se dispare a 20.
 */
export function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);

  // El valor puede cambiar desde fuera (arrastre del borde del bloque, preset
  // arrastrado a la línea de tiempo…): sincroniza el texto con el modelo
  // ajustando el estado durante el render, sin efecto.
  if (value !== lastValue) {
    setLastValue(value);
    setText(String(value));
  }

  const commit = () => {
    const n = text.trim() === "" ? NaN : Number(text);
    const next = Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : value;
    setText(String(next));
    onChange(next);
  };

  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      <input
        data-testid={label}
        type="number"
        min={min}
        max={max}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="h-8 w-full rounded-md border border-line bg-ink px-2 text-sm text-foreground outline-none focus:border-accent/60"
      />
    </label>
  );
}

/**
 * Desplegable de valores fijos (numerador, denominador). Evita escribir números
 * libres que luego hay que recortar.
 */
export function Select({
  label,
  value,
  options,
  onChange,
  format,
}: {
  label: string;
  value: number;
  options: number[];
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      <select
        data-testid={label}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 w-full rounded-md border border-line bg-ink px-2 text-sm text-foreground outline-none focus:border-accent/60"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {format ? format(o) : o}
          </option>
        ))}
      </select>
    </label>
  );
}
