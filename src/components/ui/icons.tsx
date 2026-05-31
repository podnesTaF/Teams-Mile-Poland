/**
 * Modal & registration-specific icons.
 * Plain inline SVGs that take their colour from currentColor so the parent
 * className (e.g. `.modal-icon`, `.success-share-icon.wa`) drives styling.
 */

type SVGProps = React.SVGProps<SVGSVGElement>;

export function IconClose(props: SVGProps) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden {...props}>
      <path d="M3 3l14 14M17 3L3 17" />
    </svg>
  );
}

export function IconBack(props: SVGProps) {
  return (
    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <polyline points="9,1 3,7 9,13" />
    </svg>
  );
}

export function IconPerson(props: SVGProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <circle cx="12" cy="7" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}

export function IconTeam(props: SVGProps) {
  return (
    <svg viewBox="0 0 36 36" fill="currentColor" aria-hidden {...props}>
      <circle cx="18" cy="11" r="5" />
      <circle cx="6" cy="13" r="4" />
      <circle cx="30" cy="13" r="4" />
      <path d="M6 32c0-5 5.4-9 12-9s12 4 12 9" />
      <path d="M0 32c0-3.8 2.7-7 6-7" opacity="0.85" />
      <path d="M36 32c0-3.8-2.7-7-6-7" opacity="0.85" />
    </svg>
  );
}

export function IconWhatsApp(props: SVGProps) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden {...props}>
      <path d="M16 .5C7.4.5.5 7.4.5 16c0 2.8.7 5.4 2.1 7.7L.5 31.5l8-2.1c2.2 1.2 4.8 1.9 7.5 1.9 8.6 0 15.5-6.9 15.5-15.5S24.6.5 16 .5zm0 28.3c-2.4 0-4.7-.6-6.7-1.8l-.5-.3-4.7 1.2 1.3-4.6-.3-.5C3.8 20.8 3 18.4 3 16c0-7.2 5.8-13 13-13s13 5.8 13 13-5.8 13-13 13zm7.3-9.6c-.4-.2-2.4-1.2-2.7-1.3-.4-.1-.6-.2-.9.2-.3.4-1 1.3-1.3 1.6-.2.3-.5.3-.9.1-.4-.2-1.7-.6-3.2-2-1.2-1-2-2.4-2.2-2.8-.2-.4 0-.6.2-.8.2-.2.4-.5.5-.7.2-.2.2-.4.4-.6.1-.2 0-.5 0-.7-.1-.2-.9-2.1-1.2-2.9-.3-.7-.6-.7-.9-.7h-.7c-.2 0-.6.1-.9.5s-1.2 1.2-1.2 2.9 1.2 3.4 1.4 3.6c.2.2 2.5 3.8 6 5.3.8.4 1.5.6 2 .8.8.3 1.6.2 2.2.1.7-.1 2.1-.9 2.4-1.7.3-.8.3-1.5.2-1.7-.1-.1-.4-.2-.8-.4z" />
    </svg>
  );
}

export function IconTelegram(props: SVGProps) {
  return (
    <svg viewBox="0 0 32 32" fill="currentColor" aria-hidden {...props}>
      <path d="M16 0C7.2 0 0 7.2 0 16s7.2 16 16 16 16-7.2 16-16S24.8 0 16 0zm7.7 10.9l-2.6 12.3c-.2.9-.7 1.1-1.4.7l-3.9-2.9-1.9 1.8c-.2.2-.4.4-.8.4l.3-4 7.2-6.5c.3-.3-.1-.4-.5-.2L11.5 18l-3.8-1.2c-.8-.3-.9-.8.2-1.2L22.4 9.9c.7-.2 1.3.2 1.3 1z" />
    </svg>
  );
}
