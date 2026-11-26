"use client";

import type { ReactNode } from "react";

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
    <section className={`rounded-xl border border-line bg-panel ${className}`}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">{title}</h2>
          {right}
        </header>
      )}
      <div className="p-4">{children}</div>
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

export function Stepper({
  value,
  min,
  max,
  onChange,
  label,
  step = 1,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
  step?: number;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(clamp(value - step))}
          className="h-8 w-8 rounded-md border border-line bg-panel-2 text-lg leading-none text-muted hover:text-foreground"
        >
          −
        </button>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(clamp(Number(e.target.value) || min))}
          className="h-8 w-full rounded-md border border-line bg-ink text-center font-mono text-base text-foreground outline-none focus:border-accent/60"
        />
        <button
          type="button"
          onClick={() => onChange(clamp(value + step))}
          className="h-8 w-8 rounded-md border border-line bg-panel-2 text-lg leading-none text-muted hover:text-foreground"
        >
          +
        </button>
      </div>
    </div>
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
