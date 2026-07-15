import EncryptedStorage from 'react-native-encrypted-storage';
import { Storage } from 'redux-persist';

export const reduxStorage: Storage = {
    setItem: (key, value) => EncryptedStorage.setItem(key, value),
    getItem: (key) => EncryptedStorage.getItem(key),
    removeItem: (key) => EncryptedStorage.removeItem(key),
};
