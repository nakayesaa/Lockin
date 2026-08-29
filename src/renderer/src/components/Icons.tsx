import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function IconBase({ children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      {...props}
    >
      {children}
    </svg>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <IconBase {...props} fill="currentColor" stroke="none">
      <path d="M8.4 5.7a1 1 0 0 1 1.53-.84l9.1 6.3a1 1 0 0 1 0 1.66l-9.1 6.31a1 1 0 0 1-1.53-.83V5.7Z" />
    </IconBase>
  );
}

export function PauseIcon(props: IconProps) {
  return (
    <IconBase {...props} fill="currentColor" stroke="none">
      <rect x="6.5" y="5" width="4" height="14" rx="1" />
      <rect x="13.5" y="5" width="4" height="14" rx="1" />
    </IconBase>
  );
}

export function SkipBackIcon(props: IconProps) {
  return (
    <IconBase {...props} fill="currentColor" stroke="none">
      <path d="M5.5 5.5h2v13h-2zM18.5 6.3a1 1 0 0 0-1.55-.83l-8 5.7a1 1 0 0 0 0 1.66l8 5.7a1 1 0 0 0 1.55-.83V6.3Z" />
    </IconBase>
  );
}

export function SkipForwardIcon(props: IconProps) {
  return (
    <IconBase {...props} fill="currentColor" stroke="none">
      <path d="M16.5 5.5h2v13h-2zM5.5 6.3a1 1 0 0 1 1.55-.83l8 5.7a1 1 0 0 1 0 1.66l-8 5.7a1 1 0 0 1-1.55-.83V6.3Z" />
    </IconBase>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 5v14M5 12h14" />
    </IconBase>
  );
}

export function MinusIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 12h14" />
    </IconBase>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m14.5 6.5-5.5 5.5 5.5 5.5" />
    </IconBase>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
      <circle cx="9" cy="10" r="1.5" />
      <path d="m5.5 17 4.2-4.1 2.8 2.5 2.3-2.2 3.7 3.8" />
    </IconBase>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m7 7 10 10M17 7 7 17" />
    </IconBase>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3.5 19 6v5.4c0 4.3-2.8 7.5-7 9.1-4.2-1.6-7-4.8-7-9.1V6l7-2.5Z" />
      <path d="m9.3 12 1.8 1.8 3.8-4" />
    </IconBase>
  );
}

export function MoreIcon(props: IconProps) {
  return (
    <IconBase {...props} fill="currentColor" stroke="none">
      <circle cx="6" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="18" cy="12" r="1.4" />
    </IconBase>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m5.5 12.5 4 4 9-9" />
    </IconBase>
  );
}

export function WifiIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M4.5 9.5a11.8 11.8 0 0 1 15 0M7.5 13a7.3 7.3 0 0 1 9 0M10.5 16.5a2.8 2.8 0 0 1 3 0" />
      <circle cx="12" cy="19" r=".8" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

export function BatteryIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3.5" y="7.5" width="15.5" height="9" rx="2" />
      <path d="M21 10.5v3" />
      <path d="M6.5 10.5h8.5v3H6.5z" fill="currentColor" stroke="none" />
    </IconBase>
  );
}
