import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import App from "./App.tsx";
import { BaseProvider } from "./provider.tsx";
import "@/styles/globals.css";
import { client } from "./lib/appwrite.ts";

// Ping the Appwrite backend server to verify connection on application startup
try {
  const pingPromise = (client as any).ping?.();
  if (pingPromise && typeof pingPromise.catch === 'function') {
    pingPromise.catch((e: any) => console.warn("Appwrite setup ping execution skipped:", e));
  }
} catch (e) {
  console.warn("Appwrite setup ping execution skipped:", e);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <BaseProvider>
        <App />
      </BaseProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
