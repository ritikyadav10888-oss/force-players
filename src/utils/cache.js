import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'fpr_cache_';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

export const cacheManager = {
    async set(key, value, expiryMs = CACHE_EXPIRY) {
        try {
            const item = {
                value,
                timestamp: Date.now(),
                expiry: expiryMs
            };
            await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
        } catch (error) {
            console.error('Cache set error:', error);
        }
    },

    async get(key) {
        try {
            const item = await AsyncStorage.getItem(CACHE_PREFIX + key);
            if (!item) return null;

            const { value, timestamp, expiry } = JSON.parse(item);
            if (Date.now() - timestamp > expiry) {
                await this.remove(key);
                return null;
            }
            return value;
        } catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    },

    async remove(key) {
        try {
            await AsyncStorage.removeItem(CACHE_PREFIX + key);
        } catch (error) {
            console.error('Cache remove error:', error);
        }
    },

    async clear() {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
            await AsyncStorage.multiRemove(cacheKeys);
        } catch (error) {
            console.error('Cache clear error:', error);
        }
    }
};
