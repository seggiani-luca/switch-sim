// for component drawing functions
import { Renderer } from "../interface/renderer.js";

// for NodeValue
import { NodeValue } from "../simulation/simulator.js";

// definitions and terminal layouts for available circuit components
export const ComponentRegistry = Object.freeze({
	pmos: {
		name: "PMOS",
		description: "p-channel MOSFET",
		terminals: {
			source: { x: 1, y: 1 },
			gate: { x: -1, y: 0 },
			drain: { x: 1, y: -1 },
		},
		draw: (group) => {
			Renderer.drawPMOS(group);
		},
		set: (editor) => editor.setComponentTool("pmos", "PMOS"),
		key: "p",
	},

	nmos: {
		name: "NMOS",
		description: "n-channel MOSFET",
		terminals: {
			source: { x: 1, y: -1 },
			gate: { x: -1, y: 0 },
			drain: { x: 1, y: 1 },
		},
		draw: (group) => {
			Renderer.drawNMOS(group);
		},
		set: (editor) => editor.setComponentTool("nmos", "NMOS"),
		key: "n",
	},

	source: {
		name: "Source",
		description: "5V voltage source",
		terminals: {
			wire: { x: 0, y: 0 },
		},
		draw: (group) => {
			Renderer.drawSource(group);
		},
		set: (editor) => editor.setComponentTool("source", "Source"),
		key: "v",
	},

	ground: {
		name: "Ground",
		description: "Ground/chassis terminal",
		terminals: {
			wire: { x: 0, y: 0 },
		},
		draw: (group) => {
			Renderer.drawGround(group);
		},
		set: (editor) => editor.setComponentTool("ground", "Ground"),
		key: "g",
	},
});

// enum for port directions
export const PortDirection = Object.freeze({
	input: "input",
	output: "output",
});

// in-memory model of circuit components and interconnecting wires
export class Circuit {
	// initializes empty component and wire collections and ID generator
	constructor() {
		this.components = new Map(); // indexed by id
		this.wires = new Map(); // indexed by id
		this.subcircuits = new Map(); // indexed by id

		this.nextId = 0;

		this.ports = new Map(); // indexed by name

		this.listeners = new Set();
	}

	// computes circuit hash
	async hash() {
		const canonicalize = (value) => {
			if (Array.isArray(value)) return value.map(canonicalize);

			if (value && typeof value === "object")
				return Object.fromEntries(
					Object.keys(value)
						.sort()
						.map((key) => [key, canonicalize(value[key])]),
				);

			return value;
		};

		const data = JSON.stringify(canonicalize(await this.toJSON()));
		const resArray = await crypto.subtle.digest(
			"SHA-256",
			new TextEncoder().encode(data),
		);

		return [...new Uint8Array(resArray)]
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
	}

	// register an event callback on this circuit
	onChange(callback) {
		this.listeners.add(callback);
		return () => this.listeners.delete(callback);
	}

	// signals an event on this circuit
	changed() {
		for (const callback of this.listeners) callback(this);
	}

	// starts a new wire segment at (x1, y1) and adds it to the circuit
	beginWire(x1, y1) {
		const wire = {
			id: this.nextId++,
			x1,
			y1,
			x2: x1,
			y2: y1,
		};

		this.wires.set(wire.id, wire);
		return wire;
	}

	// sets the terminal end coordinates (x2, y2) of an in-progress wire
	connectWire(wire, x2, y2) {
		wire.x2 = x2;
		wire.y2 = y2;

		this.changed();
	}

	// checks for a wire at a certain position
	hasWire(x, y, exclude = null) {
		for (const wire of this.wires.values()) {
			if (wire === exclude) continue;

			const on = Circuit.pointOnWire(x, y, wire);
			if (on) return wire;
		}

		return null;
	}

	// checks for a wire length a certain position
	hasLength(x, y, exclude = null) {
		for (const wire of this.wires.values()) {
			if (wire === exclude) continue;

			const on = Circuit.pointOnWire(x, y, wire);
			if (!on) continue;

			// discard edges
			if (
				(x == wire.x1 && y == wire.y1) ||
				(x == wire.x2 && y == wire.y2)
			)
				continue;

			return wire;
		}

		return null;
	}

	hasWires(x, y, exclude = null) {
		const result = [];

		for (const wire of this.wires.values()) {
			if (wire === exclude) continue;

			const on = Circuit.pointOnWire(x, y, wire);
			if (on) result.push(wire);
		}

		return result;
	}

	// attempts to split a wire on its length
	splitWire(wire, x, y) {
		if (!Circuit.pointOnWire(x, y, wire)) return false;

		// discard edges
		if ((x == wire.x1 && y == wire.y1) || (x == wire.x2 && y == wire.y2))
			return;

		this.removeWire(wire);

		const first = this.beginWire(wire.x1, wire.y1);
		this.connectWire(first, x, y);

		const second = this.beginWire(x, y);
		this.connectWire(second, wire.x2, wire.y2);

		return [first, second];
	}

	// eulerian distance from segment tolerance check
	static pointOnWire(x, y, wire, tolerance = 0.1) {
		const dx21 = wire.x2 - wire.x1;
		const dy21 = wire.y2 - wire.y1;

		const dx31 = x - wire.x1;
		const dy31 = y - wire.y1;

		if (dx21 == 0 && dy21 == 0) return Math.hypot(dx31, dy31) < tolerance;

		const t0 = (dx31 * dx21 + dy31 * dy21) / (dx21 * dx21 + dy21 * dy21);

		if (t0 < 0 || t0 > 1) return false;

		const d = Math.hypot(dx21 * t0 - dx31, dy21 * t0 - dy31);

		return d < tolerance;
	}

	// detect wire intersections
	static wireIntersection(a, b) {
		const x1 = a.x1;
		const y1 = a.y1;
		const x2 = a.x2;
		const y2 = a.y2;

		const x3 = b.x1;
		const y3 = b.y1;
		const x4 = b.x2;
		const y4 = b.y2;

		const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

		if (denominator === 0) return null;

		const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;

		const u =
			-((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;

		// require intersection inside both wires
		if (t < 0 || t > 1 || u < 0 || u > 1) return null;

		// reject only endpoint ↔ endpoint
		if ((t === 0 || t === 1) && (u === 0 || u === 1)) return null;

		return {
			x: x1 + t * (x2 - x1),
			y: y1 + t * (y2 - y1),
		};
	}

	// removes a wire by ID or object reference
	removeWire(wire) {
		const ret = this.wires.delete(
			typeof wire === "object" ? wire.id : wire,
		);

		this.changed();
		return ret;
	}

	// instantiates a component at (x, y) with calculated terminal positions
	addComponent(type, x, y) {
		const definition = ComponentRegistry[type];
		const draw = definition.draw;

		if (!definition) throw new Error(`Unknown component type: ${type}`);

		const componentTerminals = {};

		for (const [name, position] of Object.entries(definition.terminals)) {
			componentTerminals[name] = {
				x: position.x,
				y: position.y,
			};
		}

		const component = {
			id: this.nextId++,
			type,
			draw,
			terminals: componentTerminals,
			x,
			y,
		};

		this.components.set(component.id, component);
		this.changed();
		return component;
	}

	// removes a component by ID or object reference
	removeComponent(component) {
		const ret = this.components.delete(
			typeof component === "object" ? component.id : component,
		);

		this.changed();
		return ret;
	}

	addPort(name, direction, x, y) {
		if (!Object.values(PortDirection).includes(direction))
			throw new Error(`Invalid port direction: ${direction}`);

		let terminalX;
		let terminalY;

		switch (direction) {
			case "input":
				terminalX = 2;
				terminalY = 0;
				break;

			case "output":
				terminalX = -2;
				terminalY = 0;
				break;
		}

		const port = {
			id: this.nextId++,
			name,
			direction,
			value: NodeValue.NODE_LOW,
			x,
			y,
			terminals: {
				wire: {
					x: terminalX,
					y: terminalY,
				},
			},
		};

		this.ports.set(port.id, port);
		this.changed();
		return port;
	}

	// removes a port by ID or object reference
	removePort(port) {
		const ret = this.ports.delete(
			typeof port === "object" ? port.id : port,
		);

		this.changed();
		return ret;
	}

	addSubcircuit(circuit, x, y, name) {
		const subcircuitPorts = {};

		for (const port of circuit.ports.values()) {
			subcircuitPorts[port.name] = {};
		}

		const width = 4;
		const ports = Object.values(subcircuitPorts);
		const rows = Math.ceil(ports.length / 2);

		for (const [i, port] of ports.entries()) {
			const right = i >= rows;

			port.x = right ? width : 0;
			port.y = i % rows;

			port.side = right ? "right" : "left";
		}

		const subcircuit = {
			id: this.nextId++,
			name: name,
			terminals: subcircuitPorts,
			internal: circuit,
			x,
			y,
			width: width,
			height: rows,
		};

		this.subcircuits.set(subcircuit.id, subcircuit);
		this.changed();
		return subcircuit;
	}

	// removes a subcircuit by ID or object reference
	removeSubcircuit(subcircuit) {
		const ret = this.subcircuits.delete(
			typeof subcircuit === "object" ? subcircuit.id : subcircuit,
		);

		this.changed();
		return ret;
	}

	// gets position of a component terminal
	getTerminalPosition(component, name) {
		const terminal = component.terminals[name];

		return {
			x: component.x + terminal.x,
			y: component.y + terminal.y,
		};
	}

	// moves a circuit object (wire or component)
	moveObject(object, x, y) {
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

		this.changed();
	}

	// serializes the circuit to JSON
	async toJSON() {
		// prepare subcircuit map
		const subcircuitMap = new Map();

		for (const subcircuit of this.subcircuits.values()) {
			const hash = await subcircuit.internal.hash();
			if (!subcircuitMap.has(hash))
				subcircuitMap.set(hash, await subcircuit.internal.toJSON());
		}

		return {
			name: this.name,
			description: this.description,

			components: [...this.components.values()].map((component) => ({
				type: component.type,
				x: component.x,
				y: component.y,
			})),

			wires: [...this.wires.values()].map((wire) => ({
				x1: wire.x1,
				y1: wire.y1,
				x2: wire.x2,
				y2: wire.y2,
			})),

			ports: [...this.ports.values()].map((port) => ({
				name: port.name,
				direction: port.direction,
				x: port.x,
				y: port.y,
				side: port.side,
			})),

			definitions: Object.fromEntries(subcircuitMap),

			subcircuits: await Promise.all(
				[...this.subcircuits.values()].map(async (subcircuit) => ({
					name: subcircuit.name,
					x: subcircuit.x,
					y: subcircuit.y,
					width: subcircuit.width,
					height: subcircuit.height,
					definition: await subcircuit.internal.hash(),

					terminals: Object.fromEntries(
						Object.entries(subcircuit.terminals).map(
							([name, terminal]) => [
								name,
								{
									x: terminal.x,
									y: terminal.y,
									side: terminal.side,
								},
							],
						),
					),
				})),
			),
		};
	}

	// deserializes the circuit from JSON
	fromJSON(data) {
		this.components.clear();
		this.wires.clear();
		this.ports.clear();
		this.subcircuits.clear();

		this.nextId = 0;

		if (data.name !== undefined) this.name = data.name;
		if (data.description !== undefined) this.description = data.description;

		for (const c of data.components ?? []) {
			this.addComponent(c.type, c.x, c.y);
		}

		for (const p of data.ports ?? []) {
			this.addPort(p.name, p.direction, p.x, p.y);
		}

		for (const s of data.subcircuits ?? []) {
			const internal = new Circuit();
			internal.fromJSON(data.definitions[s.definition]);

			const subcircuit = {
				id: this.nextId++,
				name: internal.name,
				terminals: s.terminals,
				x: s.x,
				y: s.y,
				width: s.width,
				height: s.height,
				internal: internal,
			};

			this.subcircuits.set(subcircuit.id, subcircuit);
		}

		for (const w of data.wires ?? []) {
			const wire = this.beginWire(w.x1, w.y1);
			this.connectWire(wire, w.x2, w.y2);
		}

		this.changed();
	}
}
