#ifndef SIMULATION_H
#define SIMULATION_H

#include "../export.h"
#include "../netlist/netlist.h"

// maximum simulation iterations
#define MAX_SIM_ITERS 1000

// simulates switch-level propagation until circuit reaches steady state
EXPORT int simulate(Circuit *circ);

#endif
