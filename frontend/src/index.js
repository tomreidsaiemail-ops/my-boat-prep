import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Keep the page on the same host as the API so sign-in cookies and requests stay same-origin.
const appHost = new URL(process.env.REACT_APP_BACKEND_URL).host;
const onOtherHost = window.location.protocol === "https:" && window.location.host !== appHost;

if (onOtherHost) {
  const { pathname, search, hash } = window.location;
  window.location.replace(`https://${appHost}${pathname}${search}${hash}`);
} else {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }
}
