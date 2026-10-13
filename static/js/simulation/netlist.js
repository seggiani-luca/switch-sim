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

// recognizes if a resistor should be pullup or pulldown
function resistorType(circuit, a, b) {
	const sourceNets = new Set();
	const groundNets = new Set();

	for (const component of circuit.components.values()) {
		if (component.type !== "source" && component.type !== "ground") continue;
		
		const terminal = circuit.getTerminalPosition(component, "wire");
		const net = netAt(circuit, terminal.x, terminal.y);

		if (component.type === "source") sourceNets.add(net);
		if (component.type === "ground") groundNets.add(net);
	}

	const aNet = netAt(circuit, a.x, a.y);
	const bNet = netAt(circuit, b.x, b.y);

	if (sourceNets.has(aNet) || sourceNets.has(bNet)) return "pullup";

	if (groundNets.has(aNet) || groundNets.has(bNet)) return "pulldown";

	return "pullup";
}

// compiles a simulator representation for a subcircuit
function compileSubcircuit(subcircuit, sim, parentNodeAt) {
	const internal = subcircuit.internal;

	labelNodes(internal);

	const internalNodeAt = compileCircuit(internal, sim, false);

	for (const [name, terminal] of Object.entries(subcircuit.terminals)) {
		const port = [...internal.ports.values()].find(
			(port) => port.name === name,
		);

		if (!port) throw new Error(`Missing internal port: ${name}`);

		const externalNode = parentNodeAt(
			subcircuit.x + terminal.x,
			subcircuit.y + terminal.y,
		);

		const internalTerminal = internal.getTerminalPosition(port, "wire");

		const internalNode = internalNodeAt(
			internalTerminal.x,
			internalTerminal.y,
		);

		sim.addPort(externalNode, internalNode);
	}
}

// compiles a simulator representation from a labeled circuit
function compileCircuit(circuit, sim, top = true) {
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

			case "resistor": {
				const a = circuit.getTerminalPosition(component, "a");
				const b = circuit.getTerminalPosition(component, "b");

				switch (resistorType(circuit, a, b)) {
					case "pullup":
						sim.addPullup(nodeAt(a.x, a.y), nodeAt(b.x, b.y));
						break;

					case "pulldown":
						sim.addPulldown(nodeAt(a.x, a.y), nodeAt(b.x, b.y));
						break;

					default:
						sim.addResistor(nodeAt(a.x, a.y), nodeAt(b.x, b.y));
						break;
				}
				break;
			}
		}
	}

	// goes through subcircuits, adding
	for (const subcircuit of circuit.subcircuits.values()) {
		compileSubcircuit(subcircuit, sim, nodeAt);
	}

	// non-top circuits have passive input ports
	if (!top) return nodeAt;

	// goes through ports, adding
	for (const port of circuit.ports.values()) {
		if (port.direction == PortDirection.input) {
			const terminal = circuit.getTerminalPosition(port, "wire");

			// a top port becomes either a source or a ground
			if (port.value == NodeValue.NODE_HIGH)
				sim.addSource(nodeAt(terminal.x, terminal.y));
			else sim.addGround(nodeAt(terminal.x, terminal.y));
		}
	}

	return nodeAt;
}

// gets wire states back after simulation
export function updateWires(sim, circ) {
	// get wire states back
	for (const wire of circ.wires.values()) {
		wire.value = sim.getNode(wire.node);
	}

	// get port states back
	for (const port of circ.ports.values()) {
		const terminal = circ.getTerminalPosition(port, "wire");
		const wires = circ.hasWires(terminal.x, terminal.y);

		port.value =
			wires.length === 0
				? NodeValue.NODE_UNKNOWN
				: sim.getNode(wires[0].node);
	}

	// update internal subcircuits recursively
	for (const subcircuit of circ.subcircuits.values()) {
		updateWires(sim, subcircuit.internal);
	}
}

// compiles a geometrical representation of a circuit to a netlist one
// more specifically, converts a Circuit to a Simulator object
export function compileNetlist(circuit) {
	// first label nodes
	labelNodes(circuit);

	// then generate simulator
	const sim = new Simulator();
	compileCircuit(circuit, sim);
	return sim;
}
