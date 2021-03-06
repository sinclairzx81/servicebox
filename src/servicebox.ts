/*--------------------------------------------------------------------------

ServiceBox: Typed Web Services for NodeJS

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

import { Type, Static, TSchema, UnionToIntersect } from '@sinclair/typebox'
import { IncomingMessage, ServerResponse }         from 'http'
import addFormats                                  from 'ajv-formats'
import Ajv, { ValidateFunction }                   from 'ajv'

// ------------------------------------------------------------------------
// TypeBox
// ------------------------------------------------------------------------

export * from '@sinclair/typebox'

// ------------------------------------------------------------------------
// Middleware
// ------------------------------------------------------------------------

export type Middleware<Context extends object | null>  = {
    
    map: (request: IncomingMessage) => Context | Promise<Context> | null | Promise<null>
}

// ------------------------------------------------------------------------
// MiddlewareArray
// ------------------------------------------------------------------------

export type MiddlewareArray = Middleware<object | null>[]

export type MiddlewareArrayContext<T extends MiddlewareArray> = UnionToIntersect<{

    [K in keyof T]: T[K] extends Middleware<infer U> ? U extends null ? {} : U : never 

}[number]>


// ------------------------------------------------------------------------
// Contract
// ------------------------------------------------------------------------

export type Contract<
    Request  extends TSchema, 
    Response extends TSchema
> = {
    description?: string,
    request:  Request,
    response: Response
}

// ------------------------------------------------------------------------
// MethodBody
// ------------------------------------------------------------------------

export type MethodBody<
    Middleware extends MiddlewareArray,
    Request    extends TSchema,
    Response   extends TSchema
> = (
    context:  MiddlewareArrayContext<Middleware>,
    request:  Static<Request>,
) => Promise<Static<Response>> | Static<Response>

// ------------------------------------------------------------------------
// Method
// ------------------------------------------------------------------------

export class Method<
    Middleware extends MiddlewareArray,
    Request    extends TSchema,
    Response   extends TSchema
> {
    constructor(
        public readonly middleware: Middleware,
        public readonly contract:   Contract<Request, Response>,
        public readonly execute:    MethodBody<Middleware, Request, Response>
    ) { }
}

// ------------------------------------------------------------------------
// Context
// ------------------------------------------------------------------------

export class Context<Middleware extends MiddlewareArray> {
    constructor(
        public readonly middleware: Middleware
    ) {}

    public method<
        Request  extends TSchema, 
        Response extends TSchema
    >(
        contract: Contract<Request, Response>, 
        execute:  MethodBody<Middleware, Request, Response>
    ) {
        return new Method(
            this.middleware, 
            contract, 
            execute
        )
    }
}

// ------------------------------------------------------------------------
// Exception
// ------------------------------------------------------------------------

export class Exception extends Error {
    constructor(message: string = '', 
        public readonly code: number = -32000, 
        public readonly data: unknown = null) {
        super(message)
    }
}

export class ParseException extends Exception {
    constructor(data: unknown) {
        super('Parse error', -32700, data)
    }
}

export class InvalidRequestException extends Exception {
    constructor(data: unknown) {
        super('Invalid request', -32600, data)
    }
}

export class MethodNotFoundException extends Exception {
    constructor(data: unknown) {
        super('Method not found', -32601, data)
    }
}

export class InvalidParamsException extends Exception {
    constructor(data: unknown) {
        super('Invalid params', -32602, data)
    }
}

export class InternalErrorException extends Exception {
    constructor(data: unknown) {
        super('Internal error', -32603, data)
    }
}

// ------------------------------------------------------------------------
// Protocol Request Response
// ------------------------------------------------------------------------

export type RpcRequest = Static<typeof RpcRequest>
export const RpcRequest = Type.Object({
    jsonrpc: Type.Literal("2.0"),
    id:      Type.Optional(Type.Number()),
    method:  Type.String(),
    params:  Type.Unknown()
})

export class RpcResult {
    public jsonrpc: string = '2.0'
    constructor(public readonly id: number | null,
                public readonly result: unknown) {}
}

export class RpcError {
    public jsonrpc: string = '2.0'
    constructor(public id: number | null, 
                public error: { 
                    code: number, 
                    message: string, 
                    data: unknown 
                }) {}

    public static from_exception(id: number | null, exception: Exception) {
        return new RpcError(id, {
            code: exception.code,
            data: exception.data,
            message: exception.message
        })
    }
}

export const RpcBatchRequest  = Type.Array(RpcRequest)

export type  RpcBatchRequest  = Static<typeof RpcBatchRequest>

export type  RpcBatchResponse = Array<RpcResult | RpcError>

// ------------------------------------------------------------------------
// Validator
// ------------------------------------------------------------------------

export class Validator {
    private static ajv = addFormats(new Ajv({ allErrors: true }), [
        'date-time', 'time', 'date', 'email', 'hostname', 
        'ipv4', 'ipv6', 'uri', 'uri-reference', 'uuid', 
        'uri-template', 'json-pointer',  'relative-json-pointer', 
        'regex'
    ]).addKeyword('kind').addKeyword('modifier')
    
    readonly #validate:  ValidateFunction

    constructor(public readonly schema: TSchema) {
        this.#validate  = Validator.ajv.compile(schema)
    }
    /** Validates the given data against this validators schema. */
    public validate (data: unknown): [boolean, unknown] {
        return this.#validate(data) ? [true, null] : [false, this.#validate.errors]
    }
}

// ------------------------------------------------------------------------
// ServiceMethods
// ------------------------------------------------------------------------

export interface ServiceMethods {
    [name: string]: Method<MiddlewareArray, any, any>
}

export type ServiceMethodContext<T>  = T extends Method<infer U, any, any> ? MiddlewareArrayContext<U> : never

export type ServiceMethodRequest<T>  = T extends Method<any, infer U, any> ? Static<U> : never

export type ServiceMethodResponse<T> = T extends Method<any, any, infer U> ? Static<U> : never

// ------------------------------------------------------------------------
// Service
// ------------------------------------------------------------------------

export class Service<T extends ServiceMethods> {
    readonly #methods:  Map<string, [Method<MiddlewareArray, any, any>, Validator]>
    readonly #protocol: Validator

    /** Constructs this service using the given methods. */
    constructor(methods: T) {
        this.#protocol = new Validator(RpcBatchRequest)
        this.#methods = new Map<string, [Method<MiddlewareArray, any, any>, Validator]>()
        Object.entries(methods).filter(([name, method]) => {
            return method instanceof Method
        }).forEach(([name, method]) => {
            const validator = new Validator(method.contract.request)
            this.#methods.set(name, [method, validator])
        })
    }

    /** Executes a method on this service. */
    public async execute<K extends keyof T>(
        key: K, 
        context: ServiceMethodContext<T[K]>, 
        request: ServiceMethodRequest<T[K]>
    ): Promise<ServiceMethodResponse<T[K]>> {
        const [method, validator] = this.get_method(key as string)
        const [success, error] = validator.validate(request)
        if(!success) throw new InvalidParamsException(error)
        return method.execute(context, request)
    }

    /** Returns metadata for this service. */
    public get metadata(): {[method: string]: Contract<any, any> } {
        const metadata = {} as {[method: string]: Contract<any, any> }
        for(const [name, [method]] of this.#methods) {
            metadata[name] = method.contract
        }
        return metadata
    }

    /** Reads a buffer from the http request stream. */
    private read_buffer(request: IncomingMessage): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const buffers = [] as Buffer[]
            request.on('data',  buffer => buffers.push(buffer))
            request.on('error', error  => reject(error))
            request.on('end',   ()     => resolve(Buffer.concat(buffers)))
        })
    }
    
    /** Reads a json object from the http request stream. */
    private async read_request_object(request: IncomingMessage): Promise<unknown> {
        try {
            const buffer = await this.read_buffer(request)
            const text = buffer.toString('utf8')
            return JSON.parse(text)
        } catch (error) {
            throw new ParseException({})
        }
    }

    /** Reads the rpc_batch_request from the http request stream. */
    private async read_rpc_batch_request(request: IncomingMessage): Promise<RpcBatchRequest> {
        const batch_rpc_request = await this.read_request_object(request)
        const [success, error] = this.#protocol.validate(batch_rpc_request)
        if(!success) throw new InvalidRequestException(error)
        return batch_rpc_request as RpcBatchRequest
    }

    /** Returns the method from the given rpc_request. */
    private get_method(key: string): [Method<MiddlewareArray, any, any>, Validator] {
        if(!this.#methods.has(key)) throw new MethodNotFoundException({ method: key })
        return this.#methods.get(key)!
    }

    /** Validates the request parameters for a method. */
    private validate_params(validator: Validator, params: unknown) {
        const [success, errors] = validator.validate(params)
        if(!success) throw new InvalidParamsException(errors)
    }

    /** Executes the methods middleware stack and returns the aggregated context. */
    private async read_context(request: IncomingMessage, method: Method<MiddlewareArray, any, any>) {
        const contexts = []
        for(const middleware of method.middleware) {
            const context = await middleware.map(request)
            if(context === null) continue
            contexts.push(context)
        }
        return contexts.reduce((acc, context) => {
            return { ...acc, ...context}
        }, {})
    }

    /** Writes a buffer to the http response stream. */
    private async write_buffer(response: ServerResponse, buffer: Buffer): Promise<void> {
        return new Promise(resolve => response.write(buffer, () => response.end(() => resolve())))
    }

    /** Writes an rpc response to the http response stream. */
    private async write_rpc_batch_response(response: ServerResponse, rpc_batch_response: RpcBatchResponse): Promise<void> {
        response.statusCode = 200
        response.setHeader('Content-Type', 'application/json')
        await this.write_buffer(response, Buffer.from(JSON.stringify(rpc_batch_response)))
    }

    /** Returns this services description as JSON. */
    private async send_metadata(request: IncomingMessage, response: ServerResponse) {
        response.statusCode = 200
        response.setHeader('Content-Type', 'application/json')
        await this.write_buffer(response, Buffer.from(JSON.stringify(this.metadata, null, 2)))
    }
    
    private async execute_method(request: IncomingMessage, rpc_request: RpcRequest): Promise<RpcResult | RpcError> {
        let id = null
        try {
            id = rpc_request.id || null
            const [method, validator] = this.get_method(rpc_request.method)
            this.validate_params(validator, rpc_request.params)
            const context = await this.read_context(request, method) as any
            const result  = await this.execute(
                rpc_request.method, 
                context, 
                rpc_request.params as any
            )
            return new RpcResult(id, result)
        } catch(error) {
            return !(error instanceof Exception)
                ? RpcError.from_exception(id, new Exception('An error occured', -32000, {}))
                : RpcError.from_exception(id, error)
        }
    }

    /** Executes a method on this service. */
    private async execute_batch(request: IncomingMessage, response: ServerResponse) {
        try {
            const batch_rpc_request = await this.read_rpc_batch_request(request)
            const batch_rpc_response = []
            for(const rpc_request of batch_rpc_request) {
                const result = await this.execute_method(request, rpc_request)
                batch_rpc_response.push(result)
            }
            await this.write_rpc_batch_response(response, batch_rpc_response)
        } catch(error) {
            const rpc_error = !(error instanceof Exception)
                ? RpcError.from_exception(0, new Exception('An error occured', -32000, {}))
                : RpcError.from_exception(0, error)
            this.write_rpc_batch_response(response, [rpc_error]).catch(() => {})
        }
    }

    /** Handles http request to this service. */
    public request(request: IncomingMessage, response: ServerResponse) {
        switch(request.method?.toLowerCase()) {
            case 'get': return this.send_metadata(request, response)
            case 'post': return this.execute_batch(request, response)
            default: return this.write_buffer(response, Buffer.alloc(0))
        }
    }
}
