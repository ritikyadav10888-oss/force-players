module.exports = {
    expo: {
        name: "Force Player Register",
        slug: "force-player-register",
        scheme: "fpr",
        version: "1.0.0",
        orientation: "portrait",
        icon: "./assets/icon.png",
        userInterfaceStyle: "light",
        splash: {
            image: "./assets/splash.png",
            resizeMode: "contain",
            backgroundColor: "#ffffff"
        },
        assetBundlePatterns: [
            "**/*"
        ],
        ios: {
            supportsTablet: true,
            bundleIdentifier: "com.forcesports.playerregister"
        },
        android: {
            adaptiveIcon: {
                foregroundImage: "./assets/adaptive-icon.png",
                backgroundColor: "#ffffff"
            },
            package: "com.forcesports.playerregister"
        },
        web: {
            favicon: "./assets/favicon.png"
        },
        extra: {
            // Environment variables accessible via Constants.expoConfig.extra
            // This will use the key from .env file (test or live mode)
            EXPO_PUBLIC_RAZORPAY_KEY_ID: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID
        }
    }
};
