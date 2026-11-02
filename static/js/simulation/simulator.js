import createModule from "../../wasm/simulatorWasm.js";

const Wasm = await createModule();

// allocates a temporary UTF-8 C string in WASM heap to free it after callback
function withCString(str, fn) {
	const len = Wasm.lengthBytesUTF8(str) + 1;
	const ptr = Wasm._malloc(len);

	try {
		Wasm.stringToUTF8(str, ptr, len);
		return fn(ptr);
	} finally {
		Wasm._free(ptr);
	}
}

// node logic states matching C NodeValue enum
export const NodeValue = Object.freeze({
	VALUE_L: 0,
	VALUE_H: 1,
	VALUE_X: 2,
});

// node strength states matching C NodeStrength enum
export const NodeStrength = Object.freeze({
	STRENGTH_DRIVEN: 4,
	STRENGTH_NORMAL: 3,
	STRENGTH_PULLED: 2,
	STRENGTH_CHARGE: 1,
});

// JavaScript wrapper around the C WebAssembly circuit simulator
export class Simulator {
	// allocates a new C Circuit instance in WASM memory
	constructor() {
		this.ptr = Wasm._circuitNew();

		if (!this.ptr) throw new Error("Failed to create simulator Circuit");
	}

	// deallocates the C Circuit instance from WASM memory
	free() {
		if (this.ptr !== 0) {
			Wasm._circuitFree(this.ptr);
			this.ptr = 0;
		}
	}

	// adds a node to WASM circuit, with optional string label
	addNode(name) {
		if (name === undefined) return Wasm._circuitAddNode(this.ptr);

		return withCString(name, (ptr) =>
			Wasm._circuitAddNodeNamed(this.ptr, ptr),
		);
	}

	// queries signal value of a node
	getNodeValue(node) {
		const val = Wasm._circuitGetNodeValue(this.ptr, node);

		if (val < NodeValue.VALUE_L || val > NodeValue.VALUE_X)
			throw new Error(`Invalid NodeValue on get: ${val}`);

		return val;
	}

	// queries strength value of a node
	getNodeStrength(node) {
		const str = Wasm._circuitGetNodeStrength(this.ptr, node);

		if (
			str < NodeStrength.STRENGTH_CHARGE ||
			str > NodeStrength.STRENGTH_DRIVEN
		)
			throw new Error(`Invalid NodeStrength on get: ${val}`);

		return str;
	}

	// overrides signal value of a node
	setNodeValue(node, val) {
		if (val < NodeValue.VALUE_L || val > NodeValue.VALUE_X)
			throw new Error(`Invalid NodeValue on set: ${val}`);

		Wasm._circuitSetNodeValue(this.ptr, node, val);
	}

	// returns the name string of a node
	getNodeName(node) {
		const ptr = Wasm._circuitGetNodeName(this.ptr, node);
		return Wasm.UTF8ToString(ptr);
	}

	// connects a constant HIGH voltage source to a node
	addSource(wire) {
		Wasm._circuitAddSource(this.ptr, wire);
	}

	// connects a constant LOW ground terminal to a node
	addGround(wire) {
		Wasm._circuitAddGround(this.ptr, wire);
	}

	// adds a PMOS transistor (conducts when gate is LOW)
	addPMOS(source, gate, drain) {
		Wasm._circuitAddPMOS(this.ptr, source, gate, drain);
	}

	// adds an NMOS transistor (conducts when gate is HIGH)
	addNMOS(source, gate, drain) {
		Wasm._circuitAddNMOS(this.ptr, source, gate, drain);
	}

	// adds a passthru port
	addPort(inp, out) {
		Wasm._circuitAddPort(this.ptr, inp, out);
	}

	// adds a pull-up resistor
	addPullup(a, b) {
		Wasm._circuitAddPullup(this.ptr, a, b);
	}

	// adds a pull-down resistor
	addPulldown(a, b) {
		Wasm._circuitAddPulldown(this.ptr, a, b);
	}

	// runs WASM switch simulation until circuit converges
	simulate() {
		return Wasm._simulate(this.ptr);
	}

	// debug prints the circuit
	printCircuit() {
		Wasm._circuitPrint(this.ptr);
	}

	// debug prints simulation events
	printEvents() {
		Wasm._logPrint();
	}
}
