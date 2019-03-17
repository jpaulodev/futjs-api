'use strict';

const Login = require('./lib/login');
const Session = require('./lib/session');
const Sleep = require('./lib/sleep');
const Methods = require('./lib/methods');

class FutJS extends Methods {
  /**
   * [constructor description]
   * @param  {[type]}  options.email          [description]
   * @param  {[type]}  options.password       [description]
   * @param  {[type]}  options.secret         [description]
   * @param  {[type]}  options.platform       [description]
   * @param  {[type]}  options.captchaHandler [description]
   * @param  {[type]}  options.tfAuthHandler  [description]
   * @param  {Boolean} options.saveVariable   [description]
   * @param  {Boolean} options.loadVariable   [description]
   * @param  {Number}  options.RPM            [description]
   * @param  {Number}  options.minDelay       [description]
   * @param  {[String]} options.proxy         [description]
   * @param  {[String]} options.loginType     [description]
   * @param  {[Function]} options.preHook     [Function that return a promise]
   * @return {[type]}                         [description]
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