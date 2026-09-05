import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/global.css";
import { App } from "./App";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Élément #root introuvable dans index.html");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
