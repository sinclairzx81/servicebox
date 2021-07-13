import * as http from 'http'

import { Host, Type, Service } from '@sinclair/servicebox'


export const AddEvent = Type.Tuple([Type.Number(), Type.Number()])

export const Add   = Type.Function([Type.Number(), Type.Number()], Type.Number())


export class Authorize {
   public map(request: any) {
        return { username: 'dave' }
   }
}

export class MathService {

    private readonly service = new Service([new Authorize()])
    
    public onAdd = this.service.event(AddEvent)

    public add = this.service.method(Add, async (context, a, b) => {

        this.onAdd.send(context.username, [a, b])
        
        return a + b
    })

    public open = this.service.method(context => {

    })

    public close = this.service.method(context => {
        
    })
}

const service = new MathService()
console.log(service)

service.onAdd.receive((id, data) => console.log('leave', id, data))
service.add.execute({
    username: 'dave'
}, 1, 2)

const host = new Host(new MathService())

host.listen(5000)







// const service = new Service({
//     ...new MathService()
// })



