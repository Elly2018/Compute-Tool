import Chalk from 'chalk';
import { rmSync } from 'fs';
import Path from 'path';
import Vite from 'vite';
import compileTs from './private/tsc';

function buildRenderer() {
    return Vite.build({
        configFile: Path.join(__dirname, '..', 'vite.config.js'),
        base: './',
        mode: 'production'
    });
}

function buildMain() {
    const mainPath = Path.join(__dirname, '..', 'src', 'main');
    return compileTs(mainPath);
}

function RemoveFolders(){
    rmSync(Path.join(__dirname, '..', 'build', 'main'), {
        recursive: true,
        force: true,
    })
    
    rmSync(Path.join(__dirname, '..', 'build', 'renderer'), {
        recursive: true,
        force: true,
    })
    
    rmSync(Path.join(__dirname, '..', 'dist'), {
        recursive: true,
        force: true,
    })
}

export async function main(){
    RemoveFolders()
    const w1 = buildRenderer()
    const w2 = buildMain()
    
    return Promise.allSettled([
        w1, w2
    ]).then(() => {
        console.log(Chalk.greenBright('Renderer & main successfully transpiled! (ready to be built with electron-builder)'));
    });
}

if (require.main === module) {
    main();
}
