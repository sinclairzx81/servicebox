import * as http from 'http'

import { Host, Type, Context } from '@sinclair/servicebox'

export const Add = Type.Function([Type.Number(), Type.Number()], Type.Number(), { description: `Adds two numbers` })

export class Service {
    private readonly context = new Context([])

    public add = this.context.method(Add, (context, a, b) => {
        return a + b
    })
}

const host = new Host(new Service())

host.listen(5000)







// const service = new Service({
//     ...new MathService()
// })



