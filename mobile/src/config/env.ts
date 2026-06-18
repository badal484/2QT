// localhost works for both emulator and real device when `adb reverse tcp:8000 tcp:8000` is active.
// adb reverse tunnels localhost on the device to the Mac's port — no IP config needed.
const LOCAL_API_URL = 'http://localhost:8000/api/v1';
const LOCAL_SOCKET_URL = 'http://localhost:8000';

const PROD_API_URL = 'https://api.veltofoodpalace.com/api/v1';
const PROD_SOCKET_URL = 'https://api.veltofoodpalace.com';

export const ENV = {
  API_URL: __DEV__ ? LOCAL_API_URL : PROD_API_URL,
  SOCKET_URL: __DEV__ ? LOCAL_SOCKET_URL : PROD_SOCKET_URL,

  IMAGEKIT_URL_ENDPOINT: 'https://ik.imagekit.io/oellcbqek',
  IMAGEKIT_PUBLIC_KEY: 'public_PStmG2ipavrJoxTXsWmjsYk5T+Y=',

  APP_VERSION: '1.0.0'
};
