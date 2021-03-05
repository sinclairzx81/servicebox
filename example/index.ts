// -----------------------------------------
// Service
// -----------------------------------------

import { Service, Method, Type } from '@sinclair/servicebox'

const service = new Service({ 
    "add": new Method([], {
        request: Type.Tuple([
            Type.Number(), 
            Type.Number()
        ]),
        response: Type.Number()
    }, (context, [a, b]) => {
        return a + b
    })
 })

// -----------------------------------------
// Host
// -----------------------------------------

import { createServer } from 'http'

createServer((req, res) => service.request(req, res)).listen(5000)

// -----------------------------------------
// ServiceClient
// -----------------------------------------

import { ServiceClient } from './client'

const client = new ServiceClient('http://localhost:5000')

async function test() {
    for(let i = 0; i < 1000000; i++) {
        await client.execute('add', [i, i + 1])
            .then(console.log)
            .catch(console.log)
    }
}
test()


