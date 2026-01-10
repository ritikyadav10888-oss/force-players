import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { Surface, Title } from 'react-native-paper';

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught Error:", error, errorInfo);
    }

    resetError = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <View style={styles.container}>
                    <Surface style={styles.card} elevation={4}>
                        <Title style={styles.title}>Oops! Something went wrong.</Title>
                        <Text style={styles.message}>
                            We encountered an unexpected error. Please try again.
                        </Text>
                        {this.state.error && (
                            <Text style={styles.debug}>{this.state.error.toString()}</Text>
                        )}
                        <Button title="Try Again" onPress={this.resetError} />
                    </Surface>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        padding: 20,
    },
    card: {
        padding: 30,
        borderRadius: 8,
        alignItems: 'center',
        maxWidth: 400,
        width: '100%'
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 10,
        color: '#B00020'
    },
    message: {
        marginBottom: 20,
        textAlign: 'center',
        color: '#555'
    },
    debug: {
        fontSize: 10,
        color: '#999',
        marginBottom: 20,
        textAlign: 'center'
    }
});
