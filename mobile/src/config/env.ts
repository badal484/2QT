import { Platform } from 'react-native';

// NOTE: Replace these PROD URLs with your actual production backend URLs before final build.
const LOCAL_API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8000/api/v1' : 'http://localhost:8000/api/v1';
const PROD_API_URL = 'https://api.veltofoodpalace.com/api/v1';

const LOCAL_SOCKET_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
const PROD_SOCKET_URL = 'https://api.veltofoodpalace.com';

export const ENV = {
  API_URL: __DEV__ ? LOCAL_API_URL : PROD_API_URL,
  SOCKET_URL: __DEV__ ? LOCAL_SOCKET_URL : PROD_SOCKET_URL,
  
  // ImageKit configurations (Ensure these are your production keys for a real launch)
  IMAGEKIT_URL_ENDPOINT: 'https://ik.imagekit.io/oellcbqek',
  IMAGEKIT_PUBLIC_KEY: 'public_PStmG2ipavrJoxTXsWmjsYk5T+Y=',
  
  APP_VERSION: '1.0.0'
};
