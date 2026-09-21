const crypto = require('crypto');

function gerarLoginGenerico() {
  return 'user' + crypto.randomInt(10000, 99999);
}

function gerarSenhaProvisoria() {
  return crypto.randomBytes(6).toString('base64url'); // ex: "aB3xQ9zK"
}

module.exports = { gerarLoginGenerico, gerarSenhaProvisoria };
