import * as http from 'http'
// -----------------------------------------
// Service
// -----------------------------------------

import { Service, Type, Context } from '@sinclair/servicebox'

const Space = Type.Box('Space', {
    Number: Type.Number()
})

// Define a method signature
export const Add = Type.Function([Type.Ref(Space, 'Number'), Type.Number()], Type.Number())

export class MathService {

    // Define a method context.
    private readonly context = new Context([ /** middleware */ ])

    // Define a method
    public add = this.context.method(Add, (context, a, b) => {

        return a + b

    }, [Space])
}


const service = new MathService()



console.log(service)





// const service = new Service({
//     ...new MathService()
// })



