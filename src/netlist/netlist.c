#include "netlist.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define CAPACITY_STEP 64

// frees dynamically allocated strings in a node
void nodeFree(Node *node) { free(node->name); }

// frees component terminal node list and the component struct
void componentFree(Component *comp) {
	free(comp->nodes);
	free(comp);
}

Circuit *circuitNew() {
	Circuit *circ = malloc(sizeof(Circuit));

	circ->node_count = 0;
	circ->node_capacity = CAPACITY_STEP;
	circ->nodes = malloc(sizeof(Node) * circ->node_capacity);

	circ->component_count = 0;
	circ->component_capacity = CAPACITY_STEP;
	circ->components = malloc(sizeof(Component *) * circ->component_capacity);

	return circ;
}

void circuitFree(Circuit *circ) {
	for (size_t i = 0; i < circ->node_count; i++) {
		nodeFree(&circ->nodes[i]);
	}
	free(circ->nodes);

	for (size_t i = 0; i < circ->component_count; i++) {
		componentFree(circ->components[i]);
	}
	free(circ->components);

	free(circ);
}

NodeId circuitAddNode(Circuit *circ) {
	size_t i = circ->node_count;

	size_t len = snprintf(NULL, 0, "%s%zu", DEFAULT_NODE_NAME, i);
	char temp_name[len + 1];
	snprintf(temp_name, len + 1, "%s%zu", DEFAULT_NODE_NAME, i);

	return circuitAddNodeNamed(circ, temp_name);
}

NodeId circuitAddNodeNamed(Circuit *circ, const char *name) {
	NodeId id = circ->node_count++;
	Node *node = &circ->nodes[id];

	node->val = NODE_FLOATING;

	node->name = strdup(name);

	if (circ->node_count >= circ->node_capacity) {
		circ->node_capacity += CAPACITY_STEP;
		circ->nodes = realloc(circ->nodes, sizeof(Node) * circ->node_capacity);
	}

	return id;
}

NodeValue circuitGetNode(Circuit *circ, NodeId id) {
	if (id < 0 || id >= circ->node_count)
		return NODE_UNKNOWN;
	return circ->nodes[id].val;
}

const char *circuitGetNodeName(Circuit *circ, NodeId id) {
	if (id < 0 || id >= circ->node_count)
		return "Unknown";
	return circ->nodes[id].name;
}

// Appends a component to circuit and grows component buffer if needed
void circuitAddComponent(Circuit *circ, Component *comp) {
	circ->components[circ->component_count++] = comp;

	if (circ->component_count >= circ->component_capacity) {
		circ->component_capacity += CAPACITY_STEP;
		circ->components = realloc(
			circ->components, sizeof(Component *) * circ->component_capacity);
	}
}

void circuitAddSource(Circuit *circ, NodeId wire) {
	Component *source = malloc(sizeof(Component));
	source->type = COMPONENT_SOURCE;

	source->node_count = 1;
	source->nodes = malloc(sizeof(NodeId));
	source->nodes[0] = wire;

	circuitAddComponent(circ, source);
}

void circuitAddGround(Circuit *circ, NodeId wire) {
	Component *ground = malloc(sizeof(Component));
	ground->type = COMPONENT_GROUND;

	ground->node_count = 1;
	ground->nodes = malloc(sizeof(NodeId));
	ground->nodes[0] = wire;

	circuitAddComponent(circ, ground);
}

void circuitAddPMOS(Circuit *circ, NodeId source, NodeId gate, NodeId drain) {
	Component *pmos = malloc(sizeof(Component));
	pmos->type = COMPONENT_PMOS;

	pmos->node_count = 3;
	pmos->nodes = malloc(sizeof(NodeId) * pmos->node_count);
	pmos->nodes[0] = source;
	pmos->nodes[1] = gate;
	pmos->nodes[2] = drain;

	circuitAddComponent(circ, pmos);
}

void circuitAddNMOS(Circuit *circ, NodeId source, NodeId gate, NodeId drain) {
	Component *nmos = malloc(sizeof(Component));
	nmos->type = COMPONENT_NMOS;

	nmos->node_count = 3;
	nmos->nodes = malloc(sizeof(NodeId) * nmos->node_count);
	nmos->nodes[0] = source;
	nmos->nodes[1] = gate;
	nmos->nodes[2] = drain;

	circuitAddComponent(circ, nmos);
}

void circuitAddPort(Circuit *circ, NodeId in, NodeId out) {
	Component *port = malloc(sizeof(Component));
	port->type = COMPONENT_PORT;

	port->node_count = 2;
	port->nodes = malloc(sizeof(NodeId) * port->node_count);
	port->nodes[0] = in;
	port->nodes[1] = out;

	circuitAddComponent(circ, port);
}

void circuitAddPullup(Circuit *circ, NodeId a, NodeId b) {
	Component *resistor = malloc(sizeof(Component));
	resistor->type = COMPONENT_PULLUP;

	resistor->node_count = 2;
	resistor->nodes = malloc(sizeof(NodeId) * resistor->node_count);
	resistor->nodes[0] = a;
	resistor->nodes[1] = b;

	circuitAddComponent(circ, resistor);
}

void circuitAddPulldown(Circuit *circ, NodeId a, NodeId b) {
	Component *resistor = malloc(sizeof(Component));
	resistor->type = COMPONENT_PULLDOWN;

	resistor->node_count = 2;
	resistor->nodes = malloc(sizeof(NodeId) * resistor->node_count);
	resistor->nodes[0] = a;
	resistor->nodes[1] = b;

	circuitAddComponent(circ, resistor);
}

void circuitPrint(const Circuit *circ) {
	printf("Circuit:\n");

	printf("  Nodes: %zu\n", circ->node_count);

	for (size_t i = 0; i < circ->node_count; i++) {
		const Node *node = &circ->nodes[i];

		printf("    [%zu] %s = ", i, node->name);

		switch (node->val) {
		case NODE_LOW:
			printf("LOW");
			break;
		case NODE_LOW_WEAK:
			printf("LOW_WEAK");
			break;
		case NODE_HIGH:
			printf("HIGH");
			break;
		case NODE_HIGH_WEAK:
			printf("HIGH_WEAK");
			break;
		case NODE_FLOATING:
			printf("FLOATING");
			break;
		case NODE_UNKNOWN:
			printf("UNKNOWN");
			break;
		}

		printf("\n");
	}

	printf("  Components: %zu\n", circ->component_count);

	for (size_t i = 0; i < circ->component_count; i++) {
		const Component *comp = circ->components[i];

		printf("    [%zu] ", i);

		switch (comp->type) {
		case COMPONENT_SOURCE:
			printf("SOURCE");
			break;
		case COMPONENT_GROUND:
			printf("GROUND");
			break;
		case COMPONENT_PMOS:
			printf("PMOS");
			break;
		case COMPONENT_NMOS:
			printf("NMOS");
			break;
		case COMPONENT_PORT:
			printf("PORT");
			break;
		case COMPONENT_PULLUP:
			printf("PULLUP");
			break;
		case COMPONENT_PULLDOWN:
			printf("PULLDOWN");
			break;
		}

		printf(" (");

		for (size_t j = 0; j < comp->node_count; j++) {
			if (j > 0)
				printf(", ");
			printf("%zu", comp->nodes[j]);
		}

		printf(")\n");
	}
}
