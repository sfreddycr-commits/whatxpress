import React, { useState } from "react";
import { Menu, Plus, Trash2, Camera, UploadCloud, Image as ImageIcon } from "lucide-react";

interface Props {
  tenantId: string;
  token: string;
  categories: any[];
  menuItems: any[];
  currencySymbol?: string;
  refreshDashboard: () => void;
  setIsSidebarOpen: (v: boolean) => void;
}

export const MenuView: React.FC<Props> = ({
  tenantId,
  token,
  categories,
  menuItems,
  refreshDashboard,
  setIsSidebarOpen,
  currencySymbol = "$",
}) => {
  const [itemForm, setItemForm] = useState({
    name: "",
    price: "",
    category_id: "",
    description: "",
    image_url: "",
    is_available: true,
  });
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setItemForm(prev => {
          const current = prev.image_url ? prev.image_url.split(',').filter(Boolean) : [];
          current.push(data.url);
          return { ...prev, image_url: current.join(',') };
        });
      } else { alert("No se pudo subir la imagen."); }
    } catch (err) { alert("Error al conectar con el servidor."); }
    finally { setIsUploading(false); }
    e.target.value = "";
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setItemForm(prev => {
      const current = prev.image_url ? prev.image_url.split(',').filter(Boolean) : [];
      current.splice(indexToRemove, 1);
      return { ...prev, image_url: current.join(',') };
    });
  };

  const [categoryForm, setCategoryForm] = useState({ name: "", icon: "" });
  const [editingCategory, setEditingCategory] = useState<any>(null);

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) return;
    await fetch("/api/tenant/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ 
        id: editingCategory?.id,
        tenant_id: tenantId, 
        name: categoryForm.name,
        icon: categoryForm.icon || "📦"
      }),
    });
    setCategoryForm({ name: "", icon: "" });
    setEditingCategory(null);
    refreshDashboard();
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm("¿Eliminar esta categoría y todo su contenido?")) return;
    await fetch(`/api/tenant/categories/${id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
    });
    refreshDashboard();
  };

  const startEditCategory = (cat: any) => {
    setEditingCategory(cat);
    setCategoryForm({ name: cat.name, icon: cat.icon || "" });
  };

  const handleSaveMenuItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/tenant/menu-items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ ...itemForm, tenant_id: tenantId, id: editingItem?.id }),
      });

      if (res.ok) {
        setItemForm({ name: "", price: "", category_id: categories[0]?.id || "", description: "", image_url: "", is_available: true });
        setEditingItem(null);
        setShowItemModal(false);
        refreshDashboard();
        // Opcional: alert("Platillo guardado correctamente.");
      } else {
        const errorData = await res.json();
        alert("Error al guardar: " + (errorData.error || "Desconocido"));
      }
    } catch (err) {
      alert("Error de conexión al guardar el platillo.");
    }
  };

  const handleDeleteMenuItem = async (id: string) => {
    if (!window.confirm("¿Eliminar este platillo?")) return;
    await fetch(`/api/tenant/menu-items/${id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
    });
    refreshDashboard();
  };

  const startEdit = (item: any) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      price: String(item.price),
      category_id: item.category_id || "",
      description: item.description || "",
      image_url: item.image_url || "",
      is_available: item.is_available !== 0,
    });
    setShowItemModal(true);
  };

  const startNew = () => {
    setEditingItem(null);
    setItemForm({ name: "", price: "", category_id: categories[0]?.id || "", description: "", image_url: "", is_available: true });
    setShowItemModal(true);
  };

  return (
    <div className="flex-1 p-4 sm:p-8 overflow-y-auto bg-slate-50">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 lg:hidden">
            <Menu className="w-6 h-6" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Gestión de Menú</h1>
            <p className="text-sm text-slate-500 font-medium mt-1">Administra platillos, precios y categorías.</p>
          </div>
        </div>
        <button
          onClick={startNew}
          className="h-10 px-4 bg-[#109e38] hover:bg-[#0d842e] text-white rounded-xl text-sm font-bold shadow-sm flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Nuevo Platillo
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Stats */}
        <div className="lg:col-span-1 space-y-6">
          {/* Stat (Compact) */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-black text-slate-400 uppercase mb-1">Total Platillos</div>
              <div className="text-3xl font-black text-slate-900">{menuItems.length}</div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
               <Menu className="w-5 h-5" />
            </div>
          </div>

          {/* Category Manager Widget */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
             <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h3 className="font-black text-slate-900 text-sm uppercase">Categorías ({categories.length})</h3>
             </div>
             
             {/* Mini Add Form */}
             <form onSubmit={handleSaveCategory} className="p-4 bg-slate-50/30 border-b border-slate-100 space-y-3">
                <div className="flex gap-2">
                   <input 
                     type="text" 
                     placeholder="Icono (Opcional)" 
                     className="w-12 h-10 text-center rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#109e38] text-lg"
                     value={categoryForm.icon}
                     onChange={e => setCategoryForm({...categoryForm, icon: e.target.value})}
                   />
                   <input 
                     type="text" 
                     placeholder="Nueva categoría..." 
                     className="flex-1 h-10 px-3 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-[#109e38] font-medium"
                     value={categoryForm.name}
                     onChange={e => setCategoryForm({...categoryForm, name: e.target.value})}
                     required
                   />
                </div>
                <div className="flex gap-2">
                   <button type="submit" className="flex-1 h-9 bg-[#109e38] text-white text-xs font-bold rounded-lg hover:bg-[#0d842e] transition-all">
                      {editingCategory ? 'Actualizar' : 'Agregar Categoría'}
                   </button>
                   {editingCategory && (
                      <button type="button" onClick={() => { setEditingCategory(null); setCategoryForm({name: "", icon: ""}); }} className="px-3 h-9 bg-slate-200 text-slate-600 text-xs font-bold rounded-lg">
                         ✕
                      </button>
                   )}
                </div>
             </form>

             {/* List of categories */}
             <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
                {categories.length === 0 ? (
                   <div className="text-center py-6 text-xs text-slate-400">No hay categorías aún.</div>
                ) : (
                   categories.map((cat: any) => (
                      <div key={cat.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg group">
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-lg">{cat.icon || "📦"}</div>
                            <span className="text-sm font-bold text-slate-700">{cat.name}</span>
                         </div>
                         <div className="flex items-center gap-1 transition-opacity">
                            <button onClick={() => startEditCategory(cat)} className="p-1.5 text-slate-400 hover:text-[#109e38] hover:bg-green-50 rounded-md">
                               <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                            </button>
                            <button onClick={() => handleDeleteCategory(cat.id)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md">
                               <Trash2 className="w-3.5 h-3.5" />
                            </button>
                         </div>
                      </div>
                   ))
                )}
             </div>
          </div>
        </div>

        {/* List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-black text-slate-900 uppercase">Platillos ({menuItems.length})</h3>
            </div>
            <div className="divide-y divide-slate-100">
              {menuItems.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400 font-medium">
                  No hay platillos en el menú.
                </div>
              ) : (
                menuItems.map((item: any) => (
                  <div key={item.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
                    <div className="flex items-center gap-3">
                      {item.image_url && (
                        <img src={item.image_url.split(',')[0]} alt={item.name} referrerPolicy="no-referrer" className="w-10 h-10 rounded-lg object-cover" />
                      )}
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{item.name}</div>
                        <div className="text-xs text-slate-400">
                          {currencySymbol}{item.price} • {categories.find((c: any) => c.id === item.category_id)?.name || "Sin categoría"}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEdit(item)}
                        className="text-xs font-bold text-[#109e38] hover:bg-green-50 px-3 py-1 rounded-lg transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeleteMenuItem(item.id)}
                        className="text-xs font-bold text-red-500 hover:bg-red-50 px-3 py-1 rounded-lg transition-colors"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div onClick={() => setShowItemModal(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden z-10 flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-black text-slate-900 uppercase tracking-tight">
                {editingItem ? "Editar Producto" : "Nuevo Producto"}
              </h3>
              <button onClick={() => setShowItemModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveMenuItem} className="p-6 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nombre del Platillo</label>
                    <input required type="text" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:outline-none focus:border-[#109e38] text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Precio ({currencySymbol})</label>
                      <input required type="number" step="0.01" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:outline-none focus:border-[#109e38] text-sm font-bold" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Categoría</label>
                      <select required value={itemForm.category_id} onChange={(e) => setItemForm({ ...itemForm, category_id: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:outline-none focus:border-[#109e38] text-sm">
                        <option value="">Seleccionar</option>
                        {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Descripción</label>
                    <textarea value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} className="w-full h-24 p-4 rounded-xl border border-slate-200 focus:outline-none focus:border-[#109e38] text-sm resize-none" />
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Imagen del Producto</label>
                    <div className="grid grid-cols-2 gap-4">
                      {/* OPTION 1: GALLERY */}
                      <div className={`relative min-h-[110px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-3 transition-all cursor-pointer bg-slate-50 hover:bg-slate-100 ${isUploading ? 'border-slate-300' : 'border-slate-200 hover:border-blue-500 hover:bg-blue-50/30'}`}>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleFileChange}
                          disabled={isUploading}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        {isUploading ? (
                          <div className="flex flex-col items-center text-slate-400 animate-pulse">
                            <UploadCloud className="w-6 h-6 animate-bounce mb-1" />
                            <span className="text-[9px] font-bold uppercase">Subiendo...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center text-center">
                            <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center mb-2 text-blue-500">
                              <ImageIcon className="w-5 h-5" />
                            </div>
                            <p className="text-[10px] font-black text-slate-700 uppercase">Subir Archivo</p>
                            <p className="text-[8px] text-slate-400 font-medium mt-0.5">De tu dispositivo</p>
                          </div>
                        )}
                      </div>

                      {/* OPTION 2: CAMERA */}
                      <div className={`relative min-h-[110px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-3 transition-all cursor-pointer bg-slate-50 hover:bg-slate-100 ${isUploading ? 'border-slate-300' : 'border-slate-200 hover:border-[#109e38] hover:bg-green-50/30'}`}>
                        <input 
                          type="file" 
                          accept="image/*" 
                          capture="environment"
                          onChange={handleFileChange}
                          disabled={isUploading}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        {isUploading ? (
                          <div className="flex flex-col items-center text-[#109e38] animate-pulse">
                            <UploadCloud className="w-6 h-6 animate-bounce mb-1" />
                            <span className="text-[9px] font-bold uppercase">Cargando...</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center text-center">
                            <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center mb-2 text-[#109e38]">
                              <Camera className="w-5 h-5" />
                            </div>
                            <p className="text-[10px] font-black text-slate-700 uppercase">Tomar Foto</p>
                            <p className="text-[8px] text-slate-400 font-medium mt-0.5">Abrir cámara</p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Manual URL fallback input */}
                    <div className="mt-3 flex gap-2">
                      <input type="text" value={itemForm.image_url} onChange={(e) => setItemForm({ ...itemForm, image_url: e.target.value })} placeholder="O pega enlace directo de la imagen..." className="flex-1 h-8 px-3 rounded-lg border border-slate-200 text-[11px] focus:border-[#109e38] focus:outline-none font-medium" />
                    </div>
                  </div>
                  {/* Grid View of Uploaded Images */}
                  {itemForm.image_url && itemForm.image_url.split(',').filter(Boolean).length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {itemForm.image_url.split(',').filter(Boolean).map((url, i) => (
                        <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                          <img src={url} alt={`preview-${i}`} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button 
                              type="button"
                              onClick={() => handleRemoveImage(i)}
                              className="bg-red-500 text-white p-1.5 rounded-full shadow-lg hover:scale-110 transition-transform"
                              title="Eliminar esta foto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={itemForm.is_available} onChange={(e) => setItemForm({ ...itemForm, is_available: e.target.checked })} className="sr-only peer" />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#109e38]" />
                    </label>
                    <span className="text-sm font-bold text-slate-600">Disponible para la venta</span>
                  </div>
                </div>
              </div>
              <div className="pt-6 border-t border-slate-100 shrink-0">
                <button type="submit" className="w-full h-12 bg-[#109e38] text-white rounded-xl font-black shadow-lg shadow-[#109e38]/20 transition-all hover:bg-[#0d842e] uppercase tracking-wide">
                  {editingItem ? "Actualizar Producto" : "Guardar Producto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};