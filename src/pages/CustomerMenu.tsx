import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { 
  ShoppingBag, 
  ChevronRight, 
  Plus, 
  Minus, 
  X, 
  MessageCircle, 
  Clock, 
  ChevronDown,
  Search,
  ShoppingCart,
  CheckCircle2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function CustomerMenu() {
  const { tenantId } = useParams();
  const [searchParams] = useSearchParams();
  const tableNumber = searchParams.get('table');

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<any[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [orderState, setOrderState] = useState<'browsing' | 'submitting' | 'success'>('browsing');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [viewingProduct, setViewingProduct] = useState<any>(null);

  useEffect(() => {
    if (tenantId) {
      fetch(`/api/public/menu/${tenantId}`)
        .then(res => res.json())
        .then(setData)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [tenantId]);

  const handleAddToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const handleRemoveFromCart = (itemId: string) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === itemId);
      if (existing.quantity === 1) {
        return prev.filter(i => i.id !== itemId);
      }
      return prev.map(i => i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i);
    });
  };

  const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const handleSubmitOrder = async () => {
    setOrderState('submitting');
    try {
      const res = await fetch('/api/public/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          table_number: tableNumber,
          items: cart.map(i => ({ menu_item_id: i.id, quantity: i.quantity, price: i.price })),
          delivery_type: tableNumber ? 'dine_in' : 'takeout',
          customer_name: ''
        })
      });
      if (res.ok) {
        const data = await res.json();
        setOrderId(data.orderId);
        setOrderState('success');
      } else {
        alert("Error al enviar la orden. Intenta de nuevo.");
        setOrderState('browsing');
      }
    } catch (e) {
      console.error(e);
      setOrderState('browsing');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <motion.div 
          animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-10 h-10 border-4 border-slate-100 border-t-[#109e38] rounded-full"
        />
      </div>
    );
  }

  if (!data) return <div className="p-8 text-center">Restaurante no encontrado.</div>;

  const filteredItems = data.menuItems.filter((item: any) => {
    const matchesCategory = activeCategory === 'all' || item.category_id === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-32">
      {/* Header */}
      <header className="fixed top-0 inset-x-0 bg-white/80 backdrop-blur-md z-40 border-b border-slate-100 px-6 h-16 flex items-center justify-between">
         <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-sm`} style={{ backgroundColor: data.themeColor || '#109e38' }}>
               {data.initLetters}
            </div>
            <div>
               <h1 className="text-sm font-black text-slate-900 tracking-tight leading-none uppercase">{data.restaurantName}</h1>
               <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">En línea</span>
               </div>
            </div>
         </div>
         {tableNumber && (
           <div className="px-3 py-1.5 rounded-lg bg-orange-50 border border-orange-100 flex items-center gap-1.5">
              <span className="text-[10px] font-black text-orange-600 uppercase">Mesa {tableNumber}</span>
           </div>
         )}
      </header>

      {/* Hero */}
      <div className="pt-24 px-6 mb-8 text-center">
         <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-2">¿Qué te gustaría<br />comer hoy?</h2>
         <p className="text-sm font-medium text-slate-400">Escanea. Ordena. Disfruta.</p>
      </div>

      {/* Search Bar */}
      <div className="px-6 mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Busca tu comida favorita..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 pl-11 pr-4 bg-white border border-slate-100 rounded-2xl text-sm font-medium focus:outline-none focus:border-[#109e38] shadow-sm transition-all shadow-slate-100/50"
          />
        </div>
      </div>

      {/* Category Chips */}
      <div className="sticky top-16 z-30 bg-slate-50/80 backdrop-blur-md py-4 px-6 -mx-6 overflow-x-auto flex gap-2 no-scrollbar scroll-px-6">
         <button 
           onClick={() => setActiveCategory("all")}
           className={`h-11 px-6 rounded-2xl text-xs font-black transition-all border whitespace-nowrap active:scale-95 ${activeCategory === 'all' ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-600 border-slate-100 hover:border-slate-300 shadow-sm'}`}
         >
           🍽️ TODOS
         </button>
         {data.categories.map((cat: any) => (
           <button 
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`h-11 px-6 rounded-2xl text-xs font-black transition-all border whitespace-nowrap flex items-center gap-2 active:scale-95 ${activeCategory === cat.id ? 'bg-[#109e38] text-white border-[#109e38] shadow-md shadow-[#109e38]/20' : 'bg-white text-slate-600 border-slate-100 hover:border-slate-300 shadow-sm'}`}
           >
             <span>{cat.icon}</span> {cat.name.toUpperCase()}
           </button>
         ))}
      </div>

      {/* Items List */}
      <div className="px-6 space-y-6 mt-4">
         {filteredItems.map((item: any) => (
           <motion.div 
            layout
            key={item.id} 
            className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex"
           >
             <div 
              onClick={() => setViewingProduct(item)}
              className="w-28 h-28 shrink-0 cursor-pointer relative"
             >
                <img src={item.image_url ? item.image_url.split(',')[0] : ''} referrerPolicy="no-referrer" alt={item.name} className="w-full h-full object-cover" />
                {item.image_url && item.image_url.split(',').filter(Boolean).length > 1 && (
                  <div className="absolute top-1 right-1 bg-black/50 backdrop-blur-sm text-white text-[8px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                    1/{item.image_url.split(',').filter(Boolean).length}
                  </div>
                )}
             </div>
             <div 
              onClick={() => setViewingProduct(item)}
              className="flex-1 p-4 flex flex-col justify-between cursor-pointer"
             >
                <div className="pr-2 relative">
                   <h4 className="text-sm font-bold text-slate-900 leading-tight mb-1">{item.name}</h4>
                   <p className="text-[10px] text-slate-400 font-medium line-clamp-2">{item.description}</p>
                   <div className="mt-2 text-sm font-black text-slate-900">${item.price}</div>
                </div>
             </div>
              <div className="flex items-center p-4">
                 {cart.find(i => i.id === item.id) ? (
                    <div className="flex flex-col items-center gap-2 bg-slate-50 border border-slate-100 rounded-2xl p-1">
                       <button onClick={() => handleAddToCart(item)} className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-[#109e38] shadow-sm"><Plus className="w-4 h-4" /></button>
                       <span className="text-xs font-black text-slate-900">{cart.find(i => i.id === item.id).quantity}</span>
                       <button onClick={() => handleRemoveFromCart(item.id)} className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-sm"><Minus className="w-4 h-4" /></button>
                    </div>
                 ) : (
                    <button 
                      onClick={() => handleAddToCart(item)}
                      className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                    >
                       <Plus className="w-6 h-6" />
                    </button>
                 )}
              </div>
           </motion.div>
         ))}
      </div>

      {/* Cart Button Bottom */}
      <AnimatePresence>
        {cart.length > 0 && orderState !== 'success' && (
          <motion.div 
            initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
            className="fixed bottom-0 inset-x-0 p-6 z-50 pointer-events-none"
          >
             <button 
              onClick={() => setShowCart(true)}
              className="w-full h-16 bg-[#109e38] text-white rounded-2xl shadow-2xl flex items-center justify-between px-6 pointer-events-auto active:scale-95 transition-transform shadow-[#109e38]/30"
             >
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                      <ShoppingBag className="w-4 h-4 text-white" />
                   </div>
                   <span className="text-sm font-black uppercase tracking-wide">CARRITO ({cart.reduce((a, b) => a + b.quantity, 0)})</span>
                </div>
                <div className="flex items-center gap-2">
                   <span className="text-lg font-black">${total.toFixed(2)}</span>
                   <ChevronRight className="w-5 h-5 opacity-50" />
                </div>
             </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart Slider */}
      <AnimatePresence>
        {showCart && (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
             <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               onClick={() => setShowCart(false)}
               className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
             />
             <motion.div 
               initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
               className="relative bg-white w-full max-w-lg rounded-t-[32px] sm:rounded-3xl shadow-2xl overflow-hidden p-8 flex flex-col max-h-[85vh]"
             >
                <div className="flex justify-between items-center mb-8">
                   <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Tu Pedido</h3>
                   <button onClick={() => setShowCart(false)} className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400"><X className="w-6 h-6" /></button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                   {cart.map(item => (
                     <div key={item.id} className="flex justify-between items-center">
                         <div className="flex items-center gap-4">
                            <img src={item.image_url ? item.image_url.split(',')[0] : ''} referrerPolicy="no-referrer" className="w-16 h-16 rounded-2xl object-cover" />
                            <div>
                              <div className="text-sm font-bold text-slate-900">{item.name}</div>
                              <div className="text-xs font-black text-[#109e38] mt-1">${item.price}</div>
                           </div>
                        </div>
                        <div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl p-1">
                           <button onClick={() => handleRemoveFromCart(item.id)} className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-slate-400 shadow-sm"><Minus className="w-3 h-3" /></button>
                           <span className="text-xs font-black text-slate-900 min-w-[20px] text-center">{item.quantity}</span>
                           <button onClick={() => handleAddToCart(item)} className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-[#109e38] shadow-sm"><Plus className="w-3 h-3" /></button>
                        </div>
                     </div>
                   ))}
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100">
                   <div className="flex justify-between items-center mb-6">
                      <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Total a pagar</span>
                      <span className="text-3xl font-black text-slate-900">${total.toFixed(2)}</span>
                   </div>
                   
                   <button 
                    disabled={orderState === 'submitting'}
                    onClick={handleSubmitOrder}
                    className="w-full h-16 bg-slate-900 text-white rounded-2xl font-black text-lg shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                   >
                     {orderState === 'submitting' ? (
                       <Loader2 className="w-6 h-6 animate-spin" />
                     ) : (
                       <>PEDIR AHORA <ShoppingCart className="w-6 h-6 text-[#109e38]" /></>
                     )}
                   </button>
                   <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest mt-4">Al confirmar serás redirigido a WhatsApp</p>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Success State */}
      <AnimatePresence>
         {orderState === 'success' && (
           <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-8 text-center"
           >
              <div className="fixed inset-0 bg-white" />
              <div className="relative flex flex-col items-center max-w-sm">
                 <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center text-[#109e38] mb-8">
                    <CheckCircle2 className="w-12 h-12" />
                 </div>
                 <h3 className="text-3xl font-black text-slate-900 mb-4 tracking-tight uppercase">¡PEDIDO ENVIADO!</h3>
                 <p className="text-sm text-slate-500 font-medium leading-relaxed mb-2">
                    Tu orden ha sido registrada y está en preparación.
                 </p>
                 {orderId && (
                   <p className="text-xs font-bold text-slate-400 mb-8">
                      #{orderId.substring(orderId.length - 10).toUpperCase()}
                   </p>
                 )}
                 <button 
                  onClick={() => { setOrderState('browsing'); setCart([]); setOrderId(null); }}
                  className="px-8 h-12 bg-slate-900 text-white rounded-2xl text-xs font-bold uppercase tracking-widest shadow-lg"
                 >
                    Ordenar de nuevo
                 </button>
              </div>
           </motion.div>
         )}
      </AnimatePresence>

      {/* Product Detail Modal (E-Commerce Style) */}
      <AnimatePresence>
        {viewingProduct && (
          <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
             <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               onClick={() => setViewingProduct(null)}
               className="fixed inset-0 bg-black/60 backdrop-blur-md"
             />
             <motion.div 
               initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
               className="relative bg-white w-full max-w-lg rounded-t-[32px] sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
             >
                {/* Image Carousel Zone */}
                <div className="relative w-full aspect-square bg-slate-100 group">
                   <button onClick={() => setViewingProduct(null)} className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/30 backdrop-blur-md flex items-center justify-center text-white hover:bg-white hover:text-slate-900 transition-all"><X className="w-5 h-5" /></button>
                   
                   {viewingProduct.image_url ? (
                     <div className="w-full h-full flex overflow-x-auto snap-x snap-mandatory no-scrollbar relative">
                       {viewingProduct.image_url.split(',').filter(Boolean).map((img: string, i: number) => (
                         <div key={i} className="w-full h-full shrink-0 snap-center relative">
                           <img src={img} alt="" className="w-full h-full object-cover" />
                         </div>
                       ))}
                       
                       {viewingProduct.image_url.split(',').filter(Boolean).length > 1 && (
                         <div className="absolute bottom-4 inset-x-0 flex justify-center gap-2 pointer-events-none">
                            {viewingProduct.image_url.split(',').filter(Boolean).map((_:any, i:number) => (
                              <div key={i} className="w-1.5 h-1.5 rounded-full bg-white opacity-50 shadow-sm" />
                            ))}
                         </div>
                       )}
                     </div>
                   ) : (
                     <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-300">
                       No hay imagen
                     </div>
                   )}
                </div>

                {/* Content */}
                <div className="p-6 flex-1 overflow-y-auto">
                   <div className="flex justify-between items-start mb-4">
                      <div>
                         <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">{viewingProduct.name}</h3>
                         <span className="inline-block mt-1 px-2.5 py-1 bg-[#109e38]/10 text-[#109e38] rounded-lg text-[10px] font-black uppercase">
                            {data.categories.find((c:any)=>c.id === viewingProduct.category_id)?.name || "Destacado"}
                         </span>
                      </div>
                      <div className="text-2xl font-black text-slate-900">${viewingProduct.price}</div>
                   </div>

                   <p className="text-sm font-medium text-slate-500 leading-relaxed mb-8">
                      {viewingProduct.description || "Sin descripción detallada."}
                   </p>

                   {/* Controls bottom inside modal */}
                   <div className="flex items-center gap-4">
                      <div className="flex-1 flex items-center justify-between bg-slate-50 border border-slate-100 p-1 rounded-2xl h-16">
                         <button onClick={() => handleRemoveFromCart(viewingProduct.id)} className="w-14 h-14 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-500 active:scale-95 disabled:opacity-50" disabled={!cart.find(i=>i.id===viewingProduct.id)}>
                            <Minus className="w-5 h-5" />
                         </button>
                         <span className="text-lg font-black text-slate-900 mx-4">
                            {cart.find(i=>i.id === viewingProduct.id)?.quantity || 0}
                         </span>
                         <button onClick={() => handleAddToCart(viewingProduct)} className="w-14 h-14 rounded-xl bg-[#109e38] text-white shadow-md flex items-center justify-center active:scale-95">
                            <Plus className="w-5 h-5" />
                         </button>
                      </div>
                   </div>
                   <button 
                    onClick={() => setViewingProduct(null)}
                    className="w-full mt-4 py-3 text-slate-400 font-bold text-xs tracking-widest uppercase"
                   >
                     Seguir explorando
                   </button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const Loader2 = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
);
