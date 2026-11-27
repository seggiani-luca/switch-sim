#ifndef SIMULATION_H
#define SIMULATION_H

#include "../export.h"
#include "../netlist/netlist.h"

// maximum simulation iterations
#define MAX_SIM_ITERS 1000

// maximum MOS flip before lockstep is assumed
#define LOCKSTEP_FLIPS 6

// maximum propagation steps per iteration
#define MAX_PROP_STEPS 100

// port propagation depth
#define PORT_PROP_STEPS 100

// simulates switch-level propagation until circuit reaches steady state
EXPORT int simulate(Circuit *circ);

// gets iterations taken by last simulate call
EXPORT int getSimIters();

// enum for simulation ending state
typedef enum {
	CONVERGENCE = 0, // circuit converged to solution
	OVERFLOW    = 1, // circuit didn't reach solution in given steps
	OSCILLATION = 2  // circuit entered oscillation
} SimState;

// gets ending state
EXPORT SimState getSimState();

#endif
