import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles/variables.css";
import "./styles/global.css";
import "./styles/motion.css";
import "./styles/glass.css";
import { initSpotlight } from "./lib/spotlight";
import App from "./App";

initSpotlight();

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);