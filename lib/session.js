'use strict';

// TODO: Change implementation to use 'node-persist' module

let SessionObject = {};

module.exports = {
  save: (key, val) => SessionObject[key] = val,
  load: (key) => SessionObject[key]
};