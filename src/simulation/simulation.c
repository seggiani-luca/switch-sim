#include "simulation.h"

// enum for logic values
typedef enum { LOGIC_LOW, LOGIC_HIGH, LOGIC_UNKNOWN } NodeLogic;

// enum for strength values
typedef enum { STRENGTH_NONE, STRENGTH_WEAK, STRENGTH_FULL } NodeStrength;

// helper that extracts logic values from node values
NodeLogic toLogic(NodeValue v) {
	if (v == NODE_LOW_WEAK || v == NODE_LOW)
		return LOGIC_LOW;
	if (v == NODE_HIGH_WEAK || v == NODE_HIGH)
		return LOGIC_HIGH;
	return LOGIC_UNKNOWN;
}

// helper that extracts strength values from node values
NodeStrength toStrength(NodeValue v) {
	if (v == NODE_LOW_WEAK || v == NODE_HIGH_WEAK)
		return STRENGTH_WEAK;
	if (v == NODE_LOW || v == NODE_HIGH)
		return STRENGTH_FULL;
	return STRENGTH_NONE;
}

// drives fixed power supply (HIGH) and ground (LOW) node values
void forceValues(Circuit *circ) {
	for (size_t i = 0; i < circ->component_count; i++) {
		Component *comp = circ->components[i];
		if (comp->type != COMPONENT_SOURCE && comp->type != COMPONENT_GROUND)
			continue;

		Node *wire = &circ->nodes[comp->nodes[WIRE]];

		// force nodes to high or low values
		if (comp->type == COMPONENT_SOURCE)
			wire->val = NODE_HIGH;
		if (comp->type == COMPONENT_GROUND)
			wire->val = NODE_LOW;
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
		if (gate->val == NODE_FLOATING || gate->val == NODE_UNKNOWN) {
			new_state = MOS_UNKNOWN;

			// if gate is fixed, apply the usual rules
		} else {
			if (comp->type == COMPONENT_PMOS) {
				new_state = toLogic(gate->val) == LOGIC_LOW ? MOS_ON : MOS_OFF;
			}
			if (comp->type == COMPONENT_NMOS) {
				new_state = toLogic(gate->val) == LOGIC_HIGH ? MOS_ON : MOS_OFF;
			}
		}

		if (comp->state.mos != new_state) {
			comp->state.mos = new_state;
			changed = 1;
		}
	}

	return changed;
}

// conduct between two nodes, weak value is one to propagate weakly
int conduct(Node *a, Node *b, ComponentType type) {
	// unknown values stop propagation instantly
	if (a->val == NODE_UNKNOWN || b->val == NODE_UNKNOWN)
		return 0;

	// compute values A could compute to B, and viceversa
	NodeValue AToB = a->val;
	NodeValue BToA = b->val;
	switch (type) {
	case COMPONENT_NMOS:
		if (a->val == NODE_HIGH)
			AToB = NODE_HIGH_WEAK;
		if (b->val == NODE_HIGH)
			BToA = NODE_HIGH_WEAK;
		break;

	case COMPONENT_PMOS:
		if (a->val == NODE_LOW)
			AToB = NODE_LOW_WEAK;
		if (b->val == NODE_LOW)
			BToA = NODE_LOW_WEAK;
		break;

	case COMPONENT_PULLUP:
		if (a->val == NODE_HIGH)
			AToB = NODE_HIGH_WEAK;
		if (b->val == NODE_HIGH)
			BToA = NODE_HIGH_WEAK;
		break;

	case COMPONENT_PULLDOWN:
		if (a->val == NODE_LOW)
			AToB = NODE_LOW_WEAK;
		if (b->val == NODE_LOW)
			BToA = NODE_LOW_WEAK;
		break;

	default: // ideal connection
		break;
	}

	// propagate instantly to HiZ
	if (b->val == NODE_FLOATING) {
		b->val = AToB;
		return 1;
	}
	if (a->val == NODE_FLOATING) {
		a->val = BToA;
		return 1;
	}

	// precompute logic values and strength
	NodeLogic aLogic = toLogic(a->val);
	NodeLogic bLogic = toLogic(b->val);
	NodeStrength aStrength = toStrength(a->val);
	NodeStrength bStrength = toStrength(b->val);

	// same logic values, propagate only if possible and not already done
	if (aLogic == bLogic) {
		if (aStrength > bStrength && b->val != AToB) {
			b->val = AToB;
			return 1;
		}

		if (bStrength > aStrength && a->val != BToA) {
			a->val = BToA;
			return 1;
		}

		return 0;
	}

	// compare effective strengths after accounting for propagation
	NodeStrength aEffective = toStrength(AToB);
	NodeStrength bEffective = toStrength(BToA);

	// on contention, set both values to unknown
	if (aEffective == bEffective) {
		a->val = b->val = NODE_UNKNOWN;
		return 1;
	}

	// different logic values, propagate only if possible and not already done
	if (aEffective > bEffective && b->val != AToB) {
		b->val = AToB;
		return 1;
	}
	if (bEffective > aEffective && a->val != BToA) {
		a->val = BToA;
		return 1;
	}

	return 0;
}

// transfers signals between source and drain according to transistor state,
// checking for contention
int propagateMosChannel(Node *source, Node *drain, MOSState state,
						ComponentType mos) {
	// if MOS state is off, don't appply conduction rules
	if (state == MOS_OFF)
		return 0;

	int changed = 0;

	// if MOS state is unknown, the idea would be to mark channel ends as
	// unknown but this has the problem of forcing sources to unknown;
	// we instead do nothing
	if (state == MOS_UNKNOWN)
		return 0;

	// MOS is on, conduct
	return conduct(source, drain, mos);
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
		MOSState state = comp->state.mos;

		changed |= propagateMosChannel(source, drain, state, comp->type);
	}

	return changed;
}

// propagates signals across all dipoles in the circuit
int propagateDipoles(Circuit *circ) {
	int changed = 0;

	for (size_t i = 0; i < circ->component_count; i++) {
		Component *comp = circ->components[i];

		if (comp->type != COMPONENT_PORT && comp->type != COMPONENT_PULLUP &&
			comp->type != COMPONENT_PULLDOWN)
			continue;

		Node *in = &circ->nodes[comp->nodes[IN]];
		Node *out = &circ->nodes[comp->nodes[OUT]];

		changed |= conduct(in, out, comp->type);
	}

	return changed;
}

int simulate(Circuit *circ) {
	forceValues(circ);

	for (size_t i = 0; i < MAX_SIM_ITERS; i++) {
		int changed = 0;

		changed |= updateMosGates(circ);
		changed |= propagateMosChannels(circ);
		changed |= propagateDipoles(circ);
		forceValues(circ);

		if (!changed)
			return 1; // converged
	}

	return 0; // did not converge
}
