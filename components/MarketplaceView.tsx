import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  Search,
  SlidersHorizontal,
  Star,
  ExternalLink,
  Truck,
  ShieldCheck,
  Zap,
  RefreshCw,
  Sparkles,
  Cpu,
  Watch,
  Shirt,
  Home,
  CheckCircle2,
  Share2,
  ChevronRight,
  Info,
  X,
  PackageCheck,
  Eye,
  Store,
} from 'lucide-react';
import { MarketplaceProduct } from '../types/marketplace';
import {
  fetchMarketplaceProducts,
  MARKETPLACE_CATEGORIES,
  getSellmeShopUrl,
} from '../services/marketplaceService';
import { UserProfile } from '../types/community';

interface MarketplaceViewProps {
  userProfile: UserProfile;
  onNavigateTab?: (tab: string) => void;
  onShareProductToFeed?: (product: MarketplaceProduct) => void;
}

export const MarketplaceView: React.FC<MarketplaceViewProps> = ({
  userProfile,
  onNavigateTab,
  onShareProductToFeed,
}) => {
  const [products, setProducts] = useState<MarketplaceProduct[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<'all' | 'sellme' | 'aliexpress'>('all');
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('trending');
  const [selectedProduct, setSelectedProduct] = useState<MarketplaceProduct | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [showShareToast, setShowShareToast] = useState<boolean>(false);

  // Category Icon Resolver
  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'Cpu':
        return <Cpu className="w-3.5 h-3.5" />;
      case 'Zap':
        return <Zap className="w-3.5 h-3.5" />;
      case 'Watch':
        return <Watch className="w-3.5 h-3.5" />;
      case 'Shirt':
        return <Shirt className="w-3.5 h-3.5" />;
      case 'Home':
        return <Home className="w-3.5 h-3.5" />;
      default:
        return <Sparkles className="w-3.5 h-3.5" />;
    }
  };

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      const res = await fetchMarketplaceProducts({
        category: selectedCategory,
        source: selectedSource,
        search: searchQuery,
        sort: sortBy,
      });
      setProducts(res.products);
      if (res.categoryCounts) {
        setCategoryCounts(res.categoryCounts);
      }
    } catch (err) {
      console.error('Failed to load marketplace products:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [selectedCategory, selectedSource, sortBy]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadProducts();
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadProducts();
  };

  const handleOpenSellmeShop = (product?: MarketplaceProduct) => {
    const targetUrl = product
      ? getSellmeShopUrl({ productId: product.id, source: 'metfa_marketplace_view' })
      : getSellmeShopUrl({ category: selectedCategory, source: 'metfa_marketplace_banner' });
    window.open(targetUrl, '_blank', 'noopener');
  };

  const handleShareProduct = (product: MarketplaceProduct) => {
    if (onShareProductToFeed) {
      onShareProductToFeed(product);
    } else {
      // Copy product link and show toast
      try {
        navigator.clipboard.writeText(product.affiliateUrl || product.productUrl);
        setShowShareToast(true);
        setTimeout(() => setShowShareToast(false), 2500);
      } catch {}
    }
  };

  return (
    <div className="flex-1 w-full h-full flex flex-col overflow-y-auto bg-white text-slate-900 pb-20 sm:pb-24">
      {/* Toast Notice for Share */}
      {showShareToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-teal-700 text-white font-bold px-4 py-2 rounded-2xl shadow-xl flex items-center gap-2 text-xs animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-white" />
          <span>Product link copied to clipboard!</span>
        </div>
      )}

      {/* Top Banner: Cross-App Sellme & AliExpress Bridge */}
      <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-teal-50 border-b border-slate-200 px-4 py-4 sm:px-6 sm:py-5 shrink-0">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-gradient-to-tr from-purple-600 to-teal-600 rounded-xl text-white shadow-md shadow-purple-600/20">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                    Sellme Marketplace
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                    AliExpress Global Dropship
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-medium">
                  Shop viral AI tech, smart gadgets, and trending creator gear with seamless cross-app routing.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition active:scale-95 cursor-pointer shrink-0 shadow-xs"
              title="Refresh live catalog"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-teal-600' : 'text-slate-600'}`} />
              <span className="hidden sm:inline">Sync Live</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenSellmeShop()}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 via-indigo-600 to-purple-600 hover:from-teal-500 hover:to-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-teal-600/20 transition active:scale-95 cursor-pointer"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Open Sellme Shop</span>
              <ExternalLink className="w-3 h-3 text-white/80" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-4 space-y-4">
        {/* Search & Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search AliExpress & Sellme products..."
              className="w-full pl-9 pr-20 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:border-purple-600 focus:bg-white text-xs text-slate-900 placeholder-slate-400 transition outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  loadProducts();
                }}
                className="absolute right-14 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 text-xs"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold rounded-lg transition shadow-xs"
            >
              Search
            </button>
          </form>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 outline-none focus:border-purple-600 cursor-pointer shadow-xs"
            >
              <option value="trending">🔥 Trending Now</option>
              <option value="orders">📦 Most Orders</option>
              <option value="rating">⭐ Highest Rated</option>
              <option value="price_low">💵 Price: Low to High</option>
              <option value="price_high">💎 Price: High to Low</option>
            </select>
          </div>
        </div>

        {/* Source & Catalog Filter Row */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
          {/* Category Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none flex-1">
            {MARKETPLACE_CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              const count = categoryCounts[cat.id] ?? cat.itemCount;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-r from-purple-600 to-teal-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  {getCategoryIcon(cat.iconName)}
                  <span>{cat.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Source Tabs (All / Sellme / AliExpress) */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shrink-0 text-xs">
            <button
              type="button"
              onClick={() => setSelectedSource('all')}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${
                selectedSource === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Sources
            </button>
            <button
              type="button"
              onClick={() => setSelectedSource('sellme')}
              className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                selectedSource === 'sellme'
                  ? 'bg-white text-teal-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Store className="w-3 h-3 text-teal-600" />
              Sellme Direct
            </button>
            <button
              type="button"
              onClick={() => setSelectedSource('aliexpress')}
              className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
                selectedSource === 'aliexpress'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <PackageCheck className="w-3 h-3 text-purple-600" />
              AliExpress Global
            </button>
          </div>
        </div>

        {/* Product Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 py-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="bg-slate-50 rounded-2xl border border-slate-200 p-3 space-y-3 animate-pulse"
              >
                <div className="w-full aspect-square bg-slate-200 rounded-xl" />
                <div className="h-3 bg-slate-200 rounded w-3/4" />
                <div className="h-4 bg-slate-200 rounded w-1/2" />
                <div className="h-8 bg-slate-200 rounded-xl w-full" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 space-y-3 bg-slate-50 rounded-2xl border border-slate-200 p-6">
            <ShoppingBag className="w-12 h-12 text-slate-400 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No products found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              We couldn't find items matching your search. Try adjusting keywords or category filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4.5">
            {products.map((product) => {
              return (
                <div
                  key={product.id}
                  className="bg-white hover:bg-slate-50/50 border border-slate-200 hover:border-purple-300 rounded-2xl overflow-hidden flex flex-col transition duration-200 group shadow-xs hover:shadow-md"
                >
                  {/* Thumbnail Image Container */}
                  <div className="relative aspect-square overflow-hidden bg-slate-100">
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />

                    {/* Discount Badge */}
                    {product.discountPercentage && product.discountPercentage > 0 && (
                      <span className="absolute top-2 left-2 bg-rose-600 text-white font-black text-[10px] px-2 py-0.5 rounded-md shadow-xs">
                        -{product.discountPercentage}%
                      </span>
                    )}

                    {/* Source Badge */}
                    <span className="absolute top-2 right-2 bg-white/90 backdrop-blur-xs text-teal-800 border border-teal-200 font-bold text-[9px] px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-xs">
                      <PackageCheck className="w-2.5 h-2.5 text-teal-600" />
                      {product.source === 'aliexpress' ? 'AliExpress' : 'Sellme Direct'}
                    </span>

                    {/* Quick View Button overlay */}
                    <button
                      type="button"
                      onClick={() => setSelectedProduct(product)}
                      className="absolute inset-x-3 bottom-3 py-1.5 bg-slate-900/90 hover:bg-slate-900 text-white font-semibold text-xs rounded-xl backdrop-blur-xs opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1 shadow-md cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-teal-300" />
                      <span>Quick View</span>
                    </button>
                  </div>

                  {/* Content & Metadata */}
                  <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                    <div className="space-y-1">
                      <h4
                        className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-purple-700 transition cursor-pointer"
                        onClick={() => setSelectedProduct(product)}
                        title={product.title}
                      >
                        {product.title}
                      </h4>

                      {/* Ratings & Orders */}
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                        <div className="flex items-center gap-1 text-amber-500 font-bold">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span>{product.rating.toFixed(1)}</span>
                          <span className="text-slate-400">({product.reviewCount})</span>
                        </div>
                        <span className="text-slate-500 font-medium">{product.ordersCount.toLocaleString()}+ sold</span>
                      </div>
                    </div>

                    {/* Pricing & Free Shipping */}
                    <div className="pt-1.5 border-t border-slate-100 space-y-2">
                      <div className="flex items-baseline justify-between">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-sm sm:text-base font-black text-slate-900">
                            ${product.price.toFixed(2)}
                          </span>
                          {product.originalPrice && product.originalPrice > product.price && (
                            <span className="text-[10px] text-slate-400 line-through">
                              ${product.originalPrice.toFixed(2)}
                            </span>
                          )}
                        </div>

                        {product.shipping.isFree && (
                          <span className="text-[9px] font-bold text-teal-700 flex items-center gap-0.5 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100">
                            <Truck className="w-2.5 h-2.5 text-teal-600" /> Free Ship
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() => handleShareProduct(product)}
                          className="col-span-1 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition active:scale-95 cursor-pointer shadow-xs"
                          title="Share Product"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenSellmeShop(product)}
                          className="col-span-3 py-2 px-2 rounded-xl bg-gradient-to-r from-teal-600 to-purple-600 hover:from-teal-500 hover:to-purple-500 text-white font-bold text-[11px] flex items-center justify-center gap-1 shadow-xs transition active:scale-95 cursor-pointer"
                        >
                          <span>Buy Now</span>
                          <ExternalLink className="w-2.5 h-2.5 text-white/80" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                  {selectedProduct.source === 'aliexpress' ? 'AliExpress Dropship' : 'Sellme Official'}
                </span>
                <span className="text-xs text-slate-600 capitalize font-medium">{selectedProduct.category}</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="p-1 rounded-xl hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
              {/* Image Gallery */}
              <div className="space-y-2">
                <div className="aspect-video sm:aspect-[16/10] bg-slate-100 rounded-2xl overflow-hidden border border-slate-200">
                  <img
                    src={
                      selectedProduct.galleryImages?.[activeImageIndex] ||
                      selectedProduct.imageUrl
                    }
                    alt={selectedProduct.title}
                    className="w-full h-full object-cover"
                  />
                </div>

                {selectedProduct.galleryImages && selectedProduct.galleryImages.length > 1 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {selectedProduct.galleryImages.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveImageIndex(idx)}
                        className={`w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition ${
                          activeImageIndex === idx ? 'border-teal-600' : 'border-slate-200 opacity-60'
                        }`}
                      >
                        <img src={img} alt="thumb" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Title & Price */}
              <div className="space-y-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                  {selectedProduct.title}
                </h3>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl sm:text-2xl font-black text-teal-700">
                      ${selectedProduct.price.toFixed(2)}
                    </span>
                    {selectedProduct.originalPrice && (
                      <span className="text-xs text-slate-400 line-through">
                        ${selectedProduct.originalPrice.toFixed(2)}
                      </span>
                    )}
                    {selectedProduct.discountPercentage && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">
                        {selectedProduct.discountPercentage}% OFF
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-600">
                    <div className="flex items-center gap-1 text-amber-500 font-bold">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{selectedProduct.rating.toFixed(1)}</span>
                      <span className="text-slate-400">({selectedProduct.reviewCount})</span>
                    </div>
                    <span className="text-slate-600 font-medium">
                      📦 {selectedProduct.ordersCount.toLocaleString()}+ orders
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Product Overview
                </span>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {selectedProduct.description}
                </p>
              </div>

              {/* Specifications */}
              {selectedProduct.specifications && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                    Technical Specifications
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                    {Object.entries(selectedProduct.specifications).map(([key, val]) => (
                      <div
                        key={key}
                        className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex justify-between"
                      >
                        <span className="text-slate-500 font-medium">{key}</span>
                        <span className="text-slate-900 font-bold">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Seller Trust & Shipping */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1">
                  <div className="flex items-center gap-1 text-teal-700 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Verified Seller</span>
                  </div>
                  <p className="text-slate-900 font-medium text-[11px]">{selectedProduct.seller.name}</p>
                  <p className="text-[10px] text-slate-500">
                    {selectedProduct.seller.positiveFeedbackPercent}% Positive Feedback
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1">
                  <div className="flex items-center gap-1 text-purple-700 font-bold">
                    <Truck className="w-3.5 h-3.5" />
                    <span>Fast Delivery</span>
                  </div>
                  <p className="text-slate-900 font-medium text-[11px]">
                    {selectedProduct.shipping.isFree ? 'Free Global Shipping' : 'Standard Shipping'}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Est. {selectedProduct.shipping.estimatedDelivery}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer CTA */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => handleShareProduct(selectedProduct)}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Share Link</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenSellmeShop(selectedProduct)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-600 via-indigo-600 to-purple-600 hover:from-teal-500 hover:to-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95 cursor-pointer"
              >
                <span>Checkout on Sellme / AliExpress</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketplaceView;
