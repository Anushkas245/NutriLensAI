import { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Upload,
  ScanText,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  Edit3,
  Sparkles,
  Bookmark,
} from 'lucide-react';
import { SCANS_API, USER_API, PACKAGED_CATEGORIES } from '../lib/api';
import AssessmentReport from '../components/AssessmentReport';
import { useAuth } from '../context/AuthContext';

const NUTRIENT_FIELDS = [
  { key: 'calories', label: 'Calories / Energy', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'total_carbohydrate', label: 'Carbohydrates', unit: 'g' },
  { key: 'total_sugars', label: 'Total Sugars', unit: 'g' },
  { key: 'added_sugars', label: 'Added Sugars', unit: 'g' },
  { key: 'dietary_fiber', label: 'Dietary Fiber', unit: 'g' },
  { key: 'total_fat', label: 'Total Fat', unit: 'g' },
  { key: 'saturated_fat', label: 'Saturated Fat', unit: 'g' },
  { key: 'trans_fat', label: 'Trans Fat', unit: 'g' },
  { key: 'sodium', label: 'Sodium', unit: 'mg' },
];

const emptyNutrients = () => ({
  calories: '',
  protein: '',
  total_carbohydrate: '',
  total_sugars: '',
  added_sugars: '',
  dietary_fiber: '',
  total_fat: '',
  saturated_fat: '',
  trans_fat: '',
  sodium: '',
});

const toInputMap = (obj) => {
  const out = emptyNutrients();
  if (!obj) return out;
  for (const { key } of NUTRIENT_FIELDS) {
    const val = obj[key]?.value ?? obj[key];
    out[key] = val !== null && val !== undefined ? String(val) : '';
  }
  return out;
};

const toApiNutrition = (map) => {
  const numOrNull = (v) => {
    if (v === '' || v === null || v === undefined) return null;
    const parsed = Number.parseFloat(v);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };
  return {
    calories: numOrNull(map.calories),
    proteinG: numOrNull(map.protein),
    carbsG: numOrNull(map.total_carbohydrate),
    sugarG: numOrNull(map.total_sugars),
    addedSugarG: numOrNull(map.added_sugars),
    fiberG: numOrNull(map.dietary_fiber),
    fatG: numOrNull(map.total_fat),
    saturatedFatG: numOrNull(map.saturated_fat),
    transFatG: numOrNull(map.trans_fat),
    sodiumMg: numOrNull(map.sodium),
  };
};

export default function ScannerPage() {
  const [step, setStep] = useState('capture'); // 'capture' | 'review' | 'report'
  const [selectedImage, setSelectedImage] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [extractLoading, setExtractLoading] = useState(false);
  const [evalLoading, setEvalLoading] = useState(false);
  const [error, setError] = useState('');

  // Editable review form state
  const [rawExtracted, setRawExtracted] = useState(null);
  const [productName, setProductName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('Packaged Snacks');
  const [netWeight, setNetWeight] = useState('');
  const [servingSizeText, setServingSizeText] = useState('');
  const [servingSizeG, setServingSizeG] = useState('');
  const [ingredientsText, setIngredientsText] = useState('');
  const [allergensText, setAllergensText] = useState('');
  const [per100g, setPer100g] = useState(emptyNutrients);
  const [perServing, setPerServing] = useState(emptyNutrients);
  const [uncertainFields, setUncertainFields] = useState([]);
  const [requestAiSummary, setRequestAiSummary] = useState(true);

  const [report, setReport] = useState(null);
  const [savedNotice, setSavedNotice] = useState('');

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const { user } = useAuth();

  const previewUrlRef = useRef(null);

  useEffect(() => {
    previewUrlRef.current = selectedImage?.preview || null;
  }, [selectedImage]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  const startCamera = async () => {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is unavailable in this browser context. Please upload an image instead.');
      return;
    }
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      setError('Unable to access camera. Check browser permissions or upload a photo.');
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], 'captured-food-label.jpg', { type: 'image/jpeg' });
        handleSelectFile(file);
        stopCamera();
      },
      'image/jpeg',
      0.92
    );
  };

  const handleSelectFile = (file) => {
    setError('');
    if (!file || !file.type.startsWith('image/')) {
      setError('Please choose a valid image file (PNG, JPG, WEBP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be 10 MB or smaller.');
      return;
    }
    if (selectedImage?.preview) URL.revokeObjectURL(selectedImage.preview);
    setSelectedImage({ file, preview: URL.createObjectURL(file) });
  };

  const runExtraction = async () => {
    if (!selectedImage?.file) return;
    setExtractLoading(true);
    setError('');
    try {
      const data = await SCANS_API.analyzeImage(selectedImage.file);
      if (!data.success) {
        setError(data.message || 'Could not extract food label details.');
        return;
      }
      setRawExtracted(data);
      setProductName(data.product_name || '');
      setBrand(data.brand || '');
      setCategory(data.category || 'Packaged Snacks');
      setNetWeight(data.net_weight || '');
      const sSize = data.serving_size ? `${data.serving_size} ${data.serving_unit || 'g'}` : '';
      setServingSizeText(data.serving_description ? `${data.serving_description} (${sSize})` : sSize);
      const parsedG = Number.parseFloat(data.serving_size);
      setServingSizeG(Number.isFinite(parsedG) ? String(parsedG) : '');
      setIngredientsText(data.ingredients_text || (data.ingredients || []).join(', '));
      const allg = [
        ...(data.allergens?.contains || []),
        ...(data.allergens?.may_contain || []),
      ].join(', ');
      setAllergensText(allg || data.allergens?.label_text || '');
      setPer100g(toInputMap(data.nutrition_per_100g));
      setPerServing(toInputMap(data.nutrition_per_serving));
      setUncertainFields(data.uncertain_fields || []);
      setStep('review');
    } catch (err) {
      setError(err.message || 'Failed to analyze image.');
    } finally {
      setExtractLoading(false);
    }
  };

  const startManualEntry = () => {
    setError('');
    setRawExtracted(null);
    setUncertainFields([]);
    setStep('review');
  };

  const generateAnalysis = async (e) => {
    e.preventDefault();
    setEvalLoading(true);
    setError('');
    setSavedNotice('');
    try {
      const parsedServingG = Number.parseFloat(servingSizeG);
      const payload = {
        productName: productName.trim() || 'Scanned Packaged Food',
        brand: brand.trim() || null,
        category,
        barcode: rawExtracted?.barcode || null,
        netWeight: netWeight.trim() || null,
        servingSizeText: servingSizeText.trim() || null,
        servingSizeG: Number.isFinite(parsedServingG) && parsedServingG > 0 ? parsedServingG : null,
        servingsPerPack: rawExtracted?.servings_per_pack || null,
        nutritionBasis: rawExtracted?.nutrition_basis || 'both',
        per100g: toApiNutrition(per100g),
        perServing: toApiNutrition(perServing),
        ingredientsText: ingredientsText.trim() || null,
        allergens: allergensText.trim() || null,
        sourceImageName: selectedImage?.file?.name || null,
        rawExtractedJson: rawExtracted ? JSON.stringify(rawExtracted) : null,
        saveToHistory: true,
        requestAiSummary,
      };
      const result = await SCANS_API.evaluate(payload);
      setReport(result);
      setStep('report');
    } catch (err) {
      setError(err.message || 'Could not evaluate food label.');
    } finally {
      setEvalLoading(false);
    }
  };

  const handleSaveScanToAccount = async () => {
    if (!user) {
      setSavedNotice('Sign in on the Dashboard to bookmark scanned items.');
      return;
    }
    try {
      await USER_API.saveProduct({
        scanId: report.scanId,
        productName: report.productName,
        brand: report.brand,
        category: report.category,
        healthScore: report.assessment?.healthScore,
        novaGroup: report.assessment?.nova?.group,
        verdict: report.assessment?.verdict,
      });
      setSavedNotice('Saved to your Dashboard!');
    } catch (err) {
      setSavedNotice(err.message || 'Could not save.');
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header + 3-Step Indicator */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#E3ECE4] pb-6 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-[#143326]">Packaged Food Label Scanner</h1>
          <p className="mt-1 text-sm text-[#5E7266]">
            Exclusively for packaged human food labels. Extract with AI vision, verify values, and run deterministic analysis.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold">
          {[
            { id: 'capture', num: 1, label: 'Upload / Capture' },
            { id: 'review', num: 2, label: 'Review & Correct' },
            { id: 'report', num: 3, label: 'Food Analysis' },
          ].map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={s.id === 'report' && !report}
              onClick={() => {
                if (s.id === 'capture' || s.id === 'review' || (s.id === 'report' && report)) {
                  setStep(s.id);
                }
              }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition ${
                step === s.id
                  ? 'bg-[#2E5238] text-white'
                  : 'bg-white border border-[#DCE6DD] text-[#5E7266] disabled:opacity-45'
              }`}
            >
              <span>{s.num}.</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#EFCBC4] bg-[#FDF3F1] p-4 text-sm text-[#96382C]" role="alert">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: CAPTURE / UPLOAD */}
      {step === 'capture' && (
        <div className="mt-6 rounded-3xl border border-[#E3ECE4] bg-white p-6 shadow-2xs sm:p-10">
          {!selectedImage && !cameraOpen && (
            <div className="mx-auto max-w-xl rounded-2xl border-2 border-dashed border-[#BFD4C1] bg-[#FAFDF9] p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E7F2E8] text-[#2E5238]">
                <ScanText className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-xl font-extrabold text-[#143326]">
                Upload a Packaged Food Label
              </h2>
              <p className="mt-2 text-sm text-[#5E7266]">
                Capture the nutrition facts table and ingredients paragraph clearly. Non-food items, cosmetics, pet food, and restaurant dishes are rejected.
              </p>

              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#2E5238] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1D4130]"
                >
                  <Upload className="h-4 w-4" />
                  Choose Image
                </button>
                <button
                  type="button"
                  onClick={startCamera}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#C9DBC9] bg-white px-5 py-2.5 text-sm font-bold text-[#1D4130] hover:bg-[#F2F8F2]"
                >
                  <Camera className="h-4 w-4" />
                  Use Camera
                </button>
                <button
                  type="button"
                  onClick={startManualEntry}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#DCE6DD] bg-white px-4 py-2.5 text-sm font-semibold text-[#4B6154] hover:bg-[#F6FAF6]"
                >
                  <Edit3 className="h-4 w-4" />
                  Enter Label Manually
                </button>
              </div>
              <p className="mt-4 text-[11px] text-[#7B8E82]">
                Max size 10 MB • Powered by local Qwen Vision (Ollama) + Deterministic FSSAI Engine
              </p>
            </div>
          )}

          {cameraOpen && (
            <div className="mx-auto max-w-xl space-y-4 text-center">
              <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-2xl bg-[#112018]" />
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#2E5238] px-5 py-2.5 text-sm font-bold text-white"
                >
                  <Camera className="h-4 w-4" /> Capture Photo
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#D4E2D5] bg-white px-4 py-2.5 text-sm font-semibold text-[#1D4130]"
                >
                  <X className="h-4 w-4" /> Cancel
                </button>
              </div>
            </div>
          )}

          {selectedImage && !cameraOpen && (
            <div className="mx-auto grid max-w-3xl items-center gap-8 md:grid-cols-2">
              <img
                src={selectedImage.preview}
                alt="Selected food label"
                className="max-h-80 w-full rounded-2xl border border-[#E4ECE5] bg-[#F7FAF7] object-contain p-2"
              />
              <div>
                <div className="flex items-center gap-2 text-sm font-bold text-[#1E5631]">
                  <CheckCircle2 className="h-5 w-5" />
                  Image ready for OCR &amp; AI vision extraction
                </div>
                <p className="mt-2 text-xs text-[#5E7266]">
                  {selectedImage.file.name} ({(selectedImage.file.size / (1024 * 1024)).toFixed(2)} MB)
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={runExtraction}
                    disabled={extractLoading}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#2E5238] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1D4130] disabled:opacity-60"
                  >
                    {extractLoading ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Extracting label...
                      </>
                    ) : (
                      <>
                        <ScanText className="h-4 w-4" />
                        Extract Label Data
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={extractLoading}
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-xl border border-[#C9DBC9] bg-white px-4 py-2.5 text-sm font-semibold text-[#1D4130]"
                  >
                    Change Image
                  </button>
                </div>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              if (e.target.files?.[0]) handleSelectFile(e.target.files[0]);
              e.target.value = '';
            }}
            hidden
          />
        </div>
      )}

      {/* STEP 2: REVIEW & CORRECT */}
      {step === 'review' && (
        <form onSubmit={generateAnalysis} className="mt-6 space-y-6">
          {uncertainFields.length > 0 && (
            <div className="rounded-2xl border border-[#F0D9AE] bg-[#FFF9ED] p-4 text-xs text-[#8B5A12]">
              <p className="font-bold">Fields flagged for verification:</p>
              <ul className="mt-1 list-disc pl-4">
                {uncertainFields.map((u, i) => (
                  <li key={i}>{u}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-3xl border border-[#E3ECE4] bg-white p-6">
            <h2 className="text-lg font-extrabold text-[#143326]">1. Product Identity &amp; Serving Information</h2>
            <p className="mt-0.5 text-xs text-[#5E7266]">
              Verify and correct any extracted label details before running deterministic evaluation.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-xs font-bold text-[#2E5238]">Product Name *</label>
                <input
                  type="text"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Lay's Classic Salted"
                  className="mt-1 h-10 w-full rounded-xl border border-[#D4E2D5] px-3 text-sm text-[#143326]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#2E5238]">Brand</label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g. Lay's / Britannia"
                  className="mt-1 h-10 w-full rounded-xl border border-[#D4E2D5] px-3 text-sm text-[#143326]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#2E5238]">Packaged Food Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-[#D4E2D5] bg-white px-3 text-sm text-[#143326]"
                >
                  {PACKAGED_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#2E5238]">Net Pack Weight</label>
                <input
                  type="text"
                  value={netWeight}
                  onChange={(e) => setNetWeight(e.target.value)}
                  placeholder="e.g. 52 g"
                  className="mt-1 h-10 w-full rounded-xl border border-[#D4E2D5] px-3 text-sm text-[#143326]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#2E5238]">Serving Size Description</label>
                <input
                  type="text"
                  value={servingSizeText}
                  onChange={(e) => setServingSizeText(e.target.value)}
                  placeholder="e.g. 20 g (approx. 15 chips)"
                  className="mt-1 h-10 w-full rounded-xl border border-[#D4E2D5] px-3 text-sm text-[#143326]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#2E5238]">Serving Weight (grams / ml)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={servingSizeG}
                  onChange={(e) => setServingSizeG(e.target.value)}
                  placeholder="e.g. 20"
                  className="mt-1 h-10 w-full rounded-xl border border-[#D4E2D5] px-3 text-sm text-[#143326]"
                />
              </div>
            </div>
          </div>

          {/* Separate Per 100g and Per Serving Editable Tables */}
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-[#E3ECE4] bg-white p-6">
              <h2 className="text-base font-extrabold text-[#143326]">2A. Nutrition Per 100g / 100ml</h2>
              <p className="mt-0.5 text-xs text-[#5E7266]">Leave blank if unavailable on the label. Never enter 0 unless printed 0.</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {NUTRIENT_FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className="block text-[11px] font-bold text-[#4B6154]">
                      {f.label} ({f.unit})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={per100g[f.key]}
                      onChange={(e) => setPer100g((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder="Unavailable"
                      className="mt-1 h-9 w-full rounded-lg border border-[#D7E4D8] px-2.5 text-sm tabular-nums text-[#143326]"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-[#E3ECE4] bg-white p-6">
              <h2 className="text-base font-extrabold text-[#143326]">2B. Nutrition Per Serving</h2>
              <p className="mt-0.5 text-xs text-[#5E7266]">Only fill if printed separately, or leave blank to compute from Per 100g.</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {NUTRIENT_FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className="block text-[11px] font-bold text-[#4B6154]">
                      {f.label} ({f.unit})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={perServing[f.key]}
                      onChange={(e) => setPerServing((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder="Unavailable"
                      className="mt-1 h-9 w-full rounded-lg border border-[#D7E4D8] px-2.5 text-sm tabular-nums text-[#143326]"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[#E3ECE4] bg-white p-6 space-y-4">
            <h2 className="text-base font-extrabold text-[#143326]">3. Ingredients &amp; Allergens</h2>
            <div>
              <label className="block text-xs font-bold text-[#2E5238]">Ingredients List</label>
              <textarea
                rows={4}
                value={ingredientsText}
                onChange={(e) => setIngredientsText(e.target.value)}
                placeholder="Paste or verify the exact comma-separated ingredients paragraph..."
                className="mt-1 w-full rounded-xl border border-[#D4E2D5] p-3 text-sm text-[#143326]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#2E5238]">Declared Allergens</label>
              <input
                type="text"
                value={allergensText}
                onChange={(e) => setAllergensText(e.target.value)}
                placeholder="e.g. Milk, Wheat, Soy, Peanuts"
                className="mt-1 h-10 w-full rounded-xl border border-[#D4E2D5] px-3 text-sm text-[#143326]"
              />
            </div>

            {rawExtracted?.label_text && (
              <details className="rounded-xl border border-[#E4ECE5] bg-[#F8FBF8] p-3 text-xs text-[#4B6154]">
                <summary className="cursor-pointer font-bold text-[#2E5238]">
                  View raw transcribed label text
                </summary>
                <pre className="mt-2 whitespace-pre-wrap font-sans leading-relaxed">
                  {rawExtracted.label_text}
                </pre>
              </details>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[#EEF3EE] pt-4">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#2E5238]">
                <input
                  type="checkbox"
                  checked={requestAiSummary}
                  onChange={(e) => setRequestAiSummary(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#2E5238]"
                />
                <Sparkles className="h-3.5 w-3.5 text-[#426E4D]" />
                Include AI plain-language commentary (separate from deterministic score)
              </label>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep('capture')}
                  className="rounded-xl border border-[#D4E2D5] bg-white px-4 py-2.5 text-sm font-semibold text-[#4B6154]"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={evalLoading}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#2E5238] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#1D4130] disabled:opacity-60"
                >
                  {evalLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    'Generate Food Analysis'
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* STEP 3: FULL ANALYSIS REPORT */}
      {step === 'report' && report && (
        <div className="mt-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DCE8DD] bg-white p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#1E5631]">
              <CheckCircle2 className="h-4 w-4" />
              Analysis complete {report.scanId ? `• Saved to Scan History (#${report.scanId})` : ''}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStep('review')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#D2E0D3] bg-white px-3.5 py-2 text-xs font-bold text-[#1D4130]"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit Values
              </button>
              <button
                type="button"
                onClick={handleSaveScanToAccount}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#2E5238] px-3.5 py-2 text-xs font-bold text-white"
              >
                <Bookmark className="h-3.5 w-3.5" />
                Bookmark Result
              </button>
            </div>
          </div>

          {savedNotice && (
            <div className="rounded-xl border border-[#D4E4D5] bg-[#F2F8F2] px-4 py-2 text-xs font-semibold text-[#1D4130]">
              {savedNotice}
            </div>
          )}

          <AssessmentReport
            productName={report.productName}
            brand={report.brand}
            category={report.category}
            servingSizeText={report.servingSizeText}
            servingSizeG={report.servingSizeG}
            allergensText={report.allergens}
            assessment={report.assessment}
            betterAlternatives={report.betterAlternatives}
            aiCommentary={report.aiCommentary}
          />
        </div>
      )}
    </div>
  );
}
