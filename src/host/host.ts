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
import { MiddlewareArray }          from '../service/middleware'
import { Context }                  from '../service/context'
import { Handler }                  from '../service/handler'
import { Method }                   from '../service/method'
import { Event }                    from '../service/event'
import * as exception               from '../service/exception'
import * as protocol                from '../service/protocol'
import * as uuid                    from 'uuid'
import * as http                    from 'http'

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

    private async executeRequest(context_id: string, request: http.IncomingMessage, rpc_request: protocol.ProtocolRequest): Promise<protocol.ProtocolResponse>{
        try {
            if(!this.methods.has(rpc_request.method)) throw new exception.MethodNotFoundException({ })
            const method = this.methods.get(rpc_request.method)!
            const context_data = await this.executeMiddleware(request, method.middleware)
            const context  = new Context(context_id, this, context_data)
            const [service_name, method_name] = rpc_request.method.split('/')
            if(this.handlers.has(`${service_name}/connect`)) {
                const handler = this.handlers.get(`${service_name}/connect`)!
                handler.execute(context)
            }
            const result = await method.execute(context, ...rpc_request.params)
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
        const context_id = uuid.v4()
        const rpc_batch_request = await this.readBatchProtocolRequest(request)
        const rpc_batch_response: protocol.ProtocolResponse[] = []
        for(const rpc_request of rpc_batch_request) {
            const response = await this.executeRequest(context_id, request, rpc_request)
            rpc_batch_response.push(response)
        }
        await this.writeBatchProtocolResponse(response, rpc_batch_response)
    }
    
    /** Closes the connection with the given id */
    public close(id: string) {
        /** Cannot terminate connection */
    }

    public listen(port: number, hostname: string = '0.0.0.0') {
       return new Promise<void>((resolve, reject) => {
            const server = http.createServer((request, response) => this.request(request, response))
            server.listen(port, hostname, () => resolve(void 0))
       })
    }
}

