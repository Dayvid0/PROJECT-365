export function DaymarkMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 128 128"
      className={className}
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="128" height="128" rx="34" fill="#f6f4ed" />
      <circle
        cx="64"
        cy="64"
        r="34"
        fill="none"
        stroke="#183c35"
        strokeWidth="12"
        strokeDasharray="180 38"
        strokeLinecap="round"
        transform="rotate(-38 64 64)"
      />
      <circle cx="91" cy="36" r="12" fill="#d9f268" stroke="#183c35" strokeWidth="4" />
      <path d="M64 47v34" stroke="#183c35" strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}
