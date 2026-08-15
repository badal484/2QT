const PROD_API_URL = 'https://twoqt-1.onrender.com/api/v1';
const LOCAL_API_URL = 'http://localhost:8000/api/v1';
const PROD_SOCKET_URL = 'https://twoqt-1.onrender.com';

export const ENV = {
  API_URL: PROD_API_URL,
  SOCKET_URL: PROD_SOCKET_URL,

  IMAGEKIT_URL_ENDPOINT: 'https://ik.imagekit.io/oellcbqek',
  IMAGEKIT_PUBLIC_KEY: 'public_PStmG2ipavrJoxTXsWmjsYk5T+Y=',

  GOOGLE_GEOCODING_KEY: 'AIzaSyCwvUrO91u81DGsCr4YoJZWzrIC9Pr5kaA',

  // Business UPI ID shown to customers at the door for UPI payment
  BUSINESS_UPI_ID: 'badal90603@oksbi',

  // MSG91 widget (@msg91comm/sendotp-react-native) — client-embedded per MSG91's own
  // integration pattern, not a server-side secret.
  MSG91_WIDGET_ID: '366772613253353536373236',
  MSG91_WIDGET_TOKEN_AUTH: '524621TvewiLzS6a5add22P1',

  APP_VERSION: '1.0.0'
};
