const Path = require('path');
const Chalk = require('chalk');
const compileTs = require('./private/tsc');
const { copyFile } = require('fs/promises');

function buildNode() {
    const nodePath = Path.join(__dirname, '..', 'src', 'node');
    return compileTs(nodePath);
}

function copyPackageJson() {
    const from = Path.join(__dirname, '..', 'node_package.json');
    const to = Path.join(__dirname, '..', 'build', 'node', 'package.json');
    return copyFile(from, to)
}

Promise.allSettled([
    buildNode(),
    copyPackageJson()
]).then(() => {
    console.log(Chalk.greenBright('Node successfully transpiled!'));
}).catch(err => console.error(err))