<div align='center'>

<h1>ServiceBox</h1>

<p>Type Safe Web Services for Node</p>

[![npm version](https://badge.fury.io/js/%40sinclair%2Fservicebox.svg)](https://badge.fury.io/js/%40sinclair%2Fservicebox) [![GitHub CI](https://github.com/sinclairzx81/servicebox/workflows/GitHub%20CI/badge.svg)](https://github.com/sinclairzx81/servicebox/actions)

</div>

```typescript
import { Host, Context, Type } from '@sinclair/servicebox'

// ------------------------------------------------------
// Functions
// ------------------------------------------------------

export const AddEvent = Type.Object({ result: Type.Number() })

export const AddMethod = Type.Function([Type.Number(), Type.Number()], Type.Number())

// ------------------------------------------------------
// Service
// ------------------------------------------------------

export class Service {
    private readonly contexts = new Set<string>()
    private readonly context = new Context([new Authorize()])

    public $add = this.context.event(AddEvent)

    public add = this.context.method(AddMethod, (context, a, b) => {
        for(const id of this.contexts) {
            this.$add.send(id, [a, b])
        }
        return a + b
    })

    public open = this.context.handler(context => {
        this.contexts.add(context.id)
    })

    public close = this.context.handler(context => {
        this.contexts.delete(context.id)
    })
}

// ------------------------------------------------------
// Host
// ------------------------------------------------------

const host = new Host({
    service: new Service()
})

host.listen(5000)
```
## Overview

ServiceBox is a framework for building type safe web services functions in Node. It allows server side developers to define struct web service interfaces and it takes care of validating requests from those interfaces. ServiceBox leverages TypeScript type inference to ensure the server functions are statically correct and it also provides code generation services for clients.

ServiceBox is built upon the JSON-RPC 2.0 specification and developed with TypeScript 4.2 and Node 14 LTS.

License MIT

## Install

```bash
$ npm install @sinclair/servicebox
```

## Contents

- [Overview](#Overview)
- [Methods](#Methods)
- [Middleware](#Middleware)
- [Contracts](#Contracts)
- [Exceptions](#Exceptions)
- [Services](#Services)
- [Testing](#Testing)
- [Protocol](#Protocol)
- [Metadata](#Metadata)

## Methods
ServiceBox methods are created using the following parameters. See sections below for more details.

```typescript
const method = new Method([...middleware], contract, body)
```
## Middleware

ServiceBox middleware are implementations of `Middleware<Context>` that map `IncomingMessage` requests to context objects that are passed to the methods `context` argument. Middleware functions can be used for reading header information from an incoming request and preparing a valid context for the method to execute on. Middleware can also be used to reject a request (for example failed Authorization checks). For more information on rejecting requests see the [Exceptions](#Exceptions) section.

Methods can apply multiple middleware which will be merged into the methods `context` argument. If a middleware should not return a context, the middleware should return `null`.

```typescript
import { IncomingMessage } from 'http'

export class Foo {
    map(request: IncomingMessage) { 
        return { foo: 'foo' }
    }
}

export class Bar {
    map(request: IncomingMessage) { 
        return { bar: 'bar' }
    }
}
export class Baz {
    map(request: IncomingMessage) { 
        return null // no context
    }
}

const method = new Method([
    new Foo(), 
    new Bar(), 
    new Baz()
] {
    request: Type.Any(),
    response: Type.Any()    
}, ({ foo, bar }, request) => {
    //
    // ^ from middleware
    //
})
```

## Contracts

Contracts describe the `Request` and `Response` signature for a method and are represented internally as JSON Schema. ServiceBox is able to resolve the appropriate TypeScript static types for the request and response using type inference. For more information on the `Type` object refer to the [TypeBox](https://github.com/sinclairzx81/typebox) project.

```typescript
import { Method, Type } from '@sinclair/servicebox'
 
// type Add = (request: [number, number]) => number

const add = new Method([], {
    request:  Type.Tuple([ 
        Type.Number(), 
        Type.Number() 
    ]),
    response: Type.Number()
}, (context, [a, b]) => {
    //
    // [a, b] = [number, number]
    //
    return a + b // number
})
```

## Exceptions

By default, errors that are thrown inside a method or middleware will cause the method to respond with a non-descriptive error message. It is possible to override this and return application specific error codes and messages by throwing instances of type `Exception`. The example below creates a `NotImplementedException` by extending the type `Exception`.

```typescript
import { Method, Type, Exception } from '@sinclair/servicebox'


export class NotImplementedException extends Exception {
    constructor() {
        super(4000, "Method not implemented")
    }
}

const add = new Method([], {
    request: Type.Tuple([ 
        Type.Number(), 
        Type.Number() 
    ]),
    response: Type.Number()
}, (context, request) => {
    throw new NotImplementedException()
})

// Which results in the following error.
//
// { 
//    error: { 
//      code: 4000, 
//      message: 'Method not implemented', 
//      data: {}
//    } 
// }
```

## Services

Services are containers for methods. Services handle method routing logic as well as invoking calls on the requested method. The following example creates a service on the `/api` route using `express`. 

```typescript
import { Service, Method, Type } from '@sinclair/servicebox'

const service = new Service({
    'add': new Method([], {
        request: Type.Tuple([
            Type.Number(), 
            Type.Number()
        ]),
        response: Type.Number()
    }, (context, [a, b]) => {
        return a + b
    })
})


// ------------------------------------------
// Bind the service to the /api route.
// ------------------------------------------

const app = express()

app.use('/api', (req, res) => {
    service.request(req, res))
})

app.listen(5000)
```
## Testing

You can run any method created on the service using the services `execute()` function. Calls to `execute()` will bypass HTTP and invoke the method directly. As such the `context` object should match that of any middleware used by the method. As follows.

```typescript
export class Foo {
    map() {
        return { foo: 1 }
    }
}

const service = new Service({
    'add': new Method([new Foo()], {
        request: Type.Tuple([
            Type.Number(), 
            Type.Number()
        ]),
        response: Type.Number()
    }, (context, [a, b]) => {
        return a + b
    })
})

// -----------------------------------------
// Tests
// -----------------------------------------

const response = await service.execute('add', { 
    foo: 1 
}, [1, 2])

assert(response, 3)
```

## Protocol

ServiceBox implements the [JSON-RPC 2.0](https://www.jsonrpc.org/specification) specification. Requests to invoke a method must be sent via HTTP `POST` passing the `{ 'Content-Type': 'application/json' }` header and request payload. ServiceBox accepts requests as batched JSON-RPC requests.

See the `example/client.ts` class that provides a basic implementation for a client.

```typescript

// -------------------------------------
// Service
// -------------------------------------

const service = new Service({
    "add": new Method([], {
        request: Type.Tuple([
            Type.Number(),
            Type.Number()
        ]),
        response: Type.Number()
    }, (context, [a, b] => a + b))
})

// ------------------------------------
// Request
// ------------------------------------

const result = await post(endpoint, [
    { jsonrpc: '2.0', method: 'add', params: [10, 20] },
    { jsonrpc: '2.0', method: 'add', params: [20, 30] },
    { jsonrpc: '2.0', method: 'add', params: [30, 40] }
])

// result = [
//   { jsonrpc: '2.0', id: null, result: 30 },
//   { jsonrpc: '2.0', id: null, result: 50 },
//   { jsonrpc: '2.0', id: null, result: 70 },
// ]
```

## Metadata

Metadata for a service can be obtained in two ways. The first is inspecting the `service.metadata` property. The other is making a `HTTP GET` request to the services HTTP endpoint. The following inspects the metadata using `service.metadata`.

> Note: ServiceBox will respond with metadata for the service if it receives a `HTTP GET` request. To disable this, ensure that the `service.request(req, res)` is called only for `HTTP POST` requests.

```typescript
import { Service, Method, Type } from '@sinclair/servicebox'

const service = new Service({
    'add': new Method([], {
        request: Type.Tuple([
            Type.Number(),
            Type.Number()
        ]),
        response: Type.Number()
    }, (context, [a, b]) => {
        return a + b
    })
})

console.log(service.metadata)

// service.metadata = {
//     "add": {
//         "request": {
//             "type": "array",
//             "items": [
//                 { "type": "number" },
//                 { "type": "number" }
//             ],
//             "additionalItems": false,
//             "minItems": 2,
//             "maxItems": 2
//         },
//         "response": {
//             "type": "number"
//         }
//     }
// }
```