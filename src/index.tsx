import { render } from "ink";
import App from "./components/App";

(async () => {
	const app = render(<App />);

	await app.waitUntilExit();
})();
