# switch-sim

An interactive switch-level digital circuit simulator running entirely in the browser.
Try it live [here](https://seggiani-luca.github.io/switch-sim/)!
Powered by a C simulation engine compiled to [WebAssembly](https://webassembly.org/) and an interactive SVG schematic editor.

Conventional simulators typically fall into one of two extremes:
- **Gate-level simulators**: Model logic gates as abstract boolean functions, abstracting away physical transistor dynamics, impedance, and bidirectional signal flow.
- **SPICE-level simulators**: Model transistors via continuous differential equations, which are physically accurate but computationally heavy and unwieldy for large digital designs.

**switch-sim** bridges this gap. It models digital systems at the switch level using CMOS primitives (NMOS and PMOS transistors), explicit drive strengths, capacitive charge retention, signal degradation across imperfect switches, and bus contention.

---

## Features

- **Switch-Level Simulation**: Build circuits directly from transistor primitives: PMOS and NMOS MOSFETs, pull-up and pull-down resistors, constant voltage sources ($V_{DD}$), and grounds ($GND$).
- **Decoupled Value & Strength Modeling**: Clean separation between logical voltage values (`VALUE_L`, `VALUE_H`, `VALUE_X`) and discrete electrical drive strengths (`STRENGTH_DRIVEN`, `STRENGTH_NORMAL`, `STRENGTH_PULLED`, `STRENGTH_CHARGE`).
- **Physical Conduction & Threshold Degradation**: Real-world switch behaviors are modeled natively: NMOS transistors pass weak logic high ($V_{DD} - V_{th}$), PMOS transistors pass weak logic low ($|V_{tp}|$), and resistors pull with intermediate strength.
- **State Retention & Sequential Networks**: Charge decay and capacitive storage (`STRENGTH_CHARGE`) allow dynamic memory and static cross-coupled feedback to retain state, enabling simulation of latches, edge-triggered flip-flops, registers, counters, and memory cells.
- **Hierarchical Subcircuits**: Any schematic with named I/O ports can be packaged into an Integrated Circuit (**IC**) block, nested recursively, and inspected in-place.
- **Extensive Standard Library**: Includes over 30 pre-built ICs across arithmetic, encoders, decoders, latches, flip-flops, and pass-transistor logic.
- **Interactive Schematic Editor**: Smooth vector SVG canvas featuring live signal color-coding, wire splitting, crossover jumps, interactive pin toggling, and JSON import/export.

---

## Signal Model & Color Coding

Every node in the circuit holds a **Logic Value** and an electrical **Drive Strength**:

### Logic Values (`NodeValue`)
- `VALUE_L` ($0$): Low voltage / Ground.
- `VALUE_H` ($1$): High voltage / $V_{DD}$.
- `VALUE_X` ($X$): Unknown logic level or signal contention (opposing drivers fighting).

### Drive Strengths (`NodeStrength`)
Signals resolve hierarchically according to a 4-level strength ladder:

| Strength | Level | Typical Origin | Description |
|---|---|---|---|
| `STRENGTH_DRIVEN` | 4 | $V_{DD}$ Source, $GND$ Ground | Infinite-capacity ideal power rails. Cannot be overpowered. |
| `STRENGTH_NORMAL` | 3 | Active CMOS Channels | Full-strength conduction through an unobstructed transistor (NMOS pulling low, PMOS pulling high). |
| `STRENGTH_PULLED` | 2 | Pull-Up / Pull-Down Resistors | Intermediate resistive drive strength. Overpowers stored charge, but yields to active CMOS drivers. |
| `STRENGTH_CHARGE` | 1 | Stored Charge / Degraded Passes | Residual capacitive charge on floating nodes, or degraded logic passed through an imperfect switch (NMOS passing high, PMOS passing low). |

### Wire Color Coding

The canvas renders wire segments according to their resolved logic level and drive strength:

| State | Logic Level | Drive Strength | Wire Color | Visual Preview |
|---|---|---|---|---|
| **Full Low** | Low ($0$) | `DRIVEN` / `NORMAL` / `PULLED` | `#e74c3c` | 🔴 Bright Red |
| **Weak Low** | Low ($0$) | `CHARGE` (Stored / Degraded) | `#972c0c` | 🔴 Dark Red |
| **Full High** | High ($1$) | `DRIVEN` / `NORMAL` / `PULLED` | `#2ecc71` | 🟢 Bright Green |
| **Weak High** | High ($1$) | `CHARGE` (Stored / Degraded) | `#0e7c41` | 🟢 Dark Green |
| **Contention / Unknown** | Unknown ($X$) | Any | `#cccccc` | ⚪ Light Gray |

---

## Conduction & Propagation Rules

Signal propagation through channels and dipoles follows strict physical rules:

1. **Threshold Degradation**:
   - An **NMOS** conducting `VALUE_L` passes it at up to `STRENGTH_NORMAL` (strong 0).
   - An **NMOS** conducting `VALUE_H` suffers a threshold drop ($V_{DD} - V_{th}$) and degrades to `STRENGTH_CHARGE` (weak 1).
   - A **PMOS** conducting `VALUE_H` passes it at up to `STRENGTH_NORMAL` (strong 1).
   - A **PMOS** conducting `VALUE_L` suffers a threshold drop ($|V_{tp}|$) and degrades to `STRENGTH_CHARGE` (weak 0).
   - A **Pull-Up Resistor** pulls high at `STRENGTH_PULLED`, but passes low at `STRENGTH_CHARGE`.
   - A **Pull-Down Resistor** pulls low at `STRENGTH_PULLED`, but passes high at `STRENGTH_CHARGE`.

2. **Conduction Resolution**:
   - **Matching Values**: Signals reinforce each other; the higher strength propagates to the weaker node.
   - **Opposing Values (Overpowering)**: The higher effective strength overwrites the lower strength (e.g. an active `STRENGTH_NORMAL` driver easily overpowers residual `STRENGTH_CHARGE` or `STRENGTH_PULLED`).
   - **Opposing Values (Contention)**: Two opposing signals of equal effective strength cannot resolve, causing contention $\to$ both nodes burn and resolve to `VALUE_X`.

---

## How Simulation Works

Simulation is executed via a two-phase relaxation solver in C:

```
                  ┌──────────────────────────────┐
                  │      forceValues()           │
                  │  (Drive VDD/GND rails)       │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │    propagatePorts()          │
                  │  (Initial port settling)     │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │    updateMosGates()          │
                  │  (Initial gate evaluation)   │
                  └──────────────┬───────────────┘
                                 │
         ┌───────────────────────┴───────────────────────┐
         ▼                                               │
┌──────────────────────────────┐                         │
│   resetPropagation()         │                         │
│ (Demote NORMAL -> CHARGE)    │                         │
└──────────────┬───────────────┘                         │
               │                                         │
               ▼                                         │
┌──────────────────────────────┐                         │
│  Inner Propagation Loop:     │                         │
│  - propagateMosChannels()    │◄────────┐               │
│  - propagatePorts()          │         │ (Up to 100    │
│  - propagateDipoles()        │─────────┘  sub-steps)   │
└──────────────┬───────────────┘                         │
               │                                         │
               ▼                                         │
┌──────────────────────────────┐                         │ (Up to 1000
│   updateMosGates()           │                         │  iterations)
│ (Re-evaluate MOS conduction) │                         │
└──────────────┬───────────────┘                         │
               │                                         │
       Gates changed?                                    │
        ├── Yes ─────────────────────────────────────────┘
        └── No (Converged!)
               │
               ▼
   [Write back states to SVG]
```

### State Retention in Sequential Logic

1. **Charge Demotion (`resetPropagation`)**: At the start of each relaxation cycle, nodes holding `STRENGTH_NORMAL` from the previous step are demoted to `STRENGTH_CHARGE`. They preserve their logical state ($0$ or $1$) as dynamic capacitive charge.
2. **Sequential Memory**: In cross-coupled latches (e.g. SR latches or D flip-flops), stored charge on gate capacitances maintains transistor conduction, which actively regenerates `STRENGTH_NORMAL` on each step.
3. **Overwriting State**: When new inputs arrive (such as a clock edge or reset pulse), active drivers (`STRENGTH_NORMAL`) overpower stored weak charges (`STRENGTH_CHARGE`) cleanly without false contention.
4. **Schematic State Persistence**: When the schematic is modified or recompiled, `netlist.js` preserves existing wire states (`wire.value`) across compilation boundaries via `sim.setNodeValue()`, ensuring circuits do not reset when drawing or moving components.

---

## Controls & Keyboard Shortcuts

### Editor Tools

| Shortcut | Tool | Description |
|---|---|---|
| <kbd>w</kbd> | **Wire** | Draw interconnecting wires. Click once to begin, click again to end. Automatically splits intersected wires. |
| <kbd>m</kbd> | **Move** | Drag components, wires, ports, or subcircuit blocks across the grid. |
| <kbd>d</kbd> | **Delete** | Click any element (transistor, wire segment, port, or IC) to delete it. |
| <kbd>Shift</kbd> + <kbd>p</kbd> | **Port** | Open a dialog to place a named `Input` or `Output` port. |
| <kbd>f</kbd> | **Fiddle** | **Interactive mode**: Click an input port to toggle its state ($0 \leftrightarrow 1$). Click a subcircuit IC block to enter and inspect its internal schematic. |
| <kbd>s</kbd> | **Subcircuit** | Import an external `.json` circuit file and place it on the canvas as an IC block. |
| <kbd>Esc</kbd> | **Cancel / Back** | Cancel active dragging/drawing, or navigate up one level in the subcircuit hierarchy. |

### Circuit Components

| Shortcut | Component | Description |
|---|---|---|
| <kbd>p</kbd> | **PMOS** | p-channel MOSFET. Conducts when gate is `LOW`. Terminals: Source $(+1, +1)$, Gate $(-1, 0)$, Drain $(+1, -1)$. |
| <kbd>n</kbd> | **NMOS** | n-channel MOSFET. Conducts when gate is `HIGH`. Terminals: Source $(+1, -1)$, Gate $(-1, 0)$, Drain $(+1, +1)$. |
| <kbd>v</kbd> | **Source** | Constant $+5\text{V}$ voltage supply ($V_{DD}$ / Logic 1). |
| <kbd>g</kbd> | **Ground** | Constant $0\text{V}$ ground reference ($GND$ / Logic 0). |
| <kbd>r</kbd> | **Resistor** | Passive resistor. Automatically detected as pull-up or pull-down based on its terminal connections. |

---

## Standard Component Library

The built-in library (`static/lib/`) contains categorized, ready-to-place subcircuits:

- **CMOS Logic**: `NOT`, `NAND`, `NAND-3`, `NOR`, `AND`, `OR`, `Tristate NOT`.
- **Passgate Logic**: Multiplexers (`2:1`, `4:1`, `8:1`), Demultiplexers (`1:2`, `1:4`, `1:8`), `XOR`, `XNOR`, Transmission Gate.
- **Latches**: `SR Latch` (NOR-based and NAND-based), `Gated SR Latch`, `D Latch`.
- **Flip-Flops**: Master-Slave `D Flip-Flop`, Edge-Triggered `7474 D Flip-Flop`, `JK Flip-Flop`, `T Flip-Flop`.
- **Arithmetic**: `Half Adder`, `Full Adder`, `2-bit Adder`, `4-bit Adder`, `8-bit Adder`, `BCD Incrementer`.
- **Encoders & Decoders**: Encoders (`2:1`, `4:2`, `8:3`), Decoders (`1:2`, `1:4`, `1:8`).

---

## Project Structure

```
switch-sim/
├── src/                      # C Simulation Engine
│   ├── export.h              # WebAssembly symbol export macros
│   ├── log/                  # Diagnostic event logging
│   │   ├── log.h
│   │   └── log.c
│   ├── netlist/              # In-memory circuit graph & components
│   │   ├── netlist.h
│   │   └── netlist.c
│   └── simulation/           # Switch-level relaxation solver & conduction
│       ├── simulation.h
│       └── simulation.c
├── static/                   # Web Application
│   ├── index.html            # UI markup and dialogs
│   ├── favicon.svg
│   ├── css/
│   │   └── styles.css        # Canvas and layout styling
│   ├── js/
│   │   ├── app.js            # App lifecycle and event wiring
│   │   ├── model/
│   │   │   └── circuit.js    # Circuit data model, geometry, serialization
│   │   ├── interface/
│   │   │   ├── editor.js     # Tool state machine and input handlers
│   │   │   └── renderer.js   # SVG canvas renderer and icon drawing
│   │   └── simulation/
│   │       ├── simulator.js  # WASM JavaScript wrapper and memory marshalling
│   │       └── netlist.js    # Net extraction and WASM netlist compiler
│   ├── lib/                  # Pre-built standard component library
│   │   ├── cmos/             # CMOS arithmetic, logic, latches, flip-flops
│   │   ├── passgate/         # Transmission-gate MUX, DEMUX, and logic
│   │   ├── index.py          # Library catalog index generator
│   │   └── index.json
│   └── wasm/                 # Compiled WebAssembly binary & JS glue
│       ├── simulatorWasm.wasm
│       └── simulatorWasm.js
├── Makefile                  # Build orchestration
└── eslint.config.js          # ESLint configuration
```

---

## Getting Started

### Prerequisites

- [Emscripten SDK](https://emscripten.org/) (`emcc`) — required to compile C code into WebAssembly.
- [Python 3](https://www.python.org/) — for catalog indexing and serving the local development server.

### Building & Running

1. **Clone the repository**:
   ```bash
   git clone https://github.com/seggiani-luca/switch-sim.git
   cd switch-sim
   ```

2. **Compile WebAssembly & Generate Library Index**:
   ```bash
   make
   ```
   This compiles `src/**/*.c` into `static/wasm/simulatorWasm.wasm` and `static/wasm/simulatorWasm.js`, then runs `index.py` to index the library components.

3. **Launch the development server**:
   ```bash
   make serve
   ```

4. **Open in your browser**:
   Navigate to [http://localhost:8000](http://localhost:8000).

### Make Targets

- `make wasm`: Recompiles the C simulator engine to WebAssembly.
- `make index`: Regenerates `static/lib/index.json` from JSON files in the library.
- `make serve`: Starts a local HTTP server serving the `static/` directory.
- `make clean`: Removes generated WASM output files.
- `make format`: Auto-formats code (`clang-format` for C/H, `prettier` for JS/CSS/HTML).

---

## Circuit File Format

Circuits are stored as human-readable JSON files:

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

Any circuit with input and output ports can be imported as an IC block into other circuits, supporting arbitrary hierarchical composition.
