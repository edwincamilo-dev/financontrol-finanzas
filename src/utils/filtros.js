// Utilidades compartidas: validación de fechas, paginación, filtros y formato de salida.

const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const LIMITE_MAXIMO = 100;

function esFechaValida(texto) {
    if (typeof texto !== 'string' || !REGEX_FECHA.test(texto)) {
        return false;
    }

    const [anio, mes, dia] = texto.split('-').map(Number);
    const fecha = new Date(Date.UTC(anio, mes - 1, dia));

    return (
        fecha.getUTCFullYear() === anio &&
        fecha.getUTCMonth() === mes - 1 &&
        fecha.getUTCDate() === dia
    );
}

// Convierte lo que devuelve MySQL (Date o texto) a 'AAAA-MM-DD'.
function formatearFecha(valor) {
    if (valor instanceof Date) {
        const anio = valor.getFullYear();
        const mes = String(valor.getMonth() + 1).padStart(2, '0');
        const dia = String(valor.getDate()).padStart(2, '0');

        return `${anio}-${mes}-${dia}`;
    }

    return String(valor).slice(0, 10);
}

// Deja un ingreso/gasto con fecha en texto y valor numérico.
function normalizarMovimiento(fila) {
    if (!fila) {
        return fila;
    }

    return {
        ...fila,
        valor: Number(fila.valor),
        fecha: formatearFecha(fila.fecha)
    };
}

// Lee ?desde=&hasta=. Devuelve { desde, hasta } o { error }.
function leerRangoFechas(query) {
    const desde = query.desde || null;
    const hasta = query.hasta || null;

    if ((desde && !esFechaValida(desde)) || (hasta && !esFechaValida(hasta))) {
        return { error: 'Fecha inválida. Use el formato AAAA-MM-DD' };
    }

    if (desde && hasta && desde > hasta) {
        return { error: 'La fecha "desde" no puede ser mayor que "hasta"' };
    }

    return { desde, hasta };
}

// Lee ?pagina=&limite=. Sin "limite" no hay paginación (se devuelve todo).
function leerPaginacion(query) {
    if (query.limite === undefined && query.pagina === undefined) {
        return { paginar: false };
    }

    const limite = query.limite === undefined ? 10 : Number(query.limite);
    const pagina = query.pagina === undefined ? 1 : Number(query.pagina);

    if (!Number.isInteger(limite) || limite < 1 || limite > LIMITE_MAXIMO) {
        return { error: `El límite debe ser un entero entre 1 y ${LIMITE_MAXIMO}` };
    }

    if (!Number.isInteger(pagina) || pagina < 1) {
        return { error: 'La página debe ser un entero mayor o igual a 1' };
    }

    return { paginar: true, limite, pagina, offset: (pagina - 1) * limite };
}

// Condiciones comunes (fecha, texto) para una tabla con columnas "fecha" y "descripcion".
// Se usa DATE(fecha) para que "hasta" incluya todo el día aunque la columna guarde la hora.
function condicionesBase({ desde, hasta, buscar }) {
    const condiciones = [];
    const params = [];

    if (desde) {
        condiciones.push('DATE(fecha) >= ?');
        params.push(desde);
    }

    if (hasta) {
        condiciones.push('DATE(fecha) <= ?');
        params.push(hasta);
    }

    if (buscar) {
        condiciones.push('descripcion LIKE ?');
        params.push(`%${buscar}%`);
    }

    return { condiciones, params };
}

function redondear(numero, decimales = 2) {
    const factor = 10 ** decimales;

    return Math.round((Number(numero) + Number.EPSILON) * factor) / factor;
}

module.exports = {
    LIMITE_MAXIMO,
    esFechaValida,
    formatearFecha,
    normalizarMovimiento,
    leerRangoFechas,
    leerPaginacion,
    condicionesBase,
    redondear
};
