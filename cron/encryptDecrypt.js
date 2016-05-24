var fs = require('fs');
var ursa = require('ursa');
var crt;
var key;

if (process.env.RWYS_PRIVATE_KEY_PATH === undefined ||
	process.env.RWYS_PUBLIC_KEY_PATH === undefined) {
	console.log('KEY PATHS NOT SET');
	process.exit();
} else {
	key = ursa.createPrivateKey(fs.readFileSync(process.env.RWYS_PRIVATE_KEY_PATH));
	crt = ursa.createPublicKey(fs.readFileSync(process.env.RWYS_PUBLIC_KEY_PATH));	
}

var decryptWithPrivate = function(stringToDecrypt) {
	return key.decrypt(stringToDecrypt, 'base64', 'utf8');
}

var encryptWithPublic = function(stringToEncrypt) {
	var encrypted = crt.encrypt(stringToEncrypt, 'utf8', 'base64');
	callback(null, encrypted);
}

module.exports = {
	decrypt: decryptWithPrivate,
	encrypt: encryptWithPublic
}