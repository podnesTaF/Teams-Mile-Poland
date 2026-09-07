/**
 * Wstrzykuje zaufany, wygenerowany OFFLINE fragment HTML (patrz
 * content/legal-texts/README.md) — nigdy treści pochodzącej od
 * użytkownika. To jedyne miejsce w aplikacji, które używa
 * dangerouslySetInnerHTML.
 */
export function LegalContent({
  html,
  variant = "dark",
  className = "",
}: {
  html: string;
  variant?: "dark" | "print";
  className?: string;
}) {
  return (
    <div
      className={`legal-prose ${variant === "print" ? "legal-prose--print" : ""} ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
