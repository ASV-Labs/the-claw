export function ClawMark({ className, title = "THE CLAW" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label={title} data-wdi-media-role="identity">
      <rect x="4" y="6" width="56" height="6" rx="1" fill="currentColor" />
      <rect x="30" y="10" width="4" height="16" fill="currentColor" />
      <path
        d="M18 26c0 0-2 6 4 14 4 5 6 14 6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M32 26c0 10 0 18 0 32"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M46 26c0 0 2 6-4 14-4 5-6 14-6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
