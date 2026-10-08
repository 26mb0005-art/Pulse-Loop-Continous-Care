import { cn } from "@/lib/utils";

/**
 * PULSE LOOP wordmark. Temporary text-based mark: to use the supplied logo, replace the
 * contents of this component with an <img> (keep the `size` → height mapping) and every
 * header, auth screen and landing page picks it up without layout changes.
 */
export function Logo({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims = { sm: "h-6 text-[15px]", md: "h-7 text-[17px]", lg: "h-9 text-2xl" }[size];
  const mark = { sm: 18, md: 22, lg: 28 }[size];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-semibold tracking-[0.08em] text-foreground",
        dims,
        className,
      )}
    >
      <LoopMark size={mark} />
      <span>
        PULSE<span className="text-primary"> LOOP</span>
      </span>
    </span>
  );
}

/** Simple loop mark: an open orange ring closed by a green pulse. Placeholder for the brand asset. */
export function LoopMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M19.5 8.5A8.5 8.5 0 1 0 20.5 12"
        stroke="var(--highlight)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d="M6.5 12.5h3l1.5-3.5 2.2 6 1.6-2.5h2.7"
        stroke="var(--primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
