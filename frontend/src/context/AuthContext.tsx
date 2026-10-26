import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { StudentProfile } from '../types';
import { authApi } from '../services/api';

interface AuthContextType {
  token: string | null;
  profile: StudentProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, studentName?: string) => Promise<void>;
  register: (token: string, studentName?: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
  updateLocalProfile: (updated: Partial<StudentProfile>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchProfile = useCallback(async () => {
    try {
      const data = await authApi.getMe();
      setProfile(data);
    } catch (err) {
      console.error('Failed to load profile', err);
      // If unauthorized, token is cleared by api interceptor
      setToken(null);
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchProfile();
    } else {
      setIsLoading(false);
    }
  }, [token, fetchProfile]);

  const login = async (newToken: string) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setIsLoading(true);
    await fetchProfile();
  };

  const register = async (newToken: string) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setIsLoading(true);
    await fetchProfile();
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    await fetchProfile();
  };

  const updateLocalProfile = (updated: Partial<StudentProfile>) => {
    if (profile) {
      setProfile({ ...profile, ...updated });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        profile,
        isAuthenticated: !!token && !!profile,
        isLoading,
        login,
        register,
        logout,
        refreshProfile,
        updateLocalProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
