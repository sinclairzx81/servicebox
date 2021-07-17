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
export class RecordService {
    public service = new Service([new Authorize()])

    public open = this.service.handler(context => {
        console.log('records:open', context.id, context.identity)
    })

    public close = this.service.handler(context => {
        console.log('records:close', context.id, context.identity)
    })

    public add = this.service.method(Add, (context, a, b) => {
        console.log(context.identity)
        return a + b
    })
}
export class MathService {
    public service = new Service([new Authorize()])

    public $add    = this.service.event(AddEvent)
    public $remove = this.service.event(AddEvent)
    public $update = this.service.event(AddEvent)
    
    public open = this.service.handler(context => {
        console.log('math:open', context.id)
    })

    public $close = this.service.handler(context => {
        console.log('math:close', context.id)
    })

    public add = this.service.method(Add, (context, a, b) => {
        console.log(context.identity)
        return a + b
    })

    public remove = this.service.method(Add, (context, a, b) => {
        context.host.close(context.id)
        return a - b
    })
}

const host = new Host({
    records: new RecordService(),
    math: new MathService()
})
host.listen(5000)


async function start() {

    const client = new Client('http://localhost:5000')

    await client.executeMany([
        { method: 'math/add', params: [1, 2] },
        { method: 'records/add', params: [1, 2] },
        { method: 'math/add', params: [1, 2] },
        { method: 'math/add', params: [1, 2] },
        { method: 'math/add', params: [1, 2] }
    ])
}


start()