import { Host, Type, Service } from '@sinclair/servicebox'

export const AddEvent = Type.Tuple([Type.Number(), Type.Number()])

export const Add   = Type.Function([Type.Number(), Type.Number()], Type.Number())

export class Authorize {
   public map(request: any) {
        return { 
            username: 'dave',
            password: 'secret'
        }
   }
}

export class MathService {
    public readonly  service  = new Service([new Authorize()])
    private readonly contexts = new Set<string>()

    $add    = this.service.event(AddEvent)
    $remove = this.service.event(AddEvent)
    $update = this.service.event(AddEvent)

    public connect = this.service.handler(context => this.contexts.add(context.id))
    public close   = this.service.handler(context => this.contexts.delete(context.id))
    public add     = this.service.method(Add, (context, a, b) => {
        for(const id of this.contexts) {
            this.$add.send(id, [a, b])
        }
        return a + b
    })
}

const service = new MathService()

const host = new Host({
   math: new MathService()
})
host.listen(5000)

