// for tool icons
import { ToolIcon } from "./renderer.js";
import { Circuit, PortDirection } from "../model/circuit.js";
import { NodeValue } from "../simulation/simulator.js";

// snaps coordinates to integer grid points
function roundPosition(pos) {
	return {
		x: Math.round(pos.x),
		y: Math.round(pos.y),
	};
}

// definitions for available tools
export const ToolRegistry = {
	wire: {
		name: "Wire",
		description: "Wire objects together",
		draw: (group) => ToolIcon.wire(group),
		set: (editor) => editor.setWireTool(),
		key: "w",
	},
	move: {
		name: "Move",
		description: "Move wires and objects",
		draw: (group) => ToolIcon.move(group),
		set: (editor) => editor.setMoveTool(),
		key: "m",
	},
	delete: {
		name: "Delete",
		description: "Delete wires and objects",
		draw: (group) => ToolIcon.delete(group),
		set: (editor) => editor.setDeleteTool(),
		key: "d",
	},
	port: {
		name: "Port",
		description: "Create input/output ports",
		draw: (group) => ToolIcon.port(group),
		set: (editor) => editor.setPortTool(),
		key: "P",
	},
	fiddle: {
		name: "Fiddle",
		description: "Toggle input ports on/off and inspect subcircuits",
		draw: (group) => ToolIcon.fiddle(group),
		set: (editor) => editor.setFiddleTool(),
		key: "f",
	},
	subcircuit: {
		name: "Subcircuit",
		description: "Add subcircuit as IC",
		draw: (group) => ToolIcon.subcircuit(group),
		set: (editor) => editor.setSubcircuitTool(),
		key: "s",
	},
};

// manages interactive canvas editing, tool switching, and input events
export class Editor {
	// binds circuit and renderer, registers tool listeners
	constructor(circuit, renderer, { toolStat, componentStat, hierarchyStat }) {
		this.top = circuit;
		this.renderer = renderer;
		this.toolStat = toolStat;
		this.componentStat = componentStat;
		this.hierarchyStat = hierarchyStat;

		// start at top hierarchy
		this.renderStack = [];
		this.renderStack.push({
			name: "circuit",
			circuit: circuit,
		});
		this.hierarchyStat.textContent = this.renderStack.at(-1).name;

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

		// register cancel event (esc + mouse down w/o focus)
		const cancel = () => {
			const handled = this.tool.cancel?.(this);

			if (!handled && this.renderStack.length > 1) {
				const empty = this.renderStack.length === 1;
				if (!empty) {
					this.renderStack.pop();
					this.hierarchyStat.textContent =
						this.renderStack.at(-1).name;
					this.change();
				}
			}
		};
		document.addEventListener("keydown", (event) => {
			if (event.key === "Escape") cancel();
		});

		document.addEventListener("mousedown", (event) => {
			if (!this.renderer.svg.contains(event.target))
				this.tool.cancel?.(this);
		});

		this.renderer.render(circuit);
	}

	// updates editor's top level circuit
	change() {
		this.top.changed();
	}

	// gets the current circuit to handle
	get circuit() {
		return this.renderStack.at(-1).circuit;
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

					editor.change();

					return;
				}

				// second click: connect wire to end point
				editor.circuit.connectWire(editor.tool.dragging, pos.x, pos.y);
				editor.tool.dragging = null;
				editor.change();
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

				return 1;
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
				editor.circuit.moveObject(object, pos.x, pos.y);
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
				editor.circuit.moveObject(object, pos.x, pos.y);

				editor.renderer.render(editor.circuit);
			},
			cancel(editor) {
				if (editor.tool.dragging === null) return;

				const object = editor.tool.dragging;
				editor.circuit.moveObject(object, object.startX, object.startY);
				editor.tool.dragging = null;

				editor.renderer.changeCursors({
					canvas: "default",
					object: "grab",
				});

				return 1;
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
				if (object.type == "subcircuit")
					editor.circuit.removeSubcircuit(object.object);
				if (object.type == "port")
					editor.circuit.removePort(object.object);
			},
		});

		this.renderer.changeCursors({
			canvas: "default",
			object: "not-allowed",
		});
	}

	setPortTool() {
		this.setTool({
			type: "port",

			onMouseDown(editor, event) {
				editor.pendingPort = roundPosition(editor.getPosition(event));
				document.querySelector("#port-dialog").showModal();
			},
		});

		this.renderer.changeCursors({
			canvas: "copy",
			object: "no-drop",
		});
	}

	setFiddleTool() {
		this.setTool({
			type: "fiddle",

			onMouseDown(editor, event) {
				const obj = editor.queryRenderer(event);

				if (
					obj &&
					obj.type === "port" &&
					obj.object.direction == PortDirection.input
				) {
					if (obj.object.value == NodeValue.NODE_HIGH)
						obj.object.value = NodeValue.NODE_LOW;
					else obj.object.value = NodeValue.NODE_HIGH;

					editor.change();
				}

				if (obj && obj.type === "subcircuit") {
					const oldName = editor.renderStack.at(-1).name;

					editor.renderStack.push({
						name: oldName + " / " + obj.object.name,
						circuit: obj.object.internal,
					});

					editor.hierarchyStat.textContent =
						editor.renderStack.at(-1).name;
					editor.change();
				}
			},
		});

		this.renderer.changeCursors({
			canvas: "grab",
			object: "pointer",
		});
	}

	setSubcircuitTool() {
		this.askSubcircuit();
	}

	askPort(dialog) {
		if (dialog.returnValue !== "confirm") return;

		const name = document.querySelector("#port-name").value;
		const direction = document.querySelector(
			'input[name="direction"]:checked',
		).value;

		this.circuit.addPort(
			name,
			direction,
			this.pendingPort.x,
			this.pendingPort.y,
		);
	}

	askSubcircuit() {
		this.pendingSubcircuit = new Circuit();

		let openFile = document.querySelector("#open-file");

		// clone viwer
		const newFile = openFile.cloneNode(true);
		openFile.replaceWith(newFile);
		openFile = newFile;

		// setup viewer
		openFile.addEventListener(
			"change",
			async () => {
				// select file
				const file = openFile.files[0];
				if (!file) return;

				// deserialize
				this.pendingSubcircuit.fromJSON(JSON.parse(await file.text()));

				// reset selector
				openFile.value = "";

				this.setTool({
					type: "subcircuit",

					onMouseDown(editor, event) {
						const pos = roundPosition(editor.getPosition(event));

						editor.circuit.addSubcircuit(
							editor.pendingSubcircuit,
							pos.x,
							pos.y,
							file.name.replace(/\.json$/, ""),
						);
					},
				});

				this.renderer.changeCursors({
					canvas: "copy",
					object: "no-drop",
				});
			},
			{ once: true },
		);

		// open viewer
		openFile.click();
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

	// activates subcircuit placement tool
	setLibraryTool(data, name) {
		this.setTool({
			type: "subcircuit",
			subcircuitData: data,

			onMouseDown(editor, event) {
				const pos = roundPosition(editor.getPosition(event));

				const sub = new Circuit();
				sub.fromJSON(editor.tool.subcircuitData);

				editor.circuit.addSubcircuit(sub, pos.x, pos.y, name);
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

		if (type == "subcircuit")
			return {
				type: "subcircuit",
				object: this.circuit.subcircuits.get(id),
			};

		if (type == "port")
			return {
				type: "port",
				object: this.circuit.ports.get(id),
			};

		if (type == "wire")
			return {
				type: "wire",
				object: this.circuit.wires.get(id),
			};

		return null;
	}
}
