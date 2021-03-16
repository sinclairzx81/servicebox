
import fetch from 'node-fetch'

export interface JsonRpcRequest {
    jsonrpc: '2.0',
    method: string
    params: unknown
}

export async function post(endpoint: string, request: JsonRpcRequest[]) {
    const headers: { [key: string]: string } = { 'Content-Type': 'application/json' }
    const body = JSON.stringify(request)
    return await fetch(endpoint, { method: 'post', headers, body }).then(res => res.json())
}
