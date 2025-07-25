import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { BrowserRouter } from "react-router-dom";
import { Common } from "./contexts/CommonContext.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "bootstrap/dist/css/bootstrap.min.css";

createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <BrowserRouter>
      <Common>
        <App />
      </Common>
    </BrowserRouter>
  </ErrorBoundary>
);
