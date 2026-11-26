import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CompareProvider } from './context/CompareContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import ExplorePage from './pages/ExplorePage';
import ScannerPage from './pages/ScannerPage';
import ProductDetailPage from './pages/ProductDetailPage';
import ComparePage from './pages/ComparePage';
import DashboardPage from './pages/DashboardPage';
import MethodologyPage from './pages/MethodologyPage';
import SourcesPage from './pages/SourcesPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CompareProvider>
          <div className="flex min-h-screen flex-col bg-[#F7FAF7] text-[#143326]">
            <Navbar />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/explore" element={<ExplorePage />} />
                <Route path="/scanner" element={<ScannerPage />} />
                <Route path="/products/:id" element={<ProductDetailPage />} />
                <Route path="/compare" element={<ComparePage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/methodology" element={<MethodologyPage />} />
                <Route path="/sources" element={<SourcesPage />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </CompareProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
