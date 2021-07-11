import * as http from 'http'
// -----------------------------------------
// Service
// -----------------------------------------

import { Host, Type, Context } from '@sinclair/servicebox'


export const Add = Type.Function([Type.Number(), Type.Number()], Type.Number(), { description: `Adds two numbers` })
export const Sub = Type.Function([Type.Number(), Type.Number()], Type.Number())

export class MathService {
    private readonly context = new Context([ 
        { map: () => ({username: this.database}) }
    ])

    constructor(private readonly database: string) {}

    public add = this.context.method(Add, (context, a, b) => {
        return a + b
    })

    public sub = this.context.method(Sub, (context, a, b) => {
        console.log(this.database)
        return a - b
    })
}


const service = new MathService('this is the database')

console.log(service)

async function start() {

    const result = await service.add.execute({
        username: 'dave'
    }, 1, 2)

    console.log(await service.sub.execute({
        username: 'dave'
    }, 1, 2))

}
// start()




// const service = new Service({
//     ...new MathService()
// })



