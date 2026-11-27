import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bookmark,
  Check,
  Database,
  ExternalLink,
  Globe,
  Leaf,
  Plus,
  RefreshCw,
  Scale,
  AlertCircle,
} from 'lucide-react';
import { PRODUCTS_API, USER_API } from '../lib/api';
import AssessmentReport from '../components/AssessmentReport';
import { useCompare } from '../context/CompareContext';
import { useAuth } from '../context/AuthContext';

export default function ProductDetailPage() {
  const { id, source, externalId } = useParams();
  const isExternalRoute = Boolean(source && externalId);
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [importing, setImporting] = useState(false);

  const { compareIds, toggleCompare } = useCompare();
  const { user } = useAuth();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setSavedSuccess(false);
    setSaveMessage('');

    const req = isExternalRoute
      ? PRODUCTS_API.getExternal(source, externalId)
      : PRODUCTS_API.get(id);

    req
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Could not load product details.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [id, source, externalId, isExternalRoute]);

  const handleImportToSql = async () => {
    if (!isExternalRoute) return;
    setImporting(true);
    setSaveMessage('');
    try {
      const res = await PRODUCTS_API.importExternal(source, externalId);
      if (res?.product?.productId) {
        setSaveMessage(
          res.alreadyExisted
            ? 'Already in NutriLens SQL Server catalogue.'
            : 'Imported and saved into SQL Server catalogue!'
        );
        navigate(`/products/${res.product.productId}`, { replace: true });
      }
    } catch (err) {
      setSaveMessage(err.message || 'Could not import product into SQL Server.');
    } finally {
      setImporting(false);
    }
  };

  const handleSaveBookmark = async () => {
    if (!user) {
      setSaveMessage('Sign in on the Dashboard to bookmark products to your account.');
      return;
    }
    try {
      let targetProductId = data.product.productId || data.existingProductId;
      if (!targetProductId && isExternalRoute) {
        const imported = await PRODUCTS_API.importExternal(source, externalId);
        targetProductId = imported?.product?.productId;
      }
      if (targetProductId) {
        await USER_API.saveProduct({ productId: targetProductId });
      } else {
        await USER_API.saveProduct({
          productName: data.product.productName,
          brand: data.product.brand,
          category: data.product.category,
          healthScore: data.assessment?.healthScore,
          novaGroup: data.assessment?.nova?.group,
          verdict: data.assessment?.verdict,
        });
      }
      setSavedSuccess(true);
      setSaveMessage('Saved to your NutriLens dashboard.');
    } catch (err) {
      setSaveMessage(err.message || 'Could not save product.');
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[400px] max-w-6xl items-center justify-center gap-2 px-4 text-sm text-[#5E7266]">
        <RefreshCw className="h-5 w-5 animate-spin text-[#426E4D]" />
        Loading full packaged food analysis...
      </div>
    );
  }

  if (error || !data?.product) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="flex items-center gap-3 rounded-2xl border border-[#EFCBC4] bg-[#FDF3F1] p-5 text-sm text-[#96382C]">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error || 'Product not found.'}</span>
        </div>
        <Link to="/explore" className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[#2E5238]">
          <ArrowLeft className="h-4 w-4" /> Back to Explore
        </Link>
      </div>
    );
  }

  const { product, assessment, betterAlternatives } = data;
  const localProductId = product.productId > 0 ? product.productId : data.existingProductId;
  const inCompare = localProductId ? compareIds.includes(localProductId) : false;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/explore"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4B6154] hover:text-[#143326]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Explore Foods
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {data.isExternal && !data.existingProductId && (
            <button
              type="button"
              onClick={handleImportToSql}
              disabled={importing}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2E5238] px-4 py-2 text-xs font-bold text-white hover:bg-[#1D4130] disabled:opacity-60"
            >
              {importing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Import to SQL Catalogue
            </button>
          )}

          {data.isExternal && data.existingProductId && (
            <Link
              to={`/products/${data.existingProductId}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#BFE0C7] bg-[#E9F4EC] px-4 py-2 text-xs font-bold text-[#1E5631]"
            >
              <Database className="h-4 w-4" />
              Open Local Catalogue Record
            </Link>
          )}

          {localProductId && (
            <button
              type="button"
              onClick={() => toggleCompare(localProductId)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-bold transition ${
                inCompare
                  ? 'border-[#2E5238] bg-[#2E5238] text-white'
                  : 'border-[#D2E0D3] bg-white text-[#1D4130] hover:bg-[#F3F8F4]'
              }`}
            >
              {inCompare ? <Check className="h-4 w-4" /> : <Scale className="h-4 w-4" />}
              {inCompare ? 'In Comparison' : 'Add to Compare'}
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveBookmark}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#D2E0D3] bg-white px-4 py-2 text-xs font-bold text-[#1D4130] hover:bg-[#F3F8F4]"
          >
            <Bookmark className={`h-4 w-4 ${savedSuccess ? 'fill-[#2E5238] text-[#2E5238]' : ''}`} />
            {savedSuccess ? 'Saved' : 'Save Product'}
          </button>
        </div>
      </div>

      {data.isExternal && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#D4E4D5] bg-[#F3F8F3] px-4 py-3 text-xs text-[#2E5238]">
          <span className="inline-flex items-center gap-2 font-semibold">
            <Globe className="h-4 w-4" />
            Live External Preview ({product.dataSource}) — rendered directly without requiring prior SQL Server import.
          </span>
        </div>
      )}

      {saveMessage && (
        <div className="mb-4 rounded-xl border border-[#D4E4D5] bg-[#F2F8F2] px-4 py-2.5 text-xs font-semibold text-[#1D4130]">
          {saveMessage}
        </div>
      )}

      {/* Product Identity Header */}
      <div className="mb-6 flex flex-col gap-6 rounded-3xl border border-[#E3ECE4] bg-white p-6 sm:flex-row sm:items-center">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.productName}
            className="h-28 w-28 shrink-0 rounded-2xl border border-[#E8EFE8] bg-[#FAFDF9] object-contain p-2"
          />
        ) : (
          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl bg-[#EEF5EE] text-[#426E4D]">
            <Leaf className="h-10 w-10" />
          </div>
        )}

        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#5E7266]">
            {product.barcode && (
              <span className="rounded-md bg-[#F3F6F3] px-2 py-0.5 font-mono">
                Barcode: {product.barcode}
              </span>
            )}
            {data.nutriScoreGrade && (
              <span className="rounded-md border border-[#D4E2D5] bg-[#F4F8F4] px-2 py-0.5 font-bold text-[#1D4130]">
                Nutri-Score: {data.nutriScoreGrade}
              </span>
            )}
            {product.netWeight && <span>Net pack: {product.netWeight}</span>}
            {product.servingSize && <span>• Label serving: {product.servingSize}</span>}
          </div>
          <h1 className="text-2xl font-extrabold text-[#143326] sm:text-3xl">
            {product.productName}
          </h1>
          {data.rawCategories?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {data.rawCategories.map((c) => (
                <span key={c} className="rounded-full bg-[#F4F7F4] px-2.5 py-0.5 text-[11px] font-medium text-[#4B6154]">
                  {c}
                </span>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4 text-xs text-[#5E7266]">
            <span>Source: <strong className="text-[#1D4130]">{product.dataSource || 'NutriLens Database'}</strong></span>
            {product.offProductUrl && (
              <a
                href={product.offProductUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-[#2E5238] hover:underline"
              >
                View external source record <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>

      <AssessmentReport
        productName={product.productName}
        brand={product.brand}
        category={product.category}
        servingSizeText={product.servingSize}
        servingSizeG={product.servingSizeG}
        allergensText={product.allergens}
        assessment={assessment}
        betterAlternatives={betterAlternatives}
      />
    </div>
  );
}
