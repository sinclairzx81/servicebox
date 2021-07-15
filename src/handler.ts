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

import { UnionToIntersect }            from '@sinclair/typebox'
import { MiddlewareArray, Middleware } from './middleware'
import { Context }                     from './context'

// ------------------------------------------------------------------------
// Handler
// ------------------------------------------------------------------------

export type HandlerContext<T extends MiddlewareArray> = Context<UnionToIntersect<{
    [K in keyof T]: T[K] extends Middleware<infer U> ? U extends null ? {} : U : never 
}[number]>>
export type HandlerReturn = Promise<any> | any
export type HandlerArguments<M extends MiddlewareArray> = [HandlerContext<M>]
export type HandlerCallback<M extends MiddlewareArray> = (...args: HandlerArguments<M>) => Promise<HandlerReturn> | HandlerReturn

/** A handler for receiving socket events */
export class Handler<M extends MiddlewareArray> {
    constructor(
        public readonly middleware: M,
        public readonly callback: HandlerCallback<M>
    ) {}

    public execute() {
    }
}