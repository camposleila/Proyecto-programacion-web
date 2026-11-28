import { query, withTransaction } from "../config/db.js";

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
const errorHttp = (status, mensaje) =>
  Object.assign(new Error(mensaje), { status });
const esIdValido = (valor) =>
  Number.isInteger(Number(valor)) && Number(valor) > 0;
const esMontoValido = (valor) =>
  typeof valor === "number" && Number.isFinite(valor) && valor >= 0;

// Todo el calculo se hace en CENTAVOS (numeros enteros) para evitar errores de
// redondeo de los decimales de JavaScript (0.1 + 0.2 = 0.30000000000000004).
const centavos = (dinero) => Math.round(Number(dinero) * 100);
const aDinero = (cents) => cents / 100;
// Un porcentaje como 0.0725 pasa a 725 (diezmilésimas) para operar con enteros.
const puntos = (porcentaje) => Math.round(Number(porcentaje) * 10000);

// ---------------------------------------------------------------------------
// Calculo de la planilla, sin tocar la base de datos
// ---------------------------------------------------------------------------

// Renta: se busca el tramo donde cae la base y se aplica
//   renta = cuota_fija + (base - sobre_exceso) * porcentaje_exceso
function calcularRenta(baseCentavos, tramos) {
  if (baseCentavos <= 0) return 0;
  const tramo = [...tramos]
    .sort((a, b) => b.desde - a.desde) // del tramo más alto al más bajo
    .find((t) => centavos(t.desde) <= baseCentavos); // el primero cuyo "desde" ya se alcanzo
  if (!tramo) return 0;

  const exceso = baseCentavos - centavos(tramo.sobre_exceso);
  return (
    centavos(tramo.cuota_fija) +
    Math.round((exceso * puntos(tramo.porcentaje_exceso)) / 10000)
  );
}

// parametros: { ISSS_PORCENTAJE, ISSS_TOPE_MENSUAL, AFP_PORCENTAJE }  (números)
// tramos: filas de tramo_renta QUINCENAL
export function calcularEmpleado(
  { salarioMensual, otrosIngresos = 0, otrasDeducciones = 0 },
  parametros,
  tramos,
) {
  const salarioQuincenal = Math.round(centavos(salarioMensual) / 2);
  const bruto = salarioQuincenal + centavos(otrosIngresos);

  // ISSS: porcentaje sobre el bruto, con tope (el tope mensual se divide entre 2 por quincena)
  const topeQuincenal = Math.round(centavos(parametros.ISSS_TOPE_MENSUAL) / 2);
  const baseIsss = Math.min(bruto, topeQuincenal);
  const isss = Math.round(
    (baseIsss * puntos(parametros.ISSS_PORCENTAJE)) / 10000,
  );

  // AFP: porcentaje sobre el bruto
  const afp = Math.round((bruto * puntos(parametros.AFP_PORCENTAJE)) / 10000);

  // Renta: se calcula sobre el bruto menos ISSS y AFP
  const renta = calcularRenta(bruto - isss - afp, tramos);

  const neto = bruto - isss - afp - renta - centavos(otrasDeducciones);

  return {
    salario_quincenal: aDinero(salarioQuincenal),
    otros_ingresos: aDinero(centavos(otrosIngresos)),
    isss: aDinero(isss),
    afp: aDinero(afp),
    renta: aDinero(renta),
    otras_deducciones: aDinero(centavos(otrasDeducciones)),
    salario_neto: aDinero(neto),
  };
}

// Fechas de la quincena: la 1 va del 1 al 15 y la 2 del 16 al último día del mes
export function rangoQuincena(anio, mes, quincena) {
  const mm = String(mes).padStart(2, "0");
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return quincena === 1
    ? { fechaInicio: `${anio}-${mm}-01`, fechaFin: `${anio}-${mm}-15` }
    : {
        fechaInicio: `${anio}-${mm}-16`,
        fechaFin: `${anio}-${mm}-${String(ultimoDia).padStart(2, "0")}`,
      };
}

// ---------------------------------------------------------------------------
// Acceso a datos
// ---------------------------------------------------------------------------
async function cargarParametros(client) {
  const resultado = await client.query(
    "SELECT clave, valor FROM parametro_legal",
  );
  const mapa = Object.fromEntries(
    resultado.rows.map((f) => [f.clave, Number(f.valor)]),
  );
  for (const clave of [
    "ISSS_PORCENTAJE",
    "ISSS_TOPE_MENSUAL",
    "AFP_PORCENTAJE",
  ]) {
    if (mapa[clave] === undefined) {
      throw new Error(
        `Falta el parámetro legal ${clave}. ¿Corriste npm run db:setup?`,
      );
    }
  }
  return mapa;
}

async function cargarTramos(client) {
  const resultado = await client.query(
    `SELECT desde, hasta, porcentaje_exceso, sobre_exceso, cuota_fija
        FROM tramo_renta WHERE periodicidad = 'QUINCENAL' ORDER BY tramo`,
  );
  if (resultado.rows.length === 0) {
    throw new Error(
      "No hay tramos de renta quincenales. ¿Corriste npm run db:setup?",
    );
  }
  return resultado.rows;
}

// Arma la planilla completa: cabecera, detalle por empleado y totales
async function armarPlanilla(id) {
  const cabecera = await query(
    `SELECT p.*, s.nombre AS sucursal
        FROM planilla p JOIN sucursal s ON s.id_sucursal = p.id_sucursal
        WHERE p.id_planilla = $1`,
    [id],
  );
  if (cabecera.rows.length === 0) return null;

  const detalle = await query(
    `SELECT pd.*, e.nombres, e.apellidos, e.dui, e.cargo
        FROM planilla_detalle pd JOIN empleado e ON e.id_empleado = pd.id_empleado
        WHERE pd.id_planilla = $1
        ORDER BY e.apellidos, e.nombres`,
    [id],
  );

  const suma = (campo) =>
    aDinero(detalle.rows.reduce((acc, f) => acc + centavos(f[campo]), 0));
  const totales = {
    empleados: detalle.rows.length,
    salario_quincenal: suma("salario_quincenal"),
    otros_ingresos: suma("otros_ingresos"),
    isss: suma("isss"),
    afp: suma("afp"),
    renta: suma("renta"),
    otras_deducciones: suma("otras_deducciones"),
    salario_neto: suma("salario_neto"),
  };

  return { planilla: cabecera.rows[0], detalle: detalle.rows, totales };
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

// GET /api/planillas?anio=&mes=&estado=
export async function listarPlanillas(req, res, next) {
  try {
    const { anio, mes, estado } = req.query;
    const condiciones = [];
    const valores = [];

    if (esIdValido(anio)) {
      valores.push(Number(anio));
      condiciones.push(`p.anio = $${valores.length}`);
    }
    if (esIdValido(mes)) {
      valores.push(Number(mes));
      condiciones.push(`p.mes = $${valores.length}`);
    }
    if (["BORRADOR", "APROBADA", "PAGADA"].includes(estado)) {
      valores.push(estado);
      condiciones.push(`p.estado = $${valores.length}`);
    }

    const where =
      condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";
    const resultado = await query(
      `SELECT p.*, s.nombre AS sucursal,
                COUNT(pd.id_planilla_detalle)::int AS empleados,
                COALESCE(SUM(pd.salario_neto), 0) AS total_neto
        FROM planilla p
        JOIN sucursal s ON s.id_sucursal = p.id_sucursal
        LEFT JOIN planilla_detalle pd ON pd.id_planilla = p.id_planilla
        ${where}
        GROUP BY p.id_planilla, s.nombre
        ORDER BY p.anio DESC, p.mes DESC, p.quincena DESC`,
      valores,
    );
    res.json({ ok: true, data: resultado.rows });
  } catch (err) {
    next(err);
  }
}

// GET /api/planillas/:id
export async function obtenerPlanilla(req, res, next) {
  try {
    const { id } = req.params;
    if (!esIdValido(id)) {
      return res
        .status(400)
        .json({ ok: false, mensaje: "El id debe ser un número válido" });
    }
    const planilla = await armarPlanilla(id);
    if (!planilla) {
      return res
        .status(404)
        .json({ ok: false, mensaje: "Planilla no encontrada" });
    }
    res.json({ ok: true, data: planilla });
  } catch (err) {
    next(err);
  }
}

// POST /api/planillas/generar   body: { anio, mes, quincena, ajustes? }
// ajustes: [{ id_empleado, otros_ingresos, otras_deducciones }]
export async function generarPlanilla(req, res, next) {
  try {
    const { anio, mes, quincena, ajustes = [] } = req.body;

    if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
      return res
        .status(400)
        .json({
          ok: false,
          mensaje: "anio debe ser un número entre 2000 y 2100",
        });
    }
    if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
      return res
        .status(400)
        .json({ ok: false, mensaje: "mes debe ser un número entre 1 y 12" });
    }
    if (quincena !== 1 && quincena !== 2) {
      return res
        .status(400)
        .json({ ok: false, mensaje: "quincena debe ser 1 o 2" });
    }
    if (!Array.isArray(ajustes)) {
      return res
        .status(400)
        .json({ ok: false, mensaje: "ajustes debe ser un arreglo" });
    }

    // Validar los ajustes y dejarlos en un mapa por empleado
    const ajustesPorEmpleado = new Map();
    for (const a of ajustes) {
      const otrosIngresos = a.otros_ingresos ?? 0;
      const otrasDeducciones = a.otras_deducciones ?? 0;
      if (
        !esIdValido(a.id_empleado) ||
        !esMontoValido(otrosIngresos) ||
        !esMontoValido(otrasDeducciones)
      ) {
        return res.status(400).json({
          ok: false,
          mensaje:
            "Cada ajuste necesita id_empleado y montos (otros_ingresos, otras_deducciones) mayores o iguales a 0",
        });
      }
      ajustesPorEmpleado.set(Number(a.id_empleado), {
        otrosIngresos,
        otrasDeducciones,
      });
    }

    const idSucursal = req.usuario.id_sucursal;
    const { fechaInicio, fechaFin } = rangoQuincena(anio, mes, quincena);

    // Todo en una transacción: o se crea la planilla completa o no se crea nada
    const idPlanilla = await withTransaction(async (client) => {
      const existe = await client.query(
        "SELECT 1 FROM planilla WHERE id_sucursal = $1 AND anio = $2 AND mes = $3 AND quincena = $4",
        [idSucursal, anio, mes, quincena],
      );
      if (existe.rows.length > 0) {
        throw errorHttp(
          409,
          "Ya existe una planilla para esa sucursal y quincena",
        );
      }

      const parametros = await cargarParametros(client);
      const tramos = await cargarTramos(client);

      // Empleados activos de la sucursal que ya estaban contratados al cierre de la quincena
      const empleados = await client.query(
        `SELECT id_empleado, salario_mensual
            FROM empleado
            WHERE id_sucursal = $1 AND activo AND fecha_ingreso <= $2::date
            ORDER BY apellidos, nombres`,
        [idSucursal, fechaFin],
      );
      if (empleados.rows.length === 0) {
        throw errorHttp(
          400,
          "No hay empleados activos en esta sucursal para esa quincena",
        );
      }

      const idsValidos = new Set(empleados.rows.map((e) => e.id_empleado));
      for (const idAjuste of ajustesPorEmpleado.keys()) {
        if (!idsValidos.has(idAjuste)) {
          throw errorHttp(
            400,
            `El empleado ${idAjuste} del ajuste no está en esta planilla`,
          );
        }
      }

      const planilla = await client.query(
        `INSERT INTO planilla (id_sucursal, anio, mes, quincena, fecha_inicio, fecha_fin)
         VALUES ($1, $2, $3, $4, $5::date, $6::date)
         RETURNING id_planilla`,
        [idSucursal, anio, mes, quincena, fechaInicio, fechaFin],
      );
      const id = planilla.rows[0].id_planilla;

      for (const empleado of empleados.rows) {
        const ajuste = ajustesPorEmpleado.get(empleado.id_empleado) ?? {};
        const c = calcularEmpleado(
          {
            salarioMensual: empleado.salario_mensual,
            otrosIngresos: ajuste.otrosIngresos,
            otrasDeducciones: ajuste.otrasDeducciones,
          },
          parametros,
          tramos,
        );
        if (c.salario_neto < 0) {
          throw errorHttp(
            400,
            `Las deducciones superan el salario del empleado ${empleado.id_empleado}`,
          );
        }

        await client.query(
          `INSERT INTO planilla_detalle
             (id_planilla, id_empleado, salario_quincenal, otros_ingresos, isss, afp, renta, otras_deducciones, salario_neto)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            id,
            empleado.id_empleado,
            c.salario_quincenal,
            c.otros_ingresos,
            c.isss,
            c.afp,
            c.renta,
            c.otras_deducciones,
            c.salario_neto,
          ],
        );
      }
      return id;
    });

    res.status(201).json({ ok: true, data: await armarPlanilla(idPlanilla) });
  } catch (err) {
    if (err.code === "23505") {
      return res
        .status(409)
        .json({
          ok: false,
          mensaje: "Ya existe una planilla para esa sucursal y quincena",
        });
    }
    next(err);
  }
}

// Cambia el estado solo si la planilla esta en el estado esperado.
// El UPDATE lleva "AND estado = $3": asi dos personas no pueden aprobar a la vez.
async function cambiarEstado(req, res, next, desde, hacia, verbo) {
  try {
    const { id } = req.params;
    if (!esIdValido(id)) {
      return res
        .status(400)
        .json({ ok: false, mensaje: "El id debe ser un número válido" });
    }

    const resultado = await query(
      "UPDATE planilla SET estado = $1 WHERE id_planilla = $2 AND estado = $3 RETURNING id_planilla",
      [hacia, id, desde],
    );
    if (resultado.rows.length === 0) {
      const existente = await query(
        "SELECT estado FROM planilla WHERE id_planilla = $1",
        [id],
      );
      if (existente.rows.length === 0) {
        return res
          .status(404)
          .json({ ok: false, mensaje: "Planilla no encontrada" });
      }
      return res.status(409).json({
        ok: false,
        mensaje: `Solo se puede ${verbo} una planilla en estado ${desde}. Estado actual: ${existente.rows[0].estado}`,
      });
    }
    res.json({ ok: true, data: await armarPlanilla(id) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/planillas/:id/aprobar  (BORRADOR -> APROBADA)
export const aprobarPlanilla = (req, res, next) =>
  cambiarEstado(req, res, next, "BORRADOR", "APROBADA", "aprobar");

// PATCH /api/planillas/:id/pagar  (APROBADA -> PAGADA)
export const pagarPlanilla = (req, res, next) =>
  cambiarEstado(req, res, next, "APROBADA", "PAGADA", "pagar");

// DELETE /api/planillas/:id  (solo BORRADOR)
// Excepción a la baja lógica: un borrador todavía no es un documento válido y
// debe poder rehacerse (por ejemplo, si se corrigió un salario).
export async function eliminarBorrador(req, res, next) {
  try {
    const { id } = req.params;
    if (!esIdValido(id)) {
      return res
        .status(400)
        .json({ ok: false, mensaje: "El id debe ser un número válido" });
    }

    const resultado = await withTransaction(async (client) => {
      const planilla = await client.query(
        "SELECT estado FROM planilla WHERE id_planilla = $1 FOR UPDATE",
        [id],
      );
      if (planilla.rows.length === 0) return "NO_EXISTE";
      if (planilla.rows[0].estado !== "BORRADOR") return "NO_BORRADOR";
      await client.query(
        "DELETE FROM planilla_detalle WHERE id_planilla = $1",
        [id],
      );
      await client.query("DELETE FROM planilla WHERE id_planilla = $1", [id]);
      return "OK";
    });

    if (resultado === "NO_EXISTE") {
      return res
        .status(404)
        .json({ ok: false, mensaje: "Planilla no encontrada" });
    }
    if (resultado === "NO_BORRADOR") {
      return res
        .status(409)
        .json({
          ok: false,
          mensaje: "Solo se puede eliminar una planilla en BORRADOR",
        });
    }
    res.json({ ok: true, data: { id_planilla: Number(id), eliminada: true } });
  } catch (err) {
    next(err);
  }
}
