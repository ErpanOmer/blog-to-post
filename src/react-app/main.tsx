import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { Toaster } from "sonner";
import "./index.css";
import App from "@/react-app/App";

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<HashRouter>
			<App />
			<Toaster position="top-right" richColors closeButton />
		</HashRouter>
	</StrictMode>,
);
