import { useEffect, useRef, useState } from 'react'

import {

  Leaf,

  Search,

  RefreshCw,

  AlertCircle,

  Camera,

  Upload,

  X,

  Image as ImageIcon,

  CheckCircle,

  ScanText,

} from 'lucide-react'

import './App.css'

const API_URL = 'http://localhost:5080/api/products'

const OCR_URL = 'http://localhost:8000/analyze-image'

// Convert an extracted nutrition value into a number.

function getNutritionValue(nutrition, nutrientName) {

  const item = nutrition?.[nutrientName]

  if (item === undefined || item === null) return null

  const value =

    typeof item === 'object' ? item.value : item

  if (value === null || value === undefined || value === '') {

    return null

  }

  const number = Number.parseFloat(value)

  return Number.isFinite(number) ? number : null

}

// Check whether an extracted value needs manual verification.

function needsNutritionReview(nutrition, nutrientName) {

  const item = nutrition?.[nutrientName]

  return Boolean(

    item &&

    typeof item === 'object' &&

    (item.needs_review ?? item.needsReview)

  )

}

// Calculate a simple label-balance score per serving.

function getNutritionInsights(nutrition) {

  if (!nutrition || Object.keys(nutrition).length === 0) {

    return null

  }

  const sodium = getNutritionValue(nutrition, 'sodium')

  const addedSugar = getNutritionValue(nutrition, 'added_sugars')

  const saturatedFat = getNutritionValue(nutrition, 'saturated_fat')

  const fiber = getNutritionValue(nutrition, 'dietary_fiber')

  const protein = getNutritionValue(nutrition, 'protein')

  // Core values must be available and verified for a score.

  const coreValues = [

    ['sodium', sodium],

    ['added_sugars', addedSugar],

    ['saturated_fat', saturatedFat],

  ]

  const scoreNeedsReview = coreValues.some(([key, value]) =>

    value === null || needsNutritionReview(nutrition, key)

  )

  const insights = []

  if (sodium !== null) {

    insights.push(

      sodium > 140

        ? {

            type: 'warning',

            title: 'Sodium level',

            message: `${sodium} mg per serving. Compare sodium levels with similar products.`,

          }

        : {

            type: 'positive',

            title: 'Sodium level',

            message: `${sodium} mg per serving, at or below 140 mg.`,

          }

    )

  }

  if (addedSugar !== null) {

    insights.push(

      addedSugar > 5

        ? {

            type: 'warning',

            title: 'Added sugar',

            message: `${addedSugar} g per serving. Consider comparing products with less added sugar.`,

          }

        : {

            type: 'positive',

            title: 'Added sugar',

            message: `${addedSugar} g per serving, at or below 5 g.`,

          }

    )

  }

  if (saturatedFat !== null) {

    insights.push(

      saturatedFat > 1.5

        ? {

            type: 'warning',

            title: 'Saturated fat',

            message: `${saturatedFat} g per serving. Compare this amount with similar products.`,

          }

        : {

            type: 'positive',

            title: 'Saturated fat',

            message: `${saturatedFat} g per serving, at or below 1.5 g.`,

          }

    )

  }

  if (fiber !== null) {

    insights.push({

      type: fiber >= 3 ? 'positive' : 'neutral',

      title: 'Dietary fiber',

      message:

        fiber >= 3

          ? `${fiber} g per serving. This product provides at least 3 g of fiber.`

          : `${fiber} g per serving. This product provides less than 3 g of fiber.`,

    })

  }

  if (protein !== null) {

    insights.push({

      type: protein >= 5 ? 'positive' : 'neutral',

      title: 'Protein',

      message:

        protein >= 5

          ? `${protein} g per serving. This product provides at least 5 g of protein.`

          : `${protein} g per serving. This product provides less than 5 g of protein.`,

    })

  }

  if (scoreNeedsReview) {

    return {

      score: null,

      insights,

      needsReview: true,

    }

  }

  let score = 100

  // Sodium penalty.

  if (sodium > 420) score -= 30

  else if (sodium > 280) score -= 20

  else if (sodium > 140) score -= 10

  // Added sugar penalty.

  if (addedSugar > 15) score -= 30

  else if (addedSugar > 10) score -= 20

  else if (addedSugar > 5) score -= 10

  // Saturated fat penalty.

  if (saturatedFat > 5) score -= 25

  else if (saturatedFat > 3) score -= 20

  else if (saturatedFat > 1.5) score -= 10

  // Small bonuses for fiber and protein.

  if (fiber !== null && fiber >= 3) score += 5

  if (protein !== null && protein >= 5) score += 5

  return {

    score: Math.max(0, Math.min(100, score)),

    insights,

    needsReview: false,

  }

}

const MAX_IMAGE_SIZE = 10 * 1024 * 1024

function App() {

  const [products, setProducts] = useState([])

  const [searchTerm, setSearchTerm] = useState('')

  const [loading, setLoading] = useState(true)

  const [productError, setProductError] = useState('')

  const [selectedImage, setSelectedImage] = useState(null)

  const [imageError, setImageError] = useState('')

  const [cameraOpen, setCameraOpen] = useState(false)

  const [cameraError, setCameraError] = useState('')

  const [ocrLoading, setOcrLoading] = useState(false)

  const [ocrResult, setOcrResult] = useState('')

  const [ocrError, setOcrError] = useState('')

  const fileInputRef = useRef(null)

  const videoRef = useRef(null)

  const streamRef = useRef(null)

  const nutritionInsights = getNutritionInsights(ocrResult?.nutrition)

  // Load products from the ASP.NET Core API.

  const fetchProducts = async () => {

    setLoading(true)

    setProductError('')

    try {

      const response = await fetch(API_URL)

      if (!response.ok) {

        throw new Error('Unable to load products from the database.')

      }

      const data = await response.json()

      setProducts(Array.isArray(data) ? data : [])

    } catch (error) {

      setProductError(

        error.message ||

          'Could not connect to the product API. Check that the backend is running.'

      )

    } finally {

      setLoading(false)

    }

  }

  useEffect(() => {

    fetchProducts()

    return () => {

      if (streamRef.current) {

        streamRef.current.getTracks().forEach((track) => track.stop())

      }

    }

  }, [])

  // Create an image selection and clear old OCR results.

  const setImageFile = (file) => {

    setImageError('')

    setOcrError('')

    setOcrResult('')

    if (!file) return

    if (!file.type.startsWith('image/')) {

      setImageError('Please select a valid image file.')

      return

    }

    if (file.size > MAX_IMAGE_SIZE) {

      setImageError('Image must be 10 MB or smaller.')

      return

    }

    setSelectedImage({

      file,

      preview: URL.createObjectURL(file),

    })

  }

  // Handle image upload.

  const handleImageUpload = (event) => {

    const file = event.target.files?.[0]

    if (file) {

      setImageFile(file)

    }

    // Allows selecting the same file again.

    event.target.value = ''

  }

  // Open the file picker.

  const openFilePicker = () => {

    fileInputRef.current?.click()

  }

  // Stop the camera and release its resources.

  const stopCamera = () => {

    if (streamRef.current) {

      streamRef.current.getTracks().forEach((track) => track.stop())

      streamRef.current = null

    }

    if (videoRef.current) {

      videoRef.current.srcObject = null

    }

    setCameraOpen(false)

  }

  // Start the device camera.

  const startCamera = async () => {

    setCameraError('')

    setImageError('')

    if (!navigator.mediaDevices?.getUserMedia) {

      setCameraError(

        'Camera access is unavailable. Use localhost or a secure connection, and try uploading an image instead.'

      )

      return

    }

    try {

      stopCamera()

      const stream = await navigator.mediaDevices.getUserMedia({

        video: { facingMode: 'environment' },

        audio: false,

      })

      streamRef.current = stream

      setCameraOpen(true)

      // Wait until the camera preview element is rendered.

      requestAnimationFrame(() => {

        if (videoRef.current) {

          videoRef.current.srcObject = stream

          videoRef.current.play().catch(() => {

            setCameraError('Could not start the camera preview.')

          })

        }

      })

    } catch (error) {

      setCameraError(

        error.name === 'NotAllowedError'

          ? 'Camera permission was denied. Allow camera access in your browser settings.'

          : 'Unable to access the camera. Check that it is connected and not being used by another application.'

      )

    }

  }

  // Capture a photo from the camera.

  const capturePhoto = () => {

    const video = videoRef.current

    if (!video || !video.videoWidth || !video.videoHeight) {

      setCameraError('The camera is not ready yet. Please try again.')

      return

    }

    const canvas = document.createElement('canvas')

    canvas.width = video.videoWidth

    canvas.height = video.videoHeight

    const context = canvas.getContext('2d')

    if (!context) {

      setCameraError('Unable to capture the image. Please try again.')

      return

    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob(

      (blob) => {

        if (!blob) {

          setCameraError('Could not create the captured image.')

          return

        }

        const file = new File([blob], 'food-label-capture.jpg', {

          type: 'image/jpeg',

        })

        setImageFile(file)

        stopCamera()

      },

      'image/jpeg',

      0.92

    )

  }

  // Remove the selected image.

  const removeImage = () => {

    if (selectedImage?.preview) {

      URL.revokeObjectURL(selectedImage.preview)

    }

    setSelectedImage(null)

    setImageError('')

    setOcrError('')

    setOcrResult('')

  }

  // Send the selected image to the Python OCR service.

  const analyzeImage = async () => {

    if (!selectedImage?.file) {

      setOcrError('Please upload or capture an image first.')

      return

    }

    setOcrLoading(true)

    setOcrError('')

    setOcrResult('')

    try {

      const formData = new FormData()

      formData.append('file', selectedImage.file)

      const response = await fetch(OCR_URL, {

        method: 'POST',

        body: formData,

      })

      if (!response.ok) {

        throw new Error(

          `OCR service returned an error (${response.status}). Check that the Python service is running.`

        )

      }

      const data = await response.json()

      if (!data.success) {

        throw new Error(data.message || 'Image analysis failed.')

      }

      // The AI service returns structured nutrition data.

      // Keep the complete response so the UI can show values and review warnings.

      if (!data.nutrition || Object.keys(data.nutrition).length === 0) {

        if (data.extracted_text?.trim()) {

          setOcrResult({

            ...data,

            nutrition: {},

          })

          return

        }

        setOcrError(

          data.message ||

            'No nutrition information was found. Try a clearer image with better lighting.'

        )

        return

      }

      setOcrResult(data)

    } catch (error) {

      setOcrError(

        error.message ||

          'Unable to connect to the OCR service. Check that it is running on port 8000.'

      )

    } finally {

      setOcrLoading(false)

    }

  }

  // Search products by name, brand, category, or ingredients.

  const filteredProducts = products.filter((product) => {

    const searchableText = [

      product.productName,

      product.brand,

      product.category,

      product.ingredients,

    ]

      .filter(Boolean)

      .join(' ')

      .toLowerCase()

    return searchableText.includes(searchTerm.toLowerCase())

  })

  // Read common PascalCase or camelCase API property names.

  const getValue = (product, camelCase, pascalCase) =>

    product[camelCase] ?? product[pascalCase] ?? null

  return (

    <div className="app">

      <header className="navbar">

        <div className="brand">

          <div className="brand-icon">

            <Leaf size={24} />

          </div>

          <div>

            <h1>NutriLens AI</h1>

            <p>Smart food. Smarter choices.</p>

          </div>

        </div>

        <div className="navbar-status">

          <span className="status-dot" />

          Food label analyzer

        </div>

      </header>

      <main className="dashboard">

        <section className="hero-section">

          <div className="hero-content">

            <span className="eyebrow">YOUR PERSONAL FOOD COMPANION</span>

            <h2>

              Know what&apos;s <span>inside.</span>

            </h2>

            <p>

              Explore packaged foods, scan nutrition labels, and make more

              informed food choices.

            </p>

          </div>

        </section>

        <section className="scanner-section">

          <div className="section-heading">

            <div>

              <h2>

                <ScanText size={22} />

                Food Label Scanner

              </h2>

              <p>Upload a food label or capture it using your camera.</p>

            </div>

          </div>

          <div className="upload-panel">

            {!selectedImage && !cameraOpen && (

              <div className="upload-empty">

                <div className="upload-symbol">

                  <ImageIcon size={34} />

                </div>

                <h3>Scan a packaged food label</h3>

                <p>

                  Choose a clear image of the nutrition facts or ingredients

                  printed on the package.

                </p>

                <div className="upload-actions">

                  <button

                    type="button"

                    className="upload-button"

                    onClick={openFilePicker}

                  >

                    <Upload size={18} />

                    Upload Image

                  </button>

                  <button

                    type="button"

                    className="upload-button secondary"

                    onClick={startCamera}

                  >

                    <Camera size={18} />

                    Open Camera

                  </button>

                </div>

                <small>Supported image files • Maximum size: 10 MB</small>

              </div>

            )}

            {cameraOpen && (

              <div className="camera-panel">

                <video

                  ref={videoRef}

                  className="camera-preview"

                  autoPlay

                  playsInline

                  muted

                />

                <div className="upload-actions">

                  <button

                    type="button"

                    className="upload-button"

                    onClick={capturePhoto}

                  >

                    <Camera size={18} />

                    Capture Photo

                  </button>

                  <button

                    type="button"

                    className="upload-button secondary"

                    onClick={stopCamera}

                  >

                    <X size={18} />

                    Cancel

                  </button>

                </div>

              </div>

            )}

            {selectedImage && (

              <div className="image-preview-panel">

                <img

                  src={selectedImage.preview}

                  alt="Selected food label"

                  className="selected-image"

                />

                <div className="preview-details">

                  <div className="preview-file-info">

                    <CheckCircle size={19} />

                    <div>

                      <strong>Image ready for analysis</strong>

                      <p>{selectedImage.file.name}</p>

                      <p>

                        {(selectedImage.file.size / (1024 * 1024)).toFixed(2)}{' '}

                        MB

                      </p>

                    </div>

                  </div>

                  <div className="upload-actions">

                    <button

                      type="button"

                      className="upload-button"

                      onClick={analyzeImage}

                      disabled={ocrLoading}

                    >

                      {ocrLoading ? (

                        <>

                          <RefreshCw size={18} className="spin" />

                          Analyzing...

                        </>

                      ) : (

                        <>

                          <ScanText size={18} />

                          Analyze Image

                        </>

                      )}

                    </button>

                    <button

                      type="button"

                      className="upload-button secondary"

                      onClick={openFilePicker}

                      disabled={ocrLoading}

                    >

                      <Upload size={18} />

                      Change Image

                    </button>

                    <button

                      type="button"

                      className="icon-button"

                      onClick={removeImage}

                      aria-label="Remove selected image"

                      title="Remove image"

                      disabled={ocrLoading}

                    >

                      <X size={20} />

                    </button>

                  </div>

                </div>

              </div>

            )}

            <input

              ref={fileInputRef}

              type="file"

              accept="image/*"

              onChange={handleImageUpload}

              hidden

            />

            {(imageError || cameraError) && (

              <div className="upload-error" role="alert">

                <AlertCircle size={18} />

                {imageError || cameraError}

              </div>

            )}

          </div>

          {ocrLoading && (

            <div className="ocr-status" role="status">

              <RefreshCw size={18} className="spin" />

              Reading text from your food label...

            </div>

          )}

          {ocrError && (

            <div className="ocr-error" role="alert">

              <AlertCircle size={19} />

              <span>{ocrError}</span>

            </div>

          )}

          {ocrResult && (

            <div className="ocr-result">

              <div className="ocr-result-heading">

                <div>

                  <CheckCircle size={21} />

                  <h3>Nutrition Analysis Results</h3>

                </div>

                <button

                  type="button"

                  className="upload-button secondary"

                  onClick={() => {

                    navigator.clipboard

                      .writeText(JSON.stringify(ocrResult, null, 2))

                      .catch(() => setOcrError('Unable to copy results.'))

                  }}

                >

                  Copy Results

                </button>

              </div>

              <p>

                <strong>Serving size:</strong>{' '}

                {typeof ocrResult.serving_size === 'string' ||

                typeof ocrResult.serving_size === 'number'

                  ? ocrResult.serving_size

                  : ocrResult.serving_size?.value

                    ? `${ocrResult.serving_size.value} ${ocrResult.serving_size.unit || ''}`

                    : ocrResult.servingSize || 'Not detected'}

              </p>

              {Object.keys(ocrResult.nutrition || {}).length > 0 ? (

                <div className="nutrition-grid">

                  {Object.entries(ocrResult.nutrition).map(([key, item]) => {

                    const value =

                      item && typeof item === 'object'

                        ? item.value

                        : item

                    const unit =

                      item && typeof item === 'object' ? item.unit : ''

                    const needsReview =

                      item && typeof item === 'object'

                        ? Boolean(item.needs_review ?? item.needsReview)

                        : false

                    const reviewReason =

                      item && typeof item === 'object'

                        ? item.reason

                        : ''

                    const label = key

                      .replace(/_/g, ' ')

                      .replace(/\b\w/g, (char) => char.toUpperCase())

                    return (

                      <div className="nutrition-item" key={key}>

                        <span>{label}</span>

                        <strong>

                          {value === null || value === undefined || value === ''

                            ? 'Not detected'

                            : `${value} ${unit || ''}`}

                        </strong>

                        {needsReview && (

                          <small>

                            ⚠ Needs review

                            {reviewReason ? `: ${reviewReason}` : ''}

                          </small>

                        )}

                      </div>

                    )

                  })}

                </div>

              ) : (

                <p>

                  Nutrition values were not returned. Extracted label text:

                </p>

              )}

              {ocrResult.extracted_text && (

                <details>

                  <summary>View extracted label text</summary>

                  <pre>{ocrResult.extracted_text}</pre>

                </details>

              )}

              <p className="ocr-disclaimer">

                AI-extracted values may contain errors. Please compare every

                value with the original food packaging. Values marked “Needs

                review” should not be treated as verified.

              </p>

              {nutritionInsights && (
                <div className="insights-section">
                  <div className="insights-heading">
                    <div>
                      <h3>Nutrition Score &amp; Health Insights</h3>
                      <p>Based on the extracted values per serving.</p>
                    </div>

                    {nutritionInsights.score !== null ? (
                      <div className="nutrition-score">
                        <strong>{nutritionInsights.score}</strong>
                        <span>/ 100</span>
                      </div>
                    ) : (
                      <div className="score-unavailable">
                        Review required
                      </div>
                    )}
                  </div>

                  {nutritionInsights.needsReview && (
                    <p className="score-warning">
                      A score cannot be calculated because one or more important
                      values are missing or marked for review.
                    </p>
                  )}

                  {nutritionInsights.score !== null && (
                    <p className="score-explanation">
                      This is an experimental label-balance indicator, not an
                      official nutrition rating or medical recommendation.
                    </p>
                  )}

                  <div className="insights-grid">
                    {nutritionInsights.insights.map((insight, index) => (
                      <div
                        className={`insight-card ${insight.type}`}
                        key={`${insight.title}-${index}`}
                      >
                        <strong>{insight.title}</strong>
                        <p>{insight.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

          )}

        </section>

        <section className="products-section">

          <div className="section-heading products-heading">

            <div>

              <h2>Explore Products</h2>

              <p>Browse products currently stored in the NutriLens database.</p>

            </div>

            <button

              type="button"

              className="refresh-button"

              onClick={fetchProducts}

              disabled={loading}

              title="Refresh products"

            >

              <RefreshCw size={17} className={loading ? 'spin' : ''} />

              Refresh

            </button>

          </div>

          <div className="search-box">

            <Search size={20} />

            <input

              type="search"

              placeholder="Search by product, brand, category, or ingredient..."

              value={searchTerm}

              onChange={(event) => setSearchTerm(event.target.value)}

              aria-label="Search products"

            />

            {searchTerm && (

              <button

                type="button"

                className="clear-search"

                onClick={() => setSearchTerm('')}

                aria-label="Clear search"

              >

                <X size={18} />

              </button>

            )}

          </div>

          {loading && (

            <div className="empty-state">

              <RefreshCw size={25} className="spin" />

              <p>Loading products...</p>

            </div>

          )}

          {!loading && productError && (

            <div className="error-state" role="alert">

              <AlertCircle size={23} />

              <div>

                <strong>Unable to load products</strong>

                <p>{productError}</p>

                <button

                  type="button"

                  className="upload-button"

                  onClick={fetchProducts}

                >

                  Try Again

                </button>

              </div>

            </div>

          )}

          {!loading && !productError && filteredProducts.length === 0 && (

            <div className="empty-state">

              <Search size={28} />

              <h3>No products found</h3>

              <p>

                {searchTerm

                  ? 'Try another search term.'

                  : 'Add products to your database to see them here.'}

              </p>

            </div>

          )}

          {!loading && !productError && filteredProducts.length > 0 && (

            <>

              <div className="product-count">

                Showing {filteredProducts.length}{' '}

                {filteredProducts.length === 1 ? 'product' : 'products'}

              </div>

              <div className="product-grid">

                {filteredProducts.map((product) => {

                  const id = getValue(product, 'productId', 'ProductId')

                  const name =

                    getValue(product, 'productName', 'ProductName') ||

                    'Unnamed Product'

                  const brand = getValue(product, 'brand', 'Brand')

                  const category = getValue(product, 'category', 'Category')

                  const servingSize = getValue(

                    product,

                    'servingSize',

                    'ServingSize'

                  )

                  const calories = getValue(product, 'calories', 'Calories')

                  const sugar = getValue(product, 'sugarG', 'SugarG')

                  const sodium = getValue(product, 'sodiumMg', 'SodiumMg')

                  const protein = getValue(product, 'proteinG', 'ProteinG')

                  const ingredients = getValue(

                    product,

                    'ingredients',

                    'Ingredients'

                  )

                  const allergens = getValue(

                    product,

                    'allergens',

                    'Allergens'

                  )

                  const dataSource = getValue(

                    product,

                    'dataSource',

                    'DataSource'

                  )

                  return (

                    <article className="product-card" key={id ?? name}>

                      <div className="product-card-top">

                        <div className="product-icon">

                          <Leaf size={23} />

                        </div>

                        {category && (

                          <span className="product-category">{category}</span>

                        )}

                      </div>

                      <h3>{name}</h3>

                      {brand && <p className="product-brand">{brand}</p>}

                      {servingSize && (

                        <p className="serving-size">

                          Serving size: {servingSize}

                        </p>

                      )}

                      <div className="nutrition-grid">

                        <div className="nutrition-item">

                          <span>Calories</span>

                          <strong>

                            {calories ?? '—'}

                            {calories != null && ' kcal'}

                          </strong>

                        </div>

                        <div className="nutrition-item">

                          <span>Sugar</span>

                          <strong>

                            {sugar ?? '—'}

                            {sugar != null && ' g'}

                          </strong>

                        </div>

                        <div className="nutrition-item">

                          <span>Sodium</span>

                          <strong>

                            {sodium ?? '—'}

                            {sodium != null && ' mg'}

                          </strong>

                        </div>

                        <div className="nutrition-item">

                          <span>Protein</span>

                          <strong>

                            {protein ?? '—'}

                            {protein != null && ' g'}

                          </strong>

                        </div>

                      </div>

                      {ingredients && (

                        <div className="product-info">

                          <span>Ingredients</span>

                          <p>{ingredients}</p>

                        </div>

                      )}

                      {allergens && (

                        <div className="product-info">

                          <span>Allergens</span>

                          <p>{allergens}</p>

                        </div>

                      )}

                      {dataSource && (

                        <p className="data-source">

                          Data source: {dataSource}

                        </p>

                      )}

                    </article>

                  )

                })}

              </div>

            </>

          )}

        </section>

        <footer className="dashboard-footer">

          <Leaf size={17} />

          <span>NutriLens AI</span>

          <span>•</span>

          <span>Make informed food choices.</span>

        </footer>

      </main>

    </div>

  )

}

export default App
