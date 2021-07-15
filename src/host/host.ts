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

import Ajv, { ValidateFunction }    from 'ajv'
import { TSchema, TFunction, TAny } from '@sinclair/typebox'
import { Context }                  from '../service/context'
import { Handler }                  from '../service/handler'
import { Method }                   from '../service/method'
import { Event }                    from '../service/event'

import * as uuid                    from 'uuid'
import * as http                    from 'http'
import * as exception               from '../service/exception'
import * as protocol                from '../service/protocol'
import { MiddlewareArray } from '../service/middleware'

export interface Methods {
    [name: string]: any
}

export type Services = { [name: string]: any }

export class Host {
    private readonly methods: Map<string, Method<any[], TFunction<TAny[], TAny>>>
    private readonly events:  Map<string, Event<TSchema>>
    private readonly handlers: Map<string, Handler<any[]>>
    
    private readonly protocolRequestValidator: ValidateFunction<unknown>
    private readonly protocolResponseValidator: ValidateFunction<unknown>
    
    constructor(services: Services) {
        this.handlers = new Map<string, Handler<any[]>>()
        this.methods = new Map<string, Method<any[], TFunction<TAny[], TAny>>>()
        this.events = new Map<string, Event<TSchema>>()
        this.loadServices(services)

        const ajv = new Ajv().addKeyword('kind').addKeyword('modifier')
        this.protocolRequestValidator  = ajv.compile(protocol.BatchProtocolRequest)
        this.protocolResponseValidator = ajv.compile(protocol.BatchProtocolResponse)
    }

    // ---------------------------------------------------------------------
    // Service Registration
    // ---------------------------------------------------------------------

    private loadEvents(namespace: string, service: any) {
        for(const [name, event] of Object.entries(service)) {
            if(!(event instanceof Event)) continue
            this.events.set(`${namespace}/${name}`, event)
        }
    }
    private loadMethods(namespace: string, service: any) {
        for(const [name, method] of Object.entries(service)) {
            if(!(method instanceof Method)) continue
            this.methods.set(`${namespace}/${name}`, method)
        }
    }

    private loadHandlers(namespace: string, service: any) {
        for(const [name, handler] of Object.entries(service)) {
            if(!(handler instanceof Handler)) continue
            this.handlers.set(`${namespace}/${name}`, handler)
        }
    }

    private loadServices(services: Services) {
        for(const [namespace, service] of Object.entries(services)) {
            this.loadHandlers(namespace, service)
            this.loadMethods(namespace, service)
            this.loadEvents(namespace, service)
        }
    }

    // ---------------------------------------------------------------------
    // Service IO
    // ---------------------------------------------------------------------

    /** Reads a buffer from the http request stream. */
    private readBuffer(request: http.IncomingMessage): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const buffers = [] as Buffer[]
            request.on('data',  buffer => buffers.push(buffer))
            request.on('error', error  => reject(error))
            request.on('end',   ()     => resolve(Buffer.concat(buffers)))
        })
    }
    
    /** Writes a buffer to the http response stream. */
    private async writeBuffer(response: http.ServerResponse, buffer: Buffer): Promise<void> {
        return new Promise(resolve => response.write(buffer, () => response.end(() => resolve())))
    }

    // ---------------------------------------------------------------------
    // Service Protocol
    // ---------------------------------------------------------------------

    /** Reads a json object from the http request stream. */
    private async readBatchProtocolRequest(request: http.IncomingMessage): Promise<protocol.BatchProtocolRequest> {
        try {
            if(request.headers['content-type'] !== 'application/json') {
                const message = `Content-Type header not 'application/json'`
                throw new exception.ParseException({ message })
            }
            const buffer = await this.readBuffer(request)
            const text   = buffer.toString('utf8')
            const data   = JSON.parse(text)
            if(!this.protocolRequestValidator(data)) {
                throw new exception.InvalidRequestException({ })
            }
            return data as protocol.BatchProtocolRequest
        } catch (error) {
            if(!(error instanceof exception.Exception)) {
                throw new exception.InternalErrorException({ })
            } else {
                throw error
            }
        }
    }

    private async writeBatchProtocolResponse(response: http.ServerResponse, batch_response: protocol.BatchProtocolResponse) {
        response.statusCode = 200
        response.setHeader('Content-Type', 'application/json')
        await this.writeBuffer(response, Buffer.from(JSON.stringify(batch_response)))
    }

    // ---------------------------------------------------------------------
    // Method Invocation
    // ---------------------------------------------------------------------

    private async executeMiddleware(request: http.IncomingMessage, middlewareArray: MiddlewareArray) {
        const contexts = []
        for(const middleware of middlewareArray) {
            const context = await middleware.map(request)
            if(context === null) continue
            contexts.push(context)
        }
        return contexts.reduce((acc, context) => {
            return { ...acc, ...context}
        }, {})
    }

    private async executeRequest(request: http.IncomingMessage, context_id: string, rpc_request: protocol.ProtocolRequest): Promise<protocol.ProtocolResponse>{
        try {
            if(!this.methods.has(rpc_request.method)) throw new exception.MethodNotFoundException({ })
            const method       = this.methods.get(rpc_request.method)!
            const context_data = await this.executeMiddleware(request, method.middleware)
            const context  = new Context(context_id, this, context_data)
            const [service_name, method_name] = rpc_request.method.split('/')
            if(this.handlers.has(`${service_name}/connect`)) {
                const handler = this.handlers.get(`${service_name}/connect`)!
                handler.execute(context)
            }
            const result   = await method.execute(context, ...rpc_request.params)
            if(this.handlers.has(`${service_name}/close`)) {
                const handler = this.handlers.get(`${service_name}/close`)!
                handler.execute(context)
            }
            return { jsonrpc: '2.0', id: rpc_request.id, result }
        } catch(error) {
            if(!(error instanceof exception.Exception)) {
                return { jsonrpc: '2.0', id: rpc_request.id, error: new exception.InternalErrorException({ }) }
            } else {
                return { jsonrpc: '2.0', id: rpc_request.id, error }
            }
        }
    }

    public async request(request: http.IncomingMessage, response: http.ServerResponse) {
        
        const rpc_batch_request = await this.readBatchProtocolRequest(request)
        const rpc_batch_response: protocol.ProtocolResponse[] = []
        for(const rpc_request of rpc_batch_request) {
            const context_id = uuid.v4()
            const response = await this.executeRequest(request, context_id, rpc_request)
            rpc_batch_response.push(response)
        }
        await this.writeBatchProtocolResponse(response, rpc_batch_response)
    }

    /** Closes the connection with the given id */
    public close(id: string) {
        console.log('calling close')
    }

    public listen(port: number, hostname: string = '0.0.0.0') {
       return new Promise<void>((resolve, reject) => {
            const server = http.createServer((request, response) => this.request(request, response))
            server.listen(port, hostname, () => resolve(void 0))
       })
    }
}



// // ------------------------------------------------------------------------
// // Protocol Request Response
// // ------------------------------------------------------------------------

// export type RpcRequest = Static<typeof RpcRequest>
// export const RpcRequest = Type.Object({
//     jsonrpc: Type.Literal("2.0"),
//     id:      Type.Optional(Type.Number()),
//     method:  Type.String(),
//     params:  Type.Unknown()
// })

// export type RpcResponse = RpcResult | RpcError

// export class RpcResult {
//     public jsonrpc: string = '2.0'
//     constructor(public readonly id: number | null,
//                 public readonly result: unknown) {}
// }

// export class RpcError {
//     public jsonrpc: string = '2.0'
//     constructor(public id: number | null, 
//                 public error: { 
//                     code: number, 
//                     message: string, 
//                     data: unknown 
//                 }) {}

//     public static from_exception(id: number | null, exception: Exception) {
//         return new RpcError(id, {
//             code: exception.code,
//             data: exception.data,
//             message: exception.message
//         })
//     }
// }

// export const RpcBatchRequest  = Type.Array(RpcRequest)

// export type  RpcBatchRequest  = Static<typeof RpcBatchRequest>

// export type  RpcBatchResponse = Array<RpcResponse>

// // ------------------------------------------------------------------------
// // Validator
// // ------------------------------------------------------------------------

// export class Validator {
//     private static ajv = addFormats(new Ajv({ allErrors: true }), [
//         'date-time', 'time', 'date', 'email', 'hostname', 
//         'ipv4', 'ipv6', 'uri', 'uri-reference', 'uuid', 
//         'uri-template', 'json-pointer',  'relative-json-pointer', 
//         'regex'
//     ]).addKeyword('kind').addKeyword('modifier')
    
//     readonly #validate:  ValidateFunction

//     constructor(public readonly schema: TSchema) {
//         this.#validate  = Validator.ajv.compile(schema)
//     }
//     /** Validates the given data against this validators schema. */
//     public validate (data: unknown): [boolean, unknown] {
//         return this.#validate(data) ? [true, null] : [false, this.#validate.errors]
//     }
// }

// // ------------------------------------------------------------------------
// // ServiceMethods
// // ------------------------------------------------------------------------

// export interface ServiceMethods {
//     [name: string]: Method<MiddlewareArray, any, any>
// }

// export type ServiceMethodContext<T>  = T extends Method<infer U, any, any> ? MiddlewareArrayContext<U> : never

// export type ServiceMethodRequest<T>  = T extends Method<any, infer U, any> ? Static<U> : never

// export type ServiceMethodResponse<T> = T extends Method<any, any, infer U> ? Static<U> : never

// // ------------------------------------------------------------------------
// // Service
// // ------------------------------------------------------------------------

// export class Service<T extends ServiceMethods> {
//     readonly #methods:  Map<string, [Method<MiddlewareArray, any, any>, Validator]>
//     readonly #protocol: Validator

//     /** Constructs this service using the given methods. */
//     constructor(methods: T) {
//         this.#protocol = new Validator(RpcBatchRequest)
//         this.#methods = new Map<string, [Method<MiddlewareArray, any, any>, Validator]>()
//         Object.entries(methods).filter(([name, method]) => {
//             return method instanceof Method
//         }).forEach(([name, method]) => {
//             const [request, response] = method.contract
//             const validator = new Validator(request)
//             this.#methods.set(name, [method, validator])
//         })
//     }
    
//     /** Executes a method on this service. */
//     public async execute<K extends keyof T>(
//         key: K, 
//         context: ServiceMethodContext<T[K]>, 
//         request: ServiceMethodRequest<T[K]>
//     ): Promise<ServiceMethodResponse<T[K]>> {
//         const [method, validator] = this.get_method(key as string)
//         const [success, error] = validator.validate(request)
//         if(!success) throw new InvalidParamsException(error)
//         return method.execute(context, request)
//     }

//     /** Returns metadata for this service. */
//     public get metadata(): {[method: string]: [any, any] } {
//         const metadata = {} as {[method: string]: [any, any] }
//         for(const [name, [method]] of this.#methods) {
//             metadata[name] = method.contract
//         }
//         return metadata
//     }

//     /** Reads a buffer from the http request stream. */
//     private read_buffer(request: IncomingMessage): Promise<Buffer> {
//         return new Promise((resolve, reject) => {
//             const buffers = [] as Buffer[]
//             request.on('data',  buffer => buffers.push(buffer))
//             request.on('error', error  => reject(error))
//             request.on('end',   ()     => resolve(Buffer.concat(buffers)))
//         })
//     }
    
//     /** Writes a buffer to the http response stream. */
//     private async write_buffer(response: ServerResponse, buffer: Buffer): Promise<void> {
//         return new Promise(resolve => response.write(buffer, () => response.end(() => resolve())))
//     }

//     /** Reads a json object from the http request stream. */
//     private async read_request_object(request: IncomingMessage): Promise<unknown> {
//         try {
//             if(request.headers['content-type'] !== 'application/json') {
//                 const message = `Content-Type header not 'application/json'`
//                 throw new ParseException({ message })
//             }
//             const buffer = await this.read_buffer(request)
//             const text = buffer.toString('utf8')
//             return JSON.parse(text)
//         } catch (error) {
//             throw new ParseException({ })
//         }
//     }

//     /** Reads the rpc_batch_request from the http request stream. */
//     private async read_rpc_batch_request(request: IncomingMessage): Promise<RpcBatchRequest> {
//         const batch_rpc_request = await this.read_request_object(request)
//         const [success, error] = this.#protocol.validate(batch_rpc_request)
//         if(!success) throw new InvalidRequestException(error)
//         return batch_rpc_request as RpcBatchRequest
//     }

//     /** Returns the method from the given rpc_request. */
//     private get_method(key: string): [Method<MiddlewareArray, any, any>, Validator] {
//         if(!this.#methods.has(key)) throw new MethodNotFoundException({ method: key })
//         return this.#methods.get(key)!
//     }

//     /** Validates the request parameters for a method. */
//     private validate_params(validator: Validator, params: unknown) {
//         const [success, errors] = validator.validate(params)
//         if(!success) throw new InvalidParamsException(errors)
//     }

//     /** Executes the methods middleware stack and returns the aggregated context. */
//     private async read_context(request: IncomingMessage, method: Method<MiddlewareArray, any, any>) {
//         const contexts = []
//         for(const middleware of method.middleware) {
//             const context = await middleware.map(request)
//             if(context === null) continue
//             contexts.push(context)
//         }
//         return contexts.reduce((acc, context) => {
//             return { ...acc, ...context}
//         }, {})
//     }

//     /** Returns this services description as JSON. */
//     private async execute_rpc_metadata(request: IncomingMessage, response: ServerResponse) {
//         response.statusCode = 200
//         response.setHeader('Content-Type', 'application/json')
//         await this.write_buffer(response, Buffer.from(JSON.stringify(this.metadata, null, 2)))
//     }
    
//     /** Writes an rpc response to the http response stream. */
//     private async write_rpc_batch_response(response: ServerResponse, rpc_batch_response: RpcBatchResponse): Promise<void> {
//         response.statusCode = 200
//         response.setHeader('Content-Type', 'application/json')
//         await this.write_buffer(response, Buffer.from(JSON.stringify(rpc_batch_response)))
//     }

//     /** Executes a single rpc method. */
//     private async execute_rpc_method(request: IncomingMessage, rpc_request: RpcRequest): Promise<RpcResponse> {
//         let id = null
//         try {
//             id = rpc_request.id === undefined ? null : rpc_request.id
//             const [method, validator] = this.get_method(rpc_request.method)
//             this.validate_params(validator, rpc_request.params)
//             const context = await this.read_context(request, method) as any
//             const result  = await this.execute(rpc_request.method, context, rpc_request.params as any)
//             return new RpcResult(id, result)
//         } catch(error) {
//             return !(error instanceof Exception)
//                 ? RpcError.from_exception(id, new Exception('An error occured', -32000, {}))
//                 : RpcError.from_exception(id, error)
//         }
//     }

//     /** Executes a method on this service. */
//     private async execute_rpc_batch(request: IncomingMessage, response: ServerResponse) {
//         try {
//             const batch_rpc_request = await this.read_rpc_batch_request(request)
//             const batch_rpc_response = []
//             for(const rpc_request of batch_rpc_request) {
//                 const result = await this.execute_rpc_method(request, rpc_request)
//                 batch_rpc_response.push(result)
//             }
//             await this.write_rpc_batch_response(response, batch_rpc_response)
//         } catch(error) {
//             const rpc_error = !(error instanceof Exception)
//                 ? RpcError.from_exception(0, new Exception('An error occured', -32000, {}))
//                 : RpcError.from_exception(0, error)
//             this.write_rpc_batch_response(response, [rpc_error]).catch(() => {})
//         }
//     }

//     /** Handles http request to this service. */
//     public request(request: IncomingMessage, response: ServerResponse) {
//         switch(request.method?.toLowerCase()) {
//             case 'get': return this.execute_rpc_metadata(request, response)
//             case 'post': return this.execute_rpc_batch(request, response)
//             default: return this.write_buffer(response, Buffer.alloc(0))
//         }
//     }
// }
