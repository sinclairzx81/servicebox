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
// Json Rpc Schematics
// ------------------------------------------------------------------------

export type ProtocolRequest = Static<typeof ProtocolRequest>
export const ProtocolRequest = Type.Object({
    jsonrpc: Type.Literal("2.0"),
    id:      Type.Union([Type.Null(), Type.Number()]),
    method:  Type.String(),
    params:  Type.Array(Type.Unknown())
})

export type ProtocolResult = Static<typeof ProtocolResult>
export const ProtocolResult = Type.Object({
    jsonrpc: Type.Literal("2.0"),
    id:      Type.Union([Type.Number(), Type.Null()]),
    result:  Type.Unknown()
})

export type ProtocolError = Static<typeof ProtocolError>
export const ProtocolError = Type.Object({
    jsonrpc: Type.Literal("2.0"),
    error: Type.Object({
        code: Type.Number(),
        message: Type.String(),
        data: Type.Unknown()
    })
})

export type ProtocolResponse = Static<typeof ProtocolResponse>
export const ProtocolResponse = Type.Union([ProtocolResult, ProtocolError])

export type BatchProtocolRequest = Static<typeof BatchProtocolRequest>
export const BatchProtocolRequest   = Type.Array(ProtocolRequest)

export type BatchProtocolResponse = Static<typeof BatchProtocolResponse>
export const BatchProtocolResponse  = Type.Array(ProtocolResponse)

