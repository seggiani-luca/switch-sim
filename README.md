# switch-sim

An interactive switch-level digital circuit simulator running entirely in the browser. 
Powered by a C simulator compiled to [WASM](https://webassembly.org/) and an interactive schematic editor.

Conventional simulators either:
- Model logic gates as abstract boolean functions, focusing on the digital logic side of things;
- Model transistors in a physically accurate way, solving differential equations which become way too clunky for big circuits.
 **switch-sim** sits in-between, modeling digital circuits at the transistor level using CMOS switches (NMOS and PMOS MOSFETs), signal strength degradation, high-impedance states, and bus contention.

## Features

- **Transistor-level simulation**: logic gates and sequential circuits are built directly from CMOS or passgate primitives: PMOS and NMOS transistors, pull-up/pull-down resistors, power supplies, and grounds;
- **6-valued logic**: resolvee signal logic and drive strength with **High**, **Low**, **Weak High**, **Weak Low**, **Floating** and **Unknown** values;
- **Hierarchical subcircuits**: any circuit with named I/O ports can be packaged into a recursive **IC** (*Integrated Circuit*) block, with an observable internal state;
- **Interactive schematic editor**: allows for SVG circuit drawing and rendering, and interactive pin switching;
- **Serialization format**: exports and imports circuits as clean, human-readable JSON files.

An included library includes pre-built CMOS gates (`NOT`, `NAND`, `NOR`, ...) ready to place.

## Signal States & Color Coding

| State | Logic Level | Drive Strength | Wire Color | Description |
|---|---|---|---|---|
| `NODE_HIGH` | High ($1$) | Full | 🟢 Green (`#2ecc71`) | Direct connection to voltage source ($V_{DD}$) |
| `NODE_HIGH_WEAK` | High ($1$) | Weak | 🟢 Dark Green (`#0e7c41`) | Pulled high via resistor or passed through NMOS |
| `NODE_LOW` | Low ($0$) | Full | 🔴 Red (`#e74c3c`) | Direct connection to Ground ($GND$) |
| `NODE_LOW_WEAK` | Low ($0$) | Weak | 🔴 Dark Red (`#972c0c`) | Pulled low via resistor or passed through PMOS |
| `NODE_FLOATING` | Hi-Z | None | 🟡 Yellow (`#f1c40f`) | Disconnected / high-impedance net |
| `NODE_UNKNOWN` | Unknown | Contention | ⚪ Gray (`#cccccc`) | Signal contention or undetermined logic level |

## Controls & Keyboard Shortcuts

### Editor Tools

| Shortcut | Tool | Description |
|---|---|---|
| <kbd>w</kbd> | **Wire** | Draw interconnecting wires. Click once to begin, click again to end. Automatically splits intersected wires. |
| <kbd>m</kbd> | **Move** | Click and drag any component, wire, port, or subcircuit on the canvas. |
| <kbd>d</kbd> | **Delete** | Click on any element (component, wire segment, port, or subcircuit) to remove it. |
| <kbd>Shift</kbd> + <kbd>p</kbd> | **Port** | Opens a modal to place a named `Input` or `Output` port. |
| <kbd>f</kbd> | **Fiddle** | **Interactive mode**: Click an input port to toggle its state ($0 \leftrightarrow 1$). Click a subcircuit IC to enter and inspect its internal schematic. |
| <kbd>s</kbd> | **Subcircuit** | Import any saved `.json` circuit file and place it on the canvas as an IC block. |
| <kbd>Esc</kbd> | **Cancel / Back** | Cancels the active dragging/drawing action, or navigates up one level in the subcircuit hierarchy. |

### Circuit Components

| Shortcut | Component | Description |
|---|---|---|
| <kbd>p</kbd> | **PMOS** | p-channel MOSFET. Conducts when gate is `LOW`. Source: $(+1, +1)$, Gate: $(-1, 0)$, Drain: $(+1, -1)$. |
| <kbd>n</kbd> | **NMOS** | n-channel MOSFET. Conducts when gate is `HIGH`. Source: $(+1, -1)$, Gate: $(-1, 0)$, Drain: $(+1, +1)$. |
| <kbd>v</kbd> | **Source** | 5V constant voltage supply ($V_{DD}$ / Logic 1). |
| <kbd>g</kbd> | **Ground** | Ground chassis terminal (0V / Logic 0). |
| <kbd>r</kbd> | **Resistor** | Automatically detected as a pull-up or pull-down resistor based on its net connectivity. |

## Architecture

The project is split into two primary layers:

```
switch-sim/
├── src/                      # C Simulation Engine
│   ├── export.h              # Emscripten export declarations
│   ├── netlist/              # In-memory netlist data structures
│   │   ├── netlist.h
│   │   └── netlist.c
│   └── simulation/           # Switch-level relaxation solver
│       ├── simulation.h
│       └── simulation.c
├── static/                   # Web Application
│   ├── index.html            # Main UI shell
│   ├── favicon.svg
│   ├── css/
│   │   └── styles.css        # UI styling & color definitions
│   ├── js/
│   │   ├── app.js            # App lifecycle and event wiring
│   │   ├── model/
│   │   │   └── circuit.js    # Canvas circuit model and geometry
│   │   ├── interface/
│   │   │   ├── editor.js     # Editing tools and event dispatch
│   │   │   └── renderer.js   # SVG drawing and icon rendering
│   │   └── simulation/
│   │       ├── simulator.js  # WASM wrapper and C API bindings
│   │       └── netlist.js    # Net connectivity extraction & netlist compiler
│   ├── lib/                  # Predefined IC library
│   │   ├── not.json
│   │   ├── nand.json
│   │   ├── nor.json
│   │   ├── index.py          # Catalog index generator
│   │   └── index.json
│   └── wasm/                 # Compiled WebAssembly binary & JS glue
│       ├── simulatorWasm.wasm
│       └── simulatorWasm.js
├── Makefile                  # Build orchestration
└── eslint.config.js          # Linter configuration
```

### How the Simulation Works

1. **Net extraction**: when a schematic changes, `netlist.js` performs a flood-fill traversal across connected wire coordinates to cluster wire segments into discrete electrical nets;
2. **WASM compilation**: the frontend instantiates a C `Circuit` in WASM memory via `simulator.js`, mapping all schematic elements (MOS transistors, resistors, supply rails, and subcircuit port couplings) to C nodes and component descriptors;
3. **Switch-level relaxation algorithm**: this happens in steps.
   - Fixed power rails (`COMPONENT_SOURCE` and `COMPONENT_GROUND`) are driven to their nodes;
   - MOS transistor gate voltages are evaluated to set channel states (`MOS_ON`, `MOS_OFF`, or `MOS_UNKNOWN`);
   - Channels and dipoles propagate signals bidirectionally between source and drain according to transistor conduction and strength rules;
   - Strong drivers override weak drivers; conflicting drivers of identical strength resolve to `NODE_UNKNOWN`;
   - The loop iterates until the network reaches a steady state (relaxation convergence) or hits `MAX_SIM_ITERS` (1000).
4. **State writeback**: node voltages are queried across the WASM boundary and mapped back onto the schematic wires, updating line colors and port LEDs in SVG.

## Getting Started

### Prerequisites

- [Emscripten SDK](https://emscripten.org/) (`emcc`) — required to compile C source code to WebAssembly;
- [Python 3](https://www.python.org/) — required for running the local HTTP server and building the library index;
- A *browser* (duh?).

### Building & Running

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/switch-sim.git
   cd switch-sim
   ```

2. **Compile WebAssembly & Build component library**:
   ```bash
   make
   ```
   This invokes `emcc` to produce `static/wasm/simulatorWasm.wasm` and `static/wasm/simulatorWasm.js`, and runs `index.py` to index the standard gate library.

3. **Start the server**:
   ```bash
   make serve
   ```
   This starts a local Python HTTP server serving the `static/` directory.

4. **Open in browser**:
   navigate to [http://localhost:8000](http://localhost:8000) in any modern browser supporting WASM and ES Modules.

## Additional Make Targets

- `make wasm`: Recompiles only the C source files into WebAssembly;
- `make index`: Regenerates `static/lib/index.json` from JSON files in `static/lib/`;
- `make clean`: Deletes the generated `static/wasm/` directory;
- `make format`: Formats JS, HTML, and CSS files using `prettier`, and C/H files using `clang-format`.

## Circuit File Format

Circuits are saved as plain JSON objects.
Below is the structure:

```json
{
  "name": "NOT",
  "description": "CMOS inverting gate",
  "components": [
    { "type": "pmos", "x": 15, "y": 9 },
    { "type": "nmos", "x": 15, "y": 15 },
    { "type": "ground", "x": 16, "y": 18 },
    { "type": "source", "x": 16, "y": 6 }
  ],
  "wires": [
    { "x1": 10, "y1": 12, "x2": 12, "y2": 12 }
  ],
  "ports": [
    { "name": "IN", "direction": "input", "x": 8, "y": 12 },
    { "name": "OUT", "direction": "output", "x": 20, "y": 12 }
  ],
  "subcircuits": []
}
```

Any circuit containing input and output ports can be imported into another circuit as an IC block via the **Subcircuit** tool or placed directly from the sidebar library.
