function roundPosition(pos) {
	return {
		x: Math.round(pos.x),
		y: Math.round(pos.y)
	};
}

export class Editor {
	constructor(circuit, renderer, { toolStat, componentStat }) {
		this.circuit = circuit;
		this.renderer = renderer;
		this.toolStat = toolStat;
		this.componentStat = componentStat;

		this.setWireTool();

		this.renderer.svg.addEventListener("mousedown",
			event => this.tool.onMouseDown?.(this, event));

		this.renderer.svg.addEventListener("mousemove",
			event => this.tool.onMouseMove?.(this, event));

		this.renderer.svg.addEventListener("mouseup",
			event => this.tool.onMouseUp?.(this, event));

		document.addEventListener("keydown", event => {
			if (event.key === "Escape")
				this.tool.cancel?.(this);
		});

		document.addEventListener("mousedown", event => {
			if (!this.renderer.svg.contains(event.target))
				this.tool.cancel?.(this);
		});

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
			dragging: null,

			onMouseDown(editor, event) {
				const pos = roundPosition(editor.getPosition(event));

				if(editor.tool.dragging === null) {
					editor.tool.dragging = editor.circuit.beginWire(
						pos.x, pos.y, pos.x, pos.y
					);
				} else {
					editor.circuit.connectWire(
						editor.tool.dragging, pos.x, pos.y
					);
					editor.tool.dragging = null;
				}

				editor.renderer.render(editor.circuit);
			},
			onMouseMove(editor, event) {
				if(editor.tool.dragging === null) return;

				const pos = roundPosition(editor.getPosition(event));

				editor.tool.dragging.x2 = pos.x;
				editor.tool.dragging.y2 = pos.y;
				
				editor.renderer.render(editor.circuit);
			},
			cancel(editor) {
				if (this.dragging === null) return;

				editor.circuit.removeWire(this.dragging);
				this.dragging = null;

				editor.renderer.render(editor.circuit);
			}
		});
	}

	setComponentTool(type, name) {
		this.setTool({
			type: "component",
			componentType: type,
			
			onMouseDown(editor, event) {
				const pos = roundPosition(editor.getPosition(event));

				editor.circuit.addComponent(
					editor.tool.componentType, pos.x, pos.y
				);
				
				editor.renderer.render(editor.circuit);
			}
		});
		this.componentStat.textContent = name;
	}

	getPosition(event) {
		const point = this.renderer.svg.createSVGPoint();

		point.x = event.clientX;
		point.y = event.clientY;

		const pos = point.matrixTransform(
			this.renderer.svg.getScreenCTM().inverse()
		);

		return { x: pos.x, y: pos.y };
	}
}
