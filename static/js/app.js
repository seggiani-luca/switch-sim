import { Circuit, ComponentRegistry } from "./circuit.js"
import { Renderer } from "./renderer.js"
import { Editor } from "./editor.js"

function insertTool(palette, name, cback) {
	const button = document.createElement("button");

	button.className = "component-button";
	button.innerHTML = `<strong>${name}</strong>`;

	button.addEventListener("click", cback);

	palette.appendChild(button);
}

function populateToolPalette(palette, editor) {
	insertTool(palette, "Wire", () => editor.setWireTool());
	insertTool(palette, "Move", null);
	insertTool(palette, "Delete", null);
}

function populatePalette(palette, registry, editor) {
	for(const [type, comp] of Object.entries(registry)) {
		const button = document.createElement("button");
		button.className = "component-button";

		button.innerHTML = `
			<strong>${comp.name}</strong>
			<span>${comp.description}</span>`;

		button.addEventListener("click", () => {
			editor.setComponentTool(type, comp.name);
		});

		palette.appendChild(button);
	}
}

function setup() {
	const circ = new Circuit(); 

	const root = document.documentElement;

	// upper menu
	const themeButton = document.querySelector("#theme-button");
	themeButton.addEventListener("click", () => {
		root.dataset.theme =
			root.dataset.theme === "light" ? "dark" : "light";
	});

	const logButton = document.querySelector("#log-button");
	logButton.addEventListener("click", () => {
		console.log(circ);
	});

	// SVG circuit renderer
	const circuitSVG = document.querySelector("#circuit-svg");	
	const renderer = new Renderer(circuitSVG);

	// editor stats
	const editorTool = document.querySelector("#editor-tool");
	const editorComponent = document.querySelector("#editor-component");
	const editor = new Editor(circ, renderer, {
		toolStat: editorTool,
		componentStat: editorComponent
	});

	// tool palette
	const toolPalette = document.querySelector("#tool-palette");
	populateToolPalette(toolPalette, editor);

	// component palette
	const componentPalette = document.querySelector("#component-palette");
	populatePalette(componentPalette, ComponentRegistry, editor);

}

setup();
