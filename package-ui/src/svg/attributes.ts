export class SVGAttributes<T extends SVGElement> {
  constructor(elem: T) {
    this.#elem = elem;
  }
  #elem: T;
  /**Returns the svg element */
  get elem(): T {
    this.#apply_transforms();
    return this.#elem;
  }

  /** Sets the stroke color of the SVG element */
  stroke(stroke: string): this {
    this.#elem.setAttribute("stroke", stroke);
    return this;
  }
  /** Sets the stroke color of the SVG element */
  s(stroke: string): this {
    this.#elem.setAttribute("stroke", stroke);
    return this;
  }

  /** Sets the fill color of the SVG element */
  fill(fill: string): this {
    this.#elem.setAttribute("fill", fill);
    return this;
  }
  /** Sets the fill color of the SVG element */
  f(fill: string): this {
    this.#elem.setAttribute("fill", fill);
    return this;
  }

  /** Sets the stroke width of the SVG element */
  stroke_width(width: number): this {
    this.#elem.setAttribute("stroke-width", String(width));
    return this;
  }
  /** Sets the stroke width of the SVG element */
  sw(width: number): this {
    this.#elem.setAttribute("stroke-width", String(width));
    return this;
  }

  /** Adds one or more class names to the SVG element */
  class_list(...class_name: string[]): this {
    this.#elem.classList.add(...class_name);
    return this;
  }
  /** Adds one or more class names to the SVG element */
  cl(...class_name: string[]): this {
    this.#elem.classList.add(...class_name);
    return this;
  }

  /** Sets an arbitrary attribute on the SVG element */
  attribute(name: string, value: string): this {
    this.#elem.setAttribute(name, value);
    return this;
  }
  /** Sets an arbitrary attribute on the SVG element */
  a(name: string, value: string): this {
    this.#elem.setAttribute(name, value);
    return this;
  }

  #transforms: string[] = [];
  #apply_transforms(): void {
    if (this.#transforms.length > 0)
      this.#elem.setAttribute("transform", this.#transforms.join(" "));
  }

  /** Applies a translation transform to the SVG element */
  translate(x: number, y: number): this {
    this.#transforms.push(`translate(${x} ${y})`);
    return this;
  }

  /** Applies a rotation transform to the SVG element */
  rotate(angle: number, cx?: number, cy?: number): this {
    if (cx !== undefined && cy !== undefined)
      this.#transforms.push(`rotate(${angle} ${cx} ${cy})`);
    else this.#transforms.push(`rotate(${angle})`);
    return this;
  }

  /** Applies a scaling transform to the SVG element */
  scale(sx: number, sy?: number): this {
    if (sy !== undefined) this.#transforms.push(`scale(${sx} ${sy})`);
    else this.#transforms.push(`scale(${sx})`);
    return this;
  }

  /** Applies a skewX transform to the SVG element */
  skewX(angle: number): this {
    this.#transforms.push(`skewX(${angle})`);
    return this;
  }

  /** Applies a skewY transform to the SVG element */
  skewY(angle: number): this {
    this.#transforms.push(`skewY(${angle})`);
    return this;
  }

  /** Applies a custom transform to the SVG element */
  transform(transform: string): this {
    this.#transforms.push(transform);
    return this;
  }
}
