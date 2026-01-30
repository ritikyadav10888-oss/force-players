import React, { createContext, useState, useEffect, useContext } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { SECURITY_CONFIG } from '../config/security';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);

    const { OWNER_EMAILS } = SECURITY_CONFIG;

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                try {
                    // Force refresh the token to get the latest custom claims
                    const idTokenResult = await currentUser.getIdTokenResult(true);
                    const docRef = doc(db, "users", currentUser.uid);
                    const docSnap = await getDoc(docRef);

                    const role = idTokenResult.claims.role || docSnap.data()?.role || 'player';

                    if (docSnap.exists()) {
                        const data = docSnap.data();

                        // Sync role from claim to data for UI consistency
                        const updatedData = { ...data, role: role };

                        // Check Organizer Access Expiry
                        if (role === 'organizer' && data.accessExpiryDate) {
                            const today = new Date();
                            const expiry = new Date(data.accessExpiryDate);
                            if (today > expiry) {
                                console.warn("Access expired for user");
                                await signOut(auth);
                                alert("Your access to this platform has expired.");
                                return;
                            }
                        }
                        setUserData(updatedData);
                    } else {
                        // Initialize first-time user profile
                        const newUserData = {
                            email: currentUser.email,
                            role: role,
                            createdAt: new Date().toISOString()
                        };
                        try {
                            await setDoc(docRef, newUserData);
                        } catch (writeErr) {
                            console.warn("Profile init skip (permissions?):", writeErr);
                        }
                        setUserData(newUserData);
                    }
                } catch (error) {
                    console.error("Error setting user session:", error);
                }
            } else {
                setUser(null);
                setUserData(null);
            }
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    // Background Expiry Check (for active sessions)
    useEffect(() => {
        const checkExpiry = async () => {
            if (userData && userData.role === 'organizer' && userData.accessExpiryDate) {
                const expiry = new Date(userData.accessExpiryDate);
                if (new Date() > expiry) {
                    await logout();
                    alert("Your session has expired. Please contact the administrator.");
                }
            }
        };

        const interval = setInterval(checkExpiry, 60000); // Check every 1 minute
        return () => clearInterval(interval);
    }, [userData]);

    const login = async (email, password) => {
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));

            if (userDoc.exists()) {
                const data = userDoc.data();
                // Get role from claims directly on login
                const idTokenResult = await userCredential.user.getIdTokenResult(true);
                const role = idTokenResult.claims.role || 'player';

                if (role === 'organizer' && data.accessExpiryDate) {
                    const expiry = new Date(data.accessExpiryDate);
                    if (new Date() > expiry) {
                        await signOut(auth);
                        throw new Error("Your access to this platform has expired.");
                    }
                }
            }
            return userCredential;
        } catch (error) {
            throw error;
        }
    };

    const logout = () => {
        return signOut(auth);
    };

    const resetPassword = (email) => {
        return sendPasswordResetEmail(auth, email);
    };

    return (
        <AuthContext.Provider value={{ user, userData, loading, login, logout, resetPassword }}>
            {children}
        </AuthContext.Provider>
    );
};
