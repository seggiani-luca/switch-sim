#ifndef NETLIST_H
#define NETLIST_H

#include "../export.h"
#include <stddef.h>
#include <stdint.h>

#define NODE_NAME_SIZE 64
#define DEFAULT_NODE_NAME "Node."

typedef size_t NodeId;

// logical signal values on a node
typedef enum {
	NODE_LOW,
	NODE_LOW_WEAK,
	NODE_HIGH,
	NODE_HIGH_WEAK,
	NODE_FLOATING,
	NODE_UNKNOWN
} NodeValue;

// electrical node with signal state and label
typedef struct {
	NodeValue val;
	char *name;
} Node;

// supported circuit element types
typedef enum {
	COMPONENT_SOURCE,
	COMPONENT_GROUND,
	COMPONENT_PMOS,
	COMPONENT_NMOS,
	COMPONENT_PORT,
	COMPONENT_PULLUP,
	COMPONENT_PULLDOWN
} ComponentType;

// terminal index mapping for single-terminal components (source, ground)
typedef enum { WIRE = 0 } MonopoleTerminals;

// terminal index mapping for dual-terminal components (ports)
typedef enum { IN = 0, OUT = 1 } BipoleTerminals;

// terminal index mapping for MOS transistors
typedef enum { SOURCE = 0, GATE = 1, DRAIN = 2 } MOSTerminals;

// transistor channel conduction state
typedef enum { MOS_ON, MOS_OFF, MOS_UNKNOWN } MOSState;

// circuit element instance and its connected node indices
typedef struct {
	ComponentType type;

	NodeId *nodes;
	size_t node_count;

	union {
		MOSState mos;
	} state;
} Component;

// circuit container holding nodes and components
typedef struct {
	Node *nodes;
	size_t node_count;
	size_t node_capacity;

	Component **components;
	size_t component_count;
	size_t component_capacity;
} Circuit;

// allocates and initializes an empty circuit
EXPORT Circuit *circuitNew();

// frees all nodes, components, and the circuit container
EXPORT void circuitFree(Circuit *circ);

// adds a node with an auto-generated name (e.g. Node.0)
EXPORT NodeId circuitAddNode(Circuit *circ);

// adds a node with a custom name
EXPORT NodeId circuitAddNodeNamed(Circuit *circ, const char *name);

// gets current signal state of a node
EXPORT NodeValue circuitGetNode(Circuit *circ, NodeId id);

// gets label/name of a node
EXPORT const char *circuitGetNodeName(Circuit *circ, NodeId id);

// connects a constant HIGH voltage source to a node
EXPORT void circuitAddSource(Circuit *circ, NodeId wire);

// connects a constant LOW ground terminal to a node
EXPORT void circuitAddGround(Circuit *circ, NodeId wire);

// adds a PMOS transistor (conducts when gate is LOW)
EXPORT void circuitAddPMOS(Circuit *circ, NodeId source, NodeId gate,
						   NodeId drain);

// adds an NMOS transistor (conducts when gate is HIGH)
EXPORT void circuitAddNMOS(Circuit *circ, NodeId source, NodeId gate,
						   NodeId drain);

// adds a passthru port
EXPORT void circuitAddPort(Circuit *circ, NodeId in, NodeId out);

// adds a pull-up resistor
EXPORT void circuitAddPullup(Circuit *circ, NodeId a, NodeId b);

// adds a pull-down resistor
EXPORT void circuitAddPulldown(Circuit *circ, NodeId a, NodeId b);

// debug prints a circuit
EXPORT void circuitPrint(const Circuit *circ);

#endif
