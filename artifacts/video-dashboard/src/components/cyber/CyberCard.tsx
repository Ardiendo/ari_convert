import { type ReactNode } from "react";

interface CyberCardProps {
  children: ReactNode;
  className?: string;
  glow?: "red" | "cyan" | "yellow" | "none";
  label?: string;
}

const glowMap = {
  red:    "border-[hsl(347_100%_50%/0.5)] shadow-[0_0_12px_hsl(347_100%_50%/0.2),inset_0_0_12px_hsl(347_100%_50%/0.04)]",
  cyan:   "border-[hsl(172_100%_47%/0.5)] shadow-[0_0_12px_hsl(172_100%_47%/0.2),inset_0_0_12px_hsl(172_100%_47%/0.04)]",
  yellow: "border-[hsl(52_100%_50%/0.5)]  shadow-[0_0_12px_hsl(52_100%_50%/0.2),inset_0_0_12px_hsl(52_100%_50%/0.04)]",
  none:   "border-[hsl(240_30%_14%)]",
};

export function CyberCard({ children, className = "", glow = "none", label }: CyberCardProps) {
  return (
    <div className={`relative bg-card border ${glowMap[glow]} cyber-clip p-4 ${className}`}>
      {label && (
        <div className="absolute -top-px left-6 px-2 bg-card">
          <span className="text-[10px] font-mono-cyber tracking-widest text-muted-foreground uppercase">{label}</span>
        </div>
      )}

      {/* Corner decorations */}
      <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-primary" />
      <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-primary" />
      <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-primary" />
      <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-primary" />

      {children}
    </div>
  );
}
