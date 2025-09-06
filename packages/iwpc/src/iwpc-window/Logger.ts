export class Logger {
  private enable: boolean;

  constructor(enable: boolean) {
    this.enable = enable;
  }

  public _debug(...mesage: unknown[]) {
    if (this.enable) {
      console.debug(new Date().toISOString(), ...mesage);
    }
  }

  public _log(...mesage: unknown[]) {
    if (this.enable) {
      console.log(new Date().toISOString(), ...mesage);
    }
  }

  public _warn(...mesage: unknown[]) {
    if (this.enable) {
      console.warn(new Date().toISOString(), ...mesage);
    }
  }

  public _error(...mesage: unknown[]) {
    if (this.enable) {
      console.error(new Date().toISOString(), ...mesage);
    }
  }
}
