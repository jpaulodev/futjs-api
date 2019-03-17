'use strict';

const Login = require('./lib/login');
const Session = require('./lib/session');
const Sleep = require('./lib/sleep');
const Methods = require('./lib/methods');

class FutJS extends Methods {
  /**
   * [constructor description]
   * @param  {String}  options.email          FUT E-mail
   * @param  {String}  options.password       FUT Password
   * @param  {String}  options.secret         FUT Secret answer
   * @param  {String}  options.code           FUT Backup code
   * @param  {String}  options.platform       FUT Platform [pc/ps3/ps4/xbox/xbox360]
   */
  constructor(options) {
    super();

    let defaultOptions = {
      minDelay  : 0,
      loginType : 'web'
    };

    this.options = {};
    this.isReady = false; // instance will be ready after we call _init func
    Object.assign(this.options, defaultOptions);

    if (this.options.loginType === 'web') {
      this.loginLib = new Login(options);
    }
    
    // TODO: implementation of mobile login (not safe to use)
  }

  async login() {
    await this.loginLib.login();
    super.init();
  }

  credits() {
    return Session.load('userInfo')['credits'];
  }

  async sleep(ms) {
    await Sleep(ms);
  }
}

module.exports = FutJS;