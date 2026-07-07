// src/tools/customerTools.ts
import type { FunctionDeclaration } from "@google/genai";
import { Type } from "@google/genai";

export const customerTools: FunctionDeclaration[] = [
  {
    name: 'consultar_menu',
    description: 'Consulta los platillos disponibles en el menú del restaurante con sus precios y descripciones.',
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: 'consultar_detalles_platillo',
    description: 'Consulta las variantes (como tamaños) y extras (adicionales) disponibles para un platillo específico del menú.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        platillo_nombre: { type: Type.STRING, description: 'Nombre del platillo para buscar variantes o extras' }
      },
      required: ['platillo_nombre']
    }
  },
  {
    name: 'calcular_costo_envio',
    description: 'Calcula el costo de envío (delivery) en base a las coordenadas de latitud y longitud enviadas por el cliente.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        latitud: { type: Type.NUMBER, description: 'Latitud geográfica recibida' },
        longitud: { type: Type.NUMBER, description: 'Longitud geográfica recibida' }
      },
      required: ['latitud', 'longitud']
    }
  },
  {
    name: 'consultar_promociones',
    description: 'Consulta cupones de descuento o promociones activas actualmente en el restaurante.',
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: 'registrar_pedido_pos',
    description: 'Registra formalmente el pedido en el sistema de caja (POS) del restaurante para que aparezca en el panel de control y sea enviado a la cocina.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        productos: {
          type: Type.ARRAY,
          description: 'Lista de productos ordenados con sus nombres exactos del menú y cantidades',
          items: {
            type: Type.OBJECT,
            properties: {
              nombre: { type: Type.STRING, description: 'Nombre exacto del platillo que coincide con el menú' },
              cantidad: { type: Type.NUMBER, description: 'Cantidad ordenada de este platillo' }
            },
            required: ['nombre', 'cantidad']
          }
        },
        costo_envio: { type: Type.NUMBER, description: 'Costo de envío (delivery) calculado previamente, opcional o 0 si no es para envío' }
      },
      required: ['productos']
    }
  },
  {
    name: 'consultar_estado_pedido',
    description: 'Consulta el estado actual de preparación o entrega de los pedidos asociados al cliente.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        order_id: { type: Type.STRING, description: 'ID de orden opcional suministrado por el cliente' }
      }
    }
  },
  {
    name: 'transferir_a_humano',
    description: 'Pausa el bot asistente e intercepta el chat para que un operador humano del restaurante responda de forma manual.',
    parameters: { type: Type.OBJECT, properties: {} }
  }
];

export const customerToolNames = customerTools.map((t) => t.name);