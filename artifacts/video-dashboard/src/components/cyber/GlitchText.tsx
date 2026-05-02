interface GlitchTextProps {
  text: string;
  className?: string;
  tag?: "h1" | "h2" | "h3" | "span" | "p";
}

export function GlitchText({ text, className = "", tag: Tag = "span" }: GlitchTextProps) {
  return (
    <Tag
      className={`glitch-text ${className}`}
      data-text={text}
    >
      {text}
    </Tag>
  );
}
