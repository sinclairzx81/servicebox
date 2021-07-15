import { Host, Type, Service } from '@sinclair/servicebox'

import { Client } from './client'

export const AddEvent = Type.Tuple([Type.Number(), Type.Number()])

export const Add   = Type.Function([Type.Number(), Type.Number()], Type.Number())

export class Authorize {
    map(request) {
        return { a: 'dave' }
    }
}

export class MathService {
    public readonly service = new Service([new Authorize()])

    $add    = this.service.event(AddEvent)
    $remove = this.service.event(AddEvent)
    $update = this.service.event(AddEvent)

    public connect = this.service.handler(context => {
        console.log('context:connect')
    })

    public add = this.service.method(Add, (context, a, b) => {
        console.log(context.identity)
        return a + b
    })

    public remove = this.service.method(Add, (context, a, b) => {
        console.log(context.identity)
        return a - b
    })

    public close = this.service.handler(context => {
        
        console.log('context:close')
    })
}

const host = new Host({
   
   math: new MathService()
})


host.listen(5000)

async function start() {

    const client = new Client('http://localhost:5000')

    const result = await client.execute('math/add', 1, 2)

    console.log('result', result)
}

start()

