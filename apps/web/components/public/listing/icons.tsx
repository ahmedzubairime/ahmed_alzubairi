import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

/** Line icons in the site's stroke style. Decorative: the label carries the meaning. */
function Icon({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </Icon>
  );
}

/** Points back in English (left). `rtl:-scale-x-100` mirrors it in Arabic. */
export function ChevronBackIcon({ className = "", ...props }: IconProps) {
  return (
    <Icon className={`rtl:-scale-x-100 ${className}`} {...props}>
      <path d="M15 6l-6 6 6 6" />
    </Icon>
  );
}

/** Points forward in English (right). Mirrors in Arabic. */
export function ChevronForwardIcon({ className = "", ...props }: IconProps) {
  return (
    <Icon className={`rtl:-scale-x-100 ${className}`} {...props}>
      <path d="M9 6l6 6-6 6" />
    </Icon>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </Icon>
  );
}

export function PlaceIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.25" />
    </Icon>
  );
}

export function ScreenIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4.5" width="18" height="12" rx="1.75" />
      <path d="M8.5 20h7M12 16.5V20" />
    </Icon>
  );
}

export function FileIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </Icon>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Icon>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3.5 6.5l8.5 6.5 8.5-6.5" />
    </Icon>
  );
}

/** A speech bubble with a handset: WhatsApp, drawn in the site's line style. */
export function WhatsAppIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20l1.2-4.1A8.5 8.5 0 1 1 8.3 19Z" />
      <path d="M9 8.5c0 3.6 2.9 6.5 6.5 6.5l1-1.5-2-1-1 .8a4.2 4.2 0 0 1-2.3-2.3l.8-1-1-2Z" />
    </Icon>
  );
}

export function XIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 4h4l11 16h-4ZM19.5 4l-6.3 7.2M10.8 13l-6.3 7" />
    </Icon>
  );
}

export function LinkedInIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
      <path d="M8 10.5V16M8 7.75v.01M11.5 16v-5.5M11.5 13a2.5 2.5 0 0 1 5 0v3" />
    </Icon>
  );
}

export function FacebookIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14.5 21v-8h2.75l.5-3.25H14.5V7.9c0-.9.45-1.65 1.75-1.65h1.6V3.4A19 19 0 0 0 15.5 3.2c-2.6 0-4.25 1.6-4.25 4.4v2.15H8.5V13h2.75v8" />
    </Icon>
  );
}

export function PlayIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.75v6.5L15.25 12Z" />
    </Icon>
  );
}
