import { useState } from 'react';
import { Truck, Receipt, Users } from 'lucide-react';
import TabRegistrarCompra from '../components/compras/TabRegistrarCompra';
import TabCuentasPorPagar from '../components/compras/TabCuentasPorPagar';
import TabProveedores from '../components/compras/TabProveedores';

const PESTANAS = [
  { id: 'registrar', etiqueta: 'Registrar Compra', Icono: Truck },
  { id: 'cuentas', etiqueta: 'Cuentas por Pagar', Icono: Receipt },
  { id: 'proveedores', etiqueta: 'Proveedores', Icono: Users }
];

export default function ComprasPage() {
  // Controla qué sub-vista se renderiza dentro del módulo Compras
  const [tabActiva, setTabActiva] = useState('registrar');
  // Contador incremental para refrescar Cuentas por Pagar cuando se registra una nueva compra al crédito
  const [recargarCuentas, setRecargarCuentas] = useState(0);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Encabezado principal y navegación por pestañas tipo píldora */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-marino">Compras y Proveedores</h1>
          <p className="text-sm text-marino/70">
            Abastecimiento de insumos, control de crédito fiscal (IVA 13%) y cuentas por pagar.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 rounded-full bg-white p-1.5 shadow-sm ring-1 ring-marino/10">
          {PESTANAS.map(({ id, etiqueta, Icono }) => {
            const activa = tabActiva === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTabActiva(id)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition ${
                  activa
                    ? 'bg-marino text-crema shadow-sm'
                    : 'text-marino/75 hover:bg-crema hover:text-marino'
                }`}
              >
                <Icono size={15} />
                {etiqueta}
              </button>
            );
          })}
        </div>
      </div>

      {/* Renderizado condicional de cada pestaña */}
      {tabActiva === 'registrar' && (
        <TabRegistrarCompra
          onCompraRegistrada={() => setRecargarCuentas((n) => n + 1)}
        />
      )}
      {tabActiva === 'cuentas' && (
        <TabCuentasPorPagar recargarTrigger={recargarCuentas} />
      )}
      {tabActiva === 'proveedores' && <TabProveedores />}
    </div>
  );
}