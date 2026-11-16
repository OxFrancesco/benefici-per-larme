import { ClerkProvider } from "@clerk/tanstack-react-start";
import * as React from "react";
import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router";
import "@fontsource/chakra-petch/400.css";
import "@fontsource/chakra-petch/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#000000" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black" },
      { name: "apple-mobile-web-app-title", content: "Benefici per l'Arme" },
      { title: "Benefici per l'Arme" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  component: Root,
});

function Root() {
  // The service worker makes the installed app open fast. It only caches static files.
  React.useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
  }, []);
  return (
    <html lang="it">
      <head>
        <HeadContent />
      </head>
      <body>
        <ClerkProvider
          appearance={{
            variables: {
              colorPrimary: "oklch(61.52% 0.1657 26.98)",
              colorBackground: "#000000",
              colorForeground: "#ffffff",
              colorMutedForeground: "#bdbdbd",
              colorInput: "#000000",
              colorInputForeground: "#ffffff",
              colorNeutral: "#ffffff",
              borderRadius: "0",
              fontFamily: '"Chakra Petch", sans-serif',
            },
          }}
        >
          <Outlet />
          <Scripts />
        </ClerkProvider>
      </body>
    </html>
  );
}