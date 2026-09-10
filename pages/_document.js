import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="icon" href="/icons/icon-192.png" type="image/png" />
        <meta name="theme-color" content="#0A84FF" />
        {/* The apple- prefixed one is what iOS still reads; the unprefixed
            name is the standardised replacement, and Chrome warns when only
            the Apple spelling is present. Both are needed. */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Podcasts" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
