import Script from "next/script";

/**
 * Google Tag Manager container ID, e.g. "GTM-XXXXXXX".
 * Set NEXT_PUBLIC_GTM_ID in the environment to enable GTM; when unset,
 * nothing is rendered (so dev/preview stay clean).
 */
export const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

/** Injects the GTM loader script. Render once in the app layout. */
export function GoogleTagManager() {
  if (!GTM_ID) return null;
  return (
    <Script
      id="gtm-loader"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`,
      }}
    />
  );
}

/** The <noscript> fallback iframe. Render as the first child of <body>. */
export function GoogleTagManagerNoScript() {
  if (!GTM_ID) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
        title="gtm"
      />
    </noscript>
  );
}
