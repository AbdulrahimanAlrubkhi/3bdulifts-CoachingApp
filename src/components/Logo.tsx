export function CapMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4 15.5a8 8 0 0 1 16 0" />
      <path d="M4 15.5h10.5c2.8 0 5.2.8 7.5 2.5" />
      <path d="M12 7.5V6" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2 text-text" dir="ltr">
      <CapMark />
      <span className="text-[15px] font-semibold tracking-tight">3bdu.lifts</span>
    </span>
  );
}
