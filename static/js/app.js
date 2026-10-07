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
		if (event.target.closest("dialog")) return;

		const key = event.key;
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

	// upper menu
	const newButton = document.querySelector("#new-button");
	newButton.addEventListener("click", () => {
		// reload page
		location.reload();
	});

	const openButton = document.querySelector("#open-button");
	const openFile = document.querySelector("#open-file");
	openButton.addEventListener("click", () => {
		// reload page
		openFile.click();
	});

	openFile.addEventListener("change", async () => {
		// select file
		const file = openFile.files[0];
		if (!file) return;

		// deserialize
		circ.fromJSON(JSON.parse(await file.text()));

		// reset selector
		openFile.value = "";
	});

	const saveButton = document.querySelector("#save-button");
	saveButton.addEventListener("click", async () => {
		// serialize
		const data = circ.toJSON();

		// create link
		const blob = new Blob([JSON.stringify(data, null, 2)], {
			type: "application/json",
		});

		const url = URL.createObjectURL(blob);

		const link = document.createElement("a");
		link.href = url;
		link.download = "circuit.json";
		link.click();

		// revoke link
		URL.revokeObjectURL(url);
	});

	const themeButton = document.querySelector("#theme-button");
	themeButton.addEventListener("click", () => {
		const root = document.documentElement;
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

	// port dialog
	const portDialog = document.querySelector("#port-dialog");
	portDialog.addEventListener("close", () => editor.askPort(portDialog));

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
