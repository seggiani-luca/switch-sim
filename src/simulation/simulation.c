#include "simulation.h"

void forceValues(Circuit* circ) {
	for(size_t i = 0; i < circ->component_count; i++) {
		Component* comp = circ->components[i];
		if(comp->type != COMPONENT_SOURCE
		&& comp->type != COMPONENT_GROUND) continue;

		Node* wire = &circ->nodes[comp->nodes[WIRE]];

		// force nodes to high or low values
		if(comp->type == COMPONENT_SOURCE) wire->val = NODE_HIGH;
		if(comp->type == COMPONENT_GROUND) wire->val = NODE_LOW;
	}
}

int updateMosGates(Circuit* circ) {
	int changed = 0;

	for(size_t i = 0; i < circ->component_count; i++) {
		Component* comp = circ->components[i];
		if(comp->type != COMPONENT_PMOS
		&& comp->type != COMPONENT_NMOS) continue;
		
		Node* gate = &circ->nodes[comp->nodes[GATE]];

		MOSState new_state;

		// if gate is floating or unknown, MOS state is unknown
		if(gate->val == NODE_HIZ
		|| gate->val == NODE_UNKNOWN) {
			new_state = MOS_UNKNOWN;

		// if gate is fixed, apply the usual rules
		} else {
			if(comp->type == COMPONENT_PMOS)
				new_state = gate->val == NODE_LOW ? MOS_ON : MOS_OFF;
			if(comp->type == COMPONENT_NMOS)
				new_state = gate->val == NODE_HIGH ? MOS_ON : MOS_OFF;
		}

		if (comp->state.mos != new_state) {
			comp->state.mos = new_state;
			changed = 1;
		}
	}

	return changed;
}

void propagateMosChannel(Node* source, Node* drain, MOSState state) {
	// if MOS state is off, don't appply conduction rules
	if(state == MOS_OFF) return;

	// if MOS state is unknown, the idea would be to mark channel ends as
	// unknown but this has the problem of forcing sources to unknown;
	// a compromise is to conserve low and high channel ends
	if(state == MOS_UNKNOWN) {
		if(source->val != NODE_LOW
		&& source->val != NODE_HIGH)
			source->val = NODE_UNKNOWN;

		if(drain->val != NODE_LOW
		&& drain->val != NODE_HIGH)
			drain->val = NODE_UNKNOWN;

		return;
	}

	// if either side is unknown, apply the same logic and conserve
	if(source->val == NODE_UNKNOWN
	|| drain->val == NODE_UNKNOWN)
		return;


	// this is for contention: if the channel is forced in opposite direction
	// the value is unknown (physically there's a burnt wire) 
	if(source->val == NODE_HIGH && drain->val == NODE_LOW
	|| drain->val == NODE_HIGH && source->val == NODE_LOW) {
		source->val = NODE_UNKNOWN;
		drain->val = NODE_UNKNOWN;
		return;
	}

	// normal channel propagation, propagating high
	if(source->val == NODE_HIGH
	|| drain->val == NODE_HIGH) {
		source->val = NODE_HIGH;
		drain->val = NODE_HIGH;
		return;
	}

	// normal channel propagation, propagating low 
	if(source->val == NODE_LOW
	|| drain->val == NODE_LOW) {
		source->val = NODE_LOW;
		drain->val = NODE_LOW;
		return;
	}
}

void propagateMosChannels(Circuit* circ) {
	for(size_t i = 0; i < circ->component_count; i++) {
		Component* comp = circ->components[i];
	
		if(comp->type != COMPONENT_PMOS
		&& comp->type != COMPONENT_NMOS) continue;

		Node* source = &circ->nodes[comp->nodes[SOURCE]];
		Node* drain = &circ->nodes[comp->nodes[DRAIN]];
		MOSState state = comp->state.mos;

		propagateMosChannel(source, drain, state);
	}
}

void simulate(Circuit* circ) {
	forceValues(circ);

	int changed;
	do {
		changed = 0;

		changed = updateMosGates(circ);
		propagateMosChannels(circ);
	} while(changed);
}
