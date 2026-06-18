import AsyncStorage from '@react-native-async-storage/async-storage';
import { Storage } from 'redux-persist';

export const reduxStorage: Storage = AsyncStorage;
