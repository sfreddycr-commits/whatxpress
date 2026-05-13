export type Language = 'es' | 'en';

const raw: Record<Language, any> = {
es: {
  nav: { features: "Funcionalidades", how: "Como Funciona", pricing: "Precios", login: "Iniciar Sesion", start: "Prueba Gratis" },
  hero: {
    badge: "El sistema operativo de tu restaurante",
    line1: "Tu restaurante en",
    highlight: "piloto automatico",
    desc: "IA que atiende pedidos por WhatsApp, POS completo, cocina en tiempo real, delivery, meseros, QR, reportes. Todo en una plataforma. Sin instalar nada.",
    email: "tu@restaurante.com",
    cta: "Comenzar gratis",
    trialNote: "7 dias de prueba Pro  Sin tarjeta  Cancela cuando quieras",
    stats: [{ value: "3 min", label: "Para configurar" }, { value: "24/7", label: "IA atendiendo" }, { value: "+40%", label: "Mas pedidos" }]
  },
  features: {
    title: "Todo lo que tu restaurante necesita",
    subtitle: "Una plataforma. Cero instalaciones. Resultados desde el primer dia.",
    items: [
      { title: "Agente IA WhatsApp", desc: "Atiende pedidos 24/7, responde preguntas, recomienda platillos y cierra ventas automaticamente." },
      { title: "POS Punto de Venta", desc: "Cobra en mesa, para llevar o delivery. Divide cuentas, aplica descuentos, imprime tickets." },
      { title: "KDS Pantalla de Cocina", desc: "Ordenes en tiempo real por WebSocket. Sin papel, sin gritos. Cocina organizada." },
      { title: "Menu Digital QR", desc: "Cada mesa tiene su QR. El cliente escanea, ve el menu, pide y paga desde su celular." },
      { title: "Delivery con Zonas", desc: "Gestiona repartidores, zonas de cobertura, tarifas por distancia y seguimiento en tiempo real." },
      { title: "Meseros y Staff", desc: "Registra personal con PIN de acceso. Controla quien cobra, quien cocina, quien reparte." },
      { title: "Promociones y Cupones", desc: "Crea descuentos por porcentaje o monto fijo. Codigos personalizados con fecha de expiracion." },
      { title: "Loyalty y Recompensas", desc: "Sistema de puntos por compra. Los clientes acumulan y canjean por productos gratis." },
      { title: "Reportes y Analytics", desc: "Ventas diarias, platillos mas vendidos, revenue por hora. Toma decisiones con datos reales." },
      { title: "Caja y Pagos", desc: "Apertura y cierre de caja. Control de efectivo, SINPE, tarjeta. Conciliacion automatica." },
      { title: "Multi-idioma", desc: "Espanol e Ingles. El bot de IA responde en el idioma del cliente automaticamente." },
      { title: "Notificaciones", desc: "Alertas de nuevos pedidos, pagos y eventos. Campana en dashboard + emails automaticos." }
    ]
  },
  how: {
    title: "Listo en 3 minutos",
    subtitle: "No necesitas ser experto en tecnologia. Tu restaurante operando en 3 pasos.",
    steps: [
      { step: "01", title: "Registrate", desc: "Crea tu cuenta en 30 segundos. Sin tarjeta, sin compromiso. Prueba Pro 7 dias." },
      { step: "02", title: "Conecta WhatsApp", desc: "Escanea el QR y tu agente IA empieza a atender pedidos. Cero configuracion." },
      { step: "03", title: "Crece", desc: "Ve tus metricas en tiempo real. Mas pedidos, clientes felices, menos trabajo manual." }
    ]
  },
  power: {
    badge: "Tecnologia de punta",
    titleLine1: "IA que entiende",
    titleHighlight: "tu restaurante",
    bullets: [
      "Procesa pedidos completos con variantes, extras y direccion de entrega",
      "Verifica comprobantes de pago SINPE con OCR por imagen",
      "Reconoce el idioma del cliente y responde en espanol o ingles",
      "Recomienda bebidas y postres al final de cada pedido",
      "10 funciones autonomas de administracion por WhatsApp",
      "Maneja cancelaciones, cambios y preguntas frecuentes"
    ],
    cta: "Probar el Agente IA",
    chat: [
      { from: "user", text: "Quiero 2 hamburguesas clasicas, una con papas grandes y una coca cola. Es para llevar." },
      { from: "bot", text: "Perfecto! Agrego: 2 Hamburguesas Clasicas, 1 Papas Grandes, 1 Coca-Cola. Total: $18.50. Es correcto? A que hora pasas a recoger?" },
      { from: "user", text: "Si, correcto. Paso como a las 7pm." },
      { from: "bot", text: "Listo! Tu pedido estara a las 7:00 PM. Te recomiendo agregar nuestro postre de la casa por solo $3.50 mas. Te animas?" }
    ]
  },
  pricing: {
    title: "Planes que crecen contigo",
    subtitle: "Desde $29/mes. 7 dias de prueba Pro gratis. Sin contratos, sin sorpresas.",
    popular: "Mas Popular",
    starter: "Para empezar con pedidos digitales",
    pro: "Toda la potencia sin limites",
    enterprise: "Multi-sucursal, soporte dedicado",
    cta: { popular: "Prueba 7 dias gratis", normal: "Comenzar" },
    compare: "Comparacion completa de planes"
  },
  trust: {
    items: [
      { title: "Datos seguros", desc: "Encriptacion de extremo a extremo. Tus datos y los de tus clientes estan protegidos." },
      { title: "Soporte real", desc: "Respondemos en minutos, no en dias. Chat en vivo y WhatsApp para ayuda inmediata." },
      { title: "Sin instalacion", desc: "No necesitas servidores, apps ni hardware especial. Todo desde el navegador." },
      { title: "Escala contigo", desc: "Desde 1 hasta 100 sucursales. La plataforma crece con tu negocio." }
    ]
  },
  cta: {
    title: "Listo para transformar tu restaurante?",
    desc: "Prueba Pro gratis 7 dias. Sin tarjeta. Cancela cuando quieras. Miles de restaurantes ya confian en WhatXpress.",
    primary: "Comenzar prueba gratis",
    secondary: "Ver planes"
  },
  modal: {
    title: "Prueba Pro 7 dias gratis",
    subtitle: "Sin tarjeta. Acceso completo a todas las funciones.",
    nameLabel: "Nombre del Restaurante",
    namePlaceholder: "Ej: Burger Joy",
    phoneLabel: "WhatsApp",
    phonePlaceholder: "+52 555 123 4567",
    emailLabel: "Correo Electronico",
    emailPlaceholder: "restaurante@ejemplo.com",
    passLabel: "Contrasena",
    passPlaceholder: "Minimo 8 caracteres",
    codeSent: "Enviamos un codigo a tu WhatsApp",
    codeTest: "Codigo de prueba: 1234",
    codeLabel: "Codigo",
    submit: "Crear cuenta gratis",
    verify: "Verificar y crear cuenta",
    errorCode: "Codigo incorrecto. El codigo de prueba es 1234.",
    errorPhone: "Por favor ingresa tu numero de WhatsApp",
    errorReg: "Error al registrar"
  },
  footer: { pricing: "Precios", login: "Iniciar Sesion", contact: "Contacto", copy: "WhatXpress. Restaurant OS." }
},
en: {
  nav: { features: "Features", how: "How It Works", pricing: "Pricing", login: "Log In", start: "Free Trial" },
  hero: {
    badge: "Your restaurant operating system",
    line1: "Your restaurant on",
    highlight: "autopilot",
    desc: "AI that handles WhatsApp orders, full POS, live kitchen display, delivery, staff, QR menus, reports. One platform. Zero installs.",
    email: "you@restaurant.com",
    cta: "Start free",
    trialNote: "7-day Pro trial  No card  Cancel anytime",
    stats: [{ value: "3 min", label: "To set up" }, { value: "24/7", label: "AI serving" }, { value: "+40%", label: "More orders" }]
  },
  features: {
    title: "Everything your restaurant needs",
    subtitle: "One platform. Zero installs. Results from day one.",
    items: [
      { title: "AI WhatsApp Agent", desc: "Handles orders 24/7, answers questions, recommends dishes, and closes sales automatically." },
      { title: "POS Point of Sale", desc: "Charge at table, takeout, or delivery. Split bills, apply discounts, print receipts." },
      { title: "KDS Kitchen Display", desc: "Real-time orders via WebSocket. No paper, no shouting. Organized kitchen." },
      { title: "QR Digital Menu", desc: "Every table has a QR code. Customers scan, browse, order and pay from their phone." },
      { title: "Delivery Zones", desc: "Manage couriers, coverage zones, distance-based pricing, and real-time tracking." },
      { title: "Waiters & Staff", desc: "Register staff with PIN access. Control who charges, who cooks, who delivers." },
      { title: "Promotions & Coupons", desc: "Create percentage or fixed-amount discounts. Custom codes with expiration dates." },
      { title: "Loyalty & Rewards", desc: "Points system per purchase. Customers earn and redeem points for free products." },
      { title: "Reports & Analytics", desc: "Daily sales, top-selling dishes, hourly revenue. Make decisions with real data." },
      { title: "Cash & Payments", desc: "Register opening and closing. Track cash, transfers, and cards. Automatic reconciliation." },
      { title: "Multi-language", desc: "Spanish & English. The AI bot responds in the customer's language automatically." },
      { title: "Notifications", desc: "Alerts for new orders, payments, and events. In-app bell + automatic emails." }
    ]
  },
  how: {
    title: "Ready in 3 minutes",
    subtitle: "No tech expertise needed. Your restaurant running in 3 steps.",
    steps: [
      { step: "01", title: "Sign Up", desc: "Create your account in 30 seconds. No card, no commitment. 7-day Pro trial." },
      { step: "02", title: "Connect WhatsApp", desc: "Scan the QR code and your AI agent starts taking orders. Zero configuration." },
      { step: "03", title: "Grow", desc: "See your metrics in real time. More orders, happy customers, less manual work." }
    ]
  },
  power: {
    badge: "Cutting-edge technology",
    titleLine1: "AI that understands",
    titleHighlight: "your restaurant",
    bullets: [
      "Processes complete orders with variants, extras, and delivery address",
      "Verifies SINPE payment receipts with image OCR",
      "Detects customer language and responds in Spanish or English",
      "Recommends drinks and desserts at the end of each order",
      "10 autonomous admin functions via WhatsApp",
      "Handles cancellations, changes, and FAQs"
    ],
    cta: "Try the AI Agent",
    chat: [
      { from: "user", text: "I want 2 classic burgers, one with large fries and a coke. It's for takeout." },
      { from: "bot", text: "Perfect! Added: 2 Classic Burgers, 1 Large Fries, 1 Coke. Total: $18.50. Is that correct? What time will you pick up?" },
      { from: "user", text: "Yes, correct. I'll come around 7pm." },
      { from: "bot", text: "Done! Your order will be ready at 7:00 PM. Want to add our house dessert for just $3.50 more? Up for it?" }
    ]
  },
  pricing: {
    title: "Plans that grow with you",
    subtitle: "From $29/month. 7-day free Pro trial. No contracts, no surprises.",
    popular: "Most Popular",
    starter: "Getting started with digital orders",
    pro: "Full power, unlimited",
    enterprise: "Multi-location, dedicated support",
    cta: { popular: "7-Day Free Trial", normal: "Get Started" },
    compare: "Full plan comparison"
  },
  trust: {
    items: [
      { title: "Secure Data", desc: "End-to-end encryption. Your data and your customers' data are protected." },
      { title: "Real Support", desc: "We respond in minutes, not days. Live chat and WhatsApp for immediate help." },
      { title: "No Installation", desc: "No servers, apps, or special hardware needed. Everything from your browser." },
      { title: "Scales With You", desc: "From 1 to 100 locations. The platform grows with your business." }
    ]
  },
  cta: {
    title: "Ready to transform your restaurant?",
    desc: "Try Pro free for 7 days. No card. Cancel anytime. Thousands of restaurants already trust WhatXpress.",
    primary: "Start free trial",
    secondary: "View plans"
  },
  modal: {
    title: "7-Day Free Pro Trial",
    subtitle: "No card. Full access to all features.",
    nameLabel: "Restaurant Name",
    namePlaceholder: "e.g. Burger Joy",
    phoneLabel: "WhatsApp",
    phonePlaceholder: "+1 555 123 4567",
    emailLabel: "Email",
    emailPlaceholder: "restaurant@example.com",
    passLabel: "Password",
    passPlaceholder: "Minimum 8 characters",
    codeSent: "We sent a code to your WhatsApp",
    codeTest: "Test code: 1234",
    codeLabel: "Code",
    submit: "Create free account",
    verify: "Verify and create account",
    errorCode: "Wrong code. The test code is 1234.",
    errorPhone: "Please enter your WhatsApp number",
    errorReg: "Registration error"
  },
  footer: { pricing: "Pricing", login: "Log In", contact: "Contact", copy: "WhatXpress. Restaurant OS." }
}
};

export function t(lang: Language): typeof raw.es {
  return raw[lang] || raw.es;
}

export function getLang(): Language {
  if (typeof window === 'undefined') return 'es';
  try {
    const saved = localStorage.getItem('wx_lang');
    if (saved === 'en' || saved === 'es') return saved;
    const navLang = navigator.language || '';
    return navLang.startsWith('en') ? 'en' : 'es';
  } catch { return 'es'; }
}

export function setLang(lang: Language) {
  try { localStorage.setItem('wx_lang', lang); } catch {}
}

export const translations = raw;

export function formatCurrency(amount: number, lang?: Language): string {
  const locale = (lang || getLang()) === 'en' ? 'en-US' : 'es-CR';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(amount);
  } catch { return '$' + amount.toFixed(2); }
}

export function formatDate(date: Date | string, lang?: Language): string {
  const locale = (lang || getLang()) === 'en' ? 'en-US' : 'es-CR';
  const d = typeof date === 'string' ? new Date(date) : date;
  try {
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(d);
  } catch { return d.toLocaleDateString(); }
}
