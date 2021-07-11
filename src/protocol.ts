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

import { Type, Static } from '@sinclair/typebox'
import { Exception } from './exception'

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

export type RpcResponse = RpcResult | RpcError

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

export type  RpcBatchResponse = Array<RpcResponse>