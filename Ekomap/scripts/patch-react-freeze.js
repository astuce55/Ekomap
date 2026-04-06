const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../node_modules/react-freeze/dist/index.js');
const content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('freezeEnabled')) {
  fs.appendFileSync(filePath, '\nexports.freezeEnabled = function() { return true; };\n');
  console.log('✅ react-freeze patché avec succès');
}