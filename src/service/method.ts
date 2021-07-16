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

import { TFunction, TSchema, Static, UnionToIntersect } from '@sinclair/typebox'
import { MiddlewareArray, Middleware }                  from './middleware'
import { Context }                                      from './context'
import * as exception                                   from './exception'
import addFormats                                       from 'ajv-formats'
import Ajv, { ValidateFunction }                        from 'ajv'

// ------------------------------------------------------------------------
// Static Inference
// ------------------------------------------------------------------------

export type MethodContext<T extends MiddlewareArray> = Context<UnionToIntersect<{
    [K in keyof T]: T[K] extends Middleware<infer U> ? U extends null ? {} : U : never 
}[number]>>

export type MethodReturn<F> = 
    F extends TFunction<any, infer R> ?
        R extends TSchema ? Static<R>
        : never
    : never

export type MethodArguments<M extends MiddlewareArray, F> =
    F extends TFunction<infer P, infer R> ?
        P extends TSchema[] ?
            R extends TSchema   ?
                [MethodContext<M>, ...{ [K in keyof P]: Static<P[K]> }]
            : never 
        : never 
    : never


export type MethodCallback<M extends MiddlewareArray, F> =
    F extends TFunction<infer P, infer R> ?
        P extends TSchema[] ?
            R extends TSchema ?
                (...args: MethodArguments<M, F>) => Promise<MethodReturn<F>> | MethodReturn<F>
            : never 
        : never 
    : never


// ------------------------------------------------------------------------
// Method
// ------------------------------------------------------------------------

export class Method<M extends MiddlewareArray, F extends TFunction<TSchema[], TSchema>> {
    private readonly paramsValidators: ValidateFunction<unknown>[]
    private readonly returnsValidator: ValidateFunction<unknown>
    constructor(
        public readonly middleware: M,
        public readonly schema:     F,
        public readonly callback:   MethodCallback<M, F>
    ) {
        const ajv = addFormats(new Ajv({ allErrors: true }), [
            'date-time', 'time', 'date', 'email', 'hostname', 'ipv4', 'ipv6', 'uri', 'uri-reference', 'uuid', 
            'uri-template', 'json-pointer',  'relative-json-pointer', 'regex'
        ]).addKeyword('kind').addKeyword('modifier')
        this.paramsValidators = schema.arguments.map(schema => ajv.compile(schema))
        this.returnsValidator = ajv.compile(schema.returns)
    }

    private assertArguments(values: unknown[]) {
        try {
            for(let i = 0; i < values.length; i++) {
                const validator = this.paramsValidators[i]
                const param     = values[i]
                if(!validator(param)) throw new exception.InvalidParamsException(validator.errors)
            }
        } catch(error) {
            if(!(error instanceof exception.Exception)) {
                throw new exception.InvalidRequestException({ })
            } else {
                throw error
            }
        }
    }

    private assertReturn(value: unknown) {
        if(!this.returnsValidator(value)) throw new exception.InternalErrorException('Method returned unexpected value')
    }

    /** Executes this function with the given params */
    public async execute(...params: MethodArguments<M, F>): Promise<MethodReturn<F>> {
        this.assertArguments(params.slice(1))
        const result = await this.callback.apply(null, params)
        this.assertReturn(result)
        return result as MethodReturn<F>
    }
}

