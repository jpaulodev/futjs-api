'use strict';

const request = require('request-promise');
const Settings = require('./settings');
const sleep = require('./sleep');
const Session = require('./session');
const FileCookieStore = require('tough-cookie-filestore');

module.exports = async ({method, url, params = {}, delay = 0}) => {
  url = `https://${Session.load('futHost')}/${Settings.GAME_URL}/${url}`;
  const jar = request.jar(new FileCookieStore('./src/lib/cookies.json'));
  const headers = Session.load('headers');
  delete headers['X-HTTP-Method-Override'];
  const requestConfigDefaults = {
    jar,
    headers,
    json: true,
    followAllRedirects: true,
    gzip: true,
    resolveWithFullResponse: true,
  };
  let defaultRequest;
  try {
    defaultRequest = request.defaults(requestConfigDefaults);
  } catch (err) {
    console.log(err);
  }
  method = method.toLowerCase();

  if (method === 'get' || method === 'delete') {
    params.qs = Object.assign({}, params);
  }

  if (method === 'post' || method === 'put') {
    params.body = Object.assign({}, params);
  }

  if (delay) await sleep(delay);

  let response;
  try {
    response = await defaultRequest[method](url, params);
  } catch (err) {
    console.log(err);

    // TODO: improve error handling
    // TODO: handle all error codes
    switch (err.statusCode) {
      case 401:
        // session expired
        process.exit(0);
        break;
      case 429:
        // too many requests - temporary market ban
        process.exit(0);
        break;
      case 458: 
        // captcha
        process.exit(0);
        break;
    }

    return null;
  }

  return response.body;
};