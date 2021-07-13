
import { Type, TFunction, TSchema, TAny } from '@sinclair/typebox'
import { MiddlewareArray }          from './middleware'
import { Method, MethodCallback }   from './method'
import { Event }                    from './event'

// ------------------------------------------------------------------------
// Service
// ------------------------------------------------------------------------

export class Service<M extends MiddlewareArray> {
    constructor(
        public readonly middleware: M
    ) { }
    
    /** Creates a new method for this context */
    public method(callback: MethodCallback<M, TFunction<[], TAny>>): Method<M, TFunction<[], TAny>>

    /** Creates a new method for this context */
    public method<F extends TFunction<any[], any>>(signature: F, callback: MethodCallback<M, F>): Method<M, F>

    public method(...args: any[]) {
        if(args.length === 2) {
            return new Method(this.middleware, args[0], args[1])
        } else {
            const f = Type.Function([], Type.Any())
            return new Method(this.middleware, f, args[0])
        }
    }

    /** Creates a new event for this context */
    public event<T extends TSchema>(schema: T) {
        return new Event(schema)
    }
}
