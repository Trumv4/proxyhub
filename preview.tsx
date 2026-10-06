import React from "react";
import {createRoot} from "react-dom/client";
import ProxySite from "./components/proxy-site";
import "./app/globals.css";
import "./app/proxy.css";
import "./app/effects.css";
import "./app/shop.css";
try{if(localStorage.getItem("proxyhub-theme")==="dark"){document.documentElement.dataset.theme="dark";document.documentElement.classList.add("dark");}}catch{/* Browser preferences are optional. */}
createRoot(document.getElementById("root")!).render(<React.StrictMode><ProxySite/></React.StrictMode>);
