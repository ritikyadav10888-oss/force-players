// This file redirects to create-tournament with the tournament ID
// Expo Router will handle the [id] parameter
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function EditTournament() {
    const { id } = useLocalSearchParams();

    // Redirect to create-tournament with the id parameter
    // The create-tournament screen already handles edit mode when id is present
    return <Redirect href={`/(owner)/create-tournament?id=${id}`} />;
}
