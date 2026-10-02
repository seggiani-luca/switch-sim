import * as Simulator from "./simulator.js";

function logNode(circ, node) {
	console.log(`${circ.getNodeName(node)}: ${circ.getNode(node)}`);
}

function logNodes(circ, ...nodes) {
	for(const node of nodes) logNode(circ, node);
}

const circ = new Simulator.Circuit(); 

const input  = circ.addNode("Input");
const vcc = circ.addNode("Vcc");
const ground = circ.addNode("Ground");
const output = circ.addNode("Output");

circ.addPMOS(vcc, input, output);
circ.addNMOS(ground, input, output);
circ.addSource(vcc);
circ.addGround(ground);

// drive it
circ.addSource(input);

console.log("Before simulation:")
logNodes(circ, input, vcc, ground, output);

circ.simulate();

console.log("After simulation:")
logNodes(circ, input, vcc, ground, output);

circ.free();
