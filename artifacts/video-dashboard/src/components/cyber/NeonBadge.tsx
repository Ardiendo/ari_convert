import { type ReactNode } from "react";

type NeonColor = "red" | "cyan" | "yellow" | "purple" | "gray";

interface NeonBadgeProps {
  children: ReactNode;
  color?: NeonColor;
  pulse?: boolean;
  className?: string;
}

const colorMap: Record<NeonColor, { border: string; text: string; bg: string; dot: string }> = {
  red:    { border: "border-[hsl(347_100%_50%/0.5)]", text: "text-[hsl(347_100%_60%)]", bg: "bg-[hsl(347_100%_50%/0.08)]", dot: "bg-[hsl(347_100%_50%)]" },
  cyan:   { border: "border-[hsl(172_100%_47%/0.5)]", text: "text-[hsl(172_100%_60%)]", bg: "bg-[hsl(172_100%_47%/0.08)]", dot: "bg-[hsl(172_100%_47%)]" },
  yellow: { border: "border-[hsl(52_100%_50%/0.5)]",  text: "text-[hsl(52_100%_60%)]",  bg: "bg-[hsl(52_100%_50%/0.08)]",  dot: "bg-[hsl(52_100%_50%)]" },
  purple: { border: "border-[hsl(270_100%_65%/0.5)]", text: "text-[hsl(270_100%_75%)]", bg: "bg-[hsl(270_100%_65%/0.08)]", dot: "bg-[hsl(270_100%_65%)]" },
  gray:   { border: "border-[hsl(240_30%_20%)]",      text: "text-muted-foreground",     bg: "bg-[hsl(240_30%_10%)]",      dot: "bg-muted-foreground" },
};

export function NeonBadge({ children, color = "gray", pulse = false, className = "" }: NeonBadgeProps) {
  const c = colorMap[color];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 border text-xs font-mono-cyber tracking-widest uppercase ${c.border} ${c.text} ${c.bg} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${pulse ? "animate-pulse" : ""}`} />
      {children}
    </span>
  );
}
