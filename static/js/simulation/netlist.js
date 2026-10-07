// for the Simulator class
import { NodeValue, Simulator } from "./simulator.js";

// for PortDirection
import { PortDirection } from "../model/circuit.js";

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
		const terminals = component.terminals;

		switch (component.type) {
			case "nmos": {
				const source = circuit.getTerminalPosition(component, "source");
				const gate = circuit.getTerminalPosition(component, "gate");
				const drain = circuit.getTerminalPosition(component, "drain");

				sim.addNMOS(
					nodeAt(source.x, source.y),
					nodeAt(gate.x, gate.y),
					nodeAt(drain.x, drain.y),
				);
				break;
			}

			case "pmos": {
				const source = circuit.getTerminalPosition(component, "source");
				const gate = circuit.getTerminalPosition(component, "gate");
				const drain = circuit.getTerminalPosition(component, "drain");

				sim.addPMOS(
					nodeAt(source.x, source.y),
					nodeAt(gate.x, gate.y),
					nodeAt(drain.x, drain.y),
				);
				break;
			}

			case "source": {
				const wire = circuit.getTerminalPosition(component, "wire");
				sim.addSource(nodeAt(wire.x, wire.y));
				break;
			}

			case "ground": {
				const wire = circuit.getTerminalPosition(component, "wire");
				sim.addGround(nodeAt(wire.x, wire.y));
				break;
			}
		}
	}

	// goes through ports, adding
	for (const port of circuit.ports.values()) {
		if (port.direction == PortDirection.input) {
			const terminal = circuit.getTerminalPosition(port, "wire");

			if (port.value == NodeValue.NODE_HIGH)
				sim.addSource(nodeAt(terminal.x, terminal.y));
			else sim.addGround(nodeAt(terminal.x, terminal.y));
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

	// gets the node at a certain position
	const nodeAt = (terminal) => {
		const wires = circ.hasWires(terminal.x, terminal.y);

		if (wires.length === 0) return null;

		return wires[0].node;
	};

	// get port states back
	for (const port of circ.ports.values()) {
		if (port.direction == PortDirection.output) {
			const terminal = circ.getTerminalPosition(port, "wire");
			const node = nodeAt(terminal);

			port.value =
				node === null ? NodeValue.NODE_UNKNOWN : sim.getNode(node);
		}
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
