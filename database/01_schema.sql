/* =====================================================================
   Restaurante Orígenes SV - ERP y POS
   Esquema de base de datos para PostgreSQL
   Lo ejecuta `npm run db:setup` (no hace falta correrlo a mano).
   Convención: tablas y columnas en minúsculas y snake_case.
   ===================================================================== */

/* ---------------------------------------------------------------------
   1. BASE: sucursales, roles, empleados y usuarios
   --------------------------------------------------------------------- */
CREATE TABLE sucursal (
    id_sucursal  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre       VARCHAR(100) NOT NULL,
    direccion    VARCHAR(250),
    telefono     VARCHAR(20),
    activa       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE rol (
    id_rol  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre  VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE empleado (
    id_empleado      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_sucursal      INT NOT NULL REFERENCES sucursal(id_sucursal),
    nombres          VARCHAR(100) NOT NULL,
    apellidos        VARCHAR(100) NOT NULL,
    dui              VARCHAR(10) NOT NULL UNIQUE,
    nit              VARCHAR(17),
    numero_isss      VARCHAR(20),
    numero_afp       VARCHAR(20),
    cargo            VARCHAR(50) NOT NULL,
    salario_mensual  NUMERIC(12,2) NOT NULL CHECK (salario_mensual >= 0),
    fecha_ingreso    DATE NOT NULL DEFAULT CURRENT_DATE,
    activo           BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE usuario (
    id_usuario      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_empleado     INT NOT NULL UNIQUE REFERENCES empleado(id_empleado),
    id_rol          INT NOT NULL REFERENCES rol(id_rol),
    nombre_usuario  VARCHAR(50) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,           -- bcrypt, nunca texto plano
    activo          BOOLEAN NOT NULL DEFAULT TRUE
);

/* ---------------------------------------------------------------------
   2. INVENTARIO Y RECETAS
   Todo producto vendible tiene receta. Un producto de reventa (empacado)
   tiene una receta de 1 unidad de su insumo empacado, así el descuento
   de stock usa la misma lógica para todos.
   --------------------------------------------------------------------- */
CREATE TABLE unidad_medida (
    id_unidad    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre       VARCHAR(30) NOT NULL UNIQUE,
    abreviatura  VARCHAR(10) NOT NULL
);

CREATE TABLE categoria (
    id_categoria  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre        VARCHAR(60) NOT NULL UNIQUE
);

CREATE TABLE insumo (
    id_insumo      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre         VARCHAR(100) NOT NULL UNIQUE,
    id_unidad      INT NOT NULL REFERENCES unidad_medida(id_unidad),
    costo_promedio NUMERIC(12,4) NOT NULL DEFAULT 0,
    stock_minimo   NUMERIC(12,3) NOT NULL DEFAULT 0,
    activo         BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE producto (
    id_producto    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_categoria   INT NOT NULL REFERENCES categoria(id_categoria),
    nombre         VARCHAR(100) NOT NULL UNIQUE,
    tipo_producto  VARCHAR(10) NOT NULL
                   CHECK (tipo_producto IN ('ELABORADO','REVENTA')),
    precio_venta   NUMERIC(12,2) NOT NULL CHECK (precio_venta >= 0), -- IVA incluido
    activo         BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE receta_detalle (
    id_producto  INT NOT NULL REFERENCES producto(id_producto),
    id_insumo    INT NOT NULL REFERENCES insumo(id_insumo),
    cantidad     NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
    PRIMARY KEY (id_producto, id_insumo)
);

CREATE TABLE inventario_sucursal (
    id_sucursal  INT NOT NULL REFERENCES sucursal(id_sucursal),
    id_insumo    INT NOT NULL REFERENCES insumo(id_insumo),
    existencia   NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (existencia >= 0),
    PRIMARY KEY (id_sucursal, id_insumo)
);

CREATE TABLE movimiento_inventario (
    id_movimiento    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_sucursal      INT NOT NULL REFERENCES sucursal(id_sucursal),
    id_insumo        INT NOT NULL REFERENCES insumo(id_insumo),
    id_usuario       INT REFERENCES usuario(id_usuario),
    tipo_movimiento  VARCHAR(10) NOT NULL
                     CHECK (tipo_movimiento IN ('COMPRA','VENTA','AJUSTE','ANULACION')),
    cantidad         NUMERIC(14,3) NOT NULL,         -- positivo entra, negativo sale
    referencia       VARCHAR(30),                    -- 'VENTA', 'COMPRA'
    id_referencia    INT,
    fecha            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

/* ---------------------------------------------------------------------
   3. COMPRAS Y PROVEEDORES (cuentas por pagar)
   --------------------------------------------------------------------- */
CREATE TABLE proveedor (
    id_proveedor  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre        VARCHAR(150) NOT NULL,
    nit           VARCHAR(17),
    nrc           VARCHAR(15),
    telefono      VARCHAR(20),
    correo        VARCHAR(120),
    activo        BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE compra (
    id_compra         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_proveedor      INT NOT NULL REFERENCES proveedor(id_proveedor),
    id_sucursal       INT NOT NULL REFERENCES sucursal(id_sucursal),
    id_usuario        INT NOT NULL REFERENCES usuario(id_usuario),
    numero_documento  VARCHAR(40) NOT NULL,          -- factura del proveedor
    fecha_compra      DATE NOT NULL,
    condicion_pago    VARCHAR(10) NOT NULL CHECK (condicion_pago IN ('CONTADO','CREDITO')),
    subtotal          NUMERIC(12,2) NOT NULL,
    iva               NUMERIC(12,2) NOT NULL,
    total             NUMERIC(12,2) NOT NULL,
    estado            VARCHAR(10) NOT NULL DEFAULT 'REGISTRADA'
                      CHECK (estado IN ('REGISTRADA','ANULADA')),
    CONSTRAINT uq_compra_doc UNIQUE (id_proveedor, numero_documento)
);

CREATE TABLE compra_detalle (
    id_compra_detalle  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_compra          INT NOT NULL REFERENCES compra(id_compra),
    id_insumo          INT NOT NULL REFERENCES insumo(id_insumo),
    cantidad           NUMERIC(12,3) NOT NULL CHECK (cantidad > 0),
    costo_unitario     NUMERIC(12,4) NOT NULL CHECK (costo_unitario >= 0)
);

CREATE TABLE cuenta_por_pagar (
    id_cuenta          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_compra          INT NOT NULL UNIQUE REFERENCES compra(id_compra),
    monto_original     NUMERIC(12,2) NOT NULL,
    saldo              NUMERIC(12,2) NOT NULL,
    fecha_vencimiento  DATE NOT NULL,
    estado             VARCHAR(10) NOT NULL DEFAULT 'PENDIENTE'
                       CHECK (estado IN ('PENDIENTE','PARCIAL','PAGADA'))
);

CREATE TABLE pago_proveedor (
    id_pago      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_cuenta    INT NOT NULL REFERENCES cuenta_por_pagar(id_cuenta),
    monto        NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    metodo_pago  VARCHAR(15) NOT NULL,
    fecha        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

/* ---------------------------------------------------------------------
   4. CAJA Y TURNOS
   --------------------------------------------------------------------- */
CREATE TABLE caja (
    id_caja      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_sucursal  INT NOT NULL REFERENCES sucursal(id_sucursal),
    nombre       VARCHAR(50) NOT NULL
);

CREATE TABLE turno_caja (
    id_turno        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_caja         INT NOT NULL REFERENCES caja(id_caja),
    id_usuario      INT NOT NULL REFERENCES usuario(id_usuario),
    fecha_apertura  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    monto_apertura  NUMERIC(12,2) NOT NULL CHECK (monto_apertura >= 0),
    fecha_cierre    TIMESTAMPTZ,
    estado          VARCHAR(10) NOT NULL DEFAULT 'ABIERTO'
                    CHECK (estado IN ('ABIERTO','CERRADO'))
);

-- Un solo turno abierto por caja
CREATE UNIQUE INDEX ux_turno_caja_uno_abierto
    ON turno_caja(id_caja) WHERE estado = 'ABIERTO';

CREATE TABLE cierre_caja_detalle (
    id_turno        INT NOT NULL REFERENCES turno_caja(id_turno),
    metodo_pago     VARCHAR(15) NOT NULL
                    CHECK (metodo_pago IN ('EFECTIVO','TARJETA','BITCOIN','CHIVO')),
    monto_esperado  NUMERIC(12,2) NOT NULL,          -- lo calcula el sistema
    monto_contado   NUMERIC(12,2) NOT NULL,          -- lo digita el cajero
    diferencia      NUMERIC(12,2) GENERATED ALWAYS AS (monto_contado - monto_esperado) STORED,
    PRIMARY KEY (id_turno, metodo_pago)
);

/* ---------------------------------------------------------------------
   5. VENTAS Y FACTURACIÓN
   Precios de venta con IVA incluido: subtotal = total / 1.13
   e iva = total - subtotal. En el CCF se muestra el IVA separado.
   --------------------------------------------------------------------- */
CREATE TABLE cliente (
    id_cliente       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre           VARCHAR(150) NOT NULL,
    nit              VARCHAR(17),
    nrc              VARCHAR(15),
    dui              VARCHAR(10),
    email            VARCHAR(120),
    giro             VARCHAR(150),
    direccion        VARCHAR(250),
    es_contribuyente BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE correlativo_documento (
    id_correlativo  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_sucursal     INT NOT NULL REFERENCES sucursal(id_sucursal),
    tipo_documento  VARCHAR(10) NOT NULL CHECK (tipo_documento IN ('FACTURA','CCF')),
    serie           VARCHAR(10) NOT NULL,
    ultimo_numero   INT NOT NULL DEFAULT 0,
    CONSTRAINT uq_correlativo UNIQUE (id_sucursal, tipo_documento, serie)
);

CREATE TABLE venta (
    id_venta          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_sucursal       INT NOT NULL REFERENCES sucursal(id_sucursal),
    id_turno          INT NOT NULL REFERENCES turno_caja(id_turno),
    id_usuario        INT NOT NULL REFERENCES usuario(id_usuario),
    id_cliente        INT REFERENCES cliente(id_cliente),   -- obligatorio en CCF
    tipo_documento    VARCHAR(10) NOT NULL CHECK (tipo_documento IN ('FACTURA','CCF')),
    serie             VARCHAR(10) NOT NULL,
    numero_documento  INT NOT NULL,
    fecha             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    descuento         NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (descuento >= 0),
    subtotal          NUMERIC(12,2) NOT NULL,
    iva               NUMERIC(12,2) NOT NULL,
    total             NUMERIC(12,2) NOT NULL,
    estado            VARCHAR(10) NOT NULL DEFAULT 'EMITIDA'
                      CHECK (estado IN ('EMITIDA','ANULADA')),
    CONSTRAINT uq_venta_doc UNIQUE (id_sucursal, tipo_documento, serie, numero_documento)
);

CREATE TABLE venta_detalle (
    id_venta_detalle  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_venta          INT NOT NULL REFERENCES venta(id_venta),
    id_producto       INT NOT NULL REFERENCES producto(id_producto),
    cantidad          INT NOT NULL CHECK (cantidad > 0),
    precio_unitario   NUMERIC(12,2) NOT NULL,
    total_linea       NUMERIC(12,2) NOT NULL
);

-- Una venta puede pagarse con varios métodos (pago mixto)
CREATE TABLE venta_pago (
    id_venta_pago  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_venta       INT NOT NULL REFERENCES venta(id_venta),
    metodo_pago    VARCHAR(15) NOT NULL
                   CHECK (metodo_pago IN ('EFECTIVO','TARJETA','BITCOIN','CHIVO')),
    monto          NUMERIC(12,2) NOT NULL CHECK (monto > 0),
    referencia     VARCHAR(80)                       -- voucher o hash de transacción
);

/* ---------------------------------------------------------------------
   6. NÓMINA
   Los porcentajes y tramos viven en tablas para poder actualizarlos
   sin tocar el código si Hacienda o el ISSS los modifican.
   --------------------------------------------------------------------- */
CREATE TABLE parametro_legal (
    clave          VARCHAR(40) PRIMARY KEY,
    valor          NUMERIC(12,4) NOT NULL,
    descripcion    VARCHAR(200),
    vigente_desde  DATE NOT NULL
);

CREATE TABLE tramo_renta (
    id_tramo           INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    periodicidad       VARCHAR(10) NOT NULL DEFAULT 'QUINCENAL',
    tramo              INT NOT NULL,
    desde              NUMERIC(12,2) NOT NULL,
    hasta              NUMERIC(12,2),                -- NULL = en adelante
    porcentaje_exceso  NUMERIC(5,4) NOT NULL,
    sobre_exceso       NUMERIC(12,2) NOT NULL,
    cuota_fija         NUMERIC(12,2) NOT NULL,
    CONSTRAINT uq_tramo_renta UNIQUE (periodicidad, tramo)
);

CREATE TABLE planilla (
    id_planilla  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_sucursal  INT NOT NULL REFERENCES sucursal(id_sucursal),
    anio         INT NOT NULL,
    mes          INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
    quincena     INT NOT NULL CHECK (quincena IN (1,2)),
    fecha_inicio DATE NOT NULL,
    fecha_fin    DATE NOT NULL,
    estado       VARCHAR(10) NOT NULL DEFAULT 'BORRADOR'
                 CHECK (estado IN ('BORRADOR','APROBADA','PAGADA')),
    CONSTRAINT uq_planilla UNIQUE (id_sucursal, anio, mes, quincena)
);

CREATE TABLE planilla_detalle (
    id_planilla_detalle  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_planilla          INT NOT NULL REFERENCES planilla(id_planilla),
    id_empleado          INT NOT NULL REFERENCES empleado(id_empleado),
    salario_quincenal    NUMERIC(12,2) NOT NULL,
    otros_ingresos       NUMERIC(12,2) NOT NULL DEFAULT 0,
    isss                 NUMERIC(12,2) NOT NULL,
    afp                  NUMERIC(12,2) NOT NULL,
    renta                NUMERIC(12,2) NOT NULL,
    otras_deducciones    NUMERIC(12,2) NOT NULL DEFAULT 0,
    salario_neto         NUMERIC(12,2) NOT NULL,
    CONSTRAINT uq_planilla_detalle UNIQUE (id_planilla, id_empleado)
);

/* ---------------------------------------------------------------------
   7. ÍNDICES sobre llaves foráneas de uso frecuente
   (PostgreSQL no los crea automáticamente)
   --------------------------------------------------------------------- */
CREATE INDEX ix_venta_turno          ON venta(id_turno);
CREATE INDEX ix_venta_fecha          ON venta(fecha);
CREATE INDEX ix_venta_detalle_venta  ON venta_detalle(id_venta);
CREATE INDEX ix_venta_pago_venta     ON venta_pago(id_venta);
CREATE INDEX ix_compra_detalle_compra ON compra_detalle(id_compra);
CREATE INDEX ix_pago_proveedor_cuenta ON pago_proveedor(id_cuenta);
CREATE INDEX ix_movimiento_insumo    ON movimiento_inventario(id_insumo, id_sucursal);
CREATE INDEX ix_planilla_detalle_emp ON planilla_detalle(id_empleado);

/* ---------------------------------------------------------------------
   8. VISTA: alertas de stock mínimo
   --------------------------------------------------------------------- */
CREATE OR REPLACE VIEW vw_alertas_stock_minimo AS
SELECT  s.id_sucursal,
        s.nombre       AS sucursal,
        i.id_insumo,
        i.nombre       AS insumo,
        u.abreviatura  AS unidad,
        inv.existencia,
        i.stock_minimo
FROM inventario_sucursal inv
JOIN insumo i         ON i.id_insumo = inv.id_insumo
JOIN sucursal s       ON s.id_sucursal = inv.id_sucursal
JOIN unidad_medida u  ON u.id_unidad = i.id_unidad
WHERE i.activo
  AND inv.existencia <= i.stock_minimo;
