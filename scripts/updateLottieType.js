const { compile, compileFromFile } = require('json-schema-to-typescript');
const $RefParser = require('@apidevtools/json-schema-ref-parser');

const fs = require('fs');

// compile from file
compileFromFile(__dirname + '/../schema/animation.json', {
  cwd: __dirname + '/../schema/',
}).then((ts) => fs.writeFileSync(__dirname + '/../src/lottie.type.ts', ts));
