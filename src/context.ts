
import { TFunction }          from '@sinclair/typebox'
import { MiddlewareArray }    from './middleware'
import { Method, MethodCallback } from './method'

// ------------------------------------------------------------------------
// Context
// ------------------------------------------------------------------------

export class Context<M extends MiddlewareArray> {
    constructor(
        public readonly middleware: M
    ) { }
    
    /** Creates a new method for this context */
    public method<F extends TFunction<any[], any>>(signature: F, callback: MethodCallback<M, F>) {
        return new Method(this.middleware, signature, callback)
    }
}
