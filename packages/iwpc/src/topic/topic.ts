import { Subscription } from './subscription';

export class Topic<Name extends string = 'string', Message = unknown> {
  private _name: Name;
  private _bc: BroadcastChannel;
  private _subscribers: ((topicMessage: Message) => void)[];

  constructor(name: Name) {
    this._name = name;
    this._bc = new BroadcastChannel(this._name);
    this._subscribers = [];
    this._bc.onmessage = this._handleTopicMessage.bind(this);
  }

  public publish(message: Message) {
    this._bc.postMessage(message);
  }

  public subscribe(callback: (topicMessage: Message) => void) {
    this._subscribers.push(callback);
    const unsubscribeCallback = () => {
      const subscriberIndex = this._subscribers.findIndex(
        (subscriber) => subscriber === callback
      );
      if (subscriberIndex !== -1) {
        this._subscribers.splice(subscriberIndex, 1);
      }
    };
    const subscription = new Subscription(unsubscribeCallback);
    return subscription;
  }

  public close() {
    this._bc.onmessage = null;
    this._bc.close();
    this._subscribers = [];
  }

  private _handleTopicMessage(ev: MessageEvent<Message>) {
    const message = ev.data;
    this._subscribers.forEach((subscriber) => subscriber(message));
  }
}
