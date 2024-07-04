export class Subscription {
  private _unsubscribeCallback: () => void;

  constructor(unsubscribeCallback: () => void) {
    this._unsubscribeCallback = unsubscribeCallback;
  }

  public unsubscribe() {
    this._unsubscribeCallback();
  }
}
