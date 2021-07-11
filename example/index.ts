import * as http from 'http'
// -----------------------------------------
// Service
// -----------------------------------------

import { Host, Type, Context } from '@sinclair/servicebox'


// Define a method signature
export const Add = Type.Function([Type.Number(), Type.Number()], Type.Number())

export class MathService {

    // Define a method context.
    private readonly context = new Context([ 
        { map: () => ({username: 'dave'}) }
    ])

    // Define a method
    public add = this.context.method(Add, (context, a, b) => {
        return a + b
    })
}


const service = new MathService()

service.add.execute({
    username: 'dave'
}, 1, 2)

console.log(service)





// const service = new Service({
//     ...new MathService()
// })



