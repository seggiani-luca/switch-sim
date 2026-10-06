// for circuit definitions
import { Circuit, ComponentRegistry } from "./model/circuit.js";

// for netlist compilation and simulation
import { updateWires, compileNetlist } from "./simulation/netlist.js";

// for interface definitions
import { Renderer } from "./interface/renderer.js";
import { Editor, ToolRegistry } from "./interface/editor.js";

// populates component buttons from the registry to the components palette
function populatePalette(palette, registry, editor) {
	for (const item of Object.values(registry)) {
		const button = document.createElement("button");
		button.className = "component-button";

		const icon = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"svg",
		);

		icon.setAttribute("viewBox", "-2 -2 4 4");
		icon.setAttribute("width", "32");
		icon.setAttribute("height", "32");

		const group = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"g",
		);

		icon.appendChild(group);
		item.draw(group);

		const text = document.createElement("div");
		text.innerHTML = `
			<strong>${item.name}</strong>
			<span>${item.description}</span>`;

		button.append(icon, text);

		button.addEventListener("click", () => item.set(editor));

		palette.appendChild(button);
	}
}

// sets up palette key bindings
function setupKeybindings(palette, editor) {
	const bindings = new Map();

	for (const item of Object.values(palette))
		bindings.set(item.key, () => item.set(editor));

	document.addEventListener("keydown", (event) => {
		if (event.ctrlKey || event.altKey || event.metaKey) return;

		const key = event.key.toLowerCase();
		const activate = bindings.get(key);

		if (!activate) return;

		event.preventDefault();
		activate();
	});
}

// main application entry point: initializes circuit, theme, renderer, editor
function setup() {
	// circuit
	const circ = new Circuit();

	// document root
	const root = document.documentElement;

	// upper menu
	const themeButton = document.querySelector("#theme-button");
	themeButton.addEventListener("click", () => {
		root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
	});

	// SVG circuit renderer
	const circuitSVG = document.querySelector("#circuit-svg");
	const renderer = new Renderer(circuitSVG);

	// editor stats
	const editorTool = document.querySelector("#editor-tool");
	const editorComponent = document.querySelector("#editor-component");
	const editor = new Editor(circ, renderer, {
		toolStat: editorTool,
		componentStat: editorComponent,
	});

	// tool palette
	const toolPalette = document.querySelector("#tool-palette");
	populatePalette(toolPalette, ToolRegistry, editor);
	setupKeybindings(ToolRegistry, editor);

	// component palette
	const componentPalette = document.querySelector("#component-palette");
	populatePalette(componentPalette, ComponentRegistry, editor);
	setupKeybindings(ComponentRegistry, editor);

	// register circuit events
	circ.onChange(() => {
		// compile circuit
		const sim = compileNetlist(circ);

		// simulate
		sim.simulate();

		// display
		updateWires(sim, circ);
		renderer.render(circ);
	});
}

setup();
