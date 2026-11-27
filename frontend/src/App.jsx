import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CompareProvider } from './context/CompareContext';
import AppShell from './components/AppShell';
import OverviewPage from './pages/OverviewPage';
import ExplorePage from './pages/ExplorePage';
import ScannerPage from './pages/ScannerPage';
import ProductDetailPage from './pages/ProductDetailPage';
import ComparePage from './pages/ComparePage';
import SavedProductsPage from './pages/SavedProductsPage';
import ScanHistoryPage from './pages/ScanHistoryPage';
import MethodologyPage from './pages/MethodologyPage';
import SourcesPage from './pages/SourcesPage';
import SettingsPage from './pages/SettingsPage';
import AccountPage from './pages/AccountPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CompareProvider>
          <AppShell>
            <Routes>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/scanner" element={<ScannerPage />} />
              <Route path="/compare" element={<ComparePage />} />
              <Route path="/saved" element={<SavedProductsPage />} />
              <Route path="/history" element={<ScanHistoryPage />} />
              <Route path="/products/external/:source/:externalId" element={<ProductDetailPage />} />
              <Route path="/products/:id" element={<ProductDetailPage />} />
              <Route path="/methodology" element={<MethodologyPage />} />
              <Route path="/sources" element={<SourcesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/dashboard" element={<Navigate to="/account" replace />} />
            </Routes>
          </AppShell>
        </CompareProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
