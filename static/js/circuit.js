export const ComponentRegistry = Object.freeze({
	pmos: {
		name: "PMOS",
		description: "p-channel MOSFET",
		terminals: ["source", "gate", "drain"]
	},

	nmos: {
		name: "NMOS",
		description: "n-channel MOSFET",
		terminals: ["source", "gate", "drain"]
	},

	source: {
		name: "Source",
		description: "5V voltage source",
		terminals: ["wire"]
	},

	ground: {
		name: "Ground",
		description: "Ground/chassis terminal",
		terminals: ["wire"]
	}
});

export class Circuit {
	constructor() {
		this.components = new Map();
		this.wires = new Map();

		this.nextId = 0;
	}

	beginWire(x1, y1) {
		const wire = {
			id: this.nextId++,
			x1,
			y1,
			x2: x1,
			y2: y1
		};

		this.wires.set(wire.id, wire);
		return wire;
	}

	connectWire(wire, x2, y2) {
		wire.x2 = x2;
		wire.y2 = y2;
	}

	addComponent(type, x, y) {
		const definition = ComponentRegistry[type];

		if(!definition)
			throw new Error(`Unknown component type: ${type}`);

		const componentTerminals = {};

		for(const [name, position] of Object.entries(definition.terminals)) {
			componentTerminals[name] = {
				x: x + position.x,
				y: y + position.y
			};
		}

		const component = {
			id: this.nextId++,
			type,
			terminals: componentTerminals,
			x,
			y
		};

		this.components.set(component.id, component);
		return component;
	}

	removeWire(wire) {
		return this.wires.delete(
			typeof wire === "object" ? wire.id : wire
		);
	}

	removeComponent(component) {
		return this.components.delete(
			typeof component === "object" ? component.id : component
		);
	}
}
