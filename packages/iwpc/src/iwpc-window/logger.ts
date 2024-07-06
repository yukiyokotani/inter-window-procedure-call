export class Logger {
  private enable: boolean;

  constructor(enable: boolean) {
    this.enable = enable;
  }

  public _debug(...mesage: string[]) {
    if (this.enable) {
      console.debug(new Date().toISOString(), ...mesage);
    }
  }

  public _log(...mesage: string[]) {
    if (this.enable) {
      console.log(new Date().toISOString(), ...mesage);
    }
  }

  public _warn(...mesage: string[]) {
    if (this.enable) {
      console.warn(new Date().toISOString(), ...mesage);
    }
  }

  public _error(...mesage: string[]) {
    if (this.enable) {
      console.error(new Date().toISOString(), ...mesage);
    }
  }
}
