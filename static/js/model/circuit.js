// for component drawing functions
import { Renderer } from "../interface/renderer.js";

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

// in-memory model of circuit components and interconnecting wires
export class Circuit {
	// initializes empty component and wire collections and ID generator
	constructor() {
		this.components = new Map();
		this.wires = new Map();

		this.nextId = 0;

		this.listeners = new Set();
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

	// instantiates a component at (x, y) with calculated terminal positions
	addComponent(type, x, y) {
		const definition = ComponentRegistry[type];
		const draw = definition.draw;

		if (!definition) throw new Error(`Unknown component type: ${type}`);

		const componentTerminals = {};

		for (const [name, position] of Object.entries(definition.terminals)) {
			componentTerminals[name] = {
				x: x + position.x,
				y: y + position.y,
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

	// removes a component by ID or object reference
	removeComponent(component) {
		const ret = this.components.delete(
			typeof component === "object" ? component.id : component,
		);
		this.changed();
		return ret;
	}
}
