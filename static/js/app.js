import { Circuit, ComponentRegistry } from "./circuit.js"
import { Renderer } from "./renderer.js"
import { Editor } from "./editor.js"

function populatePalette(palette, registry) {
	for (const [type, comp] of Object.entries(registry)) {
		palette.insertAdjacentHTML("beforeend", `
			<button class="component-button" data-type="${type}">
				<strong>${comp.name}</strong>
				<span>${comp.description}</span>
			</button>
		`);
	}
}

function buildTestCircuit() {
	const circ = new Circuit();

	circ.addWire({
		node: 0,
		x1: 4,
		y1: 4,
		x2: 8,
		y2: 4 
	});

	circ.addComponent("pmos", {
		terminals: {
			source: 0,
			gate: 0,
			drain: 0 
		},
		x: 9,
		y: 4
	})

	circ.addWire({
		node: 0,
		x1: 4,
		y1: 8,
		x2: 8,
		y2: 8 
	});

	circ.addComponent("nmos", {
		terminals: {
			source: 0,
			gate: 0,
			drain: 0 
		},
		x: 9,
		y: 8
	})

	circ.addWire({
		node: 0,
		x1: 10,
		y1: 1,
		x2: 10,
		y2: 3 
	});

	circ.addWire({
		node: 0,
		x1: 10,
		y1: 5,
		x2: 10,
		y2: 7 
	});

	circ.addWire({
		node: 0,
		x1: 10,
		y1: 9,
		x2: 10,
		y2: 11 
	});

	circ.addComponent("source", {
		terminals: { wire: 0 },
		x: 10,
		y: 1
	});
	
	circ.addComponent("ground", {
		terminals: { wire: 0 },
		x: 10,
		y: 11
	});

	return circ;
}

function setup() {
	const root = document.documentElement;

	const themeButton = document.querySelector("#theme-button");
	themeButton.addEventListener("click", () => {
		root.dataset.theme =
			root.dataset.theme === "light" ? "dark" : "light";
	});

	const circuitSVG = document.querySelector("#circuit-svg");	
	const renderer = new Renderer(circuitSVG);

	const circ = buildTestCircuit();
	const editorTool = document.querySelector("#editor-tool");
	const editorComponent = document.querySelector("#editor-component");
	const editor = new Editor(circ, renderer, {
		toolStat: editorTool,
		componentStat: editorComponent
	});

	const wireButton = document.querySelector("#wire-button");
	wireButton.addEventListener("click", () => {
		editor.setWireTool();
	});

	const componentPalette = document.querySelector("#component-palette");
	populatePalette(componentPalette, ComponentRegistry);
	componentPalette.addEventListener("click", event => {
		const button = event.target.closest(".component-button");
		if(!button) return;
		
		const component = ComponentRegistry[button.dataset.type];
		editor.setComponentTool(button.dataset.type, component.name);
	});
}

setup();
