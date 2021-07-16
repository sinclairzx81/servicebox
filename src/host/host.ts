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
import { Request }                  from '../service/request'
import * as exception               from '../service/exception'
import * as protocol                from '../service/protocol'
import * as uuid                    from 'uuid'
import * as http                    from 'http'


export class ServiceType {
    private readonly handlers: Map<string, Handler<any[]>>
    private readonly methods:  Map<string, Method<any[], TFunction<TAny[], TAny>>>
    private readonly events:   Map<string, Event<TSchema>>

    constructor(public readonly name: string, service: any) {
        this.methods = new Map<string, Method<any[], TFunction<TAny[], TAny>>>()
        this.events = new Map<string, Event<TSchema>>()
        this.handlers = new Map<string, Handler<any[]>>()
        for (const [name, handler] of Object.entries(service)) {
            if (!(handler instanceof Handler)) continue
            const handler_name = name.replace(/\$/g, '')
            this.handlers.set(handler_name, handler)
        }
        for (const [name, event] of Object.entries(service)) {
            if (!(event instanceof Event)) continue
            const event_name = name.replace(/\$/g, '')
            this.events.set(event_name, event)
        }
        for (const [name, method] of Object.entries(service)) {
            if (!(method instanceof Method)) continue
            const method_name = name.replace(/\$/g, '')
            this.methods.set(method_name, method)
        }
    }

    public async connect(context: Context<any>): Promise<any> {
        if (!this.handlers.has('connect')) return
        const handler = this.handlers.get('connect')!
        handler.execute(context)
    }

    public async close(context: Context<any>): Promise<any> {
        if (!this.handlers.has('close')) return
        const handler = this.handlers.get('close')!
        handler.execute(context)
    }

    public async authorize(name: string, request: Request): Promise<any> {
        if (!this.methods.has(name)) throw new exception.MethodNotFoundException({})
        const method = this.methods.get(name)!
        const contexts = []
        for (const middleware of method.middleware) {
            const context = await middleware.map(request)
            if (context === null) continue
            contexts.push(context)
        }
        return contexts.reduce((acc, context) => {
            return { ...acc, ...context }
        }, {})
    }

    public async execute(name: string, context: Context<any>, ...params: any[]): Promise<any> {
        if (!this.methods.has(name)) throw new exception.MethodNotFoundException({})
        const method = this.methods.get(name)!
        return method.execute(context, ...params)
    }
}

export class Host {
    private readonly services: Map<string, ServiceType>
    private readonly protocolRequestValidator: ValidateFunction<unknown>
    private readonly protocolResponseValidator: ValidateFunction<unknown>
    constructor(services: any) {
        const ajv = new Ajv().addKeyword('kind').addKeyword('modifier')
        this.protocolRequestValidator = ajv.compile(protocol.BatchProtocolRequest)
        this.protocolResponseValidator = ajv.compile(protocol.BatchProtocolResponse)
        this.services = new Map<string, ServiceType>()
        for (const [name, service] of Object.entries(services)) {
            this.services.set(name, new ServiceType(name, service))
        }
    }

    // ---------------------------------------------------------------------
    // Service IO
    // ---------------------------------------------------------------------

    /** Reads a buffer from the http request stream. */
    private readBuffer(request: http.IncomingMessage): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const buffers = [] as Buffer[]
            request.on('data', buffer => buffers.push(buffer))
            request.on('error', error => reject(error))
            request.on('end', () => resolve(Buffer.concat(buffers)))
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
            if (request.headers['content-type'] !== 'application/json') {
                const message = `Content-Type header not 'application/json'`
                throw new exception.ParseException({ message })
            }
            const buffer = await this.readBuffer(request)
            const text = buffer.toString('utf8')
            const data = JSON.parse(text)
            if (!this.protocolRequestValidator(data)) {
                throw new exception.InvalidRequestException({})
            }
            return data as protocol.BatchProtocolRequest
        } catch (error) {
            if (!(error instanceof exception.Exception)) {
                throw new exception.InternalErrorException({})
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

    private async service_execute(context: Context<any>, rpc_request: protocol.ProtocolRequest): Promise<protocol.ProtocolResponse> {
        try {
            const [service_name, method_name] = rpc_request.method.split('/')
            if (!this.services.has(service_name)) throw new exception.MethodNotFoundException({})
            const service = this.services.get(service_name)!
            const result = service.execute(method_name, context, ...rpc_request.params)
            return { jsonrpc: '2.0', id: rpc_request.id, result }
        } catch (error) {
            if (!(error instanceof exception.Exception)) {
                return { jsonrpc: '2.0', id: rpc_request.id, error: new exception.InternalErrorException({}) }
            } else {
                return { jsonrpc: '2.0', id: rpc_request.id, error }
            }
        }
    }

    public async service_authorize(context_id: string, request: Request, rpc_batch_requests: protocol.BatchProtocolRequest): Promise<Context<any>[]> {
        const contexts: Context<any>[] = []
        for (const rpc_request of rpc_batch_requests) {
            const [service_name, method_name] = rpc_request.method.split('/')
            if (!this.services.has(service_name)) throw new exception.MethodNotFoundException({})
            const service  = this.services.get(service_name)!
            const identity = await service.authorize(method_name, request)
            const context  = new Context(context_id, this, identity)
            contexts.push(context)
        }
        return contexts
    }

    public async service_connect(rpc_batch_contexts: any[], rpc_batch_requests: protocol.BatchProtocolRequest): Promise<void> {
        const set = new Set<string>()
        for (let i = 0; i < rpc_batch_requests.length; i++) {
            const rpc_request = rpc_batch_requests[i]
            const rpc_context = rpc_batch_contexts[i]
            const [service_name] = rpc_request.method.split('/')
            if(!this.services.has(service_name)) throw new exception.MethodNotFoundException({})
            if(set.has(service_name)) continue
            set.add(service_name)
            const service = this.services.get(service_name)!
            service.connect(rpc_context)
        }
    }

    public async service_close(rpc_batch_contexts: any[], rpc_batch_requests: protocol.BatchProtocolRequest): Promise<void> {
        const set = new Set<string>()
        for (let i = 0; i < rpc_batch_requests.length; i++) {
            const rpc_request = rpc_batch_requests[i]
            const rpc_context = rpc_batch_contexts[i]
            const [service_name] = rpc_request.method.split('/')
            if(!this.services.has(service_name)) throw new exception.MethodNotFoundException({})
            if(set.has(service_name)) continue
            set.add(service_name)
            const service = this.services.get(service_name)!
            await service.close(rpc_context)
        }
    }

    public async request(http_request: http.IncomingMessage, http_response: http.ServerResponse) {
        // -------------------------------------------------------------------------------
        // Authorize Requests
        // -------------------------------------------------------------------------------
        const context_id         = uuid.v4()
        const request            = new Request({}) // todo: parse request
        const rpc_batch_requests = await this.readBatchProtocolRequest(http_request)
        const rpc_batch_contexts = await this.service_authorize(context_id, request, rpc_batch_requests)
        
        // -------------------------------------------------------------------------------
        // Execute Batch Requests
        // -------------------------------------------------------------------------------
        const rpc_batch_response: protocol.ProtocolResponse[] = []
        await this.service_connect(rpc_batch_contexts, rpc_batch_requests)
        for(let i = 0; i < rpc_batch_requests.length; i++) {
            const rpc_request = rpc_batch_requests[i]
            const rpc_context = rpc_batch_contexts[i]
            const response = await this.service_execute(rpc_context, rpc_request)
            rpc_batch_response.push(response)
        }
        await this.service_close(rpc_batch_contexts, rpc_batch_requests)
        // -------------------------------------------------------------------------------
        // Send Batch Response
        // -------------------------------------------------------------------------------
        await this.writeBatchProtocolResponse(http_response, rpc_batch_response)
    }

    /** Closes the connection with the given id */
    public close(context_id: string) {
        /** Cannot terminate connection */
    }

    public listen(port: number, hostname: string = '0.0.0.0') {
        return new Promise<void>((resolve, reject) => {
            const server = http.createServer((request, response) => this.request(request, response))
            server.listen(port, hostname, () => resolve(void 0))
        })
    }
}

