/* =====================================================================
   Datos semilla de Orígenes SV (PostgreSQL)
   ===================================================================== */
INSERT INTO rol (nombre) VALUES
 ('Administrador'), ('Gerente'), ('Cajero'), ('Barista');

INSERT INTO sucursal (nombre, direccion) VALUES
 ('Orígenes Centro', 'San Salvador'),
 ('Orígenes Escalón', 'San Salvador');

INSERT INTO unidad_medida (nombre, abreviatura) VALUES
 ('Gramo', 'g'), ('Mililitro', 'ml'), ('Unidad', 'und');

INSERT INTO categoria (nombre) VALUES
 ('Bebidas calientes'), ('Bebidas frías'), ('Repostería'), ('Empacados');

INSERT INTO caja (id_sucursal, nombre)
SELECT id_sucursal, 'Caja 1' FROM sucursal;

INSERT INTO correlativo_documento (id_sucursal, tipo_documento, serie)
SELECT s.id_sucursal, t.tipo, 'A001'
FROM sucursal s
CROSS JOIN (VALUES ('FACTURA'), ('CCF')) AS t(tipo);

-- Parámetros legales. VERIFICAR contra la normativa vigente antes de la defensa.
INSERT INTO parametro_legal (clave, valor, descripcion, vigente_desde) VALUES
 ('ISSS_PORCENTAJE',   0.0300,  'Aporte laboral ISSS',                      DATE '2026-01-01'),
 ('ISSS_TOPE_MENSUAL', 1000.00, 'Base máxima de cotización ISSS (mensual)', DATE '2026-01-01'),
 ('AFP_PORCENTAJE',    0.0725,  'Aporte laboral AFP',                       DATE '2026-01-01'),
 ('IVA_PORCENTAJE',    0.1300,  'Impuesto al Valor Agregado',               DATE '2026-01-01');

-- Tabla de retención de renta QUINCENAL (Decreto Ejecutivo No. 10, 2025).
-- Tramos I y II confirmados; III y IV equivalen a la mitad de la tabla mensual.
-- VERIFICAR los tramos III y IV contra el decreto original.
INSERT INTO tramo_renta (periodicidad, tramo, desde, hasta, porcentaje_exceso, sobre_exceso, cuota_fija) VALUES
 ('QUINCENAL', 1,    0.01,   275.00, 0.0000,    0.00,   0.00),
 ('QUINCENAL', 2,  275.01,   447.62, 0.1000,  275.00,   8.83),
 ('QUINCENAL', 3,  447.63,  1019.05, 0.2000,  447.62,  30.00),
 ('QUINCENAL', 4, 1019.06,     NULL, 0.3000, 1019.05, 144.28);

-- Ejemplo de insumos y receta: Latte Grande
INSERT INTO insumo (nombre, id_unidad, costo_promedio, stock_minimo)
SELECT v.nombre, u.id_unidad, v.costo, v.minimo
FROM (VALUES
  ('Café de especialidad', 'g',   0.0300, 2000),
  ('Leche entera',         'ml',  0.0020, 5000),
  ('Vaso 16 oz',           'und', 0.1500, 100),
  ('Tapadera',             'und', 0.0600, 100),
  ('Viñeta',               'und', 0.0200, 100)
) AS v(nombre, abrev, costo, minimo)
JOIN unidad_medida u ON u.abreviatura = v.abrev;

INSERT INTO producto (id_categoria, nombre, tipo_producto, precio_venta)
SELECT id_categoria, 'Latte Grande', 'ELABORADO', 3.50
FROM categoria WHERE nombre = 'Bebidas calientes';

INSERT INTO receta_detalle (id_producto, id_insumo, cantidad)
SELECT p.id_producto, i.id_insumo, r.cantidad
FROM (VALUES
  ('Café de especialidad', 18),
  ('Leche entera',        250),
  ('Vaso 16 oz',            1),
  ('Tapadera',              1),
  ('Viñeta',                1)
) AS r(insumo, cantidad)
JOIN insumo i   ON i.nombre = r.insumo
JOIN producto p ON p.nombre = 'Latte Grande';
