# switch-sim: Architecture Overview & Audit Report

## 1. Project Overview & Architecture

`switch-sim` is an in-browser switch-level circuit simulator with schematic capture. The architecture is split cleanly across two main boundaries:

1. **C Engine (Compiled to WebAssembly via Emscripten)**
   - [`netlist.h`](file:///home/luca/Desktop/switch-sim/src/netlist/netlist.h) / [`netlist.c`](file:///home/luca/Desktop/switch-sim/src/netlist/netlist.c): Core graph representation. Manages nodes (`Node`, `NodeId`) and 5 primitive components: `COMPONENT_SOURCE` (VDD), `COMPONENT_GROUND` (GND), `COMPONENT_PMOS`, `COMPONENT_NMOS`, and `COMPONENT_PORT` (ideal connection).
   - [`simulation.h`](file:///home/luca/Desktop/switch-sim/src/simulation/simulation.h) / [`simulation.c`](file:///home/luca/Desktop/switch-sim/src/simulation/simulation.c): Relaxation-based switch-level simulation. Iteratively executes [`updateMosGates`](file:///home/luca/Desktop/switch-sim/src/simulation/simulation.c#L22), [`propagateMosChannels`](file:///home/luca/Desktop/switch-sim/src/simulation/simulation.c#L134), and [`propagatePorts`](file:///home/luca/Desktop/switch-sim/src/simulation/simulation.c#L154) until steady state or iteration limit.

2. **JavaScript Frontend (ES6 Modules + SVG)**
   - [`Circuit`](file:///home/luca/Desktop/switch-sim/static/js/model/circuit.js#L73): In-memory geometric circuit representation (components, wire coordinates, ports, and subcircuits). Handles JSON serialization and SHA-256 canonical hashing.
   - [`labelNodes`](file:///home/luca/Desktop/switch-sim/static/js/simulation/netlist.js#L15) & [`compileCircuit`](file:///home/luca/Desktop/switch-sim/static/js/simulation/netlist.js#L78): Extracts topological electrical nets from wire line segments and compiles them to WASM simulator structures.
   - [`Simulator`](file:///home/luca/Desktop/switch-sim/static/js/simulation/simulator.js#L27): Thin wrapper interfacing with the WASM exports.
   - [`Renderer`](file:///home/luca/Desktop/switch-sim/static/js/interface/renderer.js#L96) & [`Editor`](file:///home/luca/Desktop/switch-sim/static/js/interface/editor.js#L61): SVG drawing, tool state machine, grid snapping, hierarchy navigation, and interactive port toggling.

---

## 2. Critical Bugs (High Impact / Program Incorrectness)

### Bug 1: T-Junction Wire Disconnection during Net Extraction
- **Location**: [`static/js/simulation/netlist.js:15-44`](file:///home/luca/Desktop/switch-sim/static/js/simulation/netlist.js#L15-L44)
- **Problem**:
  In [`labelNodes`](file:///home/luca/Desktop/switch-sim/static/js/simulation/netlist.js#L15), wire graph traversal checks for touching wires *only* at the current wire's two endpoints:
  ```javascript
  for (const [x, y] of [
      [current.x1, current.y1],
      [current.x2, current.y2],
  ]) {
      for (const wire of circuit.hasWires(x, y, current)) { ... }
  }
  ```
  If a horizontal wire $W_1$ runs from $(0, 0)$ to $(10, 0)$, and two branch wires $W_2$ and $W_3$ connect to its interior (e.g. at $(2, 0)$ and $(8, 0)$), $W_1$ does not check its interior. If $W_1$ is processed first, $W_2$ and $W_3$ are not reached during $W_1$'s DFS. When $W_2$ and $W_3$ are subsequently labeled, each gets a separate net ID (`connected:0`, `connected:1`, `connected:2`).
- **Consequence**: Physical T-junctions, wire buses, and branches do not connect electrically. Components attached to branches are simulated on disconnected nets.
- **Fix**:
  When checking neighbors of `current`, also query for any wires whose endpoints lie anywhere along `current` (e.g., query `circuit.pointOnWire(other.x1, other.y1, current)` and `circuit.pointOnWire(other.x2, other.y2, current)`), or automatically split wires at all intersection points upon placement and loading.

---

### Bug 2: Unbounded WASM Heap Memory Leak
- **Location**: [`static/js/app.js:203-213`](file:///home/luca/Desktop/switch-sim/static/js/app.js#L203-L213), [`static/js/simulation/netlist.js:194-202`](file:///home/luca/Desktop/switch-sim/static/js/simulation/netlist.js#L194-L202)
- **Problem**:
  Whenever the circuit changes, [`compileNetlist`](file:///home/luca/Desktop/switch-sim/static/js/simulation/netlist.js#L194) is invoked:
  ```javascript
  circ.onChange(() => {
      const sim = compileNetlist(circ); // allocates new Simulator
      sim.simulate();
      updateWires(sim, circ);
      renderer.render(editor.circuit);
      // sim is discarded; sim.free() is never called!
  });
  ```
  Each `new Simulator()` calls `Wasm._circuitNew()`, allocating C heap memory for `Circuit`, `Node[]`, `Component[]`, terminal buffers, and strings via `strdup`.
  Because `moveObject` fires `changed()` on **every mousemove event** while dragging, dragging a component across the canvas allocates hundreds of C circuits in seconds without freeing any of them.
- **Consequence**: WASM memory leaks continuously until out-of-memory or significant page slowdown occurs.
- **Fix**:
  Call `sim.free()` in `circ.onChange` immediately after `updateWires(sim, circ)`, ideally inside a `try ... finally` block:
  ```javascript
  circ.onChange(() => {
      const sim = compileNetlist(circ);
      try {
          sim.simulate();
          updateWires(sim, circ);
      } finally {
          sim.free();
      }
      renderer.render(editor.circuit);
  });
  ```

---

### Bug 3: Subcircuit Instance Aliasing & Shared In-Memory Reference
- **Location**: [`static/js/app.js:48-87`](file:///home/luca/Desktop/switch-sim/static/js/app.js#L48-L87), [`static/js/model/circuit.js:362-396`](file:///home/luca/Desktop/switch-sim/static/js/model/circuit.js#L362-L396)
- **Problem**:
  In [`populateLibrary`](file:///home/luca/Desktop/switch-sim/static/js/app.js#L48), subcircuits are deserialized once:
  ```javascript
  const sub = new Circuit();
  sub.fromJSON(data);
  button.addEventListener("click", () => editor.setLibraryTool(sub, sub.name));
  ```
  Every time a user places that component, `subcircuit.internal` is assigned the exact same `sub` instance.
  When two instances of the same subcircuit (e.g. `NOT1` and `NOT2`) are placed:
  1. Both instances share `subcircuit.internal`.
  2. In [`compileCircuit`](file:///home/luca/Desktop/switch-sim/static/js/simulation/netlist.js#L78), `wire.node` is assigned directly to the wires of `internal`. The second instance overwrites `wire.node` on the first instance.
  3. In [`updateWires`](file:///home/luca/Desktop/switch-sim/static/js/simulation/netlist.js#L169), both instances read from the same wires, displaying only the second instance's state.
  4. Editing one instance in the Fiddle tool mutates all other instances.
- **Consequence**: Multiple instances of the same subcircuit interfere with each other and corrupt visual/simulation state.
- **Fix**:
  Deep-clone or deserialize a fresh instance of `Circuit` whenever a subcircuit is placed:
  ```javascript
  editor.setLibraryTool(() => {
      const clone = new Circuit();
      clone.fromJSON(data);
      return clone;
  }, sub.name);
  ```

---

### Bug 4: Power Rail Destruction on Contention / Short Circuit
- **Location**: [`src/simulation/simulation.c:56-112`](file:///home/luca/Desktop/switch-sim/src/simulation/simulation.c#L56-L112), [`src/simulation/simulation.c:172-187`](file:///home/luca/Desktop/switch-sim/src/simulation/simulation.c#L172-L187)
- **Problem**:
  [`forceValues(circ)`](file:///home/luca/Desktop/switch-sim/src/simulation/simulation.c#L4) sets sources to `NODE_HIGH` and grounds to `NODE_LOW` once before the loop begins.
  In [`conduct(Node *a, Node *b)`](file:///home/luca/Desktop/switch-sim/src/simulation/simulation.c#L56):
  ```c
  if ((a->val == NODE_HIGH && b->val == NODE_LOW) ||
      (a->val == NODE_LOW && b->val == NODE_HIGH)) {
      a->val = NODE_UNKNOWN;
      b->val = NODE_UNKNOWN;
      return changed;
  }
  ```
  If any node connected to `VDD` shorts to a node connected to `GND`, `conduct` sets the actual `VDD` or `GND` node to `NODE_UNKNOWN`.
  Because `forceValues` is not called inside the iteration loop, `VDD` or `GND` remains `NODE_UNKNOWN`.
  Additionally, line 58 states:
  ```c
  if (a->val == NODE_UNKNOWN || b->val == NODE_UNKNOWN)
      return 0;
  ```
  Once `VDD` or `GND` becomes `NODE_UNKNOWN`, it never conducts again with any other component.
- **Consequence**: A single short circuit in one part of the circuit permanently disables the entire power supply rail for all other gates in the schematic.
- **Fix**:
  - Constant supplies (Sources and Grounds) must either be re-asserted on every iteration (`forceValues` inside the loop) or marked with a dedicated driver strength flag so they are immutable during conduction.
  - Channels with contention should mark the downstream intermediate net as `NODE_UNKNOWN` without corrupting ideal power rails.

---

### Bug 5: Subcircuit Hierarchy Event Bubbling & UI Cancellation
- **Location**: [`static/js/app.js:203`](file:///home/luca/Desktop/switch-sim/static/js/app.js#L203), [`static/js/interface/editor.js:98-117`](file:///home/luca/Desktop/switch-sim/static/js/interface/editor.js#L98-L117)
- **Problem**:
  1. **Event Bubbling**: In [`app.js`](file:///home/luca/Desktop/switch-sim/static/js/app.js#L203), `circ.onChange(...)` is only registered on the root circuit. When a user inspects a subcircuit, `editor.circuit` points to `subcircuit.internal`. Calling `addComponent`, `removeWire`, etc., triggers `changed()` on `subcircuit.internal`, which has zero listeners. Nothing re-simulates or re-renders.
  2. **Palette Click Hierarchy Pop**: In [`editor.js:114`](file:///home/luca/Desktop/switch-sim/static/js/interface/editor.js#L114):
     ```javascript
     document.addEventListener("mousedown", (event) => {
         if (!this.renderer.svg.contains(event.target)) cancel();
     });
     ```
     Clicking any toolbar or palette button is outside `svg`, triggering `cancel()`. Inside `cancel()`, `this.renderStack.pop()` pops the user back up to the top circuit whenever they try to select a tool while inside a subcircuit.
- **Consequence**: The editor is unusable within subcircuits; edits fail to re-render, and clicking tools navigates away from the subcircuit.
- **Fix**:
  - Have child circuits notify their parent circuit when modified (or register `onChange` listeners dynamically on the active circuit).
  - Modify the mousedown listener in `editor.js` to avoid popping `renderStack` when clicking on toolbar/palette controls.

---

### Bug 6: False Crossover Arcs on Connected T-Junctions
- **Location**: [`static/js/model/circuit.js:231-261`](file:///home/luca/Desktop/switch-sim/static/js/model/circuit.js#L231-L261), [`static/js/interface/renderer.js:360-372`](file:///home/luca/Desktop/switch-sim/static/js/interface/renderer.js#L360-L372)
- **Problem**:
  In [`wireIntersection`](file:///home/luca/Desktop/switch-sim/static/js/model/circuit.js#L231):
  ```javascript
  // reject only endpoint <-> endpoint
  if ((t === 0 || t === 1) && (u === 0 || u === 1)) return null;
  ```
  When wire $B$ ends directly on wire $A$ (a connected T-junction), $u = 0$ (endpoint of $B$) and $0 < t < 1$ (interior of $A$).
  `wireIntersection` reports this as a crossing intersection. [`drawCrossovers`](file:///home/luca/Desktop/switch-sim/static/js/interface/renderer.js#L360) then draws a bridge crossover arc on top of the connection point.
- **Consequence**: Connected wires visually appear with a bypass hop, indicating they are disconnected when they are actually connected.
- **Fix**:
  Crossovers should only be drawn when both wire segments intersect strictly in their interior:
  ```javascript
  const eps = 1e-4;
  if (t <= eps || t >= 1 - eps || u <= eps || u >= 1 - eps) return null;
  ```

---

## 3. Simulation & Circuit Modeling Limitations

### Bug 7: Floating / Unknown Gates Handled as Completely OFF
- **Location**: [`src/simulation/simulation.c:116-131`](file:///home/luca/Desktop/switch-sim/src/simulation/simulation.c#L116-L131)
- **Problem**:
  When a transistor gate is floating (`NODE_HIZ`) or contentious (`NODE_UNKNOWN`), `updateMosGates` sets `MOSState` to `MOS_UNKNOWN`.
  However, in [`propagateMosChannel`](file:///home/luca/Desktop/switch-sim/src/simulation/simulation.c#L116):
  ```c
  if (state == MOS_UNKNOWN)
      return 0;
  ```
  The simulator treats unknown gates as strictly `MOS_OFF`.
- **Consequence**: An uninitialized or floating input silently blocks conduction rather than marking the driven output as `NODE_UNKNOWN`. Floating gate design errors are hidden from the user.

---

### Bug 8: Purely Combinational Relaxation (No Sequential State Across Steps)
- **Location**: [`static/js/simulation/netlist.js:194-202`](file:///home/luca/Desktop/switch-sim/static/js/simulation/netlist.js#L194-L202), [`src/netlist/netlist.c:59`](file:///home/luca/Desktop/switch-sim/src/netlist/netlist.c#L59)
- **Problem**:
  Every user change re-compiles the netlist into a brand-new `Circuit` where all non-source nodes start at `NODE_HIZ`.
  In addition, within a single `simulate()` run, nodes that become `HIGH` or `LOW` can never return to `NODE_HIZ`.
- **Consequence**: The simulator cannot model sequential circuits (latches, flip-flops, DRAM/SRAM cells, precharge dynamic logic). Cross-coupled inverters (latches) start with all internal gates at `NODE_HIZ` and converge immediately to all-HIZ without latching.

---

### Bug 9: Bidirectional Port Shorting & Drive Strengths
- **Location**: [`src/simulation/simulation.c:154-170`](file:///home/luca/Desktop/switch-sim/src/simulation/simulation.c#L154-L170), [`static/js/simulation/netlist.js:154-163`](file:///home/luca/Desktop/switch-sim/static/js/simulation/netlist.js#L154-L163)
- **Problem**:
  `COMPONENT_PORT` delegates directly to [`conduct(in, out)`](file:///home/luca/Desktop/switch-sim/src/simulation/simulation.c#L56). There is no distinction between signal input and output directions for subcircuit ports; they act as ideal bidirectional shorts.
  Furthermore, because all nodes have equal driving strength:
  - Input ports that are unconnected or toggled are converted to permanent Sources or Grounds on the top level.
  - In [`updateWires`](file:///home/luca/Desktop/switch-sim/static/js/simulation/netlist.js#L176), an input port without a connected wire has its value reset to `NODE_UNKNOWN`, preventing it from retaining a toggled state.

---

## 4. Editor, File I/O & Memory Safety Issues

### Bug 10: File Dialog Collisions & Detached Cloned Elements
- **Location**: [`static/js/app.js:123-141`](file:///home/luca/Desktop/switch-sim/static/js/app.js#L123-L141), [`static/js/interface/editor.js:371-406`](file:///home/luca/Desktop/switch-sim/static/js/interface/editor.js#L371-L406)
- **Problem**:
  Both the toolbar "Open" button and the "Subcircuit" tool bind `change` event listeners to the single hidden element `#open-file`.
  In both locations:
  ```javascript
  openFile.replaceWith(openFile.cloneNode(true));
  ```
  Replacing the node detaches it from the DOM, but subsequent references in outer closures continue referencing the detached DOM node. If a user opens the file picker and cancels, listeners accumulate.
- **Fix**: Create dedicated `<input type="file">` elements programmatically per action, or manage a single persistent input without replacing the node.

---

### Bug 11: `crypto.subtle` Undefined on Non-Secure Contexts (LAN HTTP)
- **Location**: [`static/js/model/circuit.js:88-111`](file:///home/luca/Desktop/switch-sim/static/js/model/circuit.js#L88-L111)
- **Problem**:
  `window.crypto.subtle` is restricted to Secure Contexts (`https://` and `localhost`).
  If this application is accessed over a local network IP (e.g. `http://192.168.1.50:8000`), `crypto.subtle` is `undefined`.
- **Consequence**: Calling [`circ.toJSON()`](file:///home/luca/Desktop/switch-sim/static/js/model/circuit.js#L441) calls [`hash()`](file:///home/luca/Desktop/switch-sim/static/js/model/circuit.js#L88), which throws an unhandled `TypeError: Cannot read properties of undefined (reading 'digest')`. Saving circuits fails completely.
- **Fix**: Fall back to a lightweight pure-JS hash (such as FNV-1a or SHA-256 in JS) when `crypto.subtle` is unavailable.

---

### Bug 12: Dead Code & Redundant Method Definitions
- **Locations**:
  - [`static/js/interface/renderer.js:360-386`](file:///home/luca/Desktop/switch-sim/static/js/interface/renderer.js#L360-L386): `drawCrossovers` is defined twice consecutively.
  - [`static/js/interface/renderer.js:238-268` & `328-358`](file:///home/luca/Desktop/switch-sim/static/js/interface/renderer.js#L238-L268): `drawPMOS`, `drawNMOS`, `drawSource`, and `drawGround` are defined twice as static methods on `Renderer`.
  - [`src/netlist/netlist.c:72, 78`](file:///home/luca/Desktop/switch-sim/src/netlist/netlist.c#L72): `if (id < 0 || id >= circ->node_count)` checks `id < 0` on `NodeId` (`size_t`), which is always false.

---

## 5. Priority Action Items Checklist

- [ ] **1. Fix Net Extraction DFS**: Update [`labelNodes`](file:///home/luca/Desktop/switch-sim/static/js/simulation/netlist.js#L15) to check interior T-junction points on wires so branched nets connect properly.
- [ ] **2. Plug WASM Memory Leak**: Add `sim.free()` to [`circ.onChange`](file:///home/luca/Desktop/switch-sim/static/js/app.js#L203) and suppress redundant compilations during dragging in [`setMoveTool`](file:///home/luca/Desktop/switch-sim/static/js/interface/editor.js#L194).
- [ ] **3. Deep-Clone Subcircuit Definitions**: Ensure [`addSubcircuit`](file:///home/luca/Desktop/switch-sim/static/js/model/circuit.js#L362) stores an independent copy of the circuit definition for each instance.
- [ ] **4. Protect Power Supply Rails**: Ensure [`conduct`](file:///home/luca/Desktop/switch-sim/src/simulation/simulation.c#L56) does not overwrite ideal `SOURCE` and `GROUND` nodes with `NODE_UNKNOWN`.
- [ ] **5. Fix Crossover Detection**: Change [`wireIntersection`](file:///home/luca/Desktop/switch-sim/static/js/model/circuit.js#L231) to require strictly internal intersections ($0 < t < 1$ and $0 < u < 1$) so T-junctions do not draw bridge arcs.
- [ ] **6. Support Subcircuit Editing**: Bubble `changed()` events from subcircuits up to the root circuit and prevent clicking palette buttons from popping the hierarchy stack.
- [ ] **7. Provide Pure-JS Hash Fallback**: Add a fallback in [`hash()`](file:///home/luca/Desktop/switch-sim/static/js/model/circuit.js#L88) for non-HTTPS network testing.
- [ ] **8. Clean Up Redundant Code**: Remove duplicate methods in [`renderer.js`](file:///home/luca/Desktop/switch-sim/static/js/interface/renderer.js) and redundant unsigned comparisons in [`netlist.c`](file:///home/luca/Desktop/switch-sim/src/netlist/netlist.c).
