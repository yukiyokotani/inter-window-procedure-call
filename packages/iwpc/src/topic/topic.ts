import { Subscription } from './subscription';

export class Topic<Name extends string = 'string', Message = unknown> {
  private _name: Name;
  private _bc: BroadcastChannel;
  private _subscribers: ((topicMessage: Message) => void)[];
  private _closed: boolean;

  constructor(name: Name) {
    this._name = name;
    this._bc = new BroadcastChannel(this._name);
    this._subscribers = [];
    this._closed = false;
    this._bc.onmessage = this._handleTopicMessage.bind(this);
  }

  get name() {
    return this._name;
  }

  public publish(message: Message) {
    if (this._closed) return;
    this._bc.postMessage(message);
  }

  public subscribe(callback: (topicMessage: Message) => void): Subscription {
    this._subscribers.push(callback);
    return new Subscription(() => {
      const index = this._subscribers.indexOf(callback);
      if (index !== -1) {
        this._subscribers.splice(index, 1);
      }
    });
  }

  public close() {
    if (this._closed) return;
    this._closed = true;
    this._bc.onmessage = null;
    this._bc.close();
    this._subscribers = [];
  }

  private _handleTopicMessage(ev: MessageEvent<Message>) {
    const message = ev.data;
    for (const subscriber of this._subscribers.slice()) {
      try {
        subscriber(message);
      } catch {
        // A misbehaving subscriber must not break delivery to the rest.
      }
    }
  }
}
