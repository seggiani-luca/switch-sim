import { Circuit } from "./circuit.js";

export class Renderer {
	constructor(svg) {
		this.svg = svg;
	}

	render(circuit) {
		this.svg.replaceChildren();

		this.drawGrid(100, 60)

		for(const wire of circuit.wires.values())
			this.drawWire(wire);

		for(const device of circuit.devices.values())
			this.drawDevice(device);
	}

	drawGrid(width, height, spacing = 1) {
		const group = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"g"
		);

		group.setAttribute("class", "grid");

		for(let x = 0; x <= width; x += spacing)
			this.line(group, x, 0, x, height, 0.5);

		for(let y = 0; y <= height; y += spacing)
			this.line(group, 0, y, width, y, 0.5);

		this.svg.prepend(group);
	}

	drawWire(wire) {
		const group = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"g"
		);
		group.dataset.id = wire.id;

		this.line(group, wire.x1, wire.y1, wire.x2, wire.y2);
		this.svg.appendChild(group);
	}

	drawDevice(device) {
		const group = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"g"
		);
		group.dataset.id = device.id;
		group.dataset.type = device.type;

		group.setAttribute(
			"transform",
			`translate(${device.x} ${device.y})`
		);

		switch(device.type) {
			case "pmos":
				this.drawPMOS(group);
				break;
			case "nmos":
				this.drawNMOS(group);
				break;

			case "source":
				this.drawSource(group);
				break;

			case "ground":
				this.drawGround(group);
				break;
		}

		this.svg.appendChild(group);
	}

	drawPMOS(group) {
		this.line(group, -0.4, 1, 1, 1);
		this.line(group, -0.4, -1, 1, -1);
		this.line(group, -0.4, 1, -0.4, -1);
		this.line(group, -0.6, 1, -0.6, -1);
		this.circle(group, -0.8, 0, 0.2);
	}

	drawNMOS(group) {
		this.line(group, -0.4, 1, 1, 1);
		this.line(group, -0.4, -1, 1, -1);
		this.line(group, -0.4, 1, -0.4, -1);
		this.line(group, -0.6, 1, -0.6, -1);
		this.line(group, -1, 0, -0.6, 0);
	}

	drawSource(group) {
		this.line(group, 0, 0, 0, -1);
		this.line(group, -0.5, -0.5, 0, -1);
		this.line(group, 0.5, -0.5, 0, -1);
	}
	
	drawGround(group) {
		this.line(group, -1, 0, 1, 0);
		this.line(group, -0.7, 0.3, 0.7, 0.3);
		this.line(group, -0.4, 0.6, 0.4, 0.6);
	}

	line(group, x1, y1, x2, y2, thickness=2) {
		const line = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"line"
		);

		line.setAttribute("x1", x1);
		line.setAttribute("y1", y1);
		line.setAttribute("x2", x2);
		line.setAttribute("y2", y2);

		line.setAttribute("stroke", "currentColor");
		line.setAttribute("stroke-width", thickness);
		line.setAttribute("vector-effect", "non-scaling-stroke");

		group.appendChild(line);
	}

	circle(group, cx, cy, radius, thickness = 2) {
		const circle = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"circle"
		);

		circle.setAttribute("cx", cx);
		circle.setAttribute("cy", cy);
		circle.setAttribute("r", radius);

		circle.setAttribute("fill", "none");
		circle.setAttribute("stroke", "currentColor");
		circle.setAttribute("stroke-width", thickness);
		circle.setAttribute("vector-effect", "non-scaling-stroke");

		group.appendChild(circle);
	}
}
