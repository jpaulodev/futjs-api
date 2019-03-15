const {Signale} = require('signale');
 
const defaultOptions = {
  disabled: false,
  interactive: false,
  stream: process.stdout,
  scope: 'FutAPI-JS',
  types: {
    todo: {
      badge: '**',
      color: 'yellow',
      label: 'ToDo'
    }
  }
};
 
const custom = new Signale(defaultOptions);
custom.todo('Improve documentation.');

module.exports = (options) => {
  options = Object.assign(defaultOptions, options);
  return new Signale(options);
};