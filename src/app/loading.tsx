import { CapMark } from "@/components/Logo";

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center text-muted">
      <CapMark className="h-7 w-7 animate-pulse" />
    </div>
  );
}
