import React, { useState } from 'react';
import {
  ShoppingBag,
  ExternalLink,
  RefreshCw,
  Globe,
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  Truck,
  Zap,
} from 'lucide-react';
import { UserProfile } from '../types/community';
import { MarketplaceProduct } from '../types/marketplace';

interface MarketplaceViewProps {
  userProfile?: UserProfile;
  onNavigateTab?: (tab: string) => void;
  onShareProductToFeed?: (product: MarketplaceProduct) => void;
}

export const MarketplaceView: React.FC<MarketplaceViewProps> = ({
  onNavigateTab,
}) => {
  const [iframeKey, setIframeKey] = useState<number>(0);
  const [isLoadingIframe, setIsLoadingIframe] = useState<boolean>(true);

  const shopUrl = 'https://shop.metfaai.com';

  const handleOpenDirectShop = () => {
    window.open(shopUrl, '_blank', 'noopener,noreferrer');
  };

  const handleReload = () => {
    setIsLoadingIframe(true);
    setIframeKey((prev) => prev + 1);
  };

  return (
    <div className="w-full h-full flex flex-col flex-1 bg-slate-50 relative overflow-hidden">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 shrink-0 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('feed')}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition cursor-pointer"
              title="Back to Social Feed"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-teal-500 flex items-center justify-center text-white shadow-sm shadow-purple-600/20">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-black text-slate-900 tracking-tight">Sellme App</h2>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200">
                  Official Store
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-mono">shop.metfaai.com</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReload}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer text-xs flex items-center gap-1"
            title="Reload Shop"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingIframe ? 'animate-spin text-purple-600' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleOpenDirectShop}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-teal-600 hover:from-purple-700 hover:to-teal-700 text-white font-bold text-xs shadow-sm shadow-purple-600/25 flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
          >
            <span>Open in New Tab</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Banner / Quick Action Bar */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 px-4 py-3 text-white shrink-0 flex flex-col sm:flex-row items-center justify-between gap-2.5 shadow-xs">
        <div className="flex items-center gap-3 text-center sm:text-left">
          <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-teal-300 shrink-0">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-white flex items-center gap-1.5 justify-center sm:justify-start">
              <span>🛒 Direct Sellme E-Commerce Portal</span>
              <span className="text-[9px] px-1.5 py-0.2 bg-teal-500/30 text-teal-300 border border-teal-400/30 rounded">Live</span>
            </p>
            <p className="text-[11px] text-slate-300">
              Browse products, official tech gear, AliExpress deals & secure checkout at <span className="text-teal-300 font-mono">shop.metfaai.com</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenDirectShop}
          className="w-full sm:w-auto px-4 py-1.5 rounded-xl bg-white text-purple-900 hover:bg-teal-50 font-black text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
        >
          <ShoppingBag className="w-3.5 h-3.5 text-purple-600" />
          <span>Launch Sellme Home</span>
          <ExternalLink className="w-3 h-3 text-purple-600" />
        </button>
      </div>

      {/* Embedded Live Web View of shop.metfaai.com */}
      <div className="flex-1 w-full h-full relative bg-slate-100 flex flex-col min-h-0">
        {isLoadingIframe && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-xs flex flex-col items-center justify-center z-10 p-4">
            <div className="w-10 h-10 border-3 border-purple-600 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm font-bold text-slate-800">Connecting to Sellme App...</p>
            <p className="text-xs text-slate-500 font-mono mt-1">https://shop.metfaai.com</p>
            
            <button
              type="button"
              onClick={handleOpenDirectShop}
              className="mt-4 px-4 py-2 bg-gradient-to-r from-purple-600 to-teal-600 text-white text-xs font-bold rounded-xl shadow-xs hover:opacity-95 cursor-pointer flex items-center gap-1.5"
            >
              <span>Click here to open directly in browser</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <iframe
          key={iframeKey}
          src="https://shop.metfaai.com"
          title="Sellme Shop Official"
          className="w-full h-full flex-1 border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
          onLoad={() => setIsLoadingIframe(false)}
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      {/* Feature Badges Footer */}
      <div className="bg-white border-t border-slate-200 px-4 py-2 shrink-0 flex items-center justify-around text-[11px] text-slate-600">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
          <span>100% Genuine</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Truck className="w-3.5 h-3.5 text-purple-600" />
          <span>Fast Delivery</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          <span>Official Warranty</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>AliExpress Verified</span>
        </div>
      </div>
    </div>
  );
};

export default MarketplaceView;
