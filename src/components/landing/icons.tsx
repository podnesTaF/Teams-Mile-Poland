/* Landing-only inline SVGs (red pin, scroll arrow, play, check, faq plus). */

type SVGProps = React.SVGProps<SVGSVGElement>;

export function PinIcon(props: SVGProps) {
  return (
    <svg viewBox="0 0 22 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden {...props}>
      <path
        d="M10.9 0C4.9 0 0 4.9 0 10.9 0 18.3 9.7 29.2 10.1 29.7c.4.4 1.1.4 1.5 0C12 29.2 21.7 18.3 21.7 10.9 21.7 4.9 16.9 0 10.9 0Zm0 16.3a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11Z"
        fill="#E51F32"
      />
    </svg>
  );
}

export function ScrollArrowIcon(props: SVGProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <path d="M6 9l6 6 6-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronLeftIcon(props: SVGProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ChevronRightIcon(props: SVGProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlayIcon(props: SVGProps) {
  return (
    <svg viewBox="0 0 16 16" fill="#191A18" aria-hidden {...props}>
      <path d="M3 2l11 6-11 6z" />
    </svg>
  );
}

export function PauseIcon(props: SVGProps) {
  return (
    <svg viewBox="0 0 16 16" fill="#191A18" aria-hidden {...props}>
      <path d="M4 2h3v12H4V2Zm5 0h3v12H9V2Z" />
    </svg>
  );
}

export function CheckIcon(props: SVGProps) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden {...props}>
      <path d="M3 8.5l3.5 3.5L13 4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FaqPlusIcon(props: SVGProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function SoloIcon(props: SVGProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <circle cx="12" cy="8" r="4" stroke="#fff" strokeWidth="2" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function DuoIcon(props: SVGProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden {...props}>
      <circle cx="8" cy="9" r="3" stroke="#fff" strokeWidth="2" />
      <circle cx="16" cy="9" r="3" stroke="#fff" strokeWidth="2" />
      <path d="M2 20c0-3 2.7-5 6-5M22 20c0-3-2.7-5-6-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
