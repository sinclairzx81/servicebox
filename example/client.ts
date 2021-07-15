
import fetch from 'node-fetch'

export interface JsonRpcRequest {
    jsonrpc: '2.0'
    id?: number
    method: string
    params: unknown
}

export async function post(endpoint: string, request: JsonRpcRequest[]) {
    const headers: { [key: string]: string } = { 'Content-Type': 'application/json' }
    const body = JSON.stringify(request)
    return await fetch(endpoint, { method: 'post', headers, body }).then(res => res.json())
}

export type MethodCall = {
    method: string
    args: any[]
}


export class Client {
    private ordinal: number = 0
    constructor(private readonly endpoint: string) {}

    public execute(method: string, ...args: any[]): Promise<any> {
        return this.executeMany([{method, args}])
    }

    public async executeMany(calls: MethodCall[]): Promise<any[]> {
        if(calls.length === 0) return []
        return await this.post(calls.map(call => {
            const request: JsonRpcRequest = {
                jsonrpc: '2.0',
                id: this.ordinal++,
                method: call.method,
                params: call.args,
            }
            return request
        }))
    }

    private async post(request: JsonRpcRequest[]) {
        const headers: { [key: string]: string } = { 'Content-Type': 'application/json' }
        const body = JSON.stringify(request)
        return await fetch(this.endpoint, { method: 'post', headers, body }).then(res => res.json())
    }
}


