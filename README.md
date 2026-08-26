# E2C: Expression to Logic Circuit Converter

E2C is a lightweight, zero-dependency web application that instantly parses boolean algebra expressions and visualizes them as logic gate circuits using HTML5 Canvas.

It features an intelligent layout engine, standard logic gate symbols, truth table generation, and an interactive zoomable interface—all running locally in your browser.

## Features

- **Instant Visualization:** Automatically routes and draws wires, gates, and connections without overlapping using a vertical shared input bus architecture.
- **Truth Table Generation:** Dynamically generates a complete truth table for your circuit (up to 10 variables).
- **Narrative Summaries:** Generates a step-by-step plain English explanation of how your inputs are logically constructed to form the final output.
- **Interactive Canvas:** Supports infinite vector-scaling! You can use your mouse wheel or touch-pinch gestures to zoom in and out of complex circuits without any pixelation.
- **Developer-Friendly UI:** Clean, utilitarian interface optimized for both desktop and mobile devices.

## How to Use

1. Simply open `index.html` in any modern web browser (no server or build tools required).
2. Type a boolean expression into the input field.
3. Click **Generate Circuit**.

## Supported Input Formats

The parser strictly follows standard boolean algebra notations:

- **Variables:** Single letters (e.g., `A`, `B`, `x`, `y`).
- **Complement (NOT):** Postfix apostrophe `'`. 
  - Example: `A'` or `(A + B)'`
- **AND:** Period `.`, asterisk `*`, or implicitly placing factors next to each other.
  - Examples: `A.B`, `A*B`, or simply `AB` (Implicit AND)
- **OR:** Plus symbol `+`.
  - Example: `A + B`
- **Parentheses:** Standard parentheses `()` for grouping and overriding precedence.
  - Example: `(A B) + C'`

## How It Works Under the Hood

E2C is built from scratch without any external diagramming libraries (like JointJS or GoJS).

1. **Tokenizer & Parser:** Uses a custom recursive descent parser to lexically analyze the text input and build an Abstract Syntax Tree (AST).
2. **Layout Engine:** Traverses the AST to calculate the exact spatial requirements. It places all unique variables on a vertical bus structure on the left side of the canvas, pushing the logic gates to the right to avoid overlapping paths.
3. **Vector Rendering:** Translates the layout coordinates into native `CanvasRenderingContext2D` paths (`moveTo`, `lineTo`, `arc`, `quadraticCurveTo`) to draw perfect D-shape AND gates, shield-shape OR gates, and triangle NOT gates.

## License

MIT
