const CryptoJS = require("crypto-js");

const SECRET_KEY =
process.env.AES_SECRET ||
"digicert_secret_key";


// ✅ ENCRYPT
exports.encryptData = (data) => {

 try{

  return CryptoJS.AES.encrypt(

   JSON.stringify(data), // only once stringify

   SECRET_KEY

  ).toString();

 }
 catch(err){

  console.error("Encrypt Error :",err);

  throw err;

 }

};


// ✅ DECRYPT
exports.decryptData = (cipherText)=>{

 try{

 const bytes =
 CryptoJS.AES.decrypt(

  cipherText,

  SECRET_KEY

 );

 return bytes.toString(
 CryptoJS.enc.Utf8
 );

 }
 catch(err){

 console.error("Decrypt Error :",err);

 throw err;

 }

};