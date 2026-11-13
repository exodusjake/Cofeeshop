export type User = { id: string; fullName: string; email: string; emailConfirmed: boolean; roles: string[] };
export type Paged<T> = { items: T[]; total: number; page: number; pageSize: number };

export type Variant = { id?: number | null; name: string; priceDelta: number; isDefault: boolean };
export type Addon = { id?: number | null; name: string; price: number; isActive?: boolean };
export type Product = {
  id: number; name: string; description: string; imageUrl: string | null; price: number; categoryId: number; categoryName: string;
  isAvailable: boolean; isFeatured: boolean; isSignature: boolean; supportsHot: boolean; supportsCold: boolean; isArchived: boolean;
  createdAt: string; updatedAt: string; variants: Variant[]; addons: Addon[];
  trackStock: boolean; quantityOnHand: number | null; reorderLevel: number | null; inStock: boolean;
};
export type Category = { id: number; name: string; slug: string; description: string | null; sortOrder: number; isActive: boolean; productCount: number };

export type CartItem = {
  id: number; productId: number; name: string; imageUrl: string | null; variantId: number | null; size: string | null; temperature: string | null;
  addons: { id: number; name: string; price: number }[]; unitPrice: number; quantity: number; lineTotal: number; notes: string | null; available: boolean;
};
export type Cart = { items: CartItem[]; subtotal: number; itemCount: number };

export type OrderItem = { id: number; productId: number | null; productName: string; size: string | null; temperature: string | null; addons: { id: number; name: string; price: number }[]; unitPrice: number; quantity: number; lineTotal: number; notes: string | null };
export type Order = {
  id: number; orderNumber: string; status: string; fulfillment: string; subtotal: number; discount: number; deliveryFee: number; total: number;
  promoCode: string | null; customerName: string; customerEmail: string; customerPhone: string; deliveryAddress: string | null; notes: string | null;
  paymentMethod: string; paymentStatus: string; createdAt: string; updatedAt: string; items: OrderItem[]; history: { status: string; note: string | null; at: string }[];
};
export type OrderSummary = { id: number; orderNumber: string; status: string; fulfillment: string; total: number; paymentMethod: string; paymentStatus: string; customerName: string; itemCount: number; createdAt: string };

export type Address = { id: number; label: string; recipient: string; phone: string; line1: string; line2: string | null; city: string; postalCode: string | null; notes: string | null; isDefault: boolean };
export type Profile = { fullName: string; email: string; phone: string | null; birthday: string | null; rewardPoints: number; memberSince: string };
export type Rewards = { points: number; tier: string; nextTierAt: number; history: { id: number; kind: string; points: number; description: string; createdAt: string }[] };

export type Section = { key: string; name: string; sortOrder: number; isEnabled: boolean; content: Record<string, any> };
export type Homepage = { sections: Section[]; settings: Record<string, string>; isPublished: boolean; lastPublishedAt: string | null; hasUnpublishedChanges: boolean };
export type GalleryImage = { id: number; imageUrl: string; caption: string | null; sortOrder: number; isVisible: boolean };
export type Promotion = { id: number; title: string; description: string | null; imageUrl: string | null; code: string | null; discountType: string; discountValue: number; minSubtotal: number; startsAt: string | null; endsAt: string | null; isActive: boolean };
export type Review = { id: number; productId: number | null; authorName: string; rating: number; comment: string; isApproved: boolean; createdAt: string };
export type EventItem = { title: string; date: string; description: string };

export type HomeData = {
  homepage: Homepage; pages: Record<string, string>; featured: Product[]; signature: Product[]; gallery: GalleryImage[];
  promotions: Promotion[]; reviews: Review[];
};

export type Dashboard = {
  totalSales: number; totalOrders: number; totalCustomers: number; pendingOrders: number; todayRevenue: number; activeProducts: number; lowStockCount: number;
  dailySales: { label: string; value: number; count: number }[]; monthlyRevenue: { label: string; value: number; count: number }[];
  bestSellers: { name: string; quantity: number; revenue: number }[]; orderStatistics: { status: string; count: number }[];
  revenueByCategory: { label: string; value: number; count: number }[];
};
export type AdminUser = { id: string; fullName: string; email: string; emailConfirmed: boolean; isActive: boolean; roles: string[]; createdAt: string; orderCount: number; totalSpent: number; phone: string | null };
export type Revision = { id: number; action: string; note: string | null; changedBy: string | null; createdAt: string };
