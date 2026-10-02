#ifndef NETLIST_H
#define NETLIST_H

#include "../export.h"
#include <stdint.h>
#include <stddef.h>

#define NODE_NAME_SIZE	64
#define DEFAULT_NODE_NAME "Node."

typedef size_t NodeId;

typedef enum {
	NODE_LOW,
	NODE_HIGH,
	NODE_HIZ,
	NODE_UNKNOWN
} NodeValue;

typedef struct {
	NodeValue val;
	char* name;	
} Node;

typedef enum {
	COMPONENT_SOURCE,
	COMPONENT_GROUND,
	COMPONENT_PMOS,
	COMPONENT_NMOS,
} ComponentType;

typedef enum {
	WIRE = 0
} MonopoleTerminals;

typedef enum {
	SOURCE = 0,
	GATE = 1,
	DRAIN = 2
} MOSTerminals;

typedef enum {
	MOS_ON,
	MOS_OFF,
	MOS_UNKNOWN
} MOSState;

typedef struct {
	ComponentType type;

	NodeId* nodes;
	size_t node_count;

	union {
		MOSState mos;
	} state;
} Component;

typedef struct {
	Node* nodes;
	size_t node_count;
	size_t node_capacity;

	Component** components;
	size_t component_count;
	size_t component_capacity;
} Circuit;

EXPORT Circuit* circuitNew();
EXPORT void circuitFree(Circuit* circ);
EXPORT NodeId circuitAddNode(Circuit* circ);
EXPORT NodeId circuitAddNodeNamed(Circuit* circ, const char* name);
EXPORT NodeValue circuitGetNode(Circuit* circ, NodeId id);
EXPORT const char* circuitGetNodeName(Circuit* circ, NodeId id);

EXPORT void circuitAddSource(Circuit* circ, NodeId wire);
EXPORT void circuitAddGround(Circuit* circ, NodeId wire);
EXPORT void circuitAddPMOS(Circuit* circ, NodeId source, NodeId gate,
	NodeId drain);
EXPORT void circuitAddNMOS(Circuit* circ, NodeId source, NodeId gate,
	NodeId drain);

#endif
