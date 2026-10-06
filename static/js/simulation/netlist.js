// for the Simulator class
import { Simulator } from "./simulator.js";

// gets net at a position of circuit
function netAt(circuit, x, y) {
	const wire = circuit.hasWires(x, y);

	return wire[0]?.net ?? null;
}

// labels the wires of a circuit to represent nets
function labelNodes(circuit) {
	let nextNet = 0;

	for (const wire of circuit.wires.values()) wire.net = null;

	for (const wire of circuit.wires.values()) {
		if (wire.net !== null) continue;

		const net = `connected:${nextNet++}`;

		const stack = [wire];
		wire.net = net;

		while (stack.length > 0) {
			const current = stack.pop();

			for (const [x, y] of [
				[current.x1, current.y1],
				[current.x2, current.y2],
			]) {
				for (const wire of circuit.hasWires(x, y, current)) {
					if (wire.net !== null) continue;

					wire.net = net;
					stack.push(wire);
				}
			}
		}
	}
}

// compiles a simulator representation from a labeled circuit
function compileCircuit(circuit) {
	const sim = new Simulator();
	const nodes = new Map();

	// returns the simulator node for a given net
	const nodeForNet = (net) => {
		if (!nodes.has(net)) nodes.set(net, sim.addNode());

		return nodes.get(net);
	};

	// gets the node at a certain position
	const nodeAt = (x, y) => {
		const net = netAt(circuit, x, y);

		if (net === null) return nodeForNet(`unconnected:${x},${y}`);

		return nodeForNet(net);
	};

	// update nodes in circuit
	for (const wire of circuit.wires.values()) {
		wire.node = nodeForNet(wire.net);
	}

	// goes through components, adding
	for (const component of circuit.components.values()) {
		const { terminals } = component;

		switch (component.type) {
			case "nmos":
				sim.addNMOS(
					nodeAt(terminals.source.x, terminals.source.y),
					nodeAt(terminals.gate.x, terminals.gate.y),
					nodeAt(terminals.drain.x, terminals.drain.y),
				);
				break;

			case "pmos":
				sim.addPMOS(
					nodeAt(terminals.source.x, terminals.source.y),
					nodeAt(terminals.gate.x, terminals.gate.y),
					nodeAt(terminals.drain.x, terminals.drain.y),
				);
				break;

			case "source":
				sim.addSource(nodeAt(terminals.wire.x, terminals.wire.y));
				break;

			case "ground":
				sim.addGround(nodeAt(terminals.wire.x, terminals.wire.y));
				break;
		}
	}

	return sim;
}

// gets wire states back after simulation
export function updateWires(sim, circ) {
	// get wire states back
	for (const wire of circ.wires.values()) {
		wire.value = sim.getNode(wire.node);
	}
}

// compiles a geometrical representation of a circuit to a netlist one
// more specifically, converts a Circuit to a Simulator object
export function compileNetlist(circuit) {
	// first label nodes
	labelNodes(circuit);

	// then generate simulator
	return compileCircuit(circuit);
}
