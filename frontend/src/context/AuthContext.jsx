import { createContext, useContext, useEffect, useState } from 'react';
import { AUTH_API } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('nutrilens_token');
    if (!token) {
      setAuthReady(true);
      return;
    }
    AUTH_API.me()
      .then((u) => setUser(u))
      .catch(() => {
        localStorage.removeItem('nutrilens_token');
        setUser(null);
      })
      .finally(() => setAuthReady(true));
  }, []);

  const loginSuccess = (token, userObj) => {
    localStorage.setItem('nutrilens_token', token);
    setUser(userObj);
  };

  const logout = () => {
    localStorage.removeItem('nutrilens_token');
    setUser(null);
  };

  const updateUser = (updated) => {
    setUser(updated);
  };

  const getMatchedAllergens = (productAllergensText, detectedAllergensList = []) => {
    if (!user?.allergens?.length) return [];
    const combined = `${productAllergensText || ''} ${(detectedAllergensList || []).join(' ')}`.toLowerCase();
    return user.allergens.filter((a) => combined.includes(a.toLowerCase()));
  };

  return (
    <AuthContext.Provider
      value={{ user, authReady, loginSuccess, logout, updateUser, getMatchedAllergens }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
