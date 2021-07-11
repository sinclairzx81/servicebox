
import { TFunction, TBox } from '@sinclair/typebox'
import { MiddlewareArray } from './middleware'
import { Method, MethodBody } from './method'

// ------------------------------------------------------------------------
// Context
// ------------------------------------------------------------------------

export class Context<Middleware extends MiddlewareArray> {
    constructor(
        public readonly middleware: Middleware
    ) { }
    
    /** Creates a new method for this context */
    public method<S extends TFunction<any[], any>>(signature: S, body: MethodBody<Middleware, S>, boxes: TBox<any>[] = []) {
        return new Method(this.middleware, signature, body, boxes)
    }
}
