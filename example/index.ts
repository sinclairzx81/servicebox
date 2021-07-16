import { ServiceType, Type, Service, Request, Client, Handler, Host} from '@sinclair/servicebox'

export const AddEvent = Type.Tuple([Type.Number(), Type.Number()])

export const Add   = Type.Function([Type.Number(), Type.Number()], Type.Number())

export class Authorize {
    map(request: Request) {
        return {
            username: 'hayden'
        }
    }
}

export class MathService {
    public readonly service = new Service([new Authorize()])
    public readonly $add    = this.service.event(AddEvent)
    public readonly $remove = this.service.event(AddEvent)
    public readonly $update = this.service.event(AddEvent)

    public connect = this.service.handler(context => {
        console.log('context:connect', context.id, context.identity)
    })
    
    public close = this.service.handler(context => {
        console.log('context:close', context.id, context.identity)
    })

    public add = this.service.method(Add, (context, a, b) => {
        console.log(context.identity)
        return a + b
    })

    public remove = this.service.method(Add, (context, a, b) => {
        console.log(context.identity)
        context.host.close(context.id)
        return a - b
    })
}

const host = new Host({
    math: new MathService()
})
host.listen(5000)



const client = new Client('http://localhost:5000')

client.executeMany([
    { method: 'math/add', params: [1, 2] },
    { method: 'math/add', params: [1, 2] },
    { method: 'math/add', params: [1, 2] },
    { method: 'math/add', params: [1, 2] },
    { method: 'math/add', params: [1, 2] }
])


