"use client";

export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="h-10 rounded-md bg-accent px-4 text-sm font-medium text-accent-ink print:hidden"
    >
      {label}
    </button>
  );
}
