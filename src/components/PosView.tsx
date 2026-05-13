import React from "react";
import { ArrowLeft, Menu, Plus, Minus, X, Search, ChevronDown, UtensilsCrossed, ShoppingBag, Bike, Printer, CreditCard, Users, Activity, Receipt, DollarSign, Landmark, Smartphone } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

type OrderType = 'dine_in' | 'takeaway' | 'delivery';
type PaymentMethod = 'cash' | 'card' | 'transfer' | 'other';

const TIP_PRESETS = [0, 10, 15, 18, 20];

interface PosViewProps {
  tenantId: string;
  token: string;
  categories: any[];
  menuItems: any[];
  tables: any[];
  refreshDashboard: () => void;
  setIsSidebarOpen: (v: boolean) => void;
  setActiveTab: (v: any) => void;
  currencySymbol?: string;
}

export const PosView: React.FC<PosViewProps> = ({
  tenantId, token, categories, menuItems, tables, refreshDashboard, setIsSidebarOpen, setActiveTab, currencySymbol = "$"
}) => {
  const [currentOrder, setCurrentOrder] = React.useState<any[]>([]);
  const [orderType, setOrderType] = React.useState<OrderType>('dine_in');
  const [selectedTablePos, setSelectedTablePos] = React.useState("1");
  const [showPosCart, setShowPosCart] = React.useState(false);
  
  const [selectedItemForModal, setSelectedItemForModal] = React.useState<any>(null);
  const [selectedAddons, setSelectedAddons] = React.useState<any>({});
  const [selectedSize, setSelectedSize] = React.useState("Regular");
  const [modalQuantity, setModalQuantity] = React.useState(1);
  const [specialInstructions, setSpecialInstructions] = React.useState("");
  
  const [posSearchQuery, setPosSearchQuery] = React.useState("");
  const [posCategoryFilter, setPosCategoryFilter] = React.useState("all");
  
  const [couponInput, setCouponInput] = React.useState("");
  const [couponError, setCouponError] = React.useState("");
  const [couponSuccess, setCouponSuccess] = React.useState("");
  const [activeCoupon, setActiveCoupon] = React.useState<any>(null);
  
  const [editingOrderId, setEditingOrderId] = React.useState<string | null>(null);
  const [showOpenTabsModal, setShowOpenTabsModal] = React.useState(false);
  const [activeOrders, setActiveOrders] = React.useState<any[]>([]);
  const [dbWaiters, setDbWaiters] = React.useState<any[]>([]);
  const [selectedWaiter, setSelectedWaiter] = React.useState<any>(null);
  const [customerName, setCustomerName] = React.useState("");

  // Payment state
  const [showPaymentModal, setShowPaymentModal] = React.useState(false);
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>('cash');
  const [tipPercent, setTipPercent] = React.useState<number>(0);
  const [tipCustom, setTipCustom] = React.useState("");
  const [isProcessingPayment, setIsProcessingPayment] = React.useState(false);
  const [lastPaymentOrderId, setLastPaymentOrderId] = React.useState<string | null>(null);

  // Split payment state
  const [showSplitModal, setShowSplitModal] = React.useState(false);
  const [splitMethod, setSplitMethod] = React.useState<'equal' | 'items' | 'custom'>('equal');
  const [splitCount, setSplitCount] = React.useState(2);
  const [splitLabels, setSplitLabels] = React.useState<string[]>(['Persona 1', 'Persona 2']);
  const [splitAmounts, setSplitAmounts] = React.useState<number[]>([]);
  const [splitPaymentMethods, setSplitPaymentMethods] = React.useState<PaymentMethod[]>(['cash', 'card']);

  const handlePrintReceipt = (orderId: string) => {
    window.open(`/api/tenant/pos-orders/${orderId}/receipt`, '_blank', 'width=400,height=600');
  };

  const handleOpenSplit = () => {
    const baseTotal = subtotal + taxAmount - discount + deliveryCharge;
    setSplitCount(2);
    setSplitLabels(['Persona 1', 'Persona 2']);
    setSplitAmounts([baseTotal / 2, baseTotal / 2]);
    setSplitPaymentMethods(['cash', 'card']);
    setSplitMethod('equal');
    setShowSplitModal(true);
  };

  const handleSplitCountChange = (n: number) => {
    const clamped = Math.max(2, Math.min(10, n));
    setSplitCount(clamped);
    const baseTotal = subtotal + taxAmount - discount + deliveryCharge;
    const perPerson = baseTotal / clamped;
    setSplitAmounts(Array(clamped).fill(Math.round(perPerson * 100) / 100));
    setSplitLabels(Array.from({length: clamped}, (_, i) => `Persona ${i + 1}`));
    setSplitPaymentMethods(Array(clamped).fill('cash'));
  };

  const handleSplitAmountChange = (index: number, value: string) => {
    const newAmounts = [...splitAmounts];
    newAmounts[index] = Number(value) || 0;
    setSplitAmounts(newAmounts);
  };

  const handleSplitLabelChange = (index: number, value: string) => {
    const newLabels = [...splitLabels];
    newLabels[index] = value;
    setSplitLabels(newLabels);
  };

  const handleSplitMethodChange = (index: number, method: PaymentMethod) => {
    const newMethods = [...splitPaymentMethods];
    newMethods[index] = method;
    setSplitPaymentMethods(newMethods);
  };

  const handleApplySplit = async () => {
    const baseTotal = subtotal + taxAmount - discount + deliveryCharge;
    const totalSplit = splitAmounts.reduce((a, b) => a + b, 0);
    if (Math.abs(totalSplit - baseTotal) > 0.02) {
      alert(`La suma de los splits (${totalSplit.toFixed(2)}) no coincide con el total (${baseTotal.toFixed(2)})`);
      return;
    }

    // Save order first
    const orderRes = await fetch("/api/tenant/pos-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({
        id: editingOrderId,
        tenant_id: tenantId,
        table_number: orderType === 'dine_in' ? selectedTablePos : orderType === 'delivery' ? 'Llevar' : 'Para llevar',
        status: 'closed',
        total: subtotal,
        order_type: orderType,
        waiter_id: selectedWaiter?.id || null,
        customer_name: customerName || null,
        items: currentOrder.map(i => ({ menu_item_id: i.id, quantity: i.qty, price: i.price }))
      })
    });
    if (!orderRes.ok) { alert("Error al guardar orden"); return; }
    const orderData = await orderRes.json();
    const orderId = editingOrderId || orderData.id;

    // Process splits
    const splits = splitLabels.map((_, i) => ({
      label: splitLabels[i],
      amount: splitAmounts[i],
      tip: 0,
      payment_method: splitPaymentMethods[i] || 'cash'
    }));

    const splitRes = await fetch(`/api/tenant/pos-orders/${orderId}/split`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ splits })
    });

    if (!splitRes.ok) { alert("Error al dividir pago"); return; }

    setCurrentOrder([]);
    setEditingOrderId(null);
    setActiveCoupon(null);
    setLastPaymentOrderId(orderId);
    setShowSplitModal(false);
    refreshDashboard();
  };

  // Live data
  const [dbTaxes, setDbTaxes] = React.useState<any[]>([]);
  const [deliveryFee, setDeliveryFee] = React.useState(0);
  const [deliverySettings, setDeliverySettings] = React.useState<any>({ delivery_base_fee: 0, delivery_per_km_fee: 0, delivery_max_distance: 0 });
  const [activeShift, setActiveShift] = React.useState<any>(null);

  React.useEffect(() => {
    if (!tenantId) return;
    fetch(`/api/tenant/pos-orders?tenantId=${tenantId}`, { headers: { Authorization: `Bearer ${token}`} })
      .then(r => r.ok ? r.json() : [])
      .then(data => setActiveOrders(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [tenantId, token, showOpenTabsModal, showPaymentModal]);

  React.useEffect(() => {
    if (!tenantId) return;
    fetch(`/api/tenant/taxes/${tenantId}`, { headers: { Authorization: `Bearer ${token}`} })
      .then(r => r.ok ? r.json() : [])
      .then(data => setDbTaxes(Array.isArray(data) ? data : []))
      .catch(() => {});
    fetch(`/api/tenant/waiters/${tenantId}`, { headers: { Authorization: `Bearer ${token}`} })
      .then(r => r.ok ? r.json() : [])
      .then(data => setDbWaiters(Array.isArray(data) ? data : []))
      .catch(() => {});
    fetch(`/api/tenant/settings?tenantId=${tenantId}`, { headers: { Authorization: `Bearer ${token}`} })
      .then(r => r.ok ? r.json() : {})
      .then(data => {
        setDeliverySettings(data);
        const base = Number(data.delivery_base_fee || 0);
        const perKm = Number(data.delivery_per_km_fee || 0);
        const maxDist = Number(data.delivery_max_distance || 0);
        const dist = 5;
        const fee = base + (dist * perKm);
        setDeliveryFee(maxDist > 0 && dist > maxDist ? 0 : fee);
      })
      .catch(() => {});
    fetch(`/api/tenant/cash-drawer/${tenantId}/active`, { headers: { Authorization: `Bearer ${token}`} })
      .then(r => r.ok ? r.json() : null)
      .then(data => setActiveShift(data))
      .catch(() => {});
  }, [tenantId, token]);

  const handlePlaceOrder = async (status: string) => {
    if (currentOrder.length === 0) return;
    try {
      const subtotal = currentOrder.reduce((acc, i) => acc + (i.price * i.qty), 0);
      const res = await fetch("/api/tenant/pos-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          id: editingOrderId,
          tenant_id: tenantId,
          table_number: orderType === 'dine_in' ? selectedTablePos : orderType === 'delivery' ? 'Llevar' : 'Para llevar',
          status,
          total: subtotal,
          order_type: orderType,
          waiter_id: selectedWaiter?.id || null,
          customer_name: customerName || null,
          items: currentOrder.map(i => ({ menu_item_id: i.id, quantity: i.qty, price: i.price }))
        })
      });
      if (res.ok) {
         setCurrentOrder([]);
         setEditingOrderId(null);
         refreshDashboard();
         setShowPosCart(false);
      } else {
         alert("Error al enviar la orden al servidor.");
      }
    } catch (e) { alert("Excepción de red al guardar orden."); }
  };

  const handleOpenPayment = () => {
    if (currentOrder.length === 0) return;
    setPaymentMethod('cash');
    setTipPercent(0);
    setTipCustom("");
    setShowPaymentModal(true);
  };

  const handleProcessPayment = async () => {
    setIsProcessingPayment(true);
    try {
      const subtotal = currentOrder.reduce((acc, i) => acc + (i.price * i.qty), 0);
      const tipValue = tipPercent > 0 ? (subtotal * tipPercent) / 100 : (Number(tipCustom) || 0);
      const activeTax = dbTaxes.find((t: any) => t.status === 'Active');
      const taxAmount = activeTax ? (subtotal * activeTax.tax_rate) / 100 : 0;
      const discount = activeCoupon ? activeCoupon.discount_amount : 0;
      const deliveryCharge = orderType === 'delivery' ? deliveryFee : 0;
      const total = Math.max(0, subtotal + taxAmount - discount + deliveryCharge + tipValue);

      // Save order first
      const orderRes = await fetch("/api/tenant/pos-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({
          id: editingOrderId,
          tenant_id: tenantId,
          table_number: orderType === 'dine_in' ? selectedTablePos : orderType === 'delivery' ? 'Llevar' : 'Para llevar',
          status: 'closed',
          total: subtotal,
          order_type: orderType,
          payment_method: paymentMethod,
          payment_status: 'paid',
          tip: tipValue,
          tax_amount: taxAmount,
          discount_amount: discount,
          waiter_id: selectedWaiter?.id || null,
          customer_name: customerName || null,
          items: currentOrder.map(i => ({ menu_item_id: i.id, quantity: i.qty, price: i.price }))
        })
      });
      if (!orderRes.ok) { alert("Error al guardar orden"); setIsProcessingPayment(false); return; }
      const orderData = await orderRes.json();
      const orderId = editingOrderId || orderData.id;

      // Process payment
      const payRes = await fetch(`/api/tenant/pos-orders/${orderId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ payment_method: paymentMethod, amount: subtotal + taxAmount - discount + deliveryCharge, tip: tipValue, tax_amount: taxAmount, discount_amount: discount })
      });
      if (!payRes.ok) { alert("Error al procesar pago"); setIsProcessingPayment(false); return; }

      setCurrentOrder([]);
      setEditingOrderId(null);
      setActiveCoupon(null);
      setCouponInput("");
      setCouponSuccess("");
      setLastPaymentOrderId(orderData.id || orderId);
      refreshDashboard();
      // Don't close payment modal immediately - show success
    } catch (e) { alert("Error al procesar pago"); }
    finally { setIsProcessingPayment(false); }
  };

  const handleReceiptDone = () => {
    setLastPaymentOrderId(null);
    setShowPaymentModal(false);
    setShowPosCart(false);
  };

  const handleVoidOrder = async () => {
    if (!editingOrderId) return;
    if (!window.confirm("¿Anular esta orden? Se eliminará de cocina.")) return;
    await fetch(`/api/tenant/pos-orders/${editingOrderId}/void`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason: "Anulado por usuario" })
    });
    setEditingOrderId(null);
    setCurrentOrder([]);
    refreshDashboard();
  };

  const handleValidateCoupon = async () => {
    if (!couponInput.trim()) return;
    setCouponError("");
    setCouponSuccess("");
    const subtotal = currentOrder.reduce((acc, i) => acc + (i.price * i.qty), 0);
    try {
      const res = await fetch("/api/tenant/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenant_id: tenantId, code: couponInput.trim(), subtotal })
      });
      const data = await res.json();
      if (data.valid) {
        setActiveCoupon(data);
        setCouponSuccess(`Cupón aplicado: -${currencySymbol}${data.discount_amount.toFixed(2)}`);
      } else {
        setActiveCoupon(null);
        setCouponError(data.error || "Cupón inválido");
      }
    } catch (e) { setCouponError("Error al validar cupón"); }
  };

  const dbTables = tables;

  const subtotal = currentOrder.reduce((acc, i) => acc + (i.price * i.qty), 0);
  const activeTax = dbTaxes.find((t: any) => t.status === 'Active');
  const taxAmount = activeTax ? (subtotal * activeTax.tax_rate) / 100 : 0;
  const discount = activeCoupon ? activeCoupon.discount_amount : 0;
  const deliveryCharge = orderType === 'delivery' ? deliveryFee : 0;
  const tipValue = tipPercent > 0 ? (subtotal * tipPercent) / 100 : (Number(tipCustom) || 0);
  const total = Math.max(0, subtotal + taxAmount - discount + deliveryCharge);

  const handleConfirmAddModal = () => {
    if (!selectedItemForModal) return;
    const addonTotal = Object.keys(selectedAddons).reduce((acc, key) => acc + (selectedAddons[key] * 1.50), 0);
    const itemUnitPrice = selectedItemForModal.price + (selectedSize === 'Big' ? 1.00 : 0) + addonTotal;
    const cartItem = {
      ...selectedItemForModal,
      name: `${selectedItemForModal.name} (${selectedSize})${Object.keys(selectedAddons).some(k => selectedAddons[k] > 0) ? ' + Addons' : ''}`,
      price: itemUnitPrice,
      qty: modalQuantity,
      instructions: specialInstructions
    };
    setCurrentOrder(prev => {
      const existing = prev.find(i => i.id === cartItem.id && i.name === cartItem.name);
      if (existing) {
        return prev.map(i => (i.id === cartItem.id && i.name === cartItem.name) ? { ...i, qty: i.qty + modalQuantity } : i);
      }
      return [...prev, cartItem];
    });
    setSelectedItemForModal(null);
  };

  const handleAddToOrder = (item: any) => {
    setSelectedItemForModal(item);
    setModalQuantity(1);
    setSelectedSize("Standard");
    setSelectedAddons({});
    setSpecialInstructions("");
  };

  const renderCartContent = (isPersistent = false) => (
    <div className="w-full h-full flex flex-col bg-white">
       {!isPersistent && (
         <div className="p-4 border-b border-slate-100 flex justify-between items-center lg:hidden">
           <span className="text-xs font-black text-slate-800">CARRITO</span>
           <button onClick={() => setShowPosCart(false)} className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
             <X className="w-4 h-4" />
           </button>
         </div>
       )}

       <div className="p-5 space-y-4 flex-1 overflow-y-auto">
         <div className="flex gap-2">
            <div className="relative flex-1">
               <input type="text" placeholder="Nombre del cliente" value={customerName} onChange={e => setCustomerName(e.target.value)}
                 className="w-full h-11 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-[#e91e63]" />
            </div>
         </div>

         <div className="p-4 border border-slate-100 rounded-2xl bg-white space-y-4 shadow-sm">
            <span className="text-xs font-black text-slate-800 tracking-wide block">Tipo de Orden</span>
            <div className="flex gap-2">
               <button type="button" onClick={() => setOrderType('dine_in')}
                 className={`flex-1 h-9 rounded-full text-[11px] font-black uppercase tracking-wider transition-all border flex items-center justify-center gap-1.5 active:scale-95 ${orderType === 'dine_in' ? 'bg-pink-50 border-[#e91e63] text-[#e91e63]' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                 Dine-In
               </button>
               <button type="button" onClick={() => setOrderType('takeaway')}
                 className={`flex-1 h-9 rounded-full text-[11px] font-black uppercase tracking-wider transition-all border flex items-center justify-center gap-1.5 active:scale-95 ${orderType === 'takeaway' ? 'bg-pink-50 border-[#e91e63] text-[#e91e63]' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                 Takeaway
               </button>
               <button type="button" onClick={() => setOrderType('delivery')}
                 className={`flex-1 h-9 rounded-full text-[11px] font-black uppercase tracking-wider transition-all border flex items-center justify-center gap-1.5 active:scale-95 ${orderType === 'delivery' ? 'bg-pink-50 border-[#e91e63] text-[#e91e63]' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                 Delivery
               </button>
            </div>

            {orderType === 'dine_in' && (
              <div className="relative animate-fade-in">
                 <select value={selectedTablePos} onChange={(e) => setSelectedTablePos(e.target.value)}
                   className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-[#e91e63] appearance-none">
                   <option value="">Select Table</option>
                   {dbTables.map(t => <option key={t.id} value={t.table_number}>Mesa #{t.table_number}</option>)}
                 </select>
                 <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                   <ChevronDown className="w-4 h-4" />
                 </div>
              </div>
            )}
         </div>

         <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm bg-white">
            <div className="grid grid-cols-3 bg-[#fdf2f8] px-4 py-2.5 text-[10px] font-black text-slate-500 uppercase tracking-wider">
               <span>Item</span>
               <span className="text-center">Qty</span>
               <span className="text-right">Price</span>
            </div>
            <div className="divide-y divide-slate-100 max-h-[180px] overflow-y-auto">
               {currentOrder.length === 0 ? (
                  <div className="p-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white">Carrito vacío</div>
               ) : (
                  currentOrder.map((item, idx) => (
                     <div key={idx} className="grid grid-cols-3 items-center px-4 py-3 bg-white">
                        <span className="text-xs font-bold text-slate-800 truncate">{item.name}</span>
                        <div className="flex items-center justify-center gap-2">
                           <button type="button" onClick={() => setCurrentOrder(prev => {
                             if(item.qty === 1) return prev.filter(i => i.id !== item.id);
                             return prev.map(i => i.id === item.id ? {...i, qty: i.qty - 1} : i);
                           })} className="w-4 h-4 rounded bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 text-[10px] font-black">-</button>
                           <span className="text-xs font-black text-slate-800 w-4 text-center">{item.qty}</span>
                           <button type="button" onClick={() => setCurrentOrder(prev => prev.map(i => i.id === item.id ? {...i, qty: i.qty + 1} : i))} className="w-4 h-4 rounded bg-[#e91e63] text-white flex items-center justify-center text-[10px] font-black">+</button>
                        </div>
                        <span className="text-xs font-black text-slate-800 text-right">{currencySymbol}{(item.price * item.qty).toFixed(2)}</span>
                     </div>
                  ))
               )}
            </div>
         </div>

         {dbWaiters.filter(w => w.status === 'Active').length > 0 && (
           <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Mesero</label>
              <select value={selectedWaiter?.id || ''} onChange={e => { const w = dbWaiters.find(x => x.id === e.target.value); setSelectedWaiter(w || null); }}
                className="w-full h-9 px-3 bg-white text-slate-700 rounded-lg text-xs font-bold focus:outline-none focus:border-[#e91e63] border border-slate-200">
                <option value="">-- Selecciona --</option>
                {dbWaiters.filter(w => w.status === 'Active').map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
           </div>
         )}

         {currentOrder.length > 0 && (
           <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cupón de descuento</label>
              <div className="flex gap-2">
                <input type="text" placeholder="Código" value={couponInput} onChange={e => { setCouponInput(e.target.value); setCouponError(""); setCouponSuccess(""); setActiveCoupon(null); }}
                  className="flex-1 h-9 px-3 rounded-lg border border-slate-200 text-xs font-bold focus:outline-none focus:border-[#e91e63]" />
                <button onClick={handleValidateCoupon} disabled={!couponInput.trim()}
                  className="h-9 px-3 bg-[#e91e63] text-white rounded-lg text-[10px] font-black disabled:opacity-50">Aplicar</button>
              </div>
              {couponError && <p className="text-[10px] text-red-500 font-bold">{couponError}</p>}
              {couponSuccess && <p className="text-[10px] text-[#109e38] font-bold">{couponSuccess}</p>}
           </div>
         )}
       </div>

       <div className="p-5 border-t border-slate-100 bg-white space-y-4">
          <div className="space-y-2.5">
             <div className="flex justify-between text-xs font-bold text-slate-600">
                <span>Sub Total</span>
                <span>{currencySymbol}{subtotal.toFixed(2)}</span>
             </div>
             {taxAmount > 0 && (
               <div className="flex justify-between text-xs font-bold text-slate-600">
                  <span>{activeTax?.name || 'IVA'} ({activeTax?.tax_rate}%)</span>
                  <span>+{currencySymbol}{taxAmount.toFixed(2)}</span>
               </div>
             )}
             {discount > 0 && (
               <div className="flex justify-between text-xs font-bold text-green-600">
                  <span>Descuento</span>
                  <span>-{currencySymbol}{discount.toFixed(2)}</span>
               </div>
             )}
             {orderType === 'delivery' && deliveryFee > 0 && (
               <div className="flex justify-between text-xs font-bold text-slate-600">
                  <span>Delivery Fee</span>
                  <span>+{currencySymbol}{deliveryFee.toFixed(2)}</span>
               </div>
             )}
             <div className="flex justify-between text-base font-black text-slate-900 border-t border-dashed border-slate-200 pt-2.5">
                <span>Total</span>
                <span>{currencySymbol}{(subtotal + taxAmount - discount + deliveryCharge).toFixed(2)}</span>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
             {editingOrderId && (
               <button onClick={handleVoidOrder} className="w-full h-12 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm">
                  ANULAR
               </button>
             )}
             <button onClick={() => handlePlaceOrder('open')} disabled={currentOrder.length === 0}
               className="w-full h-12 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm">
               {editingOrderId ? 'ACTUALIZAR' : 'GUARDAR'}
             </button>
             <button onClick={handleOpenPayment} disabled={currentOrder.length === 0}
               className="w-full h-12 disabled:opacity-50 text-white rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm bg-[#109e38] hover:bg-[#0d842e]">
               <DollarSign className="w-4 h-4" /> COBRAR
             </button>
          </div>
       </div>
    </div>
  );

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-[#f5f6fa] relative">
       <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          <div className="p-5 bg-transparent shrink-0 space-y-5">
            <div className="flex justify-between items-center gap-4">
              <button onClick={() => setActiveTab('dashboard')} className="h-11 px-4 bg-white border border-slate-200 text-slate-600 rounded-xl flex items-center justify-center shadow-sm hover:bg-slate-50 transition-all font-bold text-sm gap-2 shrink-0 active:scale-95">
                <ArrowLeft className="w-4 h-4" /> Volver
              </button>
              <div className="flex items-center gap-4 flex-1 max-w-4xl bg-white rounded-xl border border-slate-100 pr-1 overflow-hidden shadow-sm">
                <input type="text" placeholder="Search by Menu Item" className="flex-1 h-11 px-4 bg-transparent text-sm focus:outline-none font-medium placeholder-slate-400" />
                <button type="button" className="w-10 h-10 rounded-lg bg-[#e91e63] hover:bg-[#d81b60] text-white flex items-center justify-center shrink-0 active:scale-95 transition-all">
                   <Search className="w-4 h-4 font-black" />
                </button>
              </div>
              <button onClick={() => setShowOpenTabsModal(true)} className="h-11 px-4 bg-orange-50 border border-orange-200 text-orange-600 rounded-xl flex items-center justify-center shadow-sm hover:bg-orange-100 transition-all font-black text-sm gap-2 shrink-0 active:scale-95 relative">
                🧾 Cuentas Abiertas
                {activeOrders.length > 0 && <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">{activeOrders.length}</span>}
              </button>
              {!activeShift && (
                <button onClick={() => setActiveTab('delivery')} className="h-11 px-4 bg-amber-50 border border-amber-200 text-amber-600 rounded-xl flex items-center justify-center shadow-sm hover:bg-amber-100 transition-all font-black text-sm gap-2 shrink-0 active:scale-95">
                  🔓 Abrir Caja
                </button>
              )}
            </div>

            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">
              <button onClick={() => setPosCategoryFilter("all")}
                className={`h-20 w-24 shrink-0 rounded-2xl flex flex-col items-center justify-center gap-2 border transition-all active:scale-95 ${posCategoryFilter === 'all' ? 'bg-[#ebf0fa] border-[#ebf0fa] text-[#e91e63] shadow-sm border-b-4 border-b-[#e91e63]' : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50 shadow-sm'}`}>
                <span className="text-xl">🍲</span>
                <span className="text-[10px] font-black tracking-wide uppercase">All</span>
              </button>
              {categories.map((cat: any) => (
                <button key={cat.id} onClick={() => setPosCategoryFilter(cat.id)}
                  className={`h-20 w-24 shrink-0 rounded-2xl flex flex-col items-center justify-center gap-2 border transition-all active:scale-95 ${posCategoryFilter === cat.id ? 'bg-[#ebf0fa] border-[#ebf0fa] text-[#e91e63] shadow-sm border-b-4 border-b-[#e91e63]' : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50 shadow-sm'}`}>
                  <span className="text-xl">{cat.icon || '🍔'}</span>
                  <span className="text-[10px] font-black tracking-wide uppercase truncate max-w-[80px]">{cat.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-24">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 xxl:grid-cols-5 gap-5">
              {menuItems.filter((item: any) => item.is_available && (posCategoryFilter === 'all' || item.category_id === posCategoryFilter)).map((item: any) => (
                <div key={item.id} onClick={() => handleAddToOrder(item)}
                  className="bg-white rounded-[24px] border border-slate-100 shadow-sm p-3.5 flex flex-col text-left hover:shadow-md transition-all group overflow-hidden cursor-pointer active:scale-[0.98]">
                  <div className="relative h-36 mb-3 rounded-[18px] overflow-hidden shrink-0 w-full bg-slate-50">
                    <img src={item.image_url?.split(',')[0]} referrerPolicy="no-referrer" alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  <div className="font-black text-slate-800 text-xs mb-1 line-clamp-1">{item.name}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">{categories.find((c: any) => c.id === item.category_id)?.name || 'Extra'}</div>
                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-50">
                    <div className="font-black text-slate-800 text-xs">{currencySymbol}{item.price}</div>
                    <button onClick={() => handleAddToOrder(item)} className="px-3.5 h-8 bg-pink-50 hover:bg-pink-100 text-[#e91e63] rounded-xl font-bold text-[10px] flex items-center justify-center gap-1 transition-all active:scale-95">
                      <ShoppingBag className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
       </div>

       <div className="hidden lg:flex w-[350px] shrink-0 border-l border-slate-200 bg-white flex-col h-full relative shadow-sm">
          {renderCartContent(true)}
       </div>

       {/* Item Modal */}
       {selectedItemForModal && (
         <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl p-6 relative overflow-hidden flex flex-col max-h-[90vh]">
               <button onClick={() => setSelectedItemForModal(null)} className="absolute right-5 top-5 w-7 h-7 rounded-full bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-all shadow-sm active:scale-95">
                  <X className="w-4 h-4 font-black" />
               </button>
               <div className="flex gap-4 border-b border-slate-100 pb-4">
                  <img src={selectedItemForModal.image_url?.split(',')[0]} className="w-20 h-20 rounded-2xl object-cover shrink-0 bg-slate-50" />
                  <div className="flex-1 min-w-0 pr-6">
                     <h3 className="text-sm font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">{selectedItemForModal.name}</h3>
                     <p className="text-xs font-black text-slate-800 mt-2">{currencySymbol}{selectedItemForModal.price.toFixed(2)}</p>
                  </div>
               </div>
               <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                     <span className="text-xs font-black text-slate-800">Quantity:</span>
                     <div className="flex items-center gap-3 bg-slate-50 p-1 rounded-xl border border-slate-100 shrink-0">
                        <button type="button" onClick={() => setModalQuantity(prev => Math.max(1, prev - 1))} className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 font-bold">-</button>
                        <span className="text-xs font-black text-slate-800 w-4 text-center">{modalQuantity}</span>
                        <button type="button" onClick={() => setModalQuantity(prev => prev + 1)} className="w-6 h-6 rounded-lg bg-[#e91e63] text-white flex items-center justify-center hover:bg-[#d81b60] font-bold">+</button>
                     </div>
                  </div>
                  <div className="pb-3 border-b border-slate-100 space-y-2.5">
                     <span className="text-xs font-black text-slate-800 block">Size</span>
                     <div className="grid grid-cols-2 gap-3">
                        <button type="button" onClick={() => setSelectedSize("Regular")} className={`p-3 rounded-2xl border flex flex-col text-left transition-all active:scale-95 ${selectedSize === 'Regular' ? 'bg-pink-50 border-[#e91e63] text-[#e91e63]' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                           <span className="text-xs font-black flex items-center gap-2">Regular</span>
                        </button>
                        <button type="button" onClick={() => setSelectedSize("Big")} className={`p-3 rounded-2xl border flex flex-col text-left transition-all active:scale-95 ${selectedSize === 'Big' ? 'bg-pink-50 border-[#e91e63] text-[#e91e63]' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                           <span className="text-xs font-black flex items-center gap-2">Big</span>
                           <span className="text-[10px] text-slate-400 font-bold mt-1">+{currencySymbol}1.00</span>
                        </button>
                     </div>
                  </div>
               </div>
               <div className="pt-4 border-t border-slate-100 bg-white">
                  <button onClick={handleConfirmAddModal}
                    className="w-full h-12 bg-[#e91e63] hover:bg-[#d81b60] text-white rounded-full font-black text-xs uppercase tracking-widest shadow-lg shadow-[#e91e63]/10 transition-all flex items-center justify-center gap-2 active:scale-95">
                    Add to Cart - {currencySymbol}{((selectedItemForModal.price + (selectedSize === 'Big' ? 1.00 : 0)) * modalQuantity).toFixed(2)}
                  </button>
               </div>
            </div>
         </div>
       )}

       {/* Payment Modal */}
       <AnimatePresence>
         {showPaymentModal && (
           <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                 <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-black text-slate-800 flex items-center gap-2"><CreditCard className="w-5 h-5 text-[#109e38]" /> COBRAR</h3>
                    <button onClick={() => setShowPaymentModal(false)} className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 flex items-center justify-center transition-all"><X className="w-4 h-4" /></button>
                 </div>

                 <div className="p-6 space-y-6 overflow-y-auto">
                    {/* Order Summary */}
                    <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                       {currentOrder.map((item, i) => (
                         <div key={i} className="flex justify-between text-xs">
                            <span className="text-slate-600">{item.qty}x {item.name}</span>
                            <span className="font-bold text-slate-800">{currencySymbol}{(item.price * item.qty).toFixed(2)}</span>
                         </div>
                       ))}
                       <div className="border-t border-slate-200 pt-2 mt-2 space-y-1">
                          <div className="flex justify-between text-xs text-slate-500"><span>Subtotal</span><span>{currencySymbol}{subtotal.toFixed(2)}</span></div>
                          {taxAmount > 0 && <div className="flex justify-between text-xs text-slate-500"><span>Impuesto</span><span>{currencySymbol}{taxAmount.toFixed(2)}</span></div>}
                          {discount > 0 && <div className="flex justify-between text-xs text-green-600"><span>Descuento</span><span>-{currencySymbol}{discount.toFixed(2)}</span></div>}
                          {deliveryCharge > 0 && <div className="flex justify-between text-xs text-slate-500"><span>Delivery</span><span>{currencySymbol}{deliveryCharge.toFixed(2)}</span></div>}
                          <div className="flex justify-between text-sm font-black text-slate-900 border-t border-dashed border-slate-200 pt-2 mt-2">
                             <span>Total</span>
                             <span>{currencySymbol}{(subtotal + taxAmount - discount + deliveryCharge).toFixed(2)}</span>
                          </div>
                       </div>
                    </div>

                    {/* Tip Selection */}
                    <div className="space-y-3">
                       <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">Propina</span>
                       <div className="flex gap-2 flex-wrap">
                          {TIP_PRESETS.map(pct => (
                            <button key={pct} onClick={() => { setTipPercent(pct); setTipCustom(""); }}
                              className={`h-9 px-4 rounded-xl text-[11px] font-black uppercase transition-all border ${tipPercent === pct ? 'bg-pink-50 border-[#e91e63] text-[#e91e63]' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                              {pct === 0 ? 'Sin' : `${pct}%`}
                            </button>
                          ))}
                       </div>
                       {tipPercent > 0 && (
                         <div className="text-xs font-bold text-slate-600">
                            Propina: {currencySymbol}{(subtotal * tipPercent / 100).toFixed(2)}
                         </div>
                       )}
                       <div className="relative">
                          <input type="number" placeholder="Propina personalizada" value={tipCustom} onChange={e => { setTipCustom(e.target.value); setTipPercent(0); }}
                            className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm font-bold focus:outline-none focus:border-[#109e38]" />
                       </div>
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-3">
                       <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">Método de Pago</span>
                       <div className="grid grid-cols-3 gap-3">
                          <button onClick={() => setPaymentMethod('cash')}
                            className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all active:scale-95 ${paymentMethod === 'cash' ? 'bg-green-50 border-[#109e38] text-[#109e38]' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                             <DollarSign className="w-6 h-6" />
                             <span className="text-[10px] font-black uppercase">Efectivo</span>
                          </button>
                          <button onClick={() => setPaymentMethod('card')}
                            className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all active:scale-95 ${paymentMethod === 'card' ? 'bg-blue-50 border-blue-500 text-blue-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                             <CreditCard className="w-6 h-6" />
                             <span className="text-[10px] font-black uppercase">Tarjeta</span>
                          </button>
                          <button onClick={() => setPaymentMethod('transfer')}
                            className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all active:scale-95 ${paymentMethod === 'transfer' ? 'bg-purple-50 border-purple-500 text-purple-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                             <Smartphone className="w-6 h-6" />
                             <span className="text-[10px] font-black uppercase">Transfer.</span>
                          </button>
                       </div>
                    </div>

                    {/* Split Payment Button */}
                    <button onClick={handleOpenSplit}
                      className="w-full h-11 bg-white border-2 border-dashed border-slate-300 hover:border-[#e91e63] hover:text-[#e91e63] text-slate-500 rounded-2xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95">
                      <Users className="w-4 h-4" /> DIVIDIR CUENTA
                    </button>

                    {/* Grand Total with Tip */}
                    <div className="bg-slate-900 text-white rounded-2xl p-5 text-center">
                       <div className="text-[10px] font-bold uppercase tracking-widest opacity-70">Total a Cobrar</div>
                       <div className="text-3xl font-black mt-1">{currencySymbol}{(subtotal + taxAmount - discount + deliveryCharge + tipValue).toFixed(2)}</div>
                       {tipValue > 0 && <div className="text-xs opacity-70 mt-1">Incluye propina de {currencySymbol}{tipValue.toFixed(2)}</div>}
                    </div>
                 </div>

                 <div className="p-6 border-t border-slate-100 bg-white">
                    {lastPaymentOrderId ? (
                      <div className="space-y-3">
                        <div className="text-center text-green-600 font-bold text-sm mb-2">✅ Pago procesado exitosamente</div>
                        <button onClick={() => handlePrintReceipt(lastPaymentOrderId)}
                          className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2">
                          <Printer className="w-4 h-4" /> IMPRIMIR RECIBO
                        </button>
                        <button onClick={handleReceiptDone}
                          className="w-full h-12 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold text-xs uppercase tracking-wider">
                          CERRAR
                        </button>
                      </div>
                    ) : (
                    <button onClick={handleProcessPayment} disabled={isProcessingPayment}
                      className="w-full h-14 bg-[#109e38] hover:bg-[#0d842e] disabled:opacity-50 text-white rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg shadow-[#109e38]/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
                      {isProcessingPayment ? 'PROCESANDO...' : `✅ COBRAR ${currencySymbol}${(subtotal + taxAmount - discount + deliveryCharge + tipValue).toFixed(2)}`}
                    </button>
                    )}
                 </div>
              </motion.div>
           </div>
         )}
       </AnimatePresence>

       {/* Split Payment Modal */}
       <AnimatePresence>
         {showSplitModal && (
           <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                 <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-black text-slate-800 flex items-center gap-2"><Users className="w-5 h-5 text-[#e91e63]" /> DIVIDIR CUENTA</h3>
                    <button onClick={() => setShowSplitModal(false)} className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 flex items-center justify-center transition-all"><X className="w-4 h-4" /></button>
                 </div>

                 <div className="p-6 space-y-6 overflow-y-auto">
                    <div className="bg-slate-50 rounded-2xl p-4">
                       <div className="flex justify-between text-sm mb-2">
                          <span className="font-bold text-slate-600">Total a dividir:</span>
                          <span className="font-black text-slate-900">{currencySymbol}{(subtotal + taxAmount - discount + deliveryCharge).toFixed(2)}</span>
                       </div>
                    </div>

                    {/* Number of splits */}
                    <div className="space-y-2">
                       <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Número de personas</span>
                       <div className="flex gap-2">
                         {[2, 3, 4, 5, 6].map(n => (
                           <button key={n} onClick={() => handleSplitCountChange(n)}
                             className={`w-12 h-12 rounded-2xl text-sm font-black transition-all border ${splitCount === n ? 'bg-pink-50 border-[#e91e63] text-[#e91e63]' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                             {n}
                           </button>
                         ))}
                       </div>
                    </div>

                    {/* Split rows */}
                    <div className="space-y-4">
                       {splitLabels.map((label, i) => {
                         const baseTotal = subtotal + taxAmount - discount + deliveryCharge;
                         return (
                           <div key={i} className="p-4 bg-white border border-slate-100 rounded-2xl space-y-3">
                              <div className="flex justify-between items-center">
                                 <input type="text" value={splitLabels[i]} onChange={e => handleSplitLabelChange(i, e.target.value)}
                                   className="font-bold text-sm text-slate-800 bg-transparent border-b border-transparent focus:border-[#e91e63] focus:outline-none" />
                                 <div className="flex gap-1">
                                   {(['cash', 'card', 'transfer'] as PaymentMethod[]).map(m => (
                                     <button key={m} onClick={() => handleSplitMethodChange(i, m)}
                                       className={`w-7 h-7 rounded-lg text-[9px] font-black uppercase transition-all ${splitPaymentMethods[i] === m ? (m === 'cash' ? 'bg-green-100 text-green-700' : m === 'card' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700') : 'bg-slate-100 text-slate-400'}`}>
                                       {m === 'cash' ? '$' : m === 'card' ? '💳' : '📱'}
                                     </button>
                                   ))}
                                 </div>
                              </div>
                              <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-bold text-sm">{currencySymbol}</div>
                                <input type="number" step="0.01" value={splitAmounts[i]} onChange={e => handleSplitAmountChange(i, e.target.value)}
                                  className="w-full h-11 pl-8 pr-4 rounded-xl bg-slate-50 border-2 border-slate-100 text-slate-900 font-bold focus:bg-white focus:border-[#e91e63] transition-all outline-none" />
                              </div>
                           </div>
                         );
                       })}

                       {/* Auto-balance */}
                       {(() => {
                         const baseTotal = subtotal + taxAmount - discount + deliveryCharge;
                         const totalSplit = splitAmounts.reduce((a, b) => a + b, 0);
                         const diff = Math.round((baseTotal - totalSplit) * 100) / 100;
                         if (Math.abs(diff) > 0.01) {
                           return (
                             <div className="flex justify-between items-center p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                <span className="text-xs font-bold text-amber-700">Diferencia: {currencySymbol}{diff.toFixed(2)}</span>
                                <button onClick={() => {
                                  const newAmounts = [...splitAmounts];
                                  newAmounts[newAmounts.length - 1] = Math.round((newAmounts[newAmounts.length - 1] + diff) * 100) / 100;
                                  setSplitAmounts(newAmounts);
                                }} className="h-8 px-3 bg-amber-500 text-white rounded-lg text-[10px] font-black">
                                  Ajustar última
                                </button>
                             </div>
                           );
                         }
                         return null;
                       })()}
                    </div>

                    {/* Summary */}
                    <div className="bg-slate-900 text-white rounded-2xl p-4 text-center">
                       <div className="text-[10px] font-bold uppercase tracking-widest opacity-70">Total Dividido</div>
                       <div className="text-2xl font-black mt-1">{currencySymbol}{splitAmounts.reduce((a, b) => a + b, 0).toFixed(2)}</div>
                       <div className="text-xs opacity-70 mt-1">{splitCount} personas • {splitPaymentMethods.filter(m => m === 'cash').length} efectivo, {splitPaymentMethods.filter(m => m === 'card').length} tarjeta, {splitPaymentMethods.filter(m => m === 'transfer').length} transferencia</div>
                    </div>
                 </div>

                 <div className="p-6 border-t border-slate-100 bg-white">
                    <button onClick={handleApplySplit}
                      className="w-full h-13 bg-[#e91e63] hover:bg-[#d81b60] text-white rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
                      ✅ CONFIRMAR DIVISIÓN — {currencySymbol}{splitAmounts.reduce((a, b) => a + b, 0).toFixed(2)}
                    </button>
                 </div>
              </motion.div>
           </div>
         )}
       </AnimatePresence>

       {/* Mobile Floating Cart */}
       <AnimatePresence>
         {currentOrder.length > 0 && !showPaymentModal && (
           <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
             className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] lg:hidden">
              <button onClick={() => setShowPosCart(true)}
                className="h-14 px-6 rounded-full bg-[#e91e63] text-white shadow-2xl flex items-center gap-3 min-w-[180px] shadow-[#e91e63]/30 active:scale-95 transition-transform">
                 <div className="relative">
                    <ShoppingBag className="w-5 h-5" />
                    <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-white text-[#e91e63] text-[9px] font-black flex items-center justify-center border border-[#e91e63]">{currentOrder.reduce((acc, i) => acc + i.qty, 0)}</span>
                 </div>
                 <div className="h-6 w-px bg-white/20 mx-1"></div>
                 <div className="text-left">
                    <div className="text-[9px] font-black uppercase tracking-widest opacity-80 leading-none">Total</div>
                    <div className="text-base font-black">{currencySymbol}{(subtotal + taxAmount - discount + deliveryCharge).toFixed(2)}</div>
                 </div>
              </button>
           </motion.div>
         )}
       </AnimatePresence>

       <AnimatePresence>
         {showPosCart && (
           <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-end lg:hidden">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowPosCart(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
              <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col">
                {renderCartContent(false)}
              </motion.div>
           </div>
         )}
       </AnimatePresence>

       {/* Open Tabs Modal */}
       <AnimatePresence>
         {showOpenTabsModal && (
           <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                 <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50">
                   <h3 className="font-black text-slate-800 flex items-center gap-2"><UtensilsCrossed className="w-5 h-5 text-orange-500" /> Cuentas Abiertas</h3>
                   <button onClick={() => setShowOpenTabsModal(false)} className="w-8 h-8 rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 flex items-center justify-center transition-all shadow-sm active:scale-95"><X className="w-4 h-4 font-black" /></button>
                 </div>
                 <div className="flex-1 overflow-y-auto p-5 bg-slate-50">
                   {activeOrders.length === 0 ? (
                     <div className="text-center py-10">
                       <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm"><Receipt className="w-8 h-8 text-slate-300" /></div>
                       <h4 className="text-sm font-bold text-slate-600">No hay cuentas abiertas</h4>
                     </div>
                   ) : (
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       {activeOrders.map((order: any) => (
                         <button key={order.id} onClick={async () => {
                           try {
                             const res = await fetch(`/api/tenant/pos-orders/${order.id}`);
                             const data = await res.json();
                             setEditingOrderId(order.id);
                             setSelectedTablePos(order.table_number || "");
                             setOrderType(order.order_type || order.table_number === 'Llevar' || order.table_number === 'Delivery' ? 'delivery' : 'dine_in');
                             setCurrentOrder(data.items.map((i: any) => ({ id: i.menu_item_id, name: i.menu_item_name || 'Producto', price: i.price, qty: i.quantity, image_url: i.image_url })));
                             setShowOpenTabsModal(false);
                           } catch(e) { console.error(e); }
                         }} className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col text-left hover:border-orange-500 hover:shadow-md transition-all group">
                           <div className="flex justify-between items-start mb-2">
                             <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-100 px-2 py-1 rounded">Mesa {order.table_number || 'S/N'}</span>
                             <span className="text-xs font-black text-slate-800">{currencySymbol}{order.total?.toFixed(2)}</span>
                           </div>
                           <div className="text-xs font-bold text-slate-600 mb-1">{order.item_count} Productos</div>
                           <div className="text-[10px] text-slate-400 mt-auto pt-2 border-t border-slate-50">{new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                         </button>
                       ))}
                     </div>
                   )}
                 </div>
              </motion.div>
           </div>
         )}
       </AnimatePresence>
    </div>
  );
};