import { useEffect, useRef, useState } from "react";

interface ConsoleLine {
  id: number;
  text: string;
  type: "info" | "success" | "error" | "warn" | "system";
  timestamp: string;
}

interface CommandConsoleProps {
  lines: ConsoleLine[];
  className?: string;
  maxHeight?: string;
}

const typeColors: Record<ConsoleLine["type"], string> = {
  info:    "text-[hsl(172_100%_47%)]",
  success: "text-green-400",
  error:   "text-[hsl(347_100%_50%)]",
  warn:    "text-[hsl(52_100%_50%)]",
  system:  "text-muted-foreground",
};

const typePrefixes: Record<ConsoleLine["type"], string> = {
  info:    "[INFO]",
  success: "[OK]  ",
  error:   "[ERR] ",
  warn:    "[WARN]",
  system:  "[SYS] ",
};

export function CommandConsole({ lines, className = "", maxHeight = "200px" }: CommandConsoleProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState<number[]>([]);

  useEffect(() => {
    const last = lines[lines.length - 1];
    if (last && !visible.includes(last.id)) {
      setTimeout(() => {
        setVisible((prev) => [...prev, last.id]);
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    }
  }, [lines]);

  return (
    <div
      className={`bg-[hsl(240_40%_3%)] border border-[hsl(240_30%_14%)] font-mono-cyber text-xs overflow-y-auto ${className}`}
      style={{ maxHeight }}
    >
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[hsl(240_30%_14%)] bg-[hsl(240_40%_5%)]">
        <div className="w-2 h-2 rounded-full bg-[hsl(347_100%_50%)] animate-pulse" />
        <div className="w-2 h-2 rounded-full bg-[hsl(52_100%_50%)]" />
        <div className="w-2 h-2 rounded-full bg-[hsl(172_100%_47%)]" />
        <span className="text-muted-foreground ml-2 tracking-widest text-[10px]">ARI_CONVERT // CONSOLE OUTPUT</span>
      </div>

      <div className="p-3 space-y-0.5">
        {lines.map((line) => (
          <div
            key={line.id}
            className={`flex gap-2 transition-opacity duration-300 ${
              visible.includes(line.id) ? "opacity-100" : "opacity-0"
            }`}
          >
            <span className="text-muted-foreground shrink-0 select-none">{line.timestamp}</span>
            <span className={`shrink-0 ${typeColors[line.type]}`}>{typePrefixes[line.type]}</span>
            <span className="text-foreground/90 break-all">{line.text}</span>
          </div>
        ))}
        {lines.length === 0 && (
          <div className="text-muted-foreground text-center py-4">
            — AWAITING INPUT —
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

export type { ConsoleLine };
