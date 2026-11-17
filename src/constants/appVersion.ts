import Constants from 'expo-constants';

/** Version from app.json, so the label follows each release without code changes. */
export const appVersion: string | null = Constants.expoConfig?.version ?? null;
