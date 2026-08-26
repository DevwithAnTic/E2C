# E2C: Expression to Logic Circuit Converter

![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg?style=flat-square)
![GitHub stars](https://img.shields.io/github/stars/DevwithAnTic/E2C?style=flat-square)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)

E2C is a lightweight, zero-dependency web application that instantly parses boolean algebra expressions and visualizes them as logic gate circuits using HTML5 Canvas.

It features an intelligent layout engine, standard logic gate symbols, truth table generation, and an interactive zoomable interface—all running locally in your browser.

## Features

- **Retro "Logisim" Aesthetic:** A hand-crafted, nostalgic UI inspired by classic Windows 95 and Java Swing applications. Features custom pixel-art icons, retro 3D borders, disabled font-smoothing, and classic native cursor SVGs!
- **Instant Visualization:** Automatically routes and draws wires, gates, and intersections (with bridge hops) without overlapping, utilizing a smart orthogonal spacing algorithm and a shared input bus architecture.
- **Truth Table Generation:** Dynamically generates a complete, color-striped truth table for your circuit (up to 10 variables).
- **Narrative Summaries:** Generates a step-by-step plain English explanation of how your inputs are logically constructed to form the final output.
- **Interactive Canvas:** Features a dotted CAD-style grid, drag-to-pan functionality, and infinite vector-scaling! You can use your mouse wheel or touch-pinch gestures to freely explore complex circuits without pixelation.

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

This project is licensed under the [Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/) license. 

You are free to use, modify, and share this educational tool, but you **may not** use the material for commercial purposes.
