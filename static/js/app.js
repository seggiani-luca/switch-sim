// for circuit definitions
import { Circuit, ComponentRegistry } from "./model/circuit.js";

// for netlist compilation and simulation
import { updateWires, compileNetlist } from "./simulation/netlist.js";

// for interface definitions
import { Renderer, ToolIcon } from "./interface/renderer.js";
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

// populates library palette
async function populateLibrary(palette, editor) {
	const files = await fetch("lib/index.json").then((r) => r.json());

	for (const file of files) {
		// get subcircuit
		const data = await fetch(`lib/${file}`).then((r) => r.json());
		const sub = new Circuit();
		sub.fromJSON(data);

		// populate
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

		ToolIcon.library(group);

		const text = document.createElement("div");
		text.innerHTML = `
			<strong>${sub.name}</strong>
			<span>${sub.description}</span>`;

		button.append(icon, text);
		button.addEventListener("click", () => editor.setLibraryTool(sub, sub.name));

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
async function setup() {
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
		openFile.addEventListener("change", async () => {
			// select file
			const file = openFile.files[0];
			if (!file) return;

			// deserialize
			circ.fromJSON(JSON.parse(await file.text()));

			// reset selector
			openFile.value = "";

			openFile.replaceWith(openFile.cloneNode(true));
		});

		// open viewer
		openFile.click();
	});

	const saveButton = document.querySelector("#save-button");
	saveButton.addEventListener("click", async () => {
		// serialize
		const data = await circ.toJSON();

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
	const editorHierarchy = document.querySelector("#editor-hierarchy");
	const editor = new Editor(circ, renderer, {
		toolStat: editorTool,
		componentStat: editorComponent,
		hierarchyStat: editorHierarchy 
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

	// library palette
	const libraryPalette = document.querySelector("#library-palette");
	await populateLibrary(libraryPalette, editor);

	// register circuit events
	circ.onChange(() => {
		// compile circuit
		const sim = compileNetlist(circ);

		// simulate
		sim.simulate();

		// display
		updateWires(sim, circ);
		renderer.render(editor.circuit);
	});
}

await setup();
