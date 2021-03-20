// -----------------------------------------
// Service
// -----------------------------------------

import { Service, Method, Type } from '@sinclair/servicebox'

export class Foo {
    ["add"] = new Method([{
        map: () => ({a: 1})
    }], {
        request: Type.Tuple([
            Type.Number(),
            Type.Number()
        ]),
        response: Type.Number()
    }, (context, [a, b]) => {
        return a + b
    })
}

const service = new Service({
    ...new Foo()
})

// -----------------------------------------
// Host
// -----------------------------------------

import { createServer } from 'http'

createServer((req, res) => service.request(req, res)).listen(5000)

// -----------------------------------------
// simple client
// -----------------------------------------

import { post } from './post'

async function test() {
    const response = await post('http://localhost:5000', [
        { jsonrpc: '2.0', id: 0, method: 'add', params: [10, 20] },
        { jsonrpc: '2.0', id: 1, method: 'add', params: [20, 30] },
        { jsonrpc: '2.0', id: 2, method: 'add', params: [30, 40] }
    ])
    console.log(response)
}
test()


