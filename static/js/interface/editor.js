// for tool icons
import { ToolIcon } from "./renderer.js";

// snaps coordinates to integer grid points
function roundPosition(pos) {
	return {
		x: Math.round(pos.x),
		y: Math.round(pos.y),
	};
}

// moves a circuit object (wire or component)
function moveObject(object, x, y) {
	if (object.type == "wire") {
		const wire = object.object;

		const dx = wire.x2 - wire.x1;
		const dy = wire.y2 - wire.y1;

		wire.x1 = x;
		wire.y1 = y;
		wire.x2 = x + dx;
		wire.y2 = y + dy;
	} else {
		const component = object.object;

		component.x = x;
		component.y = y;
	}
}

// definitions for available tools
export const ToolRegistry = {
	wire: {
		name: "Wire",
		description: "Wire components together",
		draw: (group) => ToolIcon.wire(group),
		set: (editor) => editor.setWireTool(),
		key: "w",
	},
	move: {
		name: "Move",
		description: "Move wires and components",
		draw: (group) => ToolIcon.move(group),
		set: (editor) => editor.setMoveTool(),
		key: "m",
	},
	delete: {
		name: "Delete",
		description: "Delete wires and components",
		draw: (group) => ToolIcon.delete(group),
		set: (editor) => editor.setDeleteTool(),
		key: "d",
	},
};

// manages interactive canvas editing, tool switching, and input events
export class Editor {
	// binds circuit and renderer, registers tool listeners
	constructor(circuit, renderer, { toolStat, componentStat }) {
		this.circuit = circuit;
		this.renderer = renderer;
		this.toolStat = toolStat;
		this.componentStat = componentStat;

		// default tool is wire
		this.setWireTool();

		// register mouse down event
		this.renderer.svg.addEventListener("mousedown", (event) => {
			event.stopPropagation();
			this.tool.onMouseDown?.(this, event);
		});

		// register mouse move event
		this.renderer.svg.addEventListener("mousemove", (event) =>
			this.tool.onMouseMove?.(this, event),
		);

		// register mouse up event
		this.renderer.svg.addEventListener("mouseup", (event) =>
			this.tool.onMouseUp?.(this, event),
		);

		// register cancel event  (esc + mouse wodn w/o focus)
		document.addEventListener("keydown", (event) => {
			if (event.key === "Escape") this.tool.cancel?.(this);
		});
		document.addEventListener("mousedown", (event) => {
			if (!this.renderer.svg.contains(event.target))
				this.tool.cancel?.(this);
		});

		this.renderer.render(circuit);
	}

	// switches active editor tool mode and updates UI toolbar stats
	setTool(tool) {
		this.tool = tool;
		this.toolStat.textContent = tool.type;
		this.componentStat.textContent = "";
	}

	// activates wire drawing tool
	setWireTool() {
		this.setTool({
			type: "wire",
			dragging: null,

			onMouseDown(editor, event) {
				const pos = roundPosition(editor.getPosition(event));

				const wire = editor.circuit.hasLength(pos.x, pos.y);
				if (wire) editor.circuit.splitWire(wire, pos.x, pos.y);

				// first click: select start point
				if (editor.tool.dragging === null) {
					editor.tool.dragging = editor.circuit.beginWire(
						pos.x,
						pos.y,
						pos.x,
						pos.y,
					);

					editor.circuit.changed();

					return;
				}

				// second click: connect wire to end point
				editor.circuit.connectWire(editor.tool.dragging, pos.x, pos.y);
				editor.tool.dragging = null;
				editor.circuit.changed();
			},
			onMouseMove(editor, event) {
				if (editor.tool.dragging === null) return;

				const pos = roundPosition(editor.getPosition(event));
				editor.tool.dragging.x2 = pos.x;
				editor.tool.dragging.y2 = pos.y;

				editor.renderer.render(editor.circuit);
			},
			cancel(editor) {
				if (editor.tool.dragging === null) return;

				editor.circuit.removeWire(this.dragging);
				editor.tool.dragging = null;
			},
		});

		this.renderer.changeCursors({
			canvas: "crosshair",
			object: "crosshair",
		});
	}

	setMoveTool() {
		this.setTool({
			type: "move",
			dragging: null,

			onMouseDown(editor, event) {
				const pos = roundPosition(editor.getPosition(event));

				// first click: select object
				if (editor.tool.dragging === null) {
					const object = editor.queryRenderer(event);
					if (!object) return;

					const target = object.object;
					const x = object.type === "wire" ? target.x1 : target.x;
					const y = object.type === "wire" ? target.y1 : target.y;

					editor.tool.dragging = {
						type: object.type,
						object: object.object,
						startX: x,
						startY: y,
					};

					editor.renderer.changeCursors({
						canvas: "grabbing",
						object: "grabbing",
					});

					return;
				}

				// second click: place dragged object
				const object = editor.tool.dragging;
				moveObject(object, pos.x, pos.y);
				editor.tool.dragging = null;

				editor.renderer.changeCursors({
					canvas: "default",
					object: "grab",
				});
			},
			onMouseMove(editor, event) {
				if (editor.tool.dragging === null) return;

				const pos = roundPosition(editor.getPosition(event));

				const object = editor.tool.dragging;
				moveObject(object, pos.x, pos.y);

				editor.renderer.render(editor.circuit);
			},
			cancel(editor) {
				if (editor.tool.dragging === null) return;

				const object = editor.tool.dragging;
				moveObject(object, object.startX, object.startY);
				editor.tool.dragging = null;

				editor.renderer.changeCursors({
					canvas: "default",
					object: "grab",
				});
			},
		});

		this.renderer.changeCursors({
			canvas: "default",
			object: "grab",
		});
	}

	setDeleteTool() {
		this.setTool({
			type: "delete",

			onMouseDown(editor, event) {
				const object = editor.queryRenderer(event);
				if (!object) return;

				if (object.type == "wire")
					editor.circuit.removeWire(object.object);
				if (object.type == "component")
					editor.circuit.removeComponent(object.object);
			},
		});

		this.renderer.changeCursors({
			canvas: "default",
			object: "not-allowed",
		});
	}

	// activates component placement tool
	setComponentTool(type, name) {
		this.setTool({
			type: "component",
			componentType: type,

			onMouseDown(editor, event) {
				const pos = roundPosition(editor.getPosition(event));

				editor.circuit.addComponent(
					editor.tool.componentType,
					pos.x,
					pos.y,
				);
			},
		});

		this.componentStat.textContent = name;

		this.renderer.changeCursors({
			canvas: "copy",
			object: "no-drop",
		});
	}

	// transforms mouse screen coordinates into SVG user-space coordinates
	getPosition(event) {
		const point = this.renderer.svg.createSVGPoint();

		point.x = event.clientX;
		point.y = event.clientY;

		const pos = point.matrixTransform(
			this.renderer.svg.getScreenCTM().inverse(),
		);

		return { x: pos.x, y: pos.y };
	}

	// finds the circuit object represented by an SVG element
	queryRenderer(event) {
		let element = event.target;

		while (element && element !== this.renderer.svg) {
			if (element.dataset?.id) break;
			element = element.parentElement;
		}

		if (!element || !this.renderer.svg.contains(element)) return null;

		let { id, type } = element.dataset;
		id = Number(id);

		if (type == "component")
			return {
				type: "component",
				object: this.circuit.components.get(id),
			};

		if (type == "wire")
			return {
				type: "wire",
				object: this.circuit.wires.get(id),
			};

		return null;
	}
}
