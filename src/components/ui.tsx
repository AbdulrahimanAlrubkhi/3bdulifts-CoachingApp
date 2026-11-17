import type { ReactNode } from "react";

export const inputClass =
  "h-11 w-full rounded-md border border-line bg-surface px-3 text-[15px] text-text placeholder:text-muted outline-none focus:border-accent";

export const buttonClass =
  "h-11 w-full rounded-md bg-accent px-4 text-[15px] font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50";

/** Outlined in the accent colour: the one action to take on a card. */
export const accentButtonClass =
  "h-9 rounded-md border border-accent px-3 text-sm text-accent transition-opacity hover:opacity-80";

export const ghostButtonClass =
  "h-9 rounded-md border border-line px-3 text-sm text-muted hover:text-text transition-colors";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  // a highlighted card passes border-accent; the default line colour must not override it
  const border = className.includes("border-accent") ? "" : "border-line";
  return <section className={`rounded-lg border ${border} bg-surface p-4 ${className}`}>{children}</section>;
}

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="mb-4 text-xl font-semibold tracking-tight">{children}</h1>;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-muted">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

/** Marks a section whose feature group has not been built yet. */
export function ComingNext({ title, text, step }: { title: string; text: string; step: number }) {
  return (
    <>
      <PageTitle>{title}</PageTitle>
      <Card>
        <p className="text-sm text-muted">
          {text} {step}.
        </p>
      </Card>
    </>
  );
}
