const fs = require('fs');
const path = require('path');
const parser = require('/tmp/jsx_check/node_modules/@babel/parser');
const traverse = require('/tmp/jsx_check/node_modules/@babel/traverse').default;

let totalErrors = 0;

function walk(dir) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.jsx')) {
      checkFile(fullPath);
    }
  }
}

function checkFile(file) {
  const code = fs.readFileSync(file, 'utf-8');
  let ast;
  try {
    ast = parser.parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
  } catch (e) {
    return;
  }

  traverse(ast, {
    JSXText(path) {
      const text = path.node.value;
      if (text.trim().length > 0) {
        if (path.parent.type === 'JSXElement' && path.parent.openingElement.name.name !== 'Text' && path.parent.openingElement.name.name !== 'Animated.Text' && path.parent.openingElement.name.name !== 'Svg' && path.parent.openingElement.name.name !== 'tspan' && path.parent.openingElement.name.name !== 'TSpan') {
          console.log(`[${file}] Line ${path.node.loc.start.line}: Bare JSXText '${text.trim()}' inside <${path.parent.openingElement.name.name}>`);
          totalErrors++;
        }
      }
    },
    JSXExpressionContainer(path) {
      if (path.parent.type === 'JSXElement' && path.parent.openingElement.name.name !== 'Text' && path.parent.openingElement.name.name !== 'Animated.Text') {
        const isStringLiteral = path.node.expression.type === 'StringLiteral';
        const isNumericLiteral = path.node.expression.type === 'NumericLiteral';
        const isTemplateLiteral = path.node.expression.type === 'TemplateLiteral';
        
        // LogicalExpression like length && <View>
        if (path.node.expression.type === 'LogicalExpression' && path.node.expression.operator === '&&') {
          const left = path.node.expression.left;
          // if left is a MemberExpression and property is 'length'
          if (left.type === 'MemberExpression' && left.property.name === 'length') {
            console.log(`[${file}] Line ${path.node.loc.start.line}: Bare expression evaluating to number '${code.substring(left.start, left.end)}' inside <${path.parent.openingElement.name.name}>`);
            totalErrors++;
          }
        }
        
        if (isStringLiteral || isTemplateLiteral || isNumericLiteral) {
          console.log(`[${file}] Line ${path.node.loc.start.line}: Bare Literal inside <${path.parent.openingElement.name.name}>`);
          totalErrors++;
        }
      }
    }
  });
}

walk('src');

if (totalErrors === 0) {
  console.log("No JSXText errors found in entire src directory.");
}
