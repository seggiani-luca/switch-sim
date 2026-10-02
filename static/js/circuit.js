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
		this.nodes = new Map();
		this.devices = new Map();
		this.wires = new Map();

		this.nextId = 0;
	}

	addNode(name = null) {
		const node = {
			id: this.nextId++,
			name,
			value: NodeValue.NODE_UNKNOWN
		};

		this.nodes.set(node.id, node);
		return node;
	}

	addWire({ node, x1, y1, x2, y2 }) {
		const wire = {
			id: this.nextId++,
			node,
			x1,
			y1,
			x2,
			y2
		};

		this.wires.set(wire.id, wire);
		return wire;
	}

	addComponent(type, { terminals = {}, x = 0, y = 0 } = {}) {
		const definition = ComponentRegistry[type];

		if(!definition)
			throw new Error(`Unknown component type: ${type}`);

		for(const terminal of definition.terminals) {
			if(!(terminal in terminals))
				throw new Error(
					`Missing terminal '${terminal}' for ${type}`
				);
		}

		const component = {
			id: this.nextId++,
			type,
			terminals,
			x,
			y
		};

		this.devices.set(component.id, component);
		return component;
	}
}
