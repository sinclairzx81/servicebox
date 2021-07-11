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

import { TFunction, TSchema, Static }              from '@sinclair/typebox'
import { MiddlewareArrayContext, MiddlewareArray } from './middleware'
import addFormats                                  from 'ajv-formats'
import Ajv, { ValidateFunction }                   from 'ajv'
import * as exception                              from './exception'

// ------------------------------------------------------------------------
// Static Inference
// ------------------------------------------------------------------------

export type MethodReturn<F> = 
    F extends TFunction<any, infer R> ?
        R extends TSchema ? Static<R>
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

export type MethodCallback<M, F> =
    M extends MiddlewareArray ?
        F extends TFunction<infer P, infer R> ?
            P extends TSchema[] ?
                R extends TSchema ?
                    (...args: MethodArguments<M, F>) => Promise<MethodReturn<F>> | MethodReturn<F>
                : never 
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
        public readonly signature:  F,
        public readonly callback:   MethodCallback<M, F>
    ) {
        const ajv = addFormats(new Ajv({ allErrors: true }), [
            'date-time', 'time', 'date', 'email', 'hostname', 
            'ipv4', 'ipv6', 'uri', 'uri-reference', 'uuid', 
            'uri-template', 'json-pointer',  'relative-json-pointer', 
            'regex'
        ]).addKeyword('kind').addKeyword('modifier')
        this.paramsValidators = signature.arguments.map(schema => ajv.compile(schema))
        this.returnsValidator = ajv.compile(signature.returns)
    }

    private assertParams(values: unknown[]) {
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

    private assertReturns(value: unknown) {
        if(!this.returnsValidator(value)) {
            throw new exception.InternalErrorException('Method returned unexpected value')
        }
    }

    /** Executes this function with the given params */
    public async execute(...params: MethodArguments<M, F>): Promise<MethodReturn<F>> {
        this.assertParams(params.slice(1))
        const result = await this.callback.apply(null, params)
        this.assertReturns(result)
        return result as MethodReturn<F>
    }
}
