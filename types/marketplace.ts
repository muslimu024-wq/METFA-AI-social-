export interface MarketplaceProduct {
  id: string;
  title: string;
  price: number;
  originalPrice?: number;
  discountPercentage?: number;
  currency: string;
  rating: number;
  reviewCount: number;
  ordersCount: number;
  imageUrl: string;
  galleryImages?: string[];
  category: string;
  source: 'aliexpress' | 'sellme';
  seller: {
    name: string;
    rating?: number;
    positiveFeedbackPercent?: number;
  };
  shipping: {
    isFree: boolean;
    estimatedDelivery?: string;
    cost?: number;
  };
  productUrl: string;
  affiliateUrl?: string;
  description: string;
  specifications?: Record<string, string>;
  inStock: boolean;
  tags: string[];
}

export interface MarketplaceCategory {
  id: string;
  name: string;
  iconName: string;
  itemCount: number;
}
