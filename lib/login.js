'use strict'

const Settings = require('./settings');
const Session = require('./session');
const APIRequest = require('./api-request');
const Pin = require('./pin');
const _ = require('lodash');
const request = require('request-promise');
const FileCookieStore = require('tough-cookie-filestore');
const readline = require('readline');
const Logger = require('./logger');
const fs = require('fs');

class Login {

  constructor({email, password, secret, code, platform}) {
    this.clientHeaders = Settings.HEADERS.web;
    this.clientVersion = 1;
    this.sku = 'FUT19WEB';
    let jar = request.jar(new FileCookieStore(this._getCookie()));

    this.defaultRequest = null;
    this.requestConfigDefaults = {
      jar,
      followAllRedirects: true,
      gzip: true,
      resolveWithFullResponse: true,
      headers: this.clientHeaders
    };

    this.loginCredentials = {
      email,
      password,
      secret,
      code,
      platform
    };

    this.gameSKU = Settings.GAME_SKU[platform];
    this.futHost = Settings.FUT_HOST[platform];
    this.platform = platform;

    this.defaultRequest = request.defaults(this.requestConfigDefaults);
  }

  async login() {
    this.logger = Logger({interactive: true, scope: 'Login'});
    this.logger.await('[%d/10] - Logging in...', 1);
    const stateResponse = await this._checkCurrentState();
    const stateResponseURI = stateResponse.request.uri.href;
    if (stateResponseURI !== 'https://www.easports.com/fifa/ultimate-team/web-app/auth.html') {
      await this._doLogin({
        email    : this.loginCredentials.email, 
        password : this.loginCredentials.password, 
        URI      : stateResponseURI 
      });
      await this._getShards();
      await this._getPersonas();
      await this._authorize();
      await this._getUserInfo();
      Session.save('loginInfo', this);
      this.logger.success('[%d/10] - Success!', 10);
    }
  }

  async _checkCurrentState() {
    this.logger.await('[%d/10] - Checking current state...', 2);
    let qs = {
      prompt        : 'login',
      accessToken   : 'null',
      client_id     : Settings.CLIENT_ID,
      response_type : 'token',
      display       : 'web2/login',
      locale        : 'en_US',
      redirect_uri  : 'https://www.easports.com/fifa/ultimate-team/web-app/auth.html',
      release_type  : 'prod',
      scope         : 'basic.identity offline signin'
    };

    this.clientHeaders['Referer'] = 'https://www.easports.com/fifa/ultimate-team/web-app/';

    const headers = this.clientHeaders;

    return this.defaultRequest.get('https://accounts.ea.com/connect/auth', { qs, headers });
  }

  async _doLogin({email, password, URI}) {
    this.logger.await('[%d/10] - Sending credentials...', 3);
    const form = {
      email              : email,
      password           : password,
      country            : 'US',
      phoneNumber        : '',
      passwordForPhone   : '',
      gCaptchaResponse   : '',
      isPhoneNumberLogin : 'false',
      isIncompletePhone  : '',
      _rememberMe        : 'on',
      rememberMe         : 'on',
      _eventId           : 'submit'
    };

    this.clientHeaders['Referer'] = URI;

    const headers = this.clientHeaders;

    let loginResponse = await this.defaultRequest.post(URI, { form, headers });

    if (loginResponse.body.match('\'successfulLogin\': false')) {
      const reason = loginResponse.body.match(/general-error">\s+<div>\s+<div>\s+(.*)\s.+/g)[1];
      throw new Error(`LoginError, reason: ${reason}`);
    }

    if (loginResponse.body.match('var redirectUri')) {
      const endURL = `${loginResponse.request.uri.href}&_eventId=end`;
      let deviceState = await this._checkDeviceState(endURL);

      if (deviceState.message === 'login_verification') {
        await this._requestVerificationCode(deviceState.uri);
      } else {
        await this._getAccess(deviceState.uri);
      }
    }
  }

  async _checkDeviceState(endURL) {
    this.logger.await('[%d/10] - Validating current device...', 4);
    const headers = this.clientHeaders;
    return this.defaultRequest.get(endURL, { headers })
      .then((response) => {
        let responseObject = {};

        if (response.body.match('Login Verification')) responseObject.message = 'login_verification';
        else responseObject.message = response;

        responseObject.uri = response.request.uri.href;
        return responseObject;
      });
  }

  async _requestVerificationCode(URI) {
    this.logger.await('[%d/10] - Requesting verification code...', 5);
      const form = {
        codeType : 'EMAIL',
        _eventId : 'submit'
      };

      const headers = this.clientHeaders;

      let response = await this.defaultRequest.post(URI, { form, headers });
      if (response.body.match('Enter your security code')) {
        await this._askForVerificationCode();

        if (!this.loginCredentials.code) throw new Error('You must provide a verification code');

        await this._sendVerificationCode(URI);
      }
  }

  async _askForVerificationCode() {
    const rl = readline.createInterface({
      input  : process.stdin,
      output : process.stdout,
    });

    let existingCode = this.loginCredentials.code ? ` (press enter to send ${this.loginCredentials.code})` : '';

    let question = `Insert your verification code${existingCode}: `;

    return new Promise((resolve) => rl.question(question, answer => {
      rl.close();
      this.loginCredentials.code = answer || this.loginCredentials.code;
      resolve();
    }))
  }

  async _sendVerificationCode(URI) {
    const form = {
      oneTimeCode      : this.loginCredentials.code,
      _trustThisDevice : 'on',
      trustThisDevice  : 'on',
      _eventId         : 'submit'
    };

    this.clientHeaders['Referer'] = URI;

    const headers = this.clientHeaders;

    let response = await this.defaultRequest.post(URI.replace('s3', 's4'), { form, headers });
    await this._getAccess(response.request.uri.href);
  }

  async _getAccess(URI) {
    this.logger.await('[%d/10] - Getting access code...', 5);
    const matches = URI.match(/https:\/\/www.easports.com\/fifa\/ultimate-team\/web-app\/auth.html#access_token=(.+?)&token_type=(.+?)&expires_in=[0-9]+/);
    this.accessToken = matches[1];
    this.tokenType = matches[2];

    await request.get('https://www.easports.com/fifa/ultimate-team/web-app/');

    this.clientHeaders['Referer'] = 'https://www.easports.com/fifa/ultimate-team/web-app/';
    this.clientHeaders['Accept'] = 'application/json';
    this.clientHeaders['Authorization'] = `${this.tokenType} ${this.accessToken}`;

    const headers = this.clientHeaders;

    let me = await request.get('https://gateway.ea.com/proxy/identity/pids/me', { headers });
    me = JSON.parse(me);

    this.nucleusId = me.pid.externalRefValue;
    this.dob = me.pid.dob;
    delete this.clientHeaders['Authorization'];
    this.clientHeaders['Easw-Session-Data-Nucleus-Id'] = this.nucleusId;
  }

  async _getShards() {
    this.logger.await('[%d/10] - Loggin completed! Getting shards...', 6);
    const headers = this.clientHeaders;

    try {
      await this.defaultRequest.get(`https://${Settings.AUTH_URL}/ut/shards/v2`, {
        headers,
        timeout : 5000
      });
    } catch (err) {
      console.log(err)
      throw new Error(err)
    }
  }

  async _getPersonas() {
    this.logger.await('[%d/10] - Getting personas...', 7);
    const qs = {
      filterConsoleLogin    : 'true',
      returningUserGameYear : '2018',
      sku                   : this.sku
    };

    const headers = this.clientHeaders;

    let response;

    try {
      response = await this.defaultRequest.get(`https://${this.futHost}/ut/game/fifa19/user/accountinfo`,{
        qs,
        headers,
        timeout : 5000,
        json    : true
      });
    } catch (err) {
      console.log(err);
      throw new Error(err);
    }

    _.forEach(response.body.userAccountInfo.personas, (persona, key) => {
      _.forEach(persona.userClubList, (club) => {
        if (club.skuAccessList && club.skuAccessList[this.gameSKU]) {
          this.personaId = persona.personaId;
          this.personaKey = key;
        }
      })
    })

    if (!this.personaId) throw new Error('Error during login process (no persona found).');

    const userState = response.body.userAccountInfo.personas[this.personaKey].userState;
    switch (userState) {
      case 'RETURNING_USER_EXPIRED':
        throw new Error('Appears your Early Access has expired.')
    }
  }

  async _authorize() {
    this.logger.await('[%d/10] - Getting authorization...', 8);
    delete this.clientHeaders['Easw-Session-Data-Nucleus-Id'];
    this.clientHeaders['Origin'] = 'http://www.easports.com';

    const qs = {
      client_id     : 'FOS-SERVER',
      redirect_uri  : 'nucleus:rest',
      response_type : 'code',
      access_token  : this.accessToken
    };

    const headers = this.clientHeaders;

    let authEA = await this.defaultRequest('https://accounts.ea.com/connect/auth', {
      qs,
      headers,
      json : true
    });

    let authCode = authEA.body.code;
    this.clientHeaders['Content-Type'] = 'application/json';
    let body = {
      isReadOnly       : false,
      sku              : this.sku,
      clientVersion    : this.clientVersion,
      nucleusPersonaId : this.personaId,
      gameSku          : this.gameSKU,
      locale           : 'en-US',
      method           : 'authcode',
      priorityLevel    : 4,
      identification   : {
          authCode    : authCode,
          redirectUrl : 'nucleus:rest'
      }
    };

    let authHost = await this.defaultRequest.post(`https://${this.futHost}/ut/auth`, {
      body,
      headers,
      json : true
    });

    if (authHost.statusCode === 401) {
      throw new Error('Account is logged in elsewhere.');
    }

    if (authHost.statusCode === 500) {
      throw new Error('Servers are probably temporary down.');
    }

    if (_.get(authHost, 'body.reason') === 'multiple session') {
      throw new Error('multiple session');
    } else if (_.get(authHost, 'body.reason') === 'max sessions') {
      throw new Error('max sessions');
    } else if (_.get(authHost, 'body.reason') === 'doLogin: doLogin failed') {
      throw new Error('doLogin: doLogin failed');
    } else if (_.get(authHost, 'body.reason')) {
      throw new Error(authHost.body.reason);
    }

    this.sid = authHost.body.sid;
    this.clientHeaders['X-UT-SID'] = this.sid;

    //init pin
    this.pin = new Pin(this.sid, this.nucleusId, this.personaId, this.dob, this.platform).getInstance();
    await this.pin.init();
    let events = this.pin.event('login', 'success');
    await this.pin.send(events);

    //nucleus
    this.clientHeaders['Easw-Session-Data-Nucleus-Id'] = this.nucleusId;

    //phishing token
    this.phishingToken = authHost.body.phishingToken;
    this.clientHeaders['X-UT-PHISHING-TOKEN'] = this.phishingToken;

    Session.save('headers', this.clientHeaders);
    Session.save('futHost', this.futHost);
  }

  async _getUserInfo() {
    this.logger.await('[%d/10] - Getting user information...', 9);
    const headers = this.clientHeaders;

    //userinfo
    const userInfoResponse = await this.defaultRequest.get(`https://${this.futHost}/ut/game/fifa19/usermassinfo`, {
      headers,
      json : true
    });
    this.__usermassinfo = userInfoResponse.body;

    //settings
    const settingsResponse = await this.defaultRequest.get(`https://${this.futHost}/ut/game/fifa19/settings`, {
      qs   : {
        '' : new Date().getTime()
      },
      headers,
      json : true
    });
    this.__settings = settingsResponse.body;

    let piles = this._pileSize();
    this.tradepileSize = piles['tradepile'];
    this.watchlistSize = piles['watchlist'];

    // pinEvents - Home Screen
    let events = this.pin.event('page_view', 'Hub - Home');
    await this.pin.send(events);

    // pinEvents - boot_end
    events = [
      this.pin.event('connection'),
      this.pin.event('boot_end', false, false, false, 'normal')
    ];
    await this.pin.send(events);

    // credits
    this.credits = await this._keepalive();

    // return info
    const userInfo = {
      email          : this.loginCredentials.email,
      __usermassinfo : this.__usermassinfo,
      credits        : this.credits,
      auth           : {
          access_token   : this.accessToken,
          token_type     : this.tokenType,
          nucleus_id     : this.nucleusId,
          persona_id     : this.personaId,
          phishing_token : this.phishingToken,
          session_id     : this.sid,
          dob            : this.dob
      }
    };

    Session.save('userInfo', userInfo);

    return userInfo;
  }

  async _keepalive() {
    let req = {
      method : 'GET',
      url    : 'user/credits'
    };
    let response = await APIRequest(req);
    if (_.get(response, 'credits')) return response.credits;
    return false;
  }

  _pileSize() {
    let data = this.__usermassinfo.pileSizeClientData.entries;
    return {
      tradepile : data[0].value,
      watchlist : data[2].value
    };
  }

  _getCookie() {
    if (!fs.existsSync('./cookies.json')) {
      fs.writeFileSync('./cookies.json', '{}'); 
    }

    return './cookies.json';
  }
}

module.exports = Login;