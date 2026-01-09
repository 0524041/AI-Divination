'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export interface User {
    id: number;
    username: string;
    role: string;
}

export interface AuthContextType {
    user: User | null;
    loading: boolean;
    isAuthenticated: boolean;
    login: (token: string) => void;
    logout: () => void;
    checkAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Public routes that don't require authentication
const PUBLIC_ROUTES = ['/login', '/share'];

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    const isPublicRoute = PUBLIC_ROUTES.some(route =>
        pathname === route || pathname.startsWith(`${route}/`)
    );

    const checkAuth = useCallback(async (): Promise<boolean> => {
        const token = localStorage.getItem('token');

        if (!token) {
            setUser(null);
            setLoading(false);
            return false;
        }

        try {
            const res = await fetch('/api/auth/me', {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setUser(data);
                setLoading(false);
                return true;
            } else {
                // Token invalid
                localStorage.removeItem('token');
                setUser(null);
                setLoading(false);
                return false;
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            setUser(null);
            setLoading(false);
            return false;
        }
    }, []);

    const login = useCallback((token: string) => {
        localStorage.setItem('token', token);
        checkAuth();
    }, [checkAuth]);

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        setUser(null);
        router.push('/login');
    }, [router]);

    // Check auth on mount and route changes
    useEffect(() => {
        const verifyAuth = async () => {
            const isAuthed = await checkAuth();

            // Redirect to login if not authenticated and on protected route
            if (!isAuthed && !isPublicRoute) {
                router.push('/login');
            }
        };

        verifyAuth();
    }, [checkAuth, isPublicRoute, router]);

    const value: AuthContextType = {
        user,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
        checkAuth,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

/**
 * Hook to access auth context
 */
export function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

/**
 * Hook that enforces authentication
 * Redirects to login if not authenticated
 */
export function useRequireAuth(): AuthContextType {
    const auth = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!auth.loading && !auth.isAuthenticated) {
            router.push('/login');
        }
    }, [auth.loading, auth.isAuthenticated, router]);

    return auth;
}
