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

function computeHeights(astNode) {
    if (astNode.type === 'VAR') {
        astNode.h = 20; // Don't contribute much height to the tree block
    } else if (astNode.type === 'NOT') {
        computeHeights(astNode.operand);
        astNode.h = Math.max(50, astNode.operand.h);
    } else {
        computeHeights(astNode.left);
        computeHeights(astNode.right);
        astNode.h = astNode.left.h + astNode.right.h + 20;
    }
    return astNode.h;
}

function setPositions(astNode, xRight, yCenter) {
    if (astNode.type === 'VAR') {
        return; // Set from global varMap later
    }
    
    astNode.x = xRight - 60; 
    astNode.y = yCenter;
    
    let childXRight = astNode.x - 50; 
    
    if (astNode.type === 'NOT') {
        setPositions(astNode.operand, childXRight, yCenter); 
    } else {
        let totalH = astNode.left.h + astNode.right.h + 20;
        let startY = yCenter - totalH / 2;
        let leftY = startY + astNode.left.h / 2;
        let rightY = startY + astNode.left.h + 20 + astNode.right.h / 2;
        
        setPositions(astNode.left, childXRight, leftY);
        setPositions(astNode.right, childXRight, rightY);
    }
}

function getOutputPort(node) {
    if (node.type === 'AND') return {x: node.x + 50, y: node.y};
    if (node.type === 'OR') return {x: node.x + 50, y: node.y};
    if (node.type === 'NOT') return {x: node.x + 50, y: node.y}; 
    if (node.type === 'VAR') return {x: node.x + 30, y: node.y};
}

function getInputPorts(node) {
    if (node.type === 'AND') return [{x: node.x, y: node.y - 10}, {x: node.x, y: node.y + 10}];
    if (node.type === 'OR') return [{x: node.x + 5, y: node.y - 12}, {x: node.x + 5, y: node.y + 12}];
    if (node.type === 'NOT') return [{x: node.x, y: node.y}];
    return [];
}

function drawWire(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    
    let midX = x1 + Math.max(15, (x2 - x1) / 2);
    ctx.lineTo(midX, y1);
    ctx.lineTo(midX, y2);
    ctx.lineTo(x2, y2);
    
    ctx.stroke();
}

function drawVarWire(ctx, x1, y1, x2, y2, busX) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(busX, y1);
    ctx.lineTo(busX, y2);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(busX, y1, 3, 0, 2 * Math.PI);
    ctx.fillStyle = '#333';
    ctx.fill();
}

function drawGate(ctx, type, x, y, label) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#333';
    ctx.fillStyle = '#fff';
    
    ctx.beginPath();
    if (type === 'AND') {
        ctx.moveTo(x, y - 20);
        ctx.lineTo(x + 30, y - 20);
        ctx.arc(x + 30, y, 20, -Math.PI/2, Math.PI/2);
        ctx.lineTo(x, y + 20);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#333';
        ctx.font = '12px sans-serif';
        ctx.fillText('AND', x + 10, y + 4);
    } else if (type === 'OR') {
        ctx.moveTo(x, y - 20);
        ctx.quadraticCurveTo(x + 15, y, x, y + 20);
        ctx.lineTo(x + 20, y + 20);
        ctx.quadraticCurveTo(x + 50, y + 20, x + 50, y);
        ctx.quadraticCurveTo(x + 50, y - 20, x + 20, y - 20);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = '#333';
        ctx.font = '12px sans-serif';
        ctx.fillText('OR', x + 16, y + 4);
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
        
        ctx.fillStyle = '#333';
        ctx.font = '10px sans-serif';
        ctx.fillText('NOT', x + 5, y + 3);
    } else if (type === 'VAR') {
        ctx.font = '18px bold monospace';
        ctx.fillStyle = '#2c3e50';
        ctx.fillText(label, x - 10, y + 6);
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
    
    drawGate(ctx, node.type, node.x, node.y, node.value);
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

function updateSummary(gateCounts, variables, ast) {
    let summaryContent = document.getElementById('summary-content');
    
    let uniqueVars = Array.from(variables).sort();
    let intro = "";
    if (uniqueVars.length === 0) {
        intro = "We have no inputs.";
    } else if (uniqueVars.length === 1) {
        intro = `We have 1 input <strong>${uniqueVars[0]}</strong>.`;
    } else {
        let last = uniqueVars.pop();
        intro = `We have ${uniqueVars.length + 1} inputs <strong>${uniqueVars.join(', ')}</strong> and <strong>${last}</strong>.`;
        uniqueVars.push(last);
    }
    
    let steps = [];
    let seen = new Set();
    
    function generateSteps(node) {
        if (node.type === 'VAR') return node.value;
        
        if (node.type === 'NOT') {
            let op = generateSteps(node.operand);
            let expr = `${op}'`;
            if (node.operand.type === 'OR' || node.operand.type === 'AND') {
                expr = `(${op})'`;
            }
            if (!seen.has(expr)) {
                let textOp = node.operand.type === 'VAR' ? op : `(${op})`;
                steps.push(`Putting a NOT gate on <strong>${textOp}</strong> makes it <strong>${expr}</strong>.`);
                seen.add(expr);
            }
            return expr;
        }
        
        if (node.type === 'AND') {
            let left = generateSteps(node.left);
            let right = generateSteps(node.right);
            
            let lStr = (node.left.type === 'OR') ? `(${left})` : left;
            let rStr = (node.right.type === 'OR') ? `(${right})` : right;
            let expr = `${lStr} ${rStr}`;
            
            if (!seen.has(expr)) {
                steps.push(`Putting <strong>${lStr}</strong> and <strong>${rStr}</strong> together into an AND gate makes <strong>${expr}</strong>.`);
                seen.add(expr);
            }
            return expr;
        }
        
        if (node.type === 'OR') {
            let left = generateSteps(node.left);
            let right = generateSteps(node.right);
            
            let expr = `${left} + ${right}`;
            
            if (!seen.has(expr)) {
                steps.push(`Putting <strong>${left}</strong> and <strong>${right}</strong> into an OR gate makes <strong>${expr}</strong>.`);
                seen.add(expr);
            }
            return expr;
        }
    }
    
    let finalExpr = generateSteps(ast);
    
    let narrative = intro + " ";
    if (steps.length === 0) {
        narrative += `The output is directly connected to <strong>${finalExpr}</strong>.`;
    } else {
        narrative += steps.join(" ") + ` This gives our final output <strong>${finalExpr}</strong>.`;
    }
    
    summaryContent.innerHTML = `
        <p style="margin-bottom: 1rem; line-height: 1.8;">${narrative}</p>
        <ul style="list-style-type: none; border-top: 1px solid #e4e7eb; padding-top: 1rem;">
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
    const {ast, uniqueVars, varMap, varBusX, requiredWidth, requiredHeight} = currentRenderState;
    
    let canvas = document.getElementById('circuit-canvas');
    let ctx = canvas.getContext('2d');
    
    canvas.width = requiredWidth * currentScale;
    canvas.height = requiredHeight * currentScale;
    
    ctx.scale(currentScale, currentScale);
    ctx.clearRect(0, 0, requiredWidth, requiredHeight);
    
    uniqueVars.forEach(v => {
        drawGate(ctx, 'VAR', varMap[v].x, varMap[v].y, v);
    });
    
    let outPort = getOutputPort(ast);
    drawWire(ctx, outPort.x, outPort.y, outPort.x + 40, outPort.y);
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#2c3e50';
    ctx.fillText('OUT', outPort.x + 45, outPort.y + 5);
    
    drawAST(ctx, ast, varBusX);
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
    html += '<th class="out-col">OUT</th></tr></thead><tbody>';
    
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
        let requiredWidth = Math.max(800, -minX + varsWidth + 150);
        let varsHeight = uniqueVars.length * 60;
        let requiredHeight = Math.max(400, maxY - minY + 60, varsHeight + 60);
        
        let offsetX = requiredWidth - 100;
        let offsetY = (maxY === -Infinity) ? requiredHeight / 2 : -minY + Math.max(30, (requiredHeight - (maxY - minY)) / 2); 
        
        setPositions(ast, offsetX, offsetY);
        
        let varMap = {};
        let varBusX = {};
        let varStartY = (requiredHeight - varsHeight) / 2 + 30;
        uniqueVars.forEach((v, index) => {
            varMap[v] = { x: 50, y: varStartY + index * 60 };
            varBusX[v] = 90 + index * 15;
        });
        
        injectVarPositions(ast, varMap);
        
        currentScale = 1.0;
        currentRenderState = {
            ast, uniqueVars, varMap, varBusX, requiredWidth, requiredHeight
        };
        
        renderCircuit();
        
        updateSummary(gateCounts, variables, ast);
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
});
