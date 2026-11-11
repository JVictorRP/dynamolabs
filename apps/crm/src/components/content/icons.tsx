/** Ícones da prévia (traço simples, decorativos: sempre `aria-hidden`). */
type P = { className?: string };
const base = { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export const HeartIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.7 7.9 3.6 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.4 0 5.3 3.4 4.2 6.6-1.7 4.8-9.2 9.4-9.2 9.4z" /></svg>
);
export const CommentIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M21 12a8.5 8.5 0 0 1-12.3 7.6L3 21l1.5-5.3A8.5 8.5 0 1 1 21 12z" /></svg>
);
export const SendIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M22 3 9.5 14.5M22 3l-7 18-5.5-6.5L3 9l19-6z" /></svg>
);
export const BookmarkIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M6 3.5h12v17l-6-4.5-6 4.5v-17z" /></svg>
);
export const CarouselIcon = ({ className }: P) => (
  <svg {...base} className={className}><rect x="8" y="8" width="12" height="12" rx="2" fill="currentColor" stroke="none" /><path d="M5 16V6a2 2 0 0 1 2-2h10" /></svg>
);
export const ReelsIcon = ({ className }: P) => (
  <svg {...base} className={className}><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M3.5 9h17M9 3.5 12 9M15 3.5 18 9" /><path d="m10.5 12.5 4 2.3-4 2.3v-4.6z" fill="currentColor" stroke="none" /></svg>
);
export const PlayIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M7 4.5v15l12.5-7.5L7 4.5z" fill="currentColor" stroke="none" /></svg>
);
export const PauseIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M7 4.5h3.5v15H7zM13.5 4.5H17v15h-3.5z" fill="currentColor" stroke="none" /></svg>
);
export const VolumeIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5z" fill="currentColor" stroke="none" /><path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" /></svg>
);
export const MuteIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5z" fill="currentColor" stroke="none" /><path d="m16 9.5 5 5M21 9.5l-5 5" /></svg>
);
export const ChevronLeftIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="m15 5-7 7 7 7" /></svg>
);
export const ChevronRightIcon = ({ className }: P) => (
  <svg {...base} className={className}><path d="m9 5 7 7-7 7" /></svg>
);
