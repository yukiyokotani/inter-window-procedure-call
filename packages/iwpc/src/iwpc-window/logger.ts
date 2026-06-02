export class Logger {
  private enable: boolean;

  constructor(enable: boolean) {
    this.enable = enable;
  }

  public _debug(...message: unknown[]) {
    if (this.enable) {
      console.debug(new Date().toISOString(), ...message);
    }
  }

  public _log(...message: unknown[]) {
    if (this.enable) {
      console.log(new Date().toISOString(), ...message);
    }
  }

  public _warn(...message: unknown[]) {
    if (this.enable) {
      console.warn(new Date().toISOString(), ...message);
    }
  }

  public _error(...message: unknown[]) {
    if (this.enable) {
      console.error(new Date().toISOString(), ...message);
    }
  }
}
