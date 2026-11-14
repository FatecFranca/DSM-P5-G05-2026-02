import { Platform } from 'react-native';

import { ApiClient } from './api';

const defaultUrl = Platform.select({
  android: 'http://10.0.2.2:3000',
  default: 'http://localhost:3000',
});

export const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim() || defaultUrl;
export const api = new ApiClient(apiUrl);
