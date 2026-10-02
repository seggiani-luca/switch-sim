export class Editor {
	constructor(circuit, renderer, { toolStat, componentStat }) {
		this.circuit = circuit;
		this.renderer = renderer;
		this.toolStat = toolStat;
		this.componentStat = componentStat;

		this.setWireTool();

		this.renderer.svg.addEventListener(
			"mousedown",
			event => { this.onMouseDown(event); renderer.render(circuit) }
		);

		this.renderer.svg.addEventListener(
			"mousemove",
			event => { this.onMouseMove(event); renderer.render(circuit) }
		);

		this.renderer.svg.addEventListener(
			"mouseup",
			event => { this.onMouseUp(event); renderer.render(circuit) }
		);

		renderer.render(circuit);
	}

	setTool(tool) {
		this.tool = tool;
		this.toolStat.textContent = tool.type;
		this.componentStat.textContent = "";
	}

	setWireTool() {
		this.setTool({
			type: "wire",
		});
	}

	setComponentTool(type, name) {
		this.setTool({
			type: "component",
			componentType: type
		});
		this.componentStat.textContent = name;
	}

	onMouseDown(event) {
	}

	onMouseMove(event) {
	}

	onMouseUp(event) {
	}

	getPosition(event) {
		const rect = this.renderer.svg.getBoundingClientRect();

		return {
			x: event.clientX - rect.left,
			y: event.clientY - rect.top
		};
	}
}
