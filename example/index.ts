// -----------------------------------------
// Service
// -----------------------------------------

import { Service, Method, Type, Exception } from '@sinclair/servicebox'

class Foo {
    ["create-user"] = new Method([], {
        request: Type.Tuple([
            Type.Number(),
            Type.Number()
        ]),
        response: Type.Number()
    }, (context, [a, b]) => {
        return a + b
    })
}

export class Bar {
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
    ...new Foo(),
    ...new Bar()
})

service.execute('add', { 
    a: 1
}, [1, 2])


// -----------------------------------------
// Host
// -----------------------------------------

import { createServer } from 'http'

createServer((req, res) => {
    service.request(req, res)
}).listen(5000)

// -----------------------------------------
// ServiceClient
// -----------------------------------------

import { ServiceClient } from './client'

const client = new ServiceClient('http://localhost:5000')

async function test() {
    for (let i = 0; i < 100; i++) {
        await client.execute('add', [i, i + 1])
            .then(console.log)
            .catch(console.log)
    }
}
test()


