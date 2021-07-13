import { TSchema, Static } from '@sinclair/typebox'

export type EventCallback<T> = (id: string, value: T) => any

export class Event<T extends TSchema> {
    private callback: EventCallback<Static<T>> = () => {}

    constructor(public readonly schema: T) {
    }

    public receive(func: EventCallback<Static<T>>) {
        this.callback = func
    }

    public send(id: string, data: Static<T>): void {
        this.callback(id, data)
    }
}    