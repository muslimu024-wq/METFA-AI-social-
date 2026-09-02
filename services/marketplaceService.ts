import { MarketplaceProduct, MarketplaceCategory } from '../types/marketplace';

const STORAGE_MASTER_KEY = 'metfa_marketplace_master_catalog_v2';

/**
 * Curated Local Sellme Marketplace Products
 * Direct creator store items, custom Metfa hardware, fast-shipping local creator gear
 */
export const LOCAL_SELLME_PRODUCTS: MarketplaceProduct[] = [
  {
    id: 'sellme-tech-01',
    title: 'Sellme Studio Pro Podcasting & Streaming USB-C Microphone with Noise Cancelling',
    price: 49.99,
    originalPrice: 89.00,
    discountPercentage: 44,
    currency: 'USD',
    rating: 4.96,
    reviewCount: 1820,
    ordersCount: 4300,
    imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1583597509707-6756f7361882?w=800&auto=format&fit=crop&q=80',
    ],
    category: 'tech',
    source: 'sellme',
    seller: {
      name: 'Sellme Official Creator Store',
      rating: 4.98,
      positiveFeedbackPercent: 99.4,
    },
    shipping: {
      isFree: true,
      estimatedDelivery: '2-4 business days (Fast Local)',
    },
    productUrl: 'https://shop.metfaai.com/products/sellme-studio-mic',
    affiliateUrl: 'https://shop.metfaai.com/products/sellme-studio-mic?ref=metfa_social',
    description: 'Studio-grade 192kHz/24bit cardioid condenser microphone with built-in zero-latency headphone monitoring, touch-mute sensor, RGB gain halo, and custom shock mount.',
    specifications: {
      'Polar Pattern': 'Cardioid Studio Condenser',
      'Sample Rate': '192kHz / 24-bit HD',
      'Connectivity': 'USB-C to USB-C / USB-A Plug & Play',
      'Headphone Jack': '3.5mm Zero-Latency Output',
    },
    inStock: true,
    tags: ['microphone', 'studio', 'podcast', 'streaming', 'sellme', 'tech'],
  },
  {
    id: 'sellme-tech-02',
    title: 'Smart AI Auto-Tracking Phone Gimbal Stabilizer for Vlog & TikTok Reels',
    price: 36.80,
    originalPrice: 72.00,
    discountPercentage: 49,
    currency: 'USD',
    rating: 4.89,
    reviewCount: 2450,
    ordersCount: 6800,
    imageUrl: 'https://images.unsplash.com/photo-1589739900243-4b52cd9b104e?w=800&auto=format&fit=crop&q=80',
    category: 'tech',
    source: 'sellme',
    seller: {
      name: 'Sellme VlogPro Direct',
      rating: 4.92,
      positiveFeedbackPercent: 98.6,
    },
    shipping: {
      isFree: true,
      estimatedDelivery: '2-5 business days',
    },
    productUrl: 'https://shop.metfaai.com/products/ai-tracking-gimbal',
    affiliateUrl: 'https://shop.metfaai.com/products/ai-tracking-gimbal?ref=metfa_social',
    description: '360-degree AI face and body recognition phone stabilizer requiring NO APP installation. Embedded wide-angle AI camera tracks your movements seamlessly for live streaming.',
    specifications: {
      'Tracking Angle': '360° Horizontal Infinite Rotation',
      'AI System': 'Built-in Neural Processing Core',
      'Battery': '2200mAh (8 hours continuous tracking)',
      'Tripod Mount': 'Standard 1/4" screw base included',
    },
    inStock: true,
    tags: ['gimbal', 'tracking', 'ai', 'reels', 'vlog', 'sellme'],
  },
  {
    id: 'sellme-gadget-01',
    title: 'Sellme AI Smart Desktop Voice Assistant & Stream Control Hub with Touch OLED',
    price: 59.00,
    originalPrice: 119.00,
    discountPercentage: 50,
    currency: 'USD',
    rating: 4.95,
    reviewCount: 1420,
    ordersCount: 3100,
    imageUrl: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800&auto=format&fit=crop&q=80',
    category: 'gadgets',
    source: 'sellme',
    seller: {
      name: 'Sellme Tech Labs',
      rating: 4.97,
      positiveFeedbackPercent: 99.2,
    },
    shipping: {
      isFree: true,
      estimatedDelivery: '2-4 business days (Fast Local)',
    },
    productUrl: 'https://shop.metfaai.com/products/sellme-smart-hub',
    affiliateUrl: 'https://shop.metfaai.com/products/sellme-smart-hub?ref=metfa_social',
    description: 'Next-gen desktop assistant with custom macro keys, real-time Gemini AI integration, audio visualizer, weather & social media live telemetry dashboard.',
    specifications: {
      'Display': '3.5" High-Contrast IPS Touchscreen',
      'Keys': '6 Dynamic Macro LCD Keys + 2 Rotary Dials',
      'AI Support': 'Metfa AI / Gemini Voice Assistant',
      'Connection': 'Dual-Band Wi-Fi + USB-C',
    },
    inStock: true,
    tags: ['streamdeck', 'assistant', 'smartdesk', 'oled', 'gadgets', 'sellme'],
  },
  {
    id: 'sellme-gadget-02',
    title: 'RGB Magnetic Wireless Power Bank 10000mAh with Fast 22.5W PD Charging',
    price: 18.99,
    originalPrice: 38.00,
    discountPercentage: 50,
    currency: 'USD',
    rating: 4.92,
    reviewCount: 4290,
    ordersCount: 11200,
    imageUrl: 'https://images.unsplash.com/photo-1609592426868-b80c571c35b5?w=800&auto=format&fit=crop&q=80',
    category: 'gadgets',
    source: 'sellme',
    seller: {
      name: 'Sellme Verified Direct',
      rating: 4.98,
      positiveFeedbackPercent: 99.4,
    },
    shipping: {
      isFree: true,
      estimatedDelivery: '3-5 business days',
    },
    productUrl: 'https://shop.metfaai.com/products/magnetic-power-bank',
    affiliateUrl: 'https://shop.metfaai.com/products/magnetic-power-bank?ref=metfa_social',
    description: 'Compact MagSafe-compatible 15W wireless and 22.5W USB-C PD fast power bank. Features sleek cyberpunk transparent casing with ambient LED battery indicator.',
    specifications: {
      'Capacity': '10,000 mAh Li-Polymer',
      'Wireless Output': '15W / 10W / 7.5W Qi Fast',
      'Type-C Output': 'PD 22.5W Max Fast Charge',
      'Dimensions': '102 x 66 x 15 mm',
    },
    inStock: true,
    tags: ['powerbank', 'magsafe', 'charger', 'fastcharging', 'sellme'],
  },
  {
    id: 'sellme-gadget-03',
    title: 'Sellme AI Universal Smart Translation Earbuds (Real-Time 144 Languages)',
    price: 39.90,
    originalPrice: 79.90,
    discountPercentage: 50,
    currency: 'USD',
    rating: 4.88,
    reviewCount: 940,
    ordersCount: 2200,
    imageUrl: 'https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?w=800&auto=format&fit=crop&q=80',
    category: 'gadgets',
    source: 'sellme',
    seller: {
      name: 'Sellme Global Tech Store',
      rating: 4.91,
      positiveFeedbackPercent: 98.8,
    },
    shipping: {
      isFree: true,
      estimatedDelivery: '3-6 business days',
    },
    productUrl: 'https://shop.metfaai.com/products/ai-translator-earbuds',
    affiliateUrl: 'https://shop.metfaai.com/products/ai-translator-earbuds?ref=metfa_social',
    description: 'Simultaneous two-way real-time voice translation across 144 languages and accents with 98% neural accuracy. Works seamlessly for travel, business meetings, and cross-border calls.',
    specifications: {
      'Translation Modes': 'Touch, Speaker, Free Talk, Offline',
      'Languages': '144 Languages & Accents',
      'Battery Life': '6h per charge (24h with case)',
      'Latency': '< 0.5s AI Engine Response',
    },
    inStock: true,
    tags: ['translator', 'ai', 'earbuds', 'travel', 'sellme'],
  },
  {
    id: 'sellme-wear-01',
    title: 'Sellme Pulse Pro Titanium Smart Ring with Sleep, HRV & Bio-Metric Tracking',
    price: 68.00,
    originalPrice: 139.00,
    discountPercentage: 51,
    currency: 'USD',
    rating: 4.93,
    reviewCount: 2110,
    ordersCount: 5100,
    imageUrl: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800&auto=format&fit=crop&q=80',
    category: 'wearables',
    source: 'sellme',
    seller: {
      name: 'Sellme Wearables Direct',
      rating: 4.95,
      positiveFeedbackPercent: 99.0,
    },
    shipping: {
      isFree: true,
      estimatedDelivery: '2-4 business days (Fast Local)',
    },
    productUrl: 'https://shop.metfaai.com/products/pulse-pro-smart-ring',
    affiliateUrl: 'https://shop.metfaai.com/products/pulse-pro-smart-ring?ref=metfa_social',
    description: 'Ultralight titanium smart ring weighing only 2.9g. Continuously monitors sleep stages, Heart Rate Variability (HRV), skin temperature, and daily recovery scores with 7-day battery life.',
    specifications: {
      'Material': 'Aviation-Grade Titanium Alloy',
      'Waterproof': '5ATM (Up to 50 meters)',
      'Battery': '7 Days Standby Battery',
      'App Integration': 'iOS & Android Free Companion App',
    },
    inStock: true,
    tags: ['smartring', 'health', 'fitness', 'titanium', 'wearables', 'sellme'],
  },
  {
    id: 'sellme-wear-02',
    title: 'Sellme ActivePro Sport GPS Fitness Band with AMOLED Touch Display',
    price: 28.50,
    originalPrice: 58.00,
    discountPercentage: 51,
    currency: 'USD',
    rating: 4.86,
    reviewCount: 1650,
    ordersCount: 4700,
    imageUrl: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=800&auto=format&fit=crop&q=80',
    category: 'wearables',
    source: 'sellme',
    seller: {
      name: 'Sellme Wearables Direct',
      rating: 4.9,
      positiveFeedbackPercent: 98.4,
    },
    shipping: {
      isFree: true,
      estimatedDelivery: '3-5 business days',
    },
    productUrl: 'https://shop.metfaai.com/products/activepro-fitness-band',
    affiliateUrl: 'https://shop.metfaai.com/products/activepro-fitness-band?ref=metfa_social',
    description: 'Slim lightweight fitness tracker with 1.47" AMOLED vibrant touch display, 120+ workout modes, continuous blood oxygen monitoring, and 14-day ultra-long endurance.',
    specifications: {
      'Display': '1.47" AMOLED Color Screen',
      'Sensors': 'Optical Heart Rate, SpO2, Step Counter',
      'Battery': '14-Day Battery Life',
      'Water Resistance': '50M Water Resistance',
    },
    inStock: true,
    tags: ['fitnessband', 'sport', 'health', 'wearables', 'sellme'],
  },
  {
    id: 'sellme-fash-01',
    title: 'Sellme Signature Cyberpunk Techwear Water-Resistant Crossbody Sling Bag',
    price: 34.00,
    originalPrice: 68.00,
    discountPercentage: 50,
    currency: 'USD',
    rating: 4.92,
    reviewCount: 1890,
    ordersCount: 4900,
    imageUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&auto=format&fit=crop&q=80',
    category: 'fashion',
    source: 'sellme',
    seller: {
      name: 'Sellme Streetwear & Gear',
      rating: 4.94,
      positiveFeedbackPercent: 98.9,
    },
    shipping: {
      isFree: true,
      estimatedDelivery: '2-4 business days (Fast Local)',
    },
    productUrl: 'https://shop.metfaai.com/products/cyberpunk-crossbody-bag',
    affiliateUrl: 'https://shop.metfaai.com/products/cyberpunk-crossbody-bag?ref=metfa_social',
    description: 'Futuristic urban crossbody bag built from waterproof ballistic nylon with Fidlock magnetic quick-release buckles, expandable 6L storage, and concealed passport pocket.',
    specifications: {
      'Capacity': 'Expandable 4L to 6L',
      'Material': 'CORDURA 500D Waterproof Fabric',
      'Buckles': 'Fidlock Magnetic V-Buckle',
      'Zippers': 'YKK Weatherproof AquaGuard',
    },
    inStock: true,
    tags: ['techwear', 'slingbag', 'fashion', 'streetwear', 'sellme'],
  },
  {
    id: 'sellme-fash-02',
    title: 'Metfa Creator Edition Heavyweight Cotton Graphic Hoodie',
    price: 42.00,
    originalPrice: 75.00,
    discountPercentage: 44,
    currency: 'USD',
    rating: 4.97,
    reviewCount: 3120,
    ordersCount: 8400,
    imageUrl: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=800&auto=format&fit=crop&q=80',
    category: 'fashion',
    source: 'sellme',
    seller: {
      name: 'Metfa Official Apparel',
      rating: 4.99,
      positiveFeedbackPercent: 99.7,
    },
    shipping: {
      isFree: true,
      estimatedDelivery: '2-4 business days',
    },
    productUrl: 'https://shop.metfaai.com/products/metfa-creator-hoodie',
    affiliateUrl: 'https://shop.metfaai.com/products/metfa-creator-hoodie?ref=metfa_social',
    description: '450 GSM luxury heavyweight french terry cotton hoodie with embroidered minimalist Metfa neural icon, drop-shoulder relaxed fit, and double-layered hood.',
    specifications: {
      'Fabric': '100% Organic Heavyweight Cotton 450 GSM',
      'Fit': 'Oversized Boxy Relaxed Silhouette',
      'Details': 'High-Density Embroidered Chest Emblem',
      'Care': 'Pre-shrunk Machine Wash Cold',
    },
    inStock: true,
    tags: ['hoodie', 'apparel', 'metfa', 'creator', 'fashion', 'sellme'],
  },
  {
    id: 'sellme-home-01',
    title: 'Sellme Smart Minimalist LED Ambient Desk Bar with Sound Reactive Lighting',
    price: 39.50,
    originalPrice: 79.00,
    discountPercentage: 50,
    currency: 'USD',
    rating: 4.94,
    reviewCount: 2310,
    ordersCount: 5600,
    imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=800&auto=format&fit=crop&q=80',
    category: 'home',
    source: 'sellme',
    seller: {
      name: 'Sellme Home Studio',
      rating: 4.96,
      positiveFeedbackPercent: 99.1,
    },
    shipping: {
      isFree: true,
      estimatedDelivery: '2-5 business days',
    },
    productUrl: 'https://shop.metfaai.com/products/smart-ambient-desk-bar',
    affiliateUrl: 'https://shop.metfaai.com/products/smart-ambient-desk-bar?ref=metfa_social',
    description: 'Aluminum monitor light bar with auto-dimming ambient light sensor, asymmetric optical design eliminating screen glare, plus rear RGB music-sync backlight.',
    specifications: {
      'CRI': 'Ra 95+ True Color Reproduction',
      'Lighting Modes': 'Warm 2700K to Cool 6500K + Full RGB',
      'Control': 'Wireless Desktop Dial Controller',
      'Power': 'USB-C 5V 2A',
    },
    inStock: true,
    tags: ['desklight', 'monitorbar', 'lighting', 'home', 'studio', 'sellme'],
  },
  {
    id: 'sellme-home-02',
    title: 'Sellme MagSafe 3-in-1 Aluminum Fast Charging Stand for Phone, Watch & Buds',
    price: 28.99,
    originalPrice: 59.99,
    discountPercentage: 52,
    currency: 'USD',
    rating: 4.91,
    reviewCount: 1780,
    ordersCount: 4200,
    imageUrl: 'https://images.unsplash.com/photo-1586816879360-004f5b0c51e3?w=800&auto=format&fit=crop&q=80',
    category: 'home',
    source: 'sellme',
    seller: {
      name: 'Sellme Verified Direct',
      rating: 4.93,
      positiveFeedbackPercent: 98.7,
    },
    shipping: {
      isFree: true,
      estimatedDelivery: '2-4 business days',
    },
    productUrl: 'https://shop.metfaai.com/products/3-in-1-aluminum-charging-stand',
    affiliateUrl: 'https://shop.metfaai.com/products/3-in-1-aluminum-charging-stand?ref=metfa_social',
    description: 'CNC machined aerospace aluminum charging tree supporting simultaneous high-speed 15W MagSafe phone charging, Apple/Smart Watch puck, and AirPods pad.',
    specifications: {
      'Material': 'Solid Anodized Aluminum Alloy',
      'Phone Output': '15W Fast Magnetic Wireless',
      'Watch Output': '5W Fast Magnetic Charger',
      'Buds Output': '5W Qi Wireless Base',
    },
    inStock: true,
    tags: ['charger', 'magsafe', 'dock', 'home', 'desktop', 'sellme'],
  },
];

/**
 * Curated AliExpress Global Dropship Products
 */
export const ALIEXPRESS_PRODUCTS: MarketplaceProduct[] = [
  {
    id: 'ali-001',
    title: 'AI Smart ANC Wireless Earbuds with Dual Dynamic Drivers & Spatial Audio',
    price: 24.99,
    originalPrice: 49.99,
    discountPercentage: 50,
    currency: 'USD',
    rating: 4.85,
    reviewCount: 3420,
    ordersCount: 8900,
    imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1572536147248-ac59a8abfa4b?w=800&auto=format&fit=crop&q=80',
    ],
    category: 'tech',
    source: 'aliexpress',
    seller: {
      name: 'Global Tech Official Store',
      rating: 4.9,
      positiveFeedbackPercent: 98.4,
    },
    shipping: {
      isFree: true,
      estimatedDelivery: '7-12 business days',
    },
    productUrl: 'https://shop.metfaai.com/products/ai-anc-earbuds',
    affiliateUrl: 'https://shop.metfaai.com/products/ai-anc-earbuds?ref=metfa_social',
    description: 'High-fidelity Bluetooth 5.4 wireless earbuds featuring active noise cancellation up to 45dB, AI adaptive ambient mode, 36-hour total battery life with fast Type-C charging.',
    specifications: {
      'Bluetooth Version': '5.4 Low Latency',
      'Noise Cancellation': 'Active ANC up to 45dB',
      'Battery Life': '8h earbuds + 28h case',
      'Waterproof Rating': 'IPX5 Sweat-proof',
    },
    inStock: true,
    tags: ['earbuds', 'audio', 'anc', 'bluetooth', 'gadgets', 'aliexpress'],
  },
  {
    id: 'ali-002',
    title: 'Ultra Slim Smartwatch with AMOLED Display, Heart Rate & SpO2 Fitness Tracker',
    price: 32.50,
    originalPrice: 65.00,
    discountPercentage: 50,
    currency: 'USD',
    rating: 4.9,
    reviewCount: 5120,
    ordersCount: 14500,
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=800&auto=format&fit=crop&q=80',
    ],
    category: 'wearables',
    source: 'aliexpress',
    seller: {
      name: 'SmartWear Global Direct',
      rating: 4.95,
      positiveFeedbackPercent: 99.1,
    },
    shipping: {
      isFree: true,
      estimatedDelivery: '5-10 business days',
    },
    productUrl: 'https://shop.metfaai.com/products/ultra-smartwatch-amoled',
    affiliateUrl: 'https://shop.metfaai.com/products/ultra-smartwatch-amoled?ref=metfa_social',
    description: '1.43-inch Always-On AMOLED curved touchscreen smartwatch with stainless steel bezel, 100+ sports tracking modes, 14-day battery life, and Bluetooth phone call support.',
    specifications: {
      'Display': '1.43" AMOLED 466x466',
      'Sensors': 'Optical PPG, SpO2, Accelerometer',
      'Battery': '400mAh (14 days standby)',
      'Compatibility': 'Android & iOS',
    },
    inStock: true,
    tags: ['smartwatch', 'fitness', 'wearables', 'amoled', 'aliexpress'],
  },
  {
    id: 'ali-003',
    title: 'Foldable 4K HDR Drone with GPS Return, Optical Flow & Dual 3-Axis Gimbal',
    price: 79.99,
    originalPrice: 159.99,
    discountPercentage: 50,
    currency: 'USD',
    rating: 4.78,
    reviewCount: 1840,
    ordersCount: 3900,
    imageUrl: 'https://images.unsplash.com/photo-1527977966376-1c8408f9f108?w=800&auto=format&fit=crop&q=80',
    category: 'tech',
    source: 'aliexpress',
    seller: {
      name: 'AeroTech Official Dropship',
      rating: 4.88,
      positiveFeedbackPercent: 97.6,
    },
    shipping: {
      isFree: true,
      estimatedDelivery: '7-14 business days',
    },
    productUrl: 'https://shop.metfaai.com/products/4k-gps-drone',
    affiliateUrl: 'https://shop.metfaai.com/products/4k-gps-drone?ref=metfa_social',
    description: 'Professional brushless aerial drone equipped with a 4K 60fps stabilized wide-angle camera, 5GHz FPV transmission up to 3km, intelligent auto return-to-home, and gesture photography.',
    specifications: {
      'Camera': '4K HDR 60fps CMOS',
      'Flight Time': '28 minutes per battery',
      'Control Distance': '3000 meters',
      'Weight': '249g (No license required in most regions)',
    },
    inStock: true,
    tags: ['drone', '4k', 'aerial', 'camera', 'gadgets', 'aliexpress'],
  },
  {
    id: 'ali-005',
    title: 'Professional Studio RGB LED Video Light Wand with App Control for Creators',
    price: 29.90,
    originalPrice: 59.90,
    discountPercentage: 50,
    currency: 'USD',
    rating: 4.87,
    reviewCount: 2210,
    ordersCount: 6300,
    imageUrl: 'https://images.unsplash.com/photo-1517420704952-d9f39e95b43e?w=800&auto=format&fit=crop&q=80',
    category: 'tech',
    source: 'aliexpress',
    seller: {
      name: 'Creator Studio Pro Gear',
      rating: 4.9,
      positiveFeedbackPercent: 98.2,
    },
    shipping: {
      isFree: true,
      estimatedDelivery: '6-12 business days',
    },
    productUrl: 'https://shop.metfaai.com/products/rgb-light-wand',
    affiliateUrl: 'https://shop.metfaai.com/products/rgb-light-wand?ref=metfa_social',
    description: 'Handheld 360-color RGB LED lighting tube with CRI 95+, 2500K-9000K bi-color temperature, 20 special scene effects, and 1/4" tripod mount.',
    specifications: {
      'Color Temperature': '2500K - 9000K',
      'Battery': '2600mAh Rechargeable',
      'CRI': 'CRI 95+ / TLCI 97+',
      'Weight': '205g',
    },
    inStock: true,
    tags: ['lighting', 'creator', 'rgb', 'photography', 'reels', 'aliexpress'],
  },
  {
    id: 'ali-006',
    title: 'Retro Mechanical Gaming Keyboard with Gateron Switches & Hot-Swappable Keys',
    price: 45.00,
    originalPrice: 89.00,
    discountPercentage: 49,
    currency: 'USD',
    rating: 4.94,
    reviewCount: 3880,
    ordersCount: 7800,
    imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80',
    category: 'tech',
    source: 'aliexpress',
    seller: {
      name: 'Custom Keyboards Flagship',
      rating: 4.96,
      positiveFeedbackPercent: 99.0,
    },
    shipping: {
      isFree: true,
      estimatedDelivery: '7-12 business days',
    },
    productUrl: 'https://shop.metfaai.com/products/retro-mechanical-keyboard',
    affiliateUrl: 'https://shop.metfaai.com/products/retro-mechanical-keyboard?ref=metfa_social',
    description: '75% compact layout wireless mechanical keyboard with triple-mode connectivity (2.4G / BT 5.0 / USB-C), south-facing per-key RGB backlighting.',
    specifications: {
      'Layout': '75% (84 Keys)',
      'Switches': 'Gateron Pro Yellow (Hot-Swappable)',
      'Battery': '4000mAh',
    },
    inStock: true,
    tags: ['keyboard', 'mechanical', 'gaming', 'rgb', 'desktop', 'aliexpress'],
  },
  {
    id: 'ali-008',
    title: 'Minimalist Anti-Theft Water-Resistant Laptop Backpack with USB Charging Port',
    price: 27.50,
    originalPrice: 55.00,
    discountPercentage: 50,
    currency: 'USD',
    rating: 4.88,
    reviewCount: 3100,
    ordersCount: 9200,
    imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80',
    category: 'fashion',
    source: 'aliexpress',
    seller: {
      name: 'Urban Lifestyle Gear',
      rating: 4.91,
      positiveFeedbackPercent: 98.7,
    },
    shipping: {
      isFree: true,
      estimatedDelivery: '6-11 business days',
    },
    productUrl: 'https://shop.metfaai.com/products/anti-theft-backpack',
    affiliateUrl: 'https://shop.metfaai.com/products/anti-theft-backpack?ref=metfa_social',
    description: 'Ergonomic business and travel backpack crafted from high-density Oxford water-repellent fabric. Fits up to 15.6" laptops with hidden security zippers.',
    specifications: {
      'Capacity': '25 Liters',
      'Laptop Compartment': 'Up to 15.6 inch',
      'Material': 'Waterproof Oxford Polyester',
    },
    inStock: true,
    tags: ['backpack', 'fashion', 'laptop', 'travel', 'aliexpress'],
  },
  {
    id: 'ali-009',
    title: 'Mini Portable Thermal Pocket Sticker & Photo Printer with Bluetooth App',
    price: 19.50,
    originalPrice: 39.00,
    discountPercentage: 50,
    currency: 'USD',
    rating: 4.84,
    reviewCount: 1650,
    ordersCount: 5400,
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
    category: 'gadgets',
    source: 'aliexpress',
    seller: {
      name: 'PrintGo Global Store',
      rating: 4.89,
      positiveFeedbackPercent: 98.3,
    },
    shipping: {
      isFree: true,
      estimatedDelivery: '6-10 business days',
    },
    productUrl: 'https://shop.metfaai.com/products/pocket-thermal-printer',
    affiliateUrl: 'https://shop.metfaai.com/products/pocket-thermal-printer?ref=metfa_social',
    description: 'Inkless wireless pocket photo and memo printer connecting via Bluetooth. Supports instant printing of labels, notes, QR codes, and journal stickers with 200 DPI resolution.',
    specifications: {
      'Print Technology': 'Thermal Zero-Ink (ZINK)',
      'Resolution': '200 DPI',
      'Battery': '1000mAh Lithium Rechargeable',
      'Paper Size': '57 x 30mm Roll',
    },
    inStock: true,
    tags: ['printer', 'pocketprinter', 'gadgets', 'stickers', 'aliexpress'],
  },
  {
    id: 'ali-010',
    title: 'Ultra-Quiet Smart Aroma Ultrasonic Diffuser with Flame LED Effect',
    price: 22.80,
    originalPrice: 45.00,
    discountPercentage: 49,
    currency: 'USD',
    rating: 4.9,
    reviewCount: 2840,
    ordersCount: 7100,
    imageUrl: 'https://images.unsplash.com/photo-1602928321679-560bb453f190?w=800&auto=format&fit=crop&q=80',
    category: 'home',
    source: 'aliexpress',
    seller: {
      name: 'CozyHome AliExpress Store',
      rating: 4.93,
      positiveFeedbackPercent: 99.0,
    },
    shipping: {
      isFree: true,
      estimatedDelivery: '7-12 business days',
    },
    productUrl: 'https://shop.metfaai.com/products/flame-aroma-diffuser',
    affiliateUrl: 'https://shop.metfaai.com/products/flame-aroma-diffuser?ref=metfa_social',
    description: 'Realistic flame lighting effect aromatherapy humidifier with 250ml water capacity, auto shut-off waterless protection, and whisper-quiet operation under 28dB.',
    specifications: {
      'Capacity': '250ml Water Tank',
      'Noise Level': '< 28dB Whisper Quiet',
      'Safety': 'Automatic Waterless Power-Off',
      'Lighting': '7-Color Warm Flame LED Simulation',
    },
    inStock: true,
    tags: ['diffuser', 'aromatherapy', 'home', 'flame', 'aliexpress'],
  },
  {
    id: 'ali-011',
    title: 'Bone Conduction Wireless Sports Headphones IPX8 Waterproof with 32GB Storage',
    price: 26.90,
    originalPrice: 54.00,
    discountPercentage: 50,
    currency: 'USD',
    rating: 4.86,
    reviewCount: 1520,
    ordersCount: 3800,
    imageUrl: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800&auto=format&fit=crop&q=80',
    category: 'wearables',
    source: 'aliexpress',
    seller: {
      name: 'SportAcoustics Dropship',
      rating: 4.88,
      positiveFeedbackPercent: 98.1,
    },
    shipping: {
      isFree: true,
      estimatedDelivery: '7-14 business days',
    },
    productUrl: 'https://shop.metfaai.com/products/bone-conduction-sports-headphones',
    affiliateUrl: 'https://shop.metfaai.com/products/bone-conduction-sports-headphones?ref=metfa_social',
    description: 'Open-ear bone conduction headset engineered for swimming, running, and cycling. Features IPX8 full submersible waterproofing and built-in 32GB MP3 local storage.',
    specifications: {
      'Sound Tech': 'Bone Conduction Open-Ear Transducer',
      'Waterproof': 'IPX8 Waterproof Submersible 2m',
      'Internal Storage': '32GB Built-in MP3 (Holds 6000+ Songs)',
      'Battery': '8 Hours Continuous Playback',
    },
    inStock: true,
    tags: ['headphones', 'boneconduction', 'swimming', 'fitness', 'wearables', 'aliexpress'],
  },
  {
    id: 'ali-012',
    title: 'Universal Multi-Angle Magnetic Car Mount with 15W Qi Fast Wireless Charging',
    price: 14.99,
    originalPrice: 29.99,
    discountPercentage: 50,
    currency: 'USD',
    rating: 4.87,
    reviewCount: 3890,
    ordersCount: 9600,
    imageUrl: 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?w=800&auto=format&fit=crop&q=80',
    category: 'gadgets',
    source: 'aliexpress',
    seller: {
      name: 'AutoTech Global Direct',
      rating: 4.92,
      positiveFeedbackPercent: 98.6,
    },
    shipping: {
      isFree: true,
      estimatedDelivery: '6-11 business days',
    },
    productUrl: 'https://shop.metfaai.com/products/magnetic-car-mount-charger',
    affiliateUrl: 'https://shop.metfaai.com/products/magnetic-car-mount-charger?ref=metfa_social',
    description: 'Ultra-strong N52 neodymium magnetic air vent car holder with 15W fast wireless charging, 360-degree ball joint rotation, and smart overheat protection.',
    specifications: {
      'Magnets': '16x N52 Industrial Neodymium Ring',
      'Charging Output': '15W / 10W / 7.5W Qi Certified',
      'Mount Type': 'Steel Hook Air Vent Clip + Dashboard Pad',
    },
    inStock: true,
    tags: ['carmount', 'magsafe', 'charger', 'gadgets', 'aliexpress'],
  },
];

/**
 * Combined master catalog containing both Local Sellme Marketplace and AliExpress Dropshipping products
 */
export const DEFAULT_PRODUCTS: MarketplaceProduct[] = [
  ...LOCAL_SELLME_PRODUCTS,
  ...ALIEXPRESS_PRODUCTS,
];

/**
 * Category metadata with dynamic count calculator
 */
export const MARKETPLACE_CATEGORIES: MarketplaceCategory[] = [
  { id: 'all', name: 'All Products', iconName: 'Sparkles', itemCount: DEFAULT_PRODUCTS.length },
  { id: 'tech', name: 'Smart Electronics', iconName: 'Cpu', itemCount: DEFAULT_PRODUCTS.filter(p => p.category === 'tech').length },
  { id: 'gadgets', name: 'AI & Mobile Gadgets', iconName: 'Zap', itemCount: DEFAULT_PRODUCTS.filter(p => p.category === 'gadgets').length },
  { id: 'wearables', name: 'Wearables & Fitness', iconName: 'Watch', itemCount: DEFAULT_PRODUCTS.filter(p => p.category === 'wearables').length },
  { id: 'fashion', name: 'Fashion & Bags', iconName: 'Shirt', itemCount: DEFAULT_PRODUCTS.filter(p => p.category === 'fashion').length },
  { id: 'home', name: 'Home & Studio', iconName: 'Home', itemCount: DEFAULT_PRODUCTS.filter(p => p.category === 'home').length },
];

/**
 * Merge two product lists ensuring no duplicates while preserving both AliExpress and Sellme products
 */
export function mergeProductCatalogs(primary: MarketplaceProduct[], fallback: MarketplaceProduct[] = DEFAULT_PRODUCTS): MarketplaceProduct[] {
  const map = new Map<string, MarketplaceProduct>();

  // Insert fallback (defaults) first
  for (const item of fallback) {
    map.set(item.id, item);
  }

  // Overwrite/enrich with primary fetched items
  for (const item of primary) {
    map.set(item.id, item);
  }

  return Array.from(map.values());
}

/**
 * Robust fetcher that talks to Metfa server's `/api/aliexpress/products` / `/api/marketplace/products`
 * and ALWAYS merges both AliExpress global products and local Sellme marketplace products.
 */
export async function fetchMarketplaceProducts(params?: {
  category?: string;
  search?: string;
  source?: 'all' | 'sellme' | 'aliexpress';
  sort?: string;
  page?: number;
  limit?: number;
}): Promise<{
  products: MarketplaceProduct[];
  total: number;
  source: string;
  isFallback: boolean;
  categoryCounts: Record<string, number>;
}> {
  const category = params?.category || 'all';
  const search = params?.search?.trim().toLowerCase() || '';
  const sourceFilter = params?.source || 'all';
  const sort = params?.sort || 'trending';

  let masterPool: MarketplaceProduct[] = [...DEFAULT_PRODUCTS];

  try {
    const query = new URLSearchParams();
    if (category && category !== 'all') query.set('category', category);
    if (search) query.set('search', search);
    if (sourceFilter && sourceFilter !== 'all') query.set('source', sourceFilter);
    if (sort) query.set('sort', sort);
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));

    const res = await fetch(`/api/aliexpress/products?${query.toString()}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'MetfaSocial-CrossApp',
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.products) && data.products.length > 0) {
        // Merge API products with our local Sellme catalog to ensure Sellme items are never overwritten
        masterPool = mergeProductCatalogs(data.products, DEFAULT_PRODUCTS);
        try {
          localStorage.setItem(STORAGE_MASTER_KEY, JSON.stringify(masterPool));
        } catch {}
      }
    }
  } catch (err) {
    console.warn('[MarketplaceService] Server fetch failed, utilizing resilient merged catalog:', err);
    // Try reading cached master pool
    try {
      const raw = localStorage.getItem(STORAGE_MASTER_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          masterPool = mergeProductCatalogs(parsed, DEFAULT_PRODUCTS);
        }
      }
    } catch {}
  }

  // Calculate live category counts across the master pool
  const categoryCounts: Record<string, number> = {
    all: masterPool.length,
    tech: masterPool.filter(p => p.category === 'tech').length,
    gadgets: masterPool.filter(p => p.category === 'gadgets').length,
    wearables: masterPool.filter(p => p.category === 'wearables').length,
    fashion: masterPool.filter(p => p.category === 'fashion').length,
    home: masterPool.filter(p => p.category === 'home').length,
  };

  // Filter by category
  let filtered = [...masterPool];
  if (category && category !== 'all') {
    filtered = filtered.filter((p) => p.category.toLowerCase() === category.toLowerCase());
  }

  // Filter by source (Sellme vs AliExpress)
  if (sourceFilter && sourceFilter !== 'all') {
    filtered = filtered.filter((p) => p.source === sourceFilter);
  }

  // Filter by search query
  if (search) {
    filtered = filtered.filter(
      (p) =>
        p.title.toLowerCase().includes(search) ||
        p.description.toLowerCase().includes(search) ||
        p.tags.some((t) => t.toLowerCase().includes(search)) ||
        p.seller.name.toLowerCase().includes(search) ||
        p.category.toLowerCase().includes(search)
    );
  }

  // Apply sorting
  if (sort === 'price_low') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (sort === 'price_high') {
    filtered.sort((a, b) => b.price - a.price);
  } else if (sort === 'rating') {
    filtered.sort((a, b) => b.rating - a.rating);
  } else if (sort === 'orders') {
    filtered.sort((a, b) => b.ordersCount - a.ordersCount);
  }

  return {
    products: filtered,
    total: filtered.length,
    source: 'merged-aliexpress-sellme',
    isFallback: false,
    categoryCounts,
  };
}

/**
 * Builds the canonical Sellme cross-app redirect URL with proper tracking & referral context
 */
export function getSellmeShopUrl(params?: {
  productId?: string;
  category?: string;
  searchQuery?: string;
  source?: string;
}): string {
  const baseUrl = 'https://shop.metfa.com';
  const url = new URL(baseUrl);
  url.searchParams.set('source', params?.source || 'metfa_social');
  url.searchParams.set('ref', 'metfa_social_app');
  url.searchParams.set('v', '1.0');

  if (params?.productId) {
    url.searchParams.set('product_id', params.productId);
  }
  if (params?.category && params.category !== 'all') {
    url.searchParams.set('category', params.category);
  }
  if (params?.searchQuery) {
    url.searchParams.set('q', params.searchQuery);
  }

  return url.toString();
}
