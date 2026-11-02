#ifndef SIMULATION_H
#define SIMULATION_H

#include "../export.h"
#include "../netlist/netlist.h"

// maximum simulation iterations
#define MAX_SIM_ITERS 1000

// maximum propagation steps per iteration
#define MAX_PROP_STEPS 100

// port propagation depth
#define PORT_PROP_STEPS 100

// simulates switch-level propagation until circuit reaches steady state
EXPORT int simulate(Circuit *circ);

#endif
