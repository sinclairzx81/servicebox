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

import { Type, TFunction, TSchema, TAny }  from '@sinclair/typebox'
import { MiddlewareArray }                 from './middleware'
import { Handler, HandlerCallback }        from './handler'
import { Method, MethodCallback }          from './method'
import { Event }                           from './event'

// ------------------------------------------------------------------------
// Service
// ------------------------------------------------------------------------

export class Service<M extends MiddlewareArray> {
    constructor(
        public readonly middleware: M
    ) { }

    /** Creates a new handler. */
    public handler(callback: HandlerCallback<M>): Handler<M> {
        return new Handler(this.middleware, callback)
    }
    
    /** Creates a new method using this context */
    public method(callback: MethodCallback<M, TFunction<[], TAny>>): Method<M, TFunction<[], TAny>>

    /** Creates a new method using this context */
    public method<F extends TFunction<any[], any>>(signature: F, callback: MethodCallback<M, F>): Method<M, F>
    
    /** Creates a new method using this context */
    public method(...args: any[]) {
        if(args.length === 2) {
            return new Method(this.middleware, args[0], args[1])
        } else {
            const schema = Type.Function([], Type.Any())
            return new Method(this.middleware, schema, args[0])
        }
    }
    
    /** Creates a new event. */
    public event<T extends TSchema>(schema: T) {
        return new Event(schema)
    }
}
