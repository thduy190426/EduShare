export const API_URL = 'http://localhost:3000/api';

let appConfig = null;

export async function fetchAppConfig() {
    if (appConfig) return appConfig;
    try {
        const response = await fetch(`${API_URL}/config`);
        if (response.ok) {
            appConfig = await response.json();
            return appConfig;
        }
    } catch (error) {
        console.error('Failed to fetch app config', error);
    }
    return {};
}
