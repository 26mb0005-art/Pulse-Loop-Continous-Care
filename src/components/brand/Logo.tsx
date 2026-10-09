import { cn } from "@/lib/utils";

type LogoProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const logoSizes = {
  sm: { height: 28, width: 120 },
  md: { height: 36, width: 154 },
  lg: { height: 48, width: 206 },
};

export function Logo({ size = "md", className }: LogoProps) {
  const { height, width } = logoSizes[size];

  return (
    <img
      src="/PULSE_LOOP_Full_Logo_HD_Transparent.png"
      alt="PULSE LOOP"
      width={width}
      height={height}
      className={cn("object-contain", className)}
    />
  );
}

export function LoopMark({ size = 22 }: { size?: number }) {
  return (
    <img
      src="/PULSE_LOOP_App_Icon_HD_Transparent.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className="object-contain"
    />
  );
}
