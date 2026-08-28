# E2C: Expression to Logic Circuit Converter

![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg?style=flat-square)
![GitHub stars](https://img.shields.io/github/stars/DevwithAnTic/E2C?style=flat-square)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)

E2C is a client-side web application that converts boolean expressions into interactive logic gate circuits. It features a custom layout engine built with HTML5 Canvas, generating truth tables and logic summaries instantly in your browser.

## Features

- **Retro UI Theme:** Designed with a nostalgic Windows 95 and Java Swing aesthetic, using custom CSS and free, open-source inspired assets for a classic software feel.
- **Custom Layout Engine:** Automatically routes gates and wires using an orthogonal spacing algorithm. It visually bridges overlapping wires to keep the circuit readable.
- **Truth Table Generation:** Dynamically computes a complete truth table for your circuit (supports up to 10 variables).
- **Logic Summary:** Provides a step-by-step text breakdown of how the inputs are logically constructed to form the final output.
- **Multi-Input Gates (N-ary):** Automatically flattens cascaded operations (e.g., A + B + C) into a single multi-input logic gate, dynamically spacing the input pins along the gate's edge.
- **Common Subexpression Elimination (CSE):** The "Optimize Gates" toggle detects duplicated logic blocks (e.g., (A+B)(A+B)), extracts them into shared sub-circuits, and routes their output to multiple destinations, significantly reducing total gate count.
- **Persistent UI Preferences:** Checkbox states for features and layout options are saved in your browser's local storage and persist across sessions.
- **Interactive Canvas:** Supports zooming with the mouse wheel and panning via click and drag, making it easy to navigate large circuits.

## Usage

To use the tool, simply open `index.html` in any modern web browser. There are no build tools or servers required.

Type a boolean expression into the input field and click **Generate**.

### Supported Syntax
- **Variables:** Single letters (`A`, `B`, `x`, `y`)
- **NOT:** Postfix apostrophe (`A'`)
- **AND:** Period, asterisk, or implicit multiplication (`A.B`, `A*B`, or `AB`)
- **OR:** Plus symbol (`A + B`)
- **Parentheses:** Standard grouping (`(A + B)' C`)

## How it works under the hood

E2C is built without any external diagramming libraries like JointJS or GoJS. The pipeline consists of three main steps:

1. **Parser:** A custom recursive descent parser tokenizes the text input and builds an Abstract Syntax Tree (AST).
2. **Layout Engine:** Traverses the AST to calculate exact coordinates. Unique variables are mapped to a vertical bus on the left, while gates are placed to the right with exact 30px routing gaps to ensure wires never cross through a gate's bounding box.
3. **Rendering:** Translates the layout coordinates into standard `CanvasRenderingContext2D` paths (`moveTo`, `lineTo`, `arc`, etc.) to draw the logic gates and wires.

## License

This project is licensed under the [Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)](https://creativecommons.org/licenses/by-nc/4.0/) license. 

You are free to use, fork, modify, and share this educational tool to learn, but you **may not** use the material for commercial purposes.
