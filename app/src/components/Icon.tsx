/** Minimal line icons (24px grid, currentColor). Decorative: always aria-hidden. */
const paths = {
  home: 'M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1z',
  profile: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7.5 8.5c.9-3.6 3.9-5.5 7.5-5.5s6.6 1.9 7.5 5.5',
  key: 'M14.5 9.5a4 4 0 1 1-2.2 3.56L4 21.4V18h2.5v-2.5H9l1.3-1.3M16 8.5h.01',
  lock: 'M6.5 10.5h11a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-8.5a1 1 0 0 1 1-1Zm2-.5V7.5a3.5 3.5 0 0 1 7 0V10',
  bell: 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2.2 2.2 0 0 0 4 0',
  star: 'm12 3.8 2.5 5.1 5.6.8-4 4 1 5.6-5.1-2.7-5 2.7 1-5.6-4.1-4 5.6-.8z',
  shield: 'M12 3.5 19 6v5.4c0 4.4-2.9 8-7 9.1-4.1-1.1-7-4.7-7-9.1V6z',
  block: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM5.6 5.6l12.8 12.8',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-2.6-11.6a2.7 2.7 0 1 1 3.9 2.4c-.8.4-1.3 1-1.3 1.9v.6M12 17h.01',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10.5v6M12 7.5h.01',
  doc: 'M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5Zm7 0V8h4M9 12.5h6M9 16h6',
  external: 'M14 4.5h5.5V10M19.5 4.5 11 13M17.5 14v5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h5',
  logout: 'M14.5 4.5H18a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-3.5M10 16.5 5.5 12 10 7.5M5.5 12H15',
  trash: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.9 12.6a1 1 0 0 0 1 .9h7.2a1 1 0 0 0 1-.9L17.5 7M10 11v6M14 11v6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6 6 18',
  wave: 'M3 12h2M7 8v8M11 5v14M15 8v8M19 10.5v3M21 12h0',
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
