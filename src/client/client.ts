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

import fetch from 'node-fetch'

interface JsonRpcRequest {
    jsonrpc: '2.0'
    id?:      number
    method:   string
    params:   unknown
}

type MethodCall = {
    method: string
    params: any[]
}

export class Client {
    private ordinal: number = 0
    constructor(private readonly endpoint: string) {}

    public async execute(method: string, ...args: any[]): Promise<any> {
        const results = await this.executeMany([{method, params: args}])
        return results[0]
    }

    public async executeMany(calls: MethodCall[]): Promise<any[]> {
        if(calls.length === 0) return []
        const batch_request = calls.map<JsonRpcRequest>(call => ({
            jsonrpc: '2.0',
            id: this.ordinal++,
            method: call.method,
            params: call.params,
        }))
        const batch_response = await this.post(batch_request)
        const results: any[] = []
        for(const response of batch_response) {
            if(response.error) {
                throw new Error(response.error.message)
            }
            results.push(response.result)
        }
        return results
    }

    private async post(request: JsonRpcRequest[]) {
        const headers: { [key: string]: string } = { 'Content-Type': 'application/json' }
        const body = JSON.stringify(request)
        return await fetch(this.endpoint, { method: 'post', headers, body }).then(res => res.json())
    }
}
