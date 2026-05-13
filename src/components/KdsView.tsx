import React, { useState, useRef, useEffect } from "react";
import { Utensils, Globe, ShoppingBag, Search, Menu, X, ClipboardList, Volume2, LayoutGrid } from "lucide-react";

interface KdsViewProps {
  token: string;
  kitchenOrders: any[];
  onRefreshNeeded: () => void;
  setIsSidebarOpen?: (v: boolean) => void;
  onBack?: () => void;
}

export default function KdsView({ token, kitchenOrders, onRefreshNeeded, setIsSidebarOpen, onBack }: KdsViewProps) {
  const [kdsFilter, setKdsFilter] = useState("all");
  const [kdsSearch, setKdsSearch] = useState("");
  const [showItemsBoard, setShowItemsBoard] = useState(false);
  const [mobileTab, setMobileTab] = useState<"dine" | "online" | "takeaway">("dine");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const prevOrderCountRef = useRef(kitchenOrders.length);

  // 🔔 Audio alert when new orders arrive
  useEffect(() => {
    const pendingCount = kitchenOrders.filter(o => o.status === "Pending").length;
    const prevCount = prevOrderCountRef.current;
    
    if (pendingCount > prevCount && soundEnabled) {
      try {
        // Use Web Audio API for a reliable notification sound
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const playTone = (freq: number, start: number, dur: number) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq;
          osc.type = "sine";
          gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
          osc.start(ctx.currentTime + start);
          osc.stop(ctx.currentTime + start + dur);
        };
        playTone(880, 0, 0.15);   // A5
        playTone(1100, 0.15, 0.15); // C#6
        playTone(1320, 0.3, 0.3);  // E6
      } catch (e) { /* AudioContext not available */ }
    }
    prevOrderCountRef.current = pendingCount;
  }, [kitchenOrders, soundEnabled]);

  const handleUpdateOrderStatus = async (order: any, nextStatus: string) => {
    for (const item of order.items) {
      await fetch("/api/tenant/kitchen-orders/status", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: item.id, status: nextStatus }),
      });
    }
    onRefreshNeeded();
  };

  // Aggregated Items Board
  const activeItems = kitchenOrders.filter(
    (o) => o.status === "Pending" || o.status === "Preparing"
  );
  const aggregatedItems: { [key: string]: { name: string; qty: number } } = {};
  activeItems.forEach((item) => {
    const name = item.item_name;
    if (aggregatedItems[name]) {
      aggregatedItems[name].qty += item.quantity;
    } else {
      aggregatedItems[name] = { name, qty: item.quantity };
    }
  });

  // Group orders by order_id using REAL data
  const groupedOrders: {
    [key: string]: {
      order_id: string;
      table: string;
      time: string;
      status: string;
      type: string;
      items: any[];
    };
  } = {};

  kitchenOrders.forEach((item) => {
    const key = item.order_id || `order_${item.id}`;

    // Determine real order type from table_number
    let type = "Dine-In";
    const table = item.table_number || "";
    if (table.toLowerCase() === "whatsapp" || table.toLowerCase() === "online") {
      type = "Online";
    } else if (table.toLowerCase() === "llevar" || table.toLowerCase() === "para llevar" || table.toLowerCase() === "takeaway") {
      type = "Takeaway";
    }

    // Use real timestamp
    const time = item.created_at
      ? new Date(item.created_at).toLocaleString("es-CR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })
      : "Reciente";

    if (!groupedOrders[key]) {
      groupedOrders[key] = {
        order_id: key,
        table: type === "Dine-In" ? `Mesa ${table}` : "",
        time,
        status: item.status,
        type,
        items: [],
      };
    }
    groupedOrders[key].items.push(item);

    // Determine group status from items
    const statuses = groupedOrders[key].items.map((i: any) => i.status);
    if (statuses.every((s: string) => s === "Ready" || s === "Done")) {
      groupedOrders[key].status = "Ready";
    } else if (statuses.some((s: string) => s === "Preparing")) {
      groupedOrders[key].status = "Preparing";
    } else {
      groupedOrders[key].status = "Pending";
    }
  });

  let orderList = Object.values(groupedOrders);

  // Apply filters
  if (kdsFilter === "Pending") {
    orderList = orderList.filter((o) => o.status === "Pending" || o.status === "Confirmed");
  } else if (kdsFilter === "Preparing") {
    orderList = orderList.filter((o) => o.status === "Preparing");
  } else if (kdsFilter === "Ready") {
    orderList = orderList.filter((o) => o.status === "Ready" || o.status === "Done");
  }

  if (kdsSearch.trim() !== "") {
    const query = kdsSearch.toLowerCase();
    orderList = orderList.filter(
      (o) =>
        o.order_id.toLowerCase().includes(query) ||
        o.items.some((item) => item.item_name.toLowerCase().includes(query))
    );
  }

  const dineInOrders = orderList.filter((o) => o.type === "Dine-In");
  const onlineOrders = orderList.filter((o) => o.type === "Online");
  const takeawayOrders = orderList.filter((o) => o.type === "Takeaway");

  const statusBadge = (status: string) => {
    const config: Record<string, string> = {
      Ready: "bg-[#10b981] text-white",
      Preparing: "bg-[#f59e0b] text-white",
    };
    const style = config[status] || "bg-[#e91e63] text-white";
    const label = status === "Ready" ? "Listo" : status === "Preparing" ? "Preparando" : "Nuevo";
    return (
      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${style}`}>
        {label}
      </span>
    );
  };

  const OrderCard = ({ order, icon: Icon, color }: { order: any; icon: any; color: string; key?: any }) => (
    <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 sm:p-5 space-y-3 hover:shadow-md transition-all duration-300">
      <div className="flex justify-between items-center">
        <div className={`text-xs font-black flex items-center gap-1.5 ${color}`}>
          <Icon className="w-4 h-4" /> {order.order_id.substring(0, 16)}
        </div>
        {statusBadge(order.status)}
      </div>
      <div className="text-[11px] text-slate-400 font-bold leading-tight space-y-0.5">
        {order.table && <div>{order.table}</div>}
        <div className="text-[10px] text-slate-300 font-semibold">{order.time}</div>
      </div>
      <div className="border-t border-slate-100 pt-3 space-y-2">
        {order.items.map((item: any, iIdx: number) => (
          <div key={iIdx} className="flex items-center justify-between">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span className="w-5 h-5 bg-slate-100 rounded flex items-center justify-center text-[10px] font-black text-slate-600 shrink-0">{item.quantity}</span>
              <span className="truncate">{item.item_name}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="pt-2">
        {(order.status === "Pending" || order.status === "Confirmed") && (
          <button
            onClick={() => handleUpdateOrderStatus(order, "Preparing")}
            className="w-full h-12 sm:h-10 bg-[#e91e63] hover:bg-[#d81b60] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95"
          >
            🔥 Empezar a Preparar
          </button>
        )}
        {order.status === "Preparing" && (
          <button
            onClick={() => handleUpdateOrderStatus(order, "Ready")}
            className="w-full h-12 sm:h-10 bg-[#10b981] hover:bg-[#059669] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95"
          >
            ✅ Orden Lista
          </button>
        )}
      </div>
    </div>
  );

  const OrderColumn = ({ title, icon: Icon, color, orders }: { title: string; icon: any; color: string; orders: any[] }) => (
    <div className="flex flex-col h-full min-w-0">
      <div className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} /> {title}
        {orders.length > 0 && (
          <span className="ml-auto w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black flex items-center justify-center">
            {orders.length}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto space-y-4 pb-10 scrollbar-none">
        {orders.length === 0 ? (
          <div className="p-8 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white rounded-2xl border border-slate-100">
            Sin órdenes
          </div>
        ) : (
          orders.map((order, idx) => (
            <OrderCard key={idx} order={order} icon={Icon} color={color} />
          ))
        )}
      </div>
    </div>
  );

  // Mobile tab data mapping
  const mobileTabConfig = {
    dine: { title: "En Mesa", icon: Utensils, color: "text-[#e91e63]", orders: dineInOrders },
    online: { title: "Online", icon: Globe, color: "text-[#f59e0b]", orders: onlineOrders },
    takeaway: { title: "Para Llevar", icon: ShoppingBag, color: "text-[#a855f7]", orders: takeawayOrders },
  };
  const currentMobileTab = mobileTabConfig[mobileTab];

  return (
    <div className="flex-1 flex h-[calc(100vh-100px)] overflow-hidden bg-[#f7f8fa] font-sans">

      {/* ═══ DESKTOP: Left Sidebar Items Board (hidden on mobile) ═══ */}
      <div className="hidden lg:flex w-[260px] shrink-0 border-r border-slate-200 bg-white flex-col h-full shadow-sm">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-white">
          <span className="text-xs font-black text-slate-800 uppercase tracking-widest">
            Items Board
          </span>
          <span className="text-[10px] font-bold text-slate-400">
            {Object.keys(aggregatedItems).length} items
          </span>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {Object.keys(aggregatedItems).length === 0 ? (
            <div className="p-8 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Sin items activos
            </div>
          ) : (
            Object.values(aggregatedItems).map((item, idx) => (
              <div key={idx} className="flex justify-between items-center px-5 py-4 hover:bg-slate-50 transition-colors">
                <div className="min-w-0 pr-4">
                  <div className="text-xs font-black text-slate-800 truncate">{item.name}</div>
                </div>
                <div className="w-6 h-6 bg-black text-white text-[10px] font-black flex items-center justify-center rounded-full shrink-0">
                  {item.qty}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ═══ Main Panel ═══ */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#f7f8fa]">

        {/* ─── Header: Filters & Search ─── */}
        <div className="p-3 sm:p-5 border-b border-slate-100 bg-white space-y-3">
          {/* Top row: hamburger + search + items board button */}
          <div className="flex items-center gap-2">
            {setIsSidebarOpen && (
              <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-1 text-slate-400 hover:text-slate-600 lg:hidden shrink-0">
                <Menu className="w-5 h-5" />
              </button>
            )}
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Buscar orden..."
                value={kdsSearch}
                onChange={(e) => setKdsSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:border-[#e91e63] placeholder-slate-400"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            </div>
            {/* Sound toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2.5 rounded-xl transition-colors shrink-0 ${soundEnabled ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400"}`}
              title={soundEnabled ? "Sonido activado" : "Sonido desactivado"}
            >
              <Volume2 className="w-5 h-5" />
            </button>
            {/* Mobile Items Board toggle */}
            <button
              onClick={() => setShowItemsBoard(!showItemsBoard)}
              className="lg:hidden p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors shrink-0 relative"
            >
              <ClipboardList className="w-5 h-5" />
              {Object.keys(aggregatedItems).length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#e91e63] text-white text-[8px] font-black rounded-full flex items-center justify-center">
                  {Object.keys(aggregatedItems).length}
                </span>
              )}
            </button>
          </div>

          {/* Filter pills */}
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            {(["all", "Pending", "Preparing", "Ready"] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setKdsFilter(filter)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm border transition-all whitespace-nowrap shrink-0 ${
                  kdsFilter === filter
                    ? "bg-pink-50 border-[#e91e63]/20 text-[#e91e63]"
                    : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                {filter === "all" ? "Todas" : filter === "Pending" ? "Nuevas" : filter === "Ready" ? "Listas" : "Preparando"}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Mobile: Items Board Dropdown ─── */}
        {showItemsBoard && (
          <div className="lg:hidden bg-white border-b border-slate-200 p-4 max-h-[200px] overflow-y-auto">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-black text-slate-800 uppercase tracking-widest">Items Activos</span>
              <button onClick={() => setShowItemsBoard(false)} className="p-1 text-slate-400"><X className="w-4 h-4" /></button>
            </div>
            {Object.keys(aggregatedItems).length === 0 ? (
              <div className="text-[10px] text-slate-400 font-bold text-center py-4">Sin items activos</div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {Object.values(aggregatedItems).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
                    <span className="text-xs font-bold text-slate-700 truncate">{item.name}</span>
                    <span className="w-5 h-5 bg-black text-white text-[9px] font-black rounded-full flex items-center justify-center shrink-0 ml-2">{item.qty}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Mobile: Swipeable Tabs ─── */}
        <div className="lg:hidden flex bg-white border-b border-slate-100">
          {(["dine", "online", "takeaway"] as const).map((tab) => {
            const cfg = mobileTabConfig[tab];
            const Icon = cfg.icon;
            return (
              <button
                key={tab}
                onClick={() => setMobileTab(tab)}
                className={`flex-1 py-3 flex flex-col items-center gap-1 text-[10px] font-black uppercase tracking-wider transition-all border-b-2 ${
                  mobileTab === tab
                    ? `${cfg.color} border-current bg-slate-50/50`
                    : "text-slate-400 border-transparent"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{cfg.title}</span>
                {cfg.orders.length > 0 && (
                  <span className={`w-5 h-5 rounded-full text-[9px] font-black flex items-center justify-center ${
                    mobileTab === tab ? "bg-current text-white" : "bg-slate-200 text-slate-500"
                  }`} style={mobileTab === tab ? { backgroundColor: 'currentColor', color: 'white' } : {}}>
                    <span className={mobileTab === tab ? "text-white" : ""}>{cfg.orders.length}</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ─── Mobile: Single Column View ─── */}
        <div className="lg:hidden flex-1 overflow-y-auto p-4 space-y-4 pb-20">
          {currentMobileTab.orders.length === 0 ? (
            <div className="p-10 text-center bg-white rounded-2xl border border-slate-100">
              <currentMobileTab.icon className={`w-10 h-10 mx-auto mb-3 opacity-20 ${currentMobileTab.color}`} />
              <div className="text-xs font-black text-slate-400 uppercase tracking-widest">
                Sin órdenes de {currentMobileTab.title}
              </div>
            </div>
          ) : (
            currentMobileTab.orders.map((order, idx) => (
              <OrderCard key={idx} order={order} icon={currentMobileTab.icon} color={currentMobileTab.color} />
            ))
          )}
        </div>

        {/* ─── Desktop: 3 Column Grid ─── */}
        <div className="hidden lg:grid flex-1 grid-cols-3 gap-6 p-6 overflow-hidden h-[calc(100%-140px)]">
          <OrderColumn title="En Mesa" icon={Utensils} color="text-[#e91e63]" orders={dineInOrders} />
          <OrderColumn title="Online / WhatsApp" icon={Globe} color="text-[#f59e0b]" orders={onlineOrders} />
          <OrderColumn title="Para Llevar" icon={ShoppingBag} color="text-[#a855f7]" orders={takeawayOrders} />
        </div>
      </div>
    </div>
  );
}
