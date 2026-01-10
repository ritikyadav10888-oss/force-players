export default {
    expo: {
        name: "Force Player Register",
        slug: "force-player-register",
        scheme: "fpr",
        version: "1.0.0",
        orientation: "portrait",
        icon: "./assets/icon.png",
        userInterfaceStyle: "light",
        newArchEnabled: true,
        splash: {
            image: "./assets/splash-icon.png",
            resizeMode: "contain",
            backgroundColor: "#ffffff"
        },
        ios: {
            supportsTablet: true
        },
        android: {
            adaptiveIcon: {
                foregroundImage: "./assets/adaptive-icon.png",
                backgroundColor: "#ffffff"
            },
            edgeToEdgeEnabled: true,
            package: "com.forceplayerregister.app"
        },
        web: {
            favicon: "./assets/favicon.png"
        },
        plugins: [
            "expo-router",
            "@react-native-community/datetimepicker"
        ],
        extra: {
            razorpayKeyId: process.env.RAZORPAY_KEY_ID || "rzp_test_RumA22x2lbG1jk", // Fallback for dev if env missing
            eas: {
                projectId: "5ded0f01-c26b-4f72-9fb7-5e689f5fbb86"
            }
        }
    }
};
