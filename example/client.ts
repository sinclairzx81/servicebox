
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

    public async execute(method: string, ...args: any[]): Promise<any> {
        const results = await this.executeMany([{method, args}])
        return results[0]
    }

    public async executeMany(calls: MethodCall[]): Promise<any[]> {
        if(calls.length === 0) return []
        const batch_request = calls.map<JsonRpcRequest>(call => ({
            jsonrpc: '2.0',
            id: this.ordinal++,
            method: call.method,
            params: call.args,
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


