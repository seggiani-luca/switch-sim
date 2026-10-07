// for geometric operations
import { Circuit } from "../model/circuit.js";

// renders tool icons to SVG
export class ToolIcon {
	static wire(svg) {
		Renderer.line(svg, -1.5, 0, -0.5, 0);
		Renderer.line(svg, -0.5, 0, 0.5, -0.8);
		Renderer.line(svg, 0.5, -0.8, 1.5, -0.8);
	}

	static move(svg) {
		// horizontal
		Renderer.line(svg, -1.5, 0, 1.5, 0);
		Renderer.line(svg, -1.5, 0, -1, 0.5);
		Renderer.line(svg, -1.5, 0, -1, -0.5);
		Renderer.line(svg, 1.5, 0, 1, 0.5);
		Renderer.line(svg, 1.5, 0, 1, -0.5);

		// vertical
		Renderer.line(svg, 0, -1.5, 0, 1.5);
		Renderer.line(svg, 0, -1.5, 0.5, -1);
		Renderer.line(svg, 0, -1.5, -0.5, -1);
		Renderer.line(svg, 0, 1.5, 0.5, 1);
		Renderer.line(svg, 0, 1.5, -0.5, 1);
	}

	static delete(svg) {
		Renderer.line(svg, -1, -1, 1, 1);
		Renderer.line(svg, 1, -1, -1, 1);
	}

	static port(svg) {
		Renderer.line(svg, -1, -1, 0.25, -1);
		Renderer.line(svg, -1, 1, 0.25, 1);
		Renderer.line(svg, -1, -1, -1, 1);
		Renderer.line(svg, 0.25, -1, 1.25, 0);
		Renderer.line(svg, 0.25, 1, 1.25, 0);
	}

	static fiddle(svg) {
		// index finger
		Renderer.line(svg, -0.4, 0.5, -0.4, -1.3);
		Renderer.line(svg, -0.4, -1.3, -0.3, -1.4);
		Renderer.line(svg, -0.3, -1.4, -0.1, -1.4);
		Renderer.line(svg, -0.1, -1.4, 0, -1.3);
		Renderer.line(svg, 0, -1.3, 0, -0.5);

		// knuckles
		Renderer.line(svg, 0, -0.5, 0.4, -0.5);
		Renderer.line(svg, 0.4, -0.5, 0.4, -0.3);
		Renderer.line(svg, 0.4, -0.3, 0.8, -0.3);
		Renderer.line(svg, 0.8, -0.3, 0.8, -0.1);
		Renderer.line(svg, 0.8, -0.1, 1.2, -0.1);

		// palm and wrist
		Renderer.line(svg, 1.2, -0.1, 1.2, 0.6);
		Renderer.line(svg, 1.2, 0.6, 0.6, 1.4);
		Renderer.line(svg, 0.6, 1.4, -0.6, 1.4);

		// thumb
		Renderer.line(svg, -0.6, 1.4, -1.2, 0.6);
		Renderer.line(svg, -1.2, 0.6, -1.2, 0.2);
		Renderer.line(svg, -1.2, 0.2, -0.4, 0.5);
	}
}

// renders circuit grid, wires, and schematic component symbols to SVG
export class Renderer {
	// stores root SVG element for rendering
	constructor(svg) {
		this.svg = svg;
	}

	// clears canvas and redraws grid, all wires, and all components
	render(circuit) {
		this.svg.replaceChildren();

		for (const wire of circuit.wires.values()) this.drawWire(wire);
		for (const component of circuit.components.values())
			this.drawComponent(component);
		for (const port of circuit.ports.values()) this.drawPort(port);
		this.drawCrossovers(circuit);

		this.drawGrid(100, 60);
	}

	changeCursors({ canvas, object }) {
		this.svg.style.setProperty("--canvas-cursor", canvas);
		this.svg.style.setProperty("--object-cursor", object);
	}

	// generates background coordinate grid lines
	drawGrid(width, height, spacing = 1) {
		const group = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"g",
		);

		group.setAttribute("class", "grid");

		for (let x = 0; x <= width; x += spacing)
			Renderer.line(group, x, 0, x, height, 0.5);

		for (let y = 0; y <= height; y += spacing)
			Renderer.line(group, 0, y, width, y, 0.5);

		this.svg.prepend(group);
	}

	// draws a wire line between its endpoints
	drawWire(wire) {
		const group = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"g",
		);

		group.dataset.id = wire.id;
		group.dataset.type = "wire";
		group.classList.add("grabbable");

		const padding = 0.75;

		const x = Math.min(wire.x1, wire.x2) - padding;
		const y = Math.min(wire.y1, wire.y2) - padding;
		const width = Math.abs(wire.x2 - wire.x1) + 2 * padding;
		const height = Math.abs(wire.y2 - wire.y1) + 2 * padding;

		// invisible hitbox
		const hitbox = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"rect",
		);

		hitbox.setAttribute("x", x);
		hitbox.setAttribute("y", y);
		hitbox.setAttribute("width", width);
		hitbox.setAttribute("height", height);
		hitbox.setAttribute("fill", "transparent");

		group.appendChild(hitbox);

		Renderer.line(
			group,
			wire.x1,
			wire.y1,
			wire.x2,
			wire.y2,
			2,
			wire.value !== undefined
				? Renderer.wireColor(wire.value)
				: "currentColor",
		);

		this.svg.appendChild(group);
	}

	// get color from wire
	static wireColor(value) {
		switch (value) {
			case 0:
				return "var(--wire-low)";
			case 1:
				return "var(--wire-high)";
			case 2:
				return "var(--wire-hiz)";
			case 3:
				return "var(--wire-unknown)";
			default:
				return "currentColor";
		}
	}

	// creates a translated SVG group and renders the component symbol
	drawComponent(component) {
		const group = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"g",
		);

		group.dataset.id = component.id;
		group.dataset.type = "component";
		group.classList.add("grabbable");

		group.setAttribute(
			"transform",
			`translate(${component.x} ${component.y})`,
		);

		// invisible hitbox
		const hitbox = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"rect",
		);

		hitbox.setAttribute("x", -1.5);
		hitbox.setAttribute("y", -1.5);
		hitbox.setAttribute("width", 3);
		hitbox.setAttribute("height", 3);
		hitbox.setAttribute("fill", "transparent");

		group.appendChild(hitbox);

		component.draw(group);

		this.svg.appendChild(group);
	}

	// draws PMOS symbol
	static drawPMOS(group) {
		this.line(group, -0.4, 1, 1, 1);
		this.line(group, -0.4, -1, 1, -1);
		this.line(group, -0.4, 1, -0.4, -1);
		this.line(group, -0.6, 1, -0.6, -1);
		this.circle(group, -0.8, 0, 0.2);
	}

	// draws NMOS symbol
	static drawNMOS(group) {
		this.line(group, -0.4, 1, 1, 1);
		this.line(group, -0.4, -1, 1, -1);
		this.line(group, -0.4, 1, -0.4, -1);
		this.line(group, -0.6, 1, -0.6, -1);
		this.line(group, -1, 0, -0.6, 0);
	}

	// draws VDD supply symbol
	static drawSource(group) {
		this.line(group, 0, 0, 0, -1);
		this.line(group, -0.5, -0.5, 0, -1);
		this.line(group, 0.5, -0.5, 0, -1);
	}

	// draws ground symbol
	static drawGround(group) {
		this.line(group, -1, 0, 1, 0);
		this.line(group, -0.7, 0.3, 0.7, 0.3);
		this.line(group, -0.4, 0.6, 0.4, 0.6);
	}

	drawCrossovers(circuit) {
		for (const wire of circuit.wires.values()) {
			for (const other of circuit.wires.values()) {
				if (wire.id >= other.id) continue;

				const point = Circuit.wireIntersection(wire, other);
				if (!point) continue;

				// draw the crossover on `other`.
				this.drawCrossover(other, point.x, point.y);
			}
		}
	}

	// draws a wire crossover
	drawCrossover(wire, x, y) {
		const dx = wire.x2 - wire.x1;
		const dy = wire.y2 - wire.y1;
		const length = Math.hypot(dx, dy);

		if (length === 0) return;

		const ux = dx / length;
		const uy = dy / length;

		const size = 0.5;

		const x1 = x - ux * size;
		const y1 = y - uy * size;
		const x2 = x + ux * size;
		const y2 = y + uy * size;

		const nx = -uy;
		const ny = ux;

		const cx = x + nx * size;
		const cy = y + ny * size;

		const d = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;

		const mask = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"path",
		);

		mask.setAttribute("d", d);
		mask.setAttribute("fill", "none");
		mask.setAttribute("stroke", "var(--dark-bg)");
		mask.setAttribute("stroke-width", 12);
		mask.setAttribute("vector-effect", "non-scaling-stroke");

		this.svg.appendChild(mask);

		const path = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"path",
		);

		path.setAttribute("d", d);
		path.setAttribute("fill", "none");
		path.setAttribute(
			"stroke",
			wire.value !== undefined
				? Renderer.wireColor(wire.value)
				: "currentColor",
		);
		path.setAttribute("stroke-width", 2);
		path.setAttribute("vector-effect", "non-scaling-stroke");

		this.svg.appendChild(path);
	}

	// draws a port
	drawPort(port) {
		const group = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"g",
		);

		group.dataset.id = port.id;
		group.dataset.type = "port";
		group.classList.add("grabbable");

		group.setAttribute("transform", `translate(${port.x} ${port.y})`);

		// invisible hitbox
		const hitbox = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"rect",
		);

		hitbox.setAttribute("x", -1.5);
		hitbox.setAttribute("y", -1.5);
		hitbox.setAttribute("width", 3);
		hitbox.setAttribute("height", 3);
		hitbox.setAttribute("fill", "transparent");

		group.appendChild(hitbox);

		// port body
		switch (port.direction) {
			case "input":
				Renderer.line(group, -2, -0.5, 2, -0.5);
				Renderer.line(group, -2, 0.5, 2, 0.5);
				Renderer.line(group, 2, -0.5, 2, 0.5);
				Renderer.line(group, -2, -0.5, -1.5, 0);
				Renderer.line(group, -2, 0.5, -1.5, 0);
				break;

			case "output":
				Renderer.line(group, -2, -0.5, 1.5, -0.5);
				Renderer.line(group, -2, 0.5, 1.5, 0.5);
				Renderer.line(group, -2, -0.5, -2, 0.5);
				Renderer.line(group, 1.5, -0.5, 2, 0);
				Renderer.line(group, 1.5, 0.5, 2, 0);
				break;

			default:
				throw new Error(`Invalid port direction: ${port.direction}`);
		}

		// label
		Renderer.label(group, port.name, 0, 0);

		// led
		Renderer.circle(
			group,
			-1.5,
			0,
			0.1,
			5,
			port.value !== undefined
				? Renderer.wireColor(port.value)
				: "currentColor",
		);

		this.svg.appendChild(group);
	}

	// appends an SVG line element to the target group
	static line(group, x1, y1, x2, y2, thickness = 2, color = "currentColor") {
		const line = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"line",
		);

		line.setAttribute("x1", x1);
		line.setAttribute("y1", y1);
		line.setAttribute("x2", x2);
		line.setAttribute("y2", y2);

		line.setAttribute("stroke", color);
		line.setAttribute("stroke-width", thickness);
		line.setAttribute("vector-effect", "non-scaling-stroke");

		group.appendChild(line);
	}

	// appends an SVG circle element to the target group
	static circle(
		group,
		cx,
		cy,
		radius,
		thickness = 2,
		color = "currentColor",
	) {
		const circle = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"circle",
		);

		circle.setAttribute("cx", cx);
		circle.setAttribute("cy", cy);
		circle.setAttribute("r", radius);

		circle.setAttribute("fill", "none");
		circle.setAttribute("stroke", color);
		circle.setAttribute("stroke-width", thickness);
		circle.setAttribute("vector-effect", "non-scaling-stroke");

		group.appendChild(circle);
	}

	static label(group, text, x, y) {
		const label = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"text",
		);

		label.textContent = text;
		label.setAttribute("x", x);
		label.setAttribute("y", y);
		label.setAttribute("class", "circuit-label");
		label.setAttribute("text-anchor", "middle");
		label.setAttribute("dominant-baseline", "central");

		group.appendChild(label);
	}
}
