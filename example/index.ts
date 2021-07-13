import { Type, Service, Method, Event, IncomingMessage, TSchema, TFunction, TAny } from '@sinclair/servicebox'

export const AddEvent = Type.Tuple([Type.Number(), Type.Number()])

export const Add   = Type.Function([Type.Number(), Type.Number()], Type.Number())

export class Authorize {
   public map(request: IncomingMessage) {
        return { 
            username: 'dave',
            password: 'secret'
        }
   }
}

export class MathService {
    private readonly contexts = new Set<string>()
    public readonly service = new Service([new Authorize()])
    onAdd    = this.service.event(AddEvent)
    onRemove = this.service.event(AddEvent)
    onKick   = this.service.event(AddEvent)

    add = this.service.method(Add, (context, a, b) => {
        for(const id of this.contexts) {
            this.onAdd.send(id, [a, b])
        }
        return a + b
    })

    connect = this.service.handler(context => {
        this.contexts.add(context.id)
    })

    close = this.service.handler(context => {
        this.contexts.delete(context.id)
    })
}

export type Services = {[key: string]: any }

export class Host {
    private readonly methods: Map<string, Method<any[], TFunction<TAny[], TAny>>>
    private readonly events:  Map<string, Event<TSchema>>

    constructor(services: Services) {
        this.methods = new Map<string, Method<any[], TFunction<TAny[], TAny>>>()
        this.events  = new Map<string, Event<TSchema>>()
        this.loadServices(services)
    }

    // ---------------------------------------------------------------------
    // Service Registration
    // ---------------------------------------------------------------------
    
    private loadEvents(namespace: string, service: any) {
        for(const [name, event] of Object.entries(service)) {
            if(!(event instanceof Event)) continue
            this.events.set(`${namespace}/${name}`, event)
        }
    }
    private loadMethods(namespace: string, service: any) {
        for(const [name, method] of Object.entries(service)) {
            if(!(method instanceof Method)) continue
            this.methods.set(`${namespace}/${name}`, method)
        }
    }

    private loadHandlers(namespace: string, service: any) {
        for(const [name, handler] of Object.entries(service)) {
            if(!(handler instanceof Method)) continue
            this.methods.set(`${namespace}/${name}`, handler)
        }
    }

    private loadServices(services: Services) {
        for(const [namespace, service] of Object.entries(services)) {
            this.loadHandlers(namespace, service)
            this.loadMethods(namespace, service)
            this.loadEvents(namespace, service)
        }
    }
}

const service = new MathService()

console.log(service)

// const host = new Host({
//     "math":  new MathService(),
//     "users": new MathService()
// })


// console.log(host)




// const service = new Service({
//     ...new MathService()
// })



