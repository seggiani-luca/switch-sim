#include "simulation.h"
#include "../log/log.h"
#include <stdlib.h>
#include <string.h>

// drives fixed power supply (HIGH) and ground (LOW) node values
void forceValues(Circuit *circ) {
	for (size_t i = 0; i < circ->component_count; i++) {
		Component *comp = circ->components[i];
		if (comp->type != COMPONENT_SOURCE && comp->type != COMPONENT_GROUND)
			continue;

		Node *wire = &circ->nodes[comp->nodes[WIRE]];

		// force nodes to high or low values
		if (comp->type == COMPONENT_SOURCE)
			wire->val = VALUE_H;
		if (comp->type == COMPONENT_GROUND)
			wire->val = VALUE_L;

		// driven strength
		wire->str = STRENGTH_DRIVEN;

		logEvent("Forcing node %s to %s, %s", wire->name,
				 value2String(wire->val), strength2String(wire->str));
	}
}

// updates ON/OFF/UNKNOWN state of all MOS switches based on gate node values
int updateMosGates(Circuit *circ) {
	int changed = 0;

	for (size_t i = 0; i < circ->component_count; i++) {
		Component *comp = circ->components[i];
		if (comp->type != COMPONENT_PMOS && comp->type != COMPONENT_NMOS)
			continue;

		Node *gate = &circ->nodes[comp->nodes[GATE]];

		MOSState new_state;

		// if gate is floating or unknown, MOS state is unknown
		if (gate->val == VALUE_X) {
			new_state = MOS_UNKNOWN;

			// if gate is fixed, apply the usual rules
		} else {
			if (comp->type == COMPONENT_PMOS) {
				new_state = gate->val == VALUE_L ? MOS_ON : MOS_OFF;
			}
			if (comp->type == COMPONENT_NMOS) {
				new_state = gate->val == VALUE_H ? MOS_ON : MOS_OFF;
			}
		}

		if (comp->state.mos != new_state) {
			logEvent("MOS (%d, %d, %d) changed conduction state to %s",
					 comp->nodes[SOURCE], comp->nodes[GATE], comp->nodes[DRAIN],
					 state2String(new_state));

			comp->state.mos = new_state;
			changed = 1;
		}
	}

	return changed;
}

// get propagation strength from node to node
NodeStrength propagationStrength(Node *from, Node *to, ComponentType type) {
	// max propagation strength
	NodeStrength max = from->str;
	if (type == COMPONENT_NMOS || type == COMPONENT_PMOS) {
		if (max > STRENGTH_NORMAL)
			max = STRENGTH_NORMAL;
	}
	if (type == COMPONENT_PULLUP || type == COMPONENT_PULLDOWN) {
		if (max > STRENGTH_PULLED)
			max = STRENGTH_PULLED;
	}

	switch (type) {
	case COMPONENT_NMOS:
	case COMPONENT_PULLDOWN:
		if (from->val == VALUE_H)
			return STRENGTH_CHARGE;
		return max;
	case COMPONENT_PMOS:
	case COMPONENT_PULLUP:
		if (from->val == VALUE_L)
			return STRENGTH_CHARGE;
		return max;
	default:
		return max;
	}
}

// conduct between two nodes
int conduct(Node *a, Node *b, ComponentType type) {
	// calculate the effective strength in both directions
	NodeStrength a2b = propagationStrength(a, b, type);
	NodeStrength b2a = propagationStrength(b, a, type);

	// propagate strength only
	if (a->val == b->val) {
		int changed = 0;

		if (a2b > b->str) {
			logEvent("Node %s (%s, %s) conducted to %s (%s, %s -> %s, %s)",
					 a->name, value2String(a->val), strength2String(a->str),
					 b->name, value2String(b->val), strength2String(b->str),
					 value2String(a->val), strength2String(a2b));

			b->str = a2b;
			changed = 1;
		}

		if (b2a > a->str) {
			logEvent("Node %s (%s, %s) conducted to %s (%s, %s -> %s, %s)",
					 b->name, value2String(b->val), strength2String(b->str),
					 a->name, value2String(a->val), strength2String(a->str),
					 value2String(b->val), strength2String(b2a));

			a->str = b2a;
			changed = 1;
		}

		return changed;
	}

	// A overcomes B
	if (a2b > b->str && b2a <= a->str) {
		logEvent("Node %s (%s, %s) conducted to %s (%s, %s -> %s, %s)", a->name,
				 value2String(a->val), strength2String(a->str), b->name,
				 value2String(b->val), strength2String(b->str),
				 value2String(a->val), strength2String(a2b));

		b->val = a->val;
		b->str = a2b;
		return 1;
	}

	// B overcomes A
	if (b2a > a->str && a2b <= b->str) {
		logEvent("Node %s (%s, %s) conducted to %s (%s, %s -> %s, %s)", b->name,
				 value2String(b->val), strength2String(b->str), a->name,
				 value2String(a->val), strength2String(a->str),
				 value2String(b->val), strength2String(b2a));

		a->val = b->val;
		a->str = b2a;
		return 1;
	}

	// opposing signals cause contention
	if (a2b > b->str && b2a > a->str) {
		logEvent("Node %s (%s, %s) and %s (%s, %s) burnt!", a->name,
				 value2String(a->val), strength2String(a->str), b->name,
				 value2String(b->val), strength2String(b->str));

		a->val = b->val = VALUE_X;
		return 1;
	}

	// neither signal can overcome the other node
	logEvent("Node %s (%s, %s) and %s (%s, %s) didn't conduct", a->name,
			 value2String(a->val), strength2String(a->str), b->name,
			 value2String(b->val), strength2String(b->str));

	return 0;
}

// transfers signals between source and drain according to transistor state,
// checking for contention
int propagateMosChannel(Node *source, Node *drain, Component *comp) {
	// if MOS state is off, don't appply conduction rules
	if (comp->state.mos == MOS_OFF) {
		logEvent("MOS (%d, %d, %d) doesn't conduct (%s)", comp->nodes[SOURCE],
				 comp->nodes[GATE], comp->nodes[DRAIN], source->name,
				 drain->name, state2String(comp->state.mos));

		return 0;
	}

	// if MOS state is unknown, the idea would be to mark channel ends as
	// unknown but this has the problem of forcing sources to unknown;
	// we instead do nothing
	if (comp->state.mos == MOS_UNKNOWN) {
		logEvent("MOS (%d, %d, %d)  doesn't conduct (%s)", comp->nodes[SOURCE],
				 comp->nodes[GATE], comp->nodes[DRAIN],
				 state2String(comp->state.mos));

		return 0;
	}

	logEvent("MOS (%d, %d, %d) conducts (%s)", comp->nodes[SOURCE],
			 comp->nodes[GATE], comp->nodes[DRAIN],
			 state2String(comp->state.mos));

	// MOS is on, conduct
	return conduct(source, drain, comp->type);
}

// propagates signals across all MOS transistor channels in the circuit
int propagateMosChannels(Circuit *circ) {
	int changed = 0;

	for (size_t i = 0; i < circ->component_count; i++) {
		Component *comp = circ->components[i];

		if (comp->type != COMPONENT_PMOS && comp->type != COMPONENT_NMOS)
			continue;

		Node *source = &circ->nodes[comp->nodes[SOURCE]];
		Node *drain = &circ->nodes[comp->nodes[DRAIN]];

		changed |= propagateMosChannel(source, drain, comp);
	}

	return changed;
}

// propagates signals across all dipoles in the circuit
int propagateDipoles(Circuit *circ) {
	int changed = 0;

	for (size_t i = 0; i < circ->component_count; i++) {
		Component *comp = circ->components[i];

		if (comp->type != COMPONENT_PULLUP && comp->type != COMPONENT_PULLDOWN)
			continue;

		Node *in = &circ->nodes[comp->nodes[IN]];
		Node *out = &circ->nodes[comp->nodes[OUT]];

		logEvent("Dipole with in %s, out %s conducts", in->name, out->name);

		changed |= conduct(in, out, comp->type);
	}

	return changed;
}

// propagates signals across all ports in the circuit
int propagatePorts(Circuit *circ) {
	int changed = 0;

	for (size_t i = 0; i < circ->component_count; i++) {
		Component *comp = circ->components[i];

		if (comp->type != COMPONENT_PORT)
			continue;

		Node *in = &circ->nodes[comp->nodes[IN]];
		Node *out = &circ->nodes[comp->nodes[OUT]];

		logEvent("Port with in %s, out %s conducts", in->name, out->name);

		changed |= conduct(in, out, comp->type);
	}

	return changed;
}

// reset values to charges
void resetPropagation(Circuit *circuit) {
	for (size_t i = 0; i < circuit->node_count; i++) {
		Node *node = &circuit->nodes[i];

		if (node->str == STRENGTH_NORMAL)
			node->str = STRENGTH_CHARGE;
	}
}

int simulate(Circuit *circ) {
	logEvent("Doing preliminary setup");

	// force source values
	forceValues(circ);

	// propagate source values to reduce settling time
	for (int p = 0; p < PORT_PROP_STEPS; p++)
		if (!propagatePorts(circ))
			break;

	// get first mos conduction state
	updateMosGates(circ);

	for (size_t i = 0; i < MAX_SIM_ITERS; i++) {
		logEvent("Simulating at iteration %d", i);

		resetPropagation(circ);

		// resolve circuit with given gate conduction state
		for (size_t j = 0; j < MAX_PROP_STEPS; j++) {
			logEvent("Propagating at step %d", j);

			int lower_changed = 0;

			lower_changed |= propagateMosChannels(circ);
			for (int p = 0; p < PORT_PROP_STEPS; p++)
				if (!propagatePorts(circ))
					break;
			lower_changed |= propagateDipoles(circ);

			if (!lower_changed) {
				// resolved
				logEvent("Finished propagation at step %d", j);

				break;
			}
		}

		int upper_changed = 0;

		logEvent("Updating MOS conduction state at iteration %d", i);

		// update MOS gate conduction state
		upper_changed |= updateMosGates(circ);

		if (!upper_changed) {
			// converged
			logEvent("Finished converging at iteration %d", i);

			return 1;
		}

		logEvent("MOS conduction state changed, iterating");
	}

	// didn't converge
	return 0;
}
