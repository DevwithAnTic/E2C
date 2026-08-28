/**
 * E2C: Expression to Logic Circuit Converter
 * Author: DevwithAnTic
 * 
 * NOTE: This handles all the custom AST parsing and canvas rendering.
 * No external diagramming libraries used, it's all raw canvas paths.
 * 
 * TODO: Add support for XOR/XNOR gates eventually?
 */

// Basic lexer to strip whitespace and categorize chars
const tokenize = (expr) => {
    const tokens = [];
    let i = 0;
    while (i < expr.length) {
        let char = expr[i];
        if (/\s/.test(char)) {
            i++;
            continue;
        }
        if (/[a-zA-Z]/.test(char)) {
            tokens.push({ type: 'VAR', value: char });
        } else if (['.', '*'].includes(char)) {
            tokens.push({ type: 'AND', value: 'AND' });
        } else if (char === '+') {
            tokens.push({ type: 'OR', value: 'OR' });
        } else if (char === "'") {
            tokens.push({ type: 'PRIME', value: 'NOT' });
        } else if (char === '(') {
            tokens.push({ type: 'LPAREN', value: '(' });
        } else if (char === ')') {
            tokens.push({ type: 'RPAREN', value: ')' });
        } else {
            throw new Error(`Unknown character: ${char}`);
        }
        i++;
    }
    return tokens;
};

class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.pos = 0;
    }

    parse() {
        if (this.tokens.length === 0) throw new Error("Empty expression");
        const ast = this.parseOr();
        if (this.pos < this.tokens.length) {
            throw new Error("Unexpected token at end. Check parentheses and operators.");
        }
        // console.log("Generated AST:", ast); // left for debugging
        return ast;
    }

    parseOr() {
        let node = this.parseAnd();
        while (this.pos < this.tokens.length && this.tokens[this.pos].type === 'OR') {
            this.pos++;
            node = { type: 'OR', left: node, right: this.parseAnd() };
        }
        return node;
    }

    parseAnd() {
        let node = this.parseFactor();
        while (this.pos < this.tokens.length) {
            let type = this.tokens[this.pos].type;
            if (type === 'AND') {
                this.pos++;
                node = { type: 'AND', left: node, right: this.parseFactor() };
            } else if (type === 'VAR' || type === 'LPAREN') {
                // Implicit AND
                node = { type: 'AND', left: node, right: this.parseFactor() };
            } else {
                break;
            }
        }
        return node;
    }

    parseFactor() {
        if (this.pos >= this.tokens.length) throw new Error("Unexpected end of expression");
        let token = this.tokens[this.pos];
        let node;
        
        if (token.type === 'VAR') {
            this.pos++;
            node = { type: 'VAR', value: token.value };
        } else if (token.type === 'LPAREN') {
            this.pos++;
            node = this.parseOr();
            if (this.pos >= this.tokens.length || this.tokens[this.pos].type !== 'RPAREN') {
                throw new Error("Expected closing parenthesis ')'");
            }
            this.pos++;
        } else {
            throw new Error(`Unexpected token: ${token.value}`);
        }
        
        while (this.pos < this.tokens.length && this.tokens[this.pos].type === 'PRIME') {
            this.pos++;
            node = { type: 'NOT', operand: node };
        }
        
        return node;
    }
}

// Recursively calculate the required height for the bounding boxes.
// A gap of 30px is exactly the sweet spot to ensure horizontal wires
// (which enter gates at y±12) never intersect the bounding boxes of subtrees.
function computeHeights(astNode) {
    if (astNode.type === 'VAR') {
        astNode.h = 30; // base height for variables
    } else if (astNode.type === 'NOT') {
        computeHeights(astNode.operand);
        astNode.h = Math.max(60, astNode.operand.h);
    } else {
        computeHeights(astNode.left);
        computeHeights(astNode.right);
        
        // 30px routing channel so wires don't slice through the gates
        astNode.h = astNode.left.h + astNode.right.h + 30;
    }
    return astNode.h;
}

function setPositions(astNode, xRight, yCenter) {
    if (astNode.type === 'VAR') {
        return; 
    }
    
    astNode.x = xRight - 60; 
    astNode.y = yCenter;
    
    // 50px gap between columns makes the total distance 110px.
    // We will snap midX to the 15px grid explicitly in drawWire to prevent hop overlaps.
    let childXRight = astNode.x - 50; 
    
    if (astNode.type === 'NOT') {
        setPositions(astNode.operand, childXRight, yCenter); 
    } else {
        let leftY = yCenter - 15 - astNode.left.h / 2;
        let rightY = yCenter + 15 + astNode.right.h / 2;
        
        setPositions(astNode.left, childXRight, leftY);
        setPositions(astNode.right, childXRight, rightY);
    }
}

function getOutputPort(node) {
    if (node.type === 'AND') return {x: node.x + 50, y: node.y};
    if (node.type === 'OR') return {x: node.x + 50, y: node.y};
    if (node.type === 'NOT') return {x: node.x + 50, y: node.y}; 
    if (node.type === 'VAR') return {x: node.x + 20, y: node.y};
}

function getInputPorts(node) {
    if (node.type === 'AND') return [{x: node.x, y: node.y - 12}, {x: node.x, y: node.y + 12}];
    if (node.type === 'OR') return [{x: node.x + 6, y: node.y - 12}, {x: node.x + 6, y: node.y + 12}];
    if (node.type === 'NOT') return [{x: node.x, y: node.y}];
    return [];
}

let verticalWires = [];
let horizontalWires = [];
let junctionDots = [];
let busConnections = {};

function addWireSegment(x1, y1, x2, y2) {
    if (x1 === x2) {
        verticalWires.push({x: x1, y1: Math.min(y1, y2), y2: Math.max(y1, y2)});
    } else if (y1 === y2) {
        horizontalWires.push({y: y1, x1: Math.min(x1, x2), x2: Math.max(x1, x2)});
    }
}

function drawWire(ctx, x1, y1, x2, y2) {
    let exactMid = x1 + Math.max(15, (x2 - x1) / 2);
    let midX = Math.round(exactMid / 15) * 15; // Snap to 15px grid
    
    addWireSegment(x1, y1, midX, y1);
    addWireSegment(midX, y1, midX, y2);
    addWireSegment(midX, y2, x2, y2);
}

function drawVarWire(ctx, x1, y1, x2, y2, busX) {
    addWireSegment(x1, y1, busX, y1);
    addWireSegment(busX, y1, busX, y2);
    addWireSegment(busX, y2, x2, y2);
    
    if (!busConnections[busX]) busConnections[busX] = [];
    busConnections[busX].push(y1);
    busConnections[busX].push(y2);
}

function renderWires(ctx) {
    junctionDots = [];
    for (let bx in busConnections) {
        let ys = busConnections[bx];
        let yMin = Math.min(...ys);
        let yMax = Math.max(...ys);
        let uniqueYs = [...new Set(ys)];
        for (let y of uniqueYs) {
            // Check if this y is crossed by a horizontal wire
            let isCrossed = horizontalWires.some(h => h.y === y && h.x1 < bx && h.x2 > bx);
            
            // Only place dots at T-junctions or crosses.
            // L-corners (min/max) get dots only if another wire crosses through them.
            if ((y > yMin && y < yMax) || isCrossed) {
                junctionDots.push({x: parseFloat(bx), y: y});
            }
        }
    }

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    
    ctx.beginPath();
    for (let v of verticalWires) {
        ctx.moveTo(v.x, v.y1);
        ctx.lineTo(v.x, v.y2);
    }
    ctx.stroke();
    
    const R = 6;
    ctx.beginPath();
    for (let h of horizontalWires) {
        let intersectX = [];
        for (let v of verticalWires) {
            let isJunction = junctionDots.some(d => d.x === v.x && d.y === h.y);
            if (!isJunction && v.x > h.x1 && v.x < h.x2 && h.y > v.y1 && h.y < v.y2) {
                intersectX.push(v.x);
            }
        }
        
        // Remove duplicates to prevent drawing lines backwards across the hops
        intersectX = [...new Set(intersectX)].sort((a, b) => a - b);
        
        let currX = h.x1;
        for (let ix of intersectX) {
            ctx.moveTo(currX, h.y);
            ctx.lineTo(ix - R, h.y);
            ctx.arc(ix, h.y, R, Math.PI, 0, false);
            currX = ix + R;
        }
        ctx.moveTo(currX, h.y);
        ctx.lineTo(h.x2, h.y);
    }
    ctx.stroke();
    
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    for (let d of junctionDots) {
        ctx.moveTo(d.x, d.y);
        ctx.arc(d.x, d.y, 5, 0, 2 * Math.PI);
    }
    ctx.fill();
}

function drawGate(ctx, type, x, y, label) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#ffffff';
    
    let showLabels = document.getElementById('show-labels') ? document.getElementById('show-labels').checked : true;
    
    ctx.beginPath();
    if (type === 'AND') {
        // drawing a perfect D-shape for the AND gate manually
        ctx.moveTo(x, y - 25);
        ctx.lineTo(x + 25, y - 25);
        ctx.arc(x + 25, y, 25, -Math.PI/2, Math.PI/2);
        ctx.lineTo(x, y + 25);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        if (showLabels) {
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 12px "MS Sans Serif", Tahoma, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('AND', x + 21, y + 4);
            ctx.textAlign = 'left';
        }
    } else if (type === 'OR') {
        // shield shape using quadratic curves, took a while to get the points right haha
        ctx.moveTo(x, y - 25);
        ctx.quadraticCurveTo(x + 30, y - 25, x + 50, y);
        ctx.quadraticCurveTo(x + 30, y + 25, x, y + 25);
        ctx.quadraticCurveTo(x + 15, y, x, y - 25);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        if (showLabels) {
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 12px "MS Sans Serif", Tahoma, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('OR', x + 22, y + 4);
            ctx.textAlign = 'left';
        }
    } else if (type === 'NOT') {
        ctx.moveTo(x, y - 15);
        ctx.lineTo(x + 40, y);
        ctx.lineTo(x, y + 15);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.beginPath();
        ctx.arc(x + 45, y, 5, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
        
        if (showLabels) {
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 10px "MS Sans Serif", Tahoma, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('NOT', x + 12, y + 3);
            ctx.textAlign = 'left';
        }
    } else if (type === 'VAR') {
        ctx.beginPath();
        ctx.rect(x - 4, y - 12, 24, 24); // Hollow square the size of the output pin
        ctx.fillStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#000000';
        ctx.fill();
        ctx.stroke();
        
        ctx.font = 'bold 16px "Courier New", monospace';
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'right';
        ctx.fillText(label, x - 12, y + 5); // Label right-aligned beside the box
        ctx.textAlign = 'left';
    }
}

function drawAST(ctx, node, varBusX) {
    if (node.type === 'VAR') return;

    if (node.type === 'NOT') {
        let inPort = getInputPorts(node)[0];
        let childOut = getOutputPort(node.operand);
        if (node.operand.type === 'VAR') {
            drawVarWire(ctx, childOut.x, childOut.y, inPort.x, inPort.y, varBusX[node.operand.value]);
        } else {
            drawWire(ctx, childOut.x, childOut.y, inPort.x, inPort.y);
        }
        drawAST(ctx, node.operand, varBusX);
    } else if (node.type === 'AND' || node.type === 'OR') {
        let ports = getInputPorts(node);
        
        let leftOut = getOutputPort(node.left);
        if (node.left.type === 'VAR') {
            drawVarWire(ctx, leftOut.x, leftOut.y, ports[0].x, ports[0].y, varBusX[node.left.value]);
        } else {
            drawWire(ctx, leftOut.x, leftOut.y, ports[0].x, ports[0].y);
        }
        
        let rightOut = getOutputPort(node.right);
        if (node.right.type === 'VAR') {
            drawVarWire(ctx, rightOut.x, rightOut.y, ports[1].x, ports[1].y, varBusX[node.right.value]);
        } else {
            drawWire(ctx, rightOut.x, rightOut.y, ports[1].x, ports[1].y);
        }
        
        drawAST(ctx, node.left, varBusX);
        drawAST(ctx, node.right, varBusX);
    }
}

function drawAllGates(ctx, node) {
    if (node.type !== 'VAR') {
        drawGate(ctx, node.type, node.x, node.y, node.value);
        if (node.left) drawAllGates(ctx, node.left);
        if (node.right) drawAllGates(ctx, node.right);
        if (node.operand) drawAllGates(ctx, node.operand);
    }
}

function analyzeAST(ast) {
    let gateCounts = { AND: 0, OR: 0, NOT: 0 };
    let variables = new Set();
    
    function traverse(node) {
        if (node.type === 'VAR') variables.add(node.value);
        else {
            if (node.type === 'AND') gateCounts.AND++;
            if (node.type === 'OR') gateCounts.OR++;
            if (node.type === 'NOT') gateCounts.NOT++;
            
            if (node.left) traverse(node.left);
            if (node.right) traverse(node.right);
            if (node.operand) traverse(node.operand);
        }
    }
    traverse(ast);
    return { gateCounts, variables };
}

function updateSummary(gateCounts, variables, ast, equationStr) {
    let summaryContent = document.getElementById('summary-content');
    
    function generateNarrative(node, isRoot) {
        let steps = [];
        let totalGates = gateCounts.AND + gateCounts.OR + gateCounts.NOT;
        let firstPrefix = totalGates < 2 ? "In this circuit," : "It is a combinational circuit where";
        
        function traverse(n, isTopNode) {
            if (n.type === 'VAR') {
                return { text: n.value, isGate: false };
            }
            if (n.type === 'NOT') {
                let inner = traverse(n.operand, false);
                if (!inner.isGate) {
                    return { text: inner.text + "'", isGate: false };
                }
                
                let prefix = steps.length === 0 ? firstPrefix : (isTopNode ? "Finally," : "After that,");
                steps.push(`${prefix} ${inner.text} is associated with one NOT gate.`);
                return { text: `the NOT gate`, isGate: true };
            }
            
            if (n.type === 'AND' || n.type === 'OR') {
                let operands = [];
                function collect(curr) {
                    if (curr.type === n.type) {
                        collect(curr.left);
                        collect(curr.right);
                    } else {
                        operands.push(traverse(curr, false));
                    }
                }
                collect(n);
                
                let opNames = operands.map(o => o.text);
                let subject = "";
                
                if (opNames.length === 1) {
                    subject = opNames[0];
                } else if (opNames.length === 2) {
                    if (operands.every(o => o.isGate)) {
                        subject = opNames[0] + " and " + opNames[1].replace("the ", "");
                    } else {
                        subject = opNames.join(' and ');
                    }
                } else {
                    subject = opNames.slice(0, -1).join(', ') + ", and " + opNames[opNames.length - 1];
                }
                
                let gateType = n.type;
                let prefix = steps.length === 0 ? firstPrefix : (isTopNode ? "Finally," : "After that,");
                
                let verbPhrase = (operands.length === 2 && operands.every(o => o.isGate)) ? "they both are associated" : "are associated";
                
                steps.push(`${prefix} ${subject} ${verbPhrase} with one ${gateType} gate.`);
                return { text: `the ${gateType} gate`, isGate: true };
            }
        }
        
        if (node.type === 'VAR') {
            return `In this circuit, the final result is simply ${node.value}.`;
        }
        
        traverse(node, true);
        
        let fullText = steps.join(" ");
        fullText += ` Thus, we get the final result ${equationStr}.`;
        return fullText;
    }
    
    let narrative = generateNarrative(ast, true);
    
    // Capitalize first letter just to be safe, though the user example is mostly lowercase inside
    narrative = narrative.charAt(0).toUpperCase() + narrative.slice(1);
    
    let uniqueVars = Array.from(variables).sort();
    
    summaryContent.innerHTML = `
        <p style="margin-bottom: 1rem; line-height: 1.6;">${narrative}</p>
        <ul style="list-style-type: none; border-top: 1px solid var(--border); padding-top: 15px; margin-top: 15px;">
            <li style="margin-bottom: 5px;"><strong>Number of Inputs:</strong> ${uniqueVars.length} (${uniqueVars.join(', ') || 'None'})</li>
            <li><strong>Total Gates Used:</strong> ${gateCounts.AND + gateCounts.OR + gateCounts.NOT} 
            (AND: ${gateCounts.AND}, OR: ${gateCounts.OR}, NOT: ${gateCounts.NOT})</li>
        </ul>
    `;
}

function injectVarPositions(node, varMap) {
    if (node.type === 'VAR') {
        node.x = varMap[node.value].x;
        node.y = varMap[node.value].y;
    } else {
        if (node.left) injectVarPositions(node.left, varMap);
        if (node.right) injectVarPositions(node.right, varMap);
        if (node.operand) injectVarPositions(node.operand, varMap);
    }
}

let currentRenderState = null;
let currentScale = 1.0;

function renderCircuit() {
    if (!currentRenderState) return;
    const {ast, uniqueVars, varMap, varBusX, requiredWidth, requiredHeight, equationStr} = currentRenderState;
    
    let canvas = document.getElementById('circuit-canvas');
    let ctx = canvas.getContext('2d');
    
    canvas.width = requiredWidth * currentScale;
    canvas.height = requiredHeight * currentScale;
    
    ctx.scale(currentScale, currentScale);
    ctx.clearRect(0, 0, requiredWidth, requiredHeight);
    
    verticalWires = [];
    horizontalWires = [];
    junctionDots = [];
    busConnections = {};
    
    let outPort = getOutputPort(ast);
    addWireSegment(outPort.x, outPort.y, outPort.x + 30, outPort.y);
    
    drawAST(ctx, ast, varBusX);
    
    renderWires(ctx);
    
    uniqueVars.forEach(v => {
        drawGate(ctx, 'VAR', varMap[v].x, varMap[v].y, v);
    });
    
    drawAllGates(ctx, ast);
    
    ctx.beginPath();
    ctx.arc(outPort.x + 42, outPort.y, 12, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000000';
    ctx.fill();
    ctx.stroke();
    
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.fillStyle = '#000000';
    ctx.fillText(equationStr, outPort.x + 60, outPort.y + 5);
}

document.getElementById('circuit-canvas').addEventListener('wheel', (e) => {
    if (!currentRenderState) return;
    e.preventDefault();
    
    const zoomIntensity = 0.1;
    const wheel = e.deltaY < 0 ? 1 : -1;
    const zoomFactor = Math.exp(wheel * zoomIntensity);
    
    currentScale *= zoomFactor;
    currentScale = Math.min(Math.max(currentScale, 0.2), 5.0);
    
    renderCircuit();
});

let initialPinchDistance = null;
let initialScale = 1.0;

document.getElementById('circuit-canvas').addEventListener('touchstart', (e) => {
    if (!currentRenderState) return;
    if (e.touches.length === 2) {
        e.preventDefault();
        let dx = e.touches[0].clientX - e.touches[1].clientX;
        let dy = e.touches[0].clientY - e.touches[1].clientY;
        initialPinchDistance = Math.sqrt(dx * dx + dy * dy);
        initialScale = currentScale;
    }
}, {passive: false});

document.getElementById('circuit-canvas').addEventListener('touchmove', (e) => {
    if (!currentRenderState) return;
    if (e.touches.length === 2 && initialPinchDistance !== null) {
        e.preventDefault();
        let dx = e.touches[0].clientX - e.touches[1].clientX;
        let dy = e.touches[0].clientY - e.touches[1].clientY;
        let distance = Math.sqrt(dx * dx + dy * dy);
        
        let scaleChange = distance / initialPinchDistance;
        currentScale = initialScale * scaleChange;
        currentScale = Math.min(Math.max(currentScale, 0.2), 5.0);
        
        renderCircuit();
    }
}, {passive: false});

document.getElementById('circuit-canvas').addEventListener('touchend', (e) => {
    if (e.touches.length < 2) {
        initialPinchDistance = null;
    }
});

const container = document.querySelector('.circuit-container');
let isDragging = false;
let startX, startY, scrollLeft, scrollTop;

container.addEventListener('mousedown', (e) => {
    isDragging = true;
    container.classList.add('is-grabbing');
    startX = e.pageX - container.offsetLeft;
    startY = e.pageY - container.offsetTop;
    scrollLeft = container.scrollLeft;
    scrollTop = container.scrollTop;
});

container.addEventListener('mouseleave', () => {
    isDragging = false;
    container.classList.remove('is-grabbing');
});

container.addEventListener('mouseup', () => {
    isDragging = false;
    container.classList.remove('is-grabbing');
});

container.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - container.offsetLeft;
    const y = e.pageY - container.offsetTop;
    const walkX = (x - startX);
    const walkY = (y - startY);
    container.scrollLeft = scrollLeft - walkX;
    container.scrollTop = scrollTop - walkY;
});

function evaluateAST(node, assignments) {
    if (node.type === 'VAR') {
        return assignments[node.value];
    }
    if (node.type === 'NOT') {
        return !evaluateAST(node.operand, assignments);
    }
    if (node.type === 'AND') {
        return evaluateAST(node.left, assignments) && evaluateAST(node.right, assignments);
    }
    if (node.type === 'OR') {
        return evaluateAST(node.left, assignments) || evaluateAST(node.right, assignments);
    }
    return false;
}

function generateTruthTable(ast, uniqueVars) {
    let container = document.getElementById('truth-table-container');
    
    if (uniqueVars.length === 0) {
        container.innerHTML = "<p style='color: #64748b;'>No variables to evaluate.</p>";
        return;
    }
    
    if (uniqueVars.length > 10) {
        container.innerHTML = "<p style='color: #b91c1c;'>Too many variables to generate a truth table.</p>";
        return;
    }
    
    let numRows = Math.pow(2, uniqueVars.length);
    let html = '<table class="truth-table"><thead><tr>';
    
    uniqueVars.forEach(v => {
        html += `<th>${v}</th>`;
    });
    html += '<th class="out-col">OUTPUT</th></tr></thead><tbody>';
    
    for (let i = 0; i < numRows; i++) {
        let assignments = {};
        let rowHtml = '<tr>';
        
        let bin = i.toString(2).padStart(uniqueVars.length, '0');
        
        uniqueVars.forEach((v, index) => {
            let val = parseInt(bin[index]);
            assignments[v] = val === 1;
            rowHtml += `<td>${val}</td>`;
        });
        
        let outVal = evaluateAST(ast, assignments) ? 1 : 0;
        rowHtml += `<td class="out-col">${outVal}</td></tr>`;
        html += rowHtml;
    }
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

document.getElementById('generate-btn').addEventListener('click', () => {
    const equationStr = document.getElementById('equation').value.trim();
    if (!equationStr) return;
    
    try {
        const tokens = tokenize(equationStr);
        const parser = new Parser(tokens);
        const ast = parser.parse();
        
        const { gateCounts, variables } = analyzeAST(ast);
        let uniqueVars = Array.from(variables).sort();
        
        computeHeights(ast);
        
        setPositions(ast, 0, 0); 
        
        let minX = Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        
        function findBounds(node) {
            if (node.type !== 'VAR') {
                minX = Math.min(minX, node.x);
                minY = Math.min(minY, node.y - 30);
                maxY = Math.max(maxY, node.y + 30);
            }
            if (node.left) findBounds(node.left);
            if (node.right) findBounds(node.right);
            if (node.operand) findBounds(node.operand);
        }
        findBounds(ast);
        
        let varsWidth = 50 + uniqueVars.length * 15 + 40; 
        let equationTextWidth = equationStr.length * 12;
        let rightPadding = Math.max(200, equationTextWidth + 100);
        let requiredWidth = Math.max(800, -minX + varsWidth + rightPadding + 50); // Added 50px safety margin for snap rounding
        let varsHeight = uniqueVars.length * 60;
        let requiredHeight = Math.max(400, (maxY - minY) + varsHeight + 120);
        
        let maxBusX = 90 + (uniqueVars.length - 1) * 15;
        let minOffsetX = maxBusX + 60 - minX;
        
        let baseOffsetX = Math.max(requiredWidth - rightPadding + 50, minOffsetX);
        let offsetX = Math.ceil(baseOffsetX / 15) * 15; // Snap to 15px grid to ensure midX lines don't collide
        
        let offsetY = (maxY === -Infinity) ? requiredHeight / 2 : Math.round((-minY + varsHeight + 60) / 15) * 15;
        
        setPositions(ast, offsetX, offsetY);
        
        let varMap = {};
        let varBusX = {};
        // Shift variables safely above the gate tree
        let varStartY = Math.round(30 / 15) * 15;
        uniqueVars.forEach((v, index) => {
            varMap[v] = { x: 50, y: varStartY + index * 60 };
            varBusX[v] = 90 + index * 15;
        });
        
        injectVarPositions(ast, varMap);
        
        let container = document.querySelector('.circuit-container');
        let canvas = document.getElementById('circuit-canvas');
        
        // Hide canvas temporarily so the container shrinks to its true CSS layout size instead of stretching to fit the old canvas
        canvas.style.display = 'none';
        let cw = container.clientWidth;
        let ch = container.clientHeight;
        canvas.style.display = 'block';
        
        let scaleX = cw / requiredWidth;
        let scaleY = ch / requiredHeight;
        let fitScale = Math.min(scaleX, scaleY) * 0.95; // 5% padding to keep off edges
        
        // Cap scale to 1.0 so small circuits aren't blown up, but allow shrinking to fit large circuits
        currentScale = Math.min(1.0, fitScale);
        currentScale = Math.max(0.2, currentScale); // respect minimum zoom
        
        // Reset scroll position
        container.scrollLeft = 0;
        container.scrollTop = 0;
        
        currentRenderState = {
            ast, uniqueVars, varMap, varBusX, requiredWidth, requiredHeight, equationStr
        };
        
        renderCircuit();
        
        updateSummary(gateCounts, variables, ast, equationStr);
        generateTruthTable(ast, uniqueVars);
        document.getElementById('error-msg').style.display = 'none';
        
    } catch (e) {
        let errDiv = document.getElementById('error-msg');
        errDiv.textContent = 'Error: ' + e.message;
        errDiv.style.display = 'block';
    }
});

window.addEventListener('load', () => {
    document.getElementById('equation').value = 'A A\' + B';
    document.getElementById('generate-btn').click();
    
    document.getElementById('show-labels').addEventListener('change', () => {
        if (currentRenderState) renderCircuit();
    });
});
