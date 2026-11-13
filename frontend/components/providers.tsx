"use client";
import * as React from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { api, ApiError, resetCsrf } from "@/services/api";
import type { Cart, User } from "@/lib/types";
import { FavoritesProvider } from "@/components/site/product-card";

// ---------- Toasts ----------
type Toast = { id: number; text: string; tone: "ok" | "err" };
const ToastCtx = React.createContext<{ toast: (text: string, tone?: "ok" | "err") => void }>({ toast: () => {} });
export const useToast = () => React.useContext(ToastCtx);

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<Toast[]>([]);
  const toast = React.useCallback((text: string, tone: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, text, tone }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {items.map((t) => (
          <div key={t.id} role="status" className="card-lux pointer-events-auto flex items-start gap-3 bg-surface p-4 text-sm shadow-xl">
            {t.tone === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------- Auth ----------
type AuthState = {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string, rememberMe: boolean) => Promise<User>;
  register: (fullName: string, email: string, password: string, confirmPassword: string) => Promise<{ requiresEmailConfirmation: boolean; message: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};
const AuthCtx = React.createContext<AuthState>(null as unknown as AuthState);
export const useAuth = () => React.useContext(AuthCtx);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    try {
      setUser(await api.get<User>("/api/auth/me"));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => { void refresh(); }, [refresh]);

  const value = React.useMemo<AuthState>(() => ({
    user, loading, isAdmin: !!user?.roles.includes("Admin"), refresh,
    login: async (email, password, rememberMe) => {
      const u = await api.post<User>("/api/auth/login", { email, password, rememberMe });
      resetCsrf(); // the antiforgery token is bound to the user identity
      setUser(u);
      return u;
    },
    register: (fullName, email, password, confirmPassword) =>
      api.post("/api/auth/register", { fullName, email, password, confirmPassword }),
    logout: async () => {
      try { await api.post("/api/auth/logout"); } finally { resetCsrf(); setUser(null); }
    },
  }), [user, loading, refresh]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

// ---------- Cart ----------
type CartState = {
  cart: Cart | null;
  count: number;
  loading: boolean;
  reload: () => Promise<void>;
  add: (item: { productId: number; variantId?: number | null; temperature?: string | null; addonIds?: number[]; quantity: number; notes?: string }) => Promise<boolean>;
  update: (id: number, quantity: number, extra?: Record<string, unknown>) => Promise<void>;
  remove: (id: number) => Promise<void>;
  setCart: (c: Cart | null) => void;
};
const CartCtx = React.createContext<CartState>(null as unknown as CartState);
export const useCart = () => React.useContext(CartCtx);

function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [cart, setCart] = React.useState<Cart | null>(null);
  const [loading, setLoading] = React.useState(false);

  const reload = React.useCallback(async () => {
    if (!user) { setCart(null); return; }
    setLoading(true);
    try { setCart(await api.get<Cart>("/api/cart")); } catch { /* keep previous */ } finally { setLoading(false); }
  }, [user]);
  React.useEffect(() => { void reload(); }, [reload]);

  const guard = async <T,>(fn: () => Promise<T>) => {
    try { return await fn(); } catch (e) { toast(e instanceof ApiError ? e.message : "Could not update cart.", "err"); throw e; }
  };

  const value: CartState = {
    cart, loading, reload, setCart, count: cart?.itemCount ?? 0,
    add: async (item) => {
      if (!user) return false;
      try {
        setCart(await api.post<Cart>("/api/cart/items", item));
        toast("Added to your cart");
        return true;
      } catch (e) { toast(e instanceof ApiError ? e.message : "Could not add to cart.", "err"); return false; }
    },
    update: async (id, quantity, extra) => { try { setCart(await guard(() => api.put<Cart>(`/api/cart/items/${id}`, { quantity, ...extra }))); } catch { /* toasted */ } },
    remove: async (id) => { try { setCart(await guard(() => api.del<Cart>(`/api/cart/items/${id}`))); } catch { /* toasted */ } },
  };
  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <CartProvider><FavoritesProvider>{children}</FavoritesProvider></CartProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

// ---------- tiny data hook ----------
export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(!!path);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    if (!path) return;
    let live = true;
    setLoading(true);
    api.get<T>(path)
      .then((d) => { if (live) { setData(d); setError(null); } })
      .catch((e) => { if (live) setError(e instanceof ApiError ? e.message : "Could not load data."); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);

  return { data, error, loading, reload: () => setTick((t) => t + 1), setData };
}

