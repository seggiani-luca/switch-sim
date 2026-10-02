import createModule from "../wasm/simulatorWasm.js";

const Wasm = await createModule();

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

export const NodeValue = Object.freeze({
	NODE_LOW: 0,
	NODE_HIGH: 1,
	NODE_HIZ: 2,
	NODE_UNKNOWN: 3
});

export class Circuit {
	constructor() {
		this.ptr = Wasm._circuitNew();

		if(!this.ptr) throw new Error("Failed to create Circuit");
	}

	free() {
		if(this.ptr !== 0) {
			Wasm._circuitFree(this.ptr);
			this.ptr = 0;
		}
	}

	addNode(name) {
		if(name === undefined)
			return Wasm._circuitAddNode(this.ptr);
		
		return withCString(name, ptr =>
			Wasm._circuitAddNodeNamed(this.ptr, ptr)
		);
	}

	getNode(node) {
		const val = Wasm._circuitGetNode(this.ptr, node);

		if(val < NodeValue.NODE_LOW || val > NodeValue.NODE_UNKNOWN)
			throw new Error(`Invalid NodeValue: ${val}`);

		return val;
	}
	
	getNodeName(node) {
		const ptr = Wasm._circuitGetNodeName(this.ptr, node);
		return Wasm.UTF8ToString(ptr);
	}

	addSource(wire) {
		Wasm._circuitAddSource(this.ptr, wire);
	}

	addGround(wire) {
		Wasm._circuitAddGround(this.ptr, wire);
	}

	addPMOS(source, gate, drain) {
		Wasm._circuitAddPMOS(this.ptr, source, gate, drain);
	}

	addNMOS(source, gate, drain) {
		Wasm._circuitAddNMOS(this.ptr, source, gate, drain);
	}

	simulate() {
		Wasm._simulate(this.ptr);
	}
}
