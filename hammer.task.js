import { file, folder, shell, } from '@sinclair/hammer'

// Cleans the project.
export async function clean() {
    await folder('target').delete()
}

// Runs the example project.
export async function start(target = 'target/example') {
    await shell(`hammer run example/index.ts --dist ${target}`)
}

// Runs the specs for this project.
export async function spec(target = 'target/spec') {
    await shell(`tsc spec/index.ts --outDir ${target}`)
    await shell(`cd ${target} && mocha ./index.js`)
}

// Builds this package and packs it for npm publishing.
export async function build(target = 'target/build') {
    await folder(`${target}`).delete()
    const options = `--target ESNext --declaration --downlevelIteration --moduleResolution node`
    await shell(`tsc src/servicebox.ts --outDir ${target} ${options}`)
    await folder(`${target}`).add('package.json')
    await folder(`${target}`).add('readme.md')
    await folder(`${target}`).add('license')
    await shell(`cd ${target} && npm pack`)
    
    // npm publish sinclair-servicebox-0.x.x.tgz --access=public
}