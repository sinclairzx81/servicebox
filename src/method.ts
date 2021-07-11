/*--------------------------------------------------------------------------

ServiceBox: Type Safe Web Services for Node

The MIT License (MIT)

Copyright (c) 2021 Haydn Paterson (sinclair) <haydn.developer@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

---------------------------------------------------------------------------*/

import { TFunction, TBox, TSchema, Static }        from '@sinclair/typebox'
import { MiddlewareArrayContext, MiddlewareArray } from './middleware'
import addFormats                                  from 'ajv-formats'
import Ajv, { ValidateFunction }                   from 'ajv'

// ------------------------------------------------------------------------
// Static Inference
// ------------------------------------------------------------------------

export type MethodReturn<F> = 
    F extends TFunction<any, infer R> ?
        R extends TSchema ? 
            Static<R> | Promise<Static<R>>
        : never
    : never


export type MethodArguments<M, F> =
    M extends MiddlewareArray ?
        F extends TFunction<infer P, infer R> ?
            P extends TSchema[] ?
                R extends TSchema   ?
                    [MiddlewareArrayContext<M>, ...{ [K in keyof P]: Static<P[K]> }]
                : never 
            : never 
        : never
    : never

export type MethodBody<M, F> =
    M extends MiddlewareArray ?
        F extends TFunction<infer P, infer R> ?
            P extends TSchema[] ?
                R extends TSchema ?
                    (...args: MethodArguments<M, F>) => MethodReturn<F>
                : never 
            : never 
        : never
    : never


// ------------------------------------------------------------------------
// Method
// ------------------------------------------------------------------------

export class Method<M extends MiddlewareArray, F extends TFunction<TSchema[], TSchema>> {
    private readonly validators: ValidateFunction<unknown>[]
    constructor(
        private readonly middleware: M,
        private readonly signature:  F,
        private readonly body:       MethodBody<M, F>,
        private readonly boxes:      TBox<any>[]
    ) { 
        const ajv = addFormats(new Ajv({ allErrors: true }), [
            'date-time', 'time', 'date', 'email', 'hostname', 
            'ipv4', 'ipv6', 'uri', 'uri-reference', 'uuid', 
            'uri-template', 'json-pointer',  'relative-json-pointer', 
            'regex'
        ]).addKeyword('kind').addKeyword('modifier')
        this.boxes.forEach(box => ajv.addSchema(box))
        this.validators = signature.arguments.map(schema => ajv.compile(schema))
    }

    public execute(...args: MethodArguments<M, F>): MethodReturn<F> {
        // todo: implement execute function
        throw 1
    }
}
