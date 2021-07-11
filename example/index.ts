import * as http from 'http'
// -----------------------------------------
// Service
// -----------------------------------------

import { Service, Type, Context } from '@sinclair/servicebox'

const Space = Type.Box('Space', {
    Number: Type.Number()
})

// Define a method signature
export const Add = Type.Function([
    Type.Tuple([Type.Ref(Space, 'Number'), Type.String()])
], Type.Number())

export class MathService {

    // Define a method context.
    private readonly context = new Context([ 
        { map: () => ({a: 1}) }
    ])

    // Define a method
    public add = this.context.method(Add, (context, a) => {

        throw 1

    }, [Space])
}


const service = new MathService()

service.add.execute({a: 1}, [1, '1'])

console.log(service)





// const service = new Service({
//     ...new MathService()
// })



