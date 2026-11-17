/** A 1–N rating as a row of buttons. Plain radio inputs, so it works inside a server-action form without JavaScript. */
export function ScaleInput({
  name,
  label,
  max = 5,
  value,
  low,
  high,
}: {
  name: string;
  label: string;
  max?: number;
  value: number | null;
  low?: string;
  high?: string;
}) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm text-muted">{label}</legend>
      <div className={`grid gap-1.5 ${max > 5 ? "grid-cols-10" : "grid-cols-5"}`} dir="ltr">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <label
            key={n}
            className="num flex h-10 cursor-pointer items-center justify-center rounded-md border border-line text-sm text-muted transition-colors has-checked:border-accent has-checked:bg-accent has-checked:text-accent-ink has-focus-visible:outline-2 has-focus-visible:outline-accent"
          >
            <input type="radio" name={name} value={n} defaultChecked={value === n} className="sr-only" />
            {n}
          </label>
        ))}
      </div>
      {(low || high) && (
        <div className="mt-1 flex justify-between text-[11px] text-muted" dir="ltr">
          {/* 1 is always on the left, so the words follow the numbers, not the page direction */}
          <span>{low}</span>
          <span>{high}</span>
        </div>
      )}
    </fieldset>
  );
}
