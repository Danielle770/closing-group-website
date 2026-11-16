'use strict';
/*
 * Makes the hashed password for a liaison's portal login. The password itself is never stored.
 *   node /opt/closinggroup/hash-password.js
 * Type the password when asked (it is not shown), then copy the line it prints
 * (scrypt:...) into /etc/closinggroup/closinggroup.env, e.g. LIAISON_EN_PASSWORD_HASH=scrypt:...
 */
const readline = require('readline');
const { hashPassword } = require('./portal');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
rl._writeToOutput = (s) => { if (/Password/.test(s)) rl.output.write(s); };
rl.question('Password (at least 10 characters): ', (pw) => {
  rl.close();
  process.stdout.write('\n');
  if (!pw || pw.length < 10) { console.error('Too short: use at least 10 characters.'); process.exit(1); }
  console.log(hashPassword(pw));
});
