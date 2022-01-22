const fs = require('fs');
const path = require('path');
const globby = require('globby');

async function run() {
  const files = await globby(path.join(__dirname, '../examples/data/*.json'));

  for (let file of files) {
    const data = await fs.promises.readFile(file, 'utf8');
    const compressed = JSON.stringify(JSON.parse(data));
    await fs.promises.writeFile(file, compressed);
  }
}

run();
