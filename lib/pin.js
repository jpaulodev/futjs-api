'use strict';

const request = require('request-promise');
const Settings = require('./settings');

class Pin {
  constructor(sid, nucleusId, personaId, dob, platform) {
    //account
    this.sid = sid;
    this.nucleusId = nucleusId;
    this.personaId = personaId;
    this.dob = dob;
    this.platform = platform;
    this.pinUrl = Settings.PIN_URL;
    
    this.custom = {
      'networkAccess' : 'G',
      'service_plat'  : platform.substr(0, 3)
    };
    this.s = 2;
  }

  async init() {
    //pinvars
    await request.get('https://www.easports.com/fifa/ultimate-team/web-app/js/compiled_1.js').then((response) => {
      this.taxv = response.match(/taxv:"(.+?)"/)[1];
      this.tidt = response.match(/tidt:"(.+?)"/)[1];
      this.sku = response.match(/enums.SKU.FUT="(.+?)"/)[1];
      this.rel = 'prod'; //REWRITE?
      this.gid = response.match(/gid:([0-9]+?)/)[1];
      this.plat = 'web'; //REWRITE?
      this.et = response.match(/et:"(.+?)"/)[1];
      this.pidt = response.match(/pidt:"(.+?)"/)[1];
      this.v = response.match(/APP_VERSION="(.+?)"/)[1];
    });

    //headers
    this.headers = {
      'Origin'            : 'https://www.easports.com',
      'Referer'           : 'https://www.easports.com/fifa/ultimate-team/web-app/',
      'x-ea-game-id'      : this.sku,
      'x-ea-game-id-type' : this.tidt,
      'x-ea-taxv'         : this.taxv
    };
  }

  event(en, pgid = false, status = false, source = false, end_reason = false) {
    let data = {
      'core' : {
        's'        : this.s,
        'pidt'     : this.pidt,
        'pid'      : this.personaId,
        'pidm'     : {
          'nucleus' : this.nucleusId
        },
        'didm'     : {
          'uuid': '0'
        },
        'ts_event' : this.__ts(),
        'en': en
      }
    };
    if (this.dob) data.core.dob = this.dob;
    if (pgid) data.pgid = pgid;
    if (status) data.status = status;
    if (source) data.source = source;
    if (end_reason) data.end_reason = end_reason;
    if (en === 'login') {
        data.type = 'utas';
        data.userid = this.personaId;
    } else if (en === 'page_view') {
        data.type = 'menu';
    } else if (en === 'error') {
        data.server_type = 'utas';
        data.errid = 'server_error';
        data.type = 'disconnect';
        data.sid = this.sid;
    }
    this.s += 1;
    return data;
  }

  async send(events) {
    const body = {
      'taxv'    : this.taxv,
      'tidt'    : this.tidt,
      'tid'     : this.sku,
      'rel'     : this.rel,
      'v'       : this.v,
      'ts_post' : this.__ts(),
      'sid'     : this.sid,
      'gid'     : this.gid,
      'plat'    : this.plat,
      'et'      : this.et,
      'loc'     : 'en_US',
      'is_sess' : this.sid ? true : false,
      'custom'  : this.custom,
      'events'  : events
    };

    const headers = this.headers

    let response = await request.post(this.pinUrl, {
      body,
      headers,
      json: true
    });

    if (response.status !== 'ok') {
      throw new Error('PinEvent is NOT OK, probably they changed something.');
    }
  }

  __ts() {
    return new Date().toISOString()
  }
};

class Singleton {

  constructor(sid, nucleusId, personaId, dob, platform) {
    if (!Singleton.instance) {
      Singleton.instance = new Pin(sid, nucleusId, personaId, dob, platform);
    }
  }

  getInstance() {
    return Singleton.instance;
  }

};

module.exports = Singleton;