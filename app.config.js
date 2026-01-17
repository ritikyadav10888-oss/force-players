export default {
    expo: {
        name: "Force Player Register",
        slug: "force-player-register",
        scheme: "fpr",
        version: "1.0.0",
        orientation: "portrait",
        icon: "./assets/logo.png",
        userInterfaceStyle: "light",
        newArchEnabled: true,
        splash: {
            image: "./assets/logo.png",
            resizeMode: "contain",
            backgroundColor: "#ffffff"
        },
        ios: {
            supportsTablet: true
        },
        android: {
            adaptiveIcon: {
                foregroundImage: "./assets/logo.png",
                backgroundColor: "#ffffff"
            },
            edgeToEdgeEnabled: true,
            package: "com.forceplayerregister.app"
        },
        web: {
            favicon: "./assets/logo.png"
        },
        plugins: [
            "expo-router",
            "@react-native-community/datetimepicker"
        ],
        extra: {
            razorpayKeyId: process.env.RAZORPAY_KEY_ID || "rzp_test_S45Wn70zYz9AOr", // Updated test key ID
            eas: {
                projectId: "5ded0f01-c26b-4f72-9fb7-5e689f5fbb86"
            }
        }
    }
};
