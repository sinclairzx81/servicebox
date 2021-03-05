import { RpcError, RpcResult, RpcBatchResponse } from '@sinclair/servicebox'
import fetch from 'node-fetch'

export class ServiceClient {
    public readonly headers: Map<string, string>
    constructor(public readonly endpoint: string) {
        this.headers = new Map<string, string>()
    }

    /** Executes a service method. */
    public async execute<TResult>(method: string, params: unknown): Promise<TResult> {
        const response = await this.batch([{method, params}])
        const error = response[0] as RpcError
        if(error['error']) throw error['error']
        const result = response[0] as RpcResult
        return result.result as TResult
    }

    /** Batch executes several methods. */
    public async batch(commands: { method: string, params: unknown }[]): Promise<RpcBatchResponse> {
        const headers: { [key: string]: string } = { 'Content-Type': 'application/json' }
        for(const [key, value] of this.headers) { headers[key] = value }
        const body = JSON.stringify(commands.map(({method, params}) => {
            return { jsonrpc: '2.0', method, params }
        }))
        return await fetch(this.endpoint, { method: 'post', headers, body }).then(res => res.json())
    }
}