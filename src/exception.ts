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