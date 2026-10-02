import { createRoot } from "react-dom/client";
import "./dashboard-assets.generated.js";
import Home from "../app/page";

const root = document.getElementById("root");
if (!root) throw new Error("The dashboard root element is missing.");

createRoot(root).render(<Home />);
