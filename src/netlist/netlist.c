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

	node->val = VALUE_L;
	node->str = STRENGTH_CHARGE;
	node->name = strdup(name);

	if (circ->node_count >= circ->node_capacity) {
		circ->node_capacity += CAPACITY_STEP;
		circ->nodes = realloc(circ->nodes, sizeof(Node) * circ->node_capacity);
	}

	return id;
}

NodeValue circuitGetNodeValue(Circuit *circ, NodeId id) {
	if (id < 0 || id >= circ->node_count)
		return VALUE_X;
	return circ->nodes[id].val;
}

NodeStrength circuitGetNodeStrength(Circuit *circ, NodeId id) {
	if (id < 0 || id >= circ->node_count)
		return STRENGTH_CHARGE;
	return circ->nodes[id].str;
}

EXPORT void circuitSetNodeValue(Circuit *circ, NodeId id, NodeValue val) {
	if (id < 0 || id >= circ->node_count)
		return;
	circ->nodes[id].val = val;
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
		printf("    [%zu] %s (%s, %s)\n", i, node->name,
			   value2String(node->val), strength2String(node->str));
	}

	printf("  Components: %zu\n", circ->component_count);

	for (size_t i = 0; i < circ->component_count; i++) {
		const Component *comp = circ->components[i];

		printf("    [%zu] %s", i, comp2String(comp->type));

		if (comp->type == COMPONENT_PMOS || comp->type == COMPONENT_NMOS)
			printf(" [%s]", state2String(comp->state.mos));

		printf(" (");

		for (size_t j = 0; j < comp->node_count; j++) {
			if (j > 0)
				printf(", ");
			printf("%zu", comp->nodes[j]);
		}

		printf(")\n");
	}
}

const char *value2String(NodeValue val) {
	switch (val) {
	case VALUE_H:
		return "HIGH";
	case VALUE_L:
		return "LOW";
	case VALUE_X:
		return "UNKNOWN";
	default:
		return "INVALID";
	}
}

const char *strength2String(NodeStrength str) {
	switch (str) {
	case STRENGTH_DRIVEN:
		return "DRIVEN";
	case STRENGTH_PULLED:
		return "PULLED";
	case STRENGTH_NORMAL:
		return "NORMAL";
	case STRENGTH_CHARGE:
		return "CHARGE";
	default:
		return "INVALID";
	}
}

const char *comp2String(ComponentType type) {
	switch (type) {
	case COMPONENT_SOURCE:
		return "SOURCE";
	case COMPONENT_GROUND:
		return "GROUND";
	case COMPONENT_PMOS:
		return "PMOS";
	case COMPONENT_NMOS:
		return "NMOS";
	case COMPONENT_PORT:
		return "PORT";
	case COMPONENT_PULLUP:
		return "PULLUP";
	case COMPONENT_PULLDOWN:
		return "PULLDOWN";
	default:
		return "INVALID";
	}
}

const char *state2String(MOSState state) {
	switch (state) {
	case MOS_ON:
		return "ON";
	case MOS_OFF:
		return "OFF";
	case MOS_UNKNOWN:
		return "UNKNOWN";
	default:
		return "INVALID";
	}
}
