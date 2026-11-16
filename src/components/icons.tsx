const base = {
  viewBox: "0 0 24 24",
  width: 18,
  height: 18,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "square",
  "aria-hidden": true,
} as const;

export const BookmarkIcon = ({ filled }: { filled: boolean }) => (
  <svg {...base} fill={filled ? "currentColor" : "none"}>
    <path d="M6 3h12v18l-6-4.5L6 21z" />
  </svg>
);

export const MapIcon = () => (
  <svg {...base}>
    <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15" />
  </svg>
);

export const CloseIcon = () => (
  <svg {...base}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const ChatIcon = () => (
  <svg {...base}>
    <path d="M4 4h16v12H9l-5 4z" />
  </svg>
);

export const SendIcon = () => (
  <svg {...base}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const ShareIcon = () => (
  <svg {...base}>
    <path d="M12 15V3M7 8l5-5 5 5M5 12v9h14v-9" />
  </svg>
);

export const CheckIcon = () => (
  <svg {...base}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const GridIcon = () => (
  <svg {...base}>
    <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
  </svg>
);
