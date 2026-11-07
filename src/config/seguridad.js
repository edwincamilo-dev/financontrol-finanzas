// Configuración de seguridad compartida: validación del secreto JWT y la Content-Security-Policy.

const LARGO_MINIMO_JWT_SECRET = 32;

const COMANDO_GENERAR_SECRETO = 'node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"';

// Devuelve null si el secreto sirve, o un mensaje que explica cómo arreglarlo.
// Un secreto corto o adivinable permite falsificar tokens y entrar a cualquier cuenta.
function validarJwtSecret(secreto) {
    const valor = typeof secreto === 'string' ? secreto.trim() : '';

    if (valor.length >= LARGO_MINIMO_JWT_SECRET) return null;

    const problema = valor
        ? `JWT_SECRET tiene ${valor.length} caracteres y debe tener al menos ${LARGO_MINIMO_JWT_SECRET}.`
        : 'falta la variable JWT_SECRET.';

    return [
        `No se puede iniciar FinanControl: ${problema}`,
        'Genera un secreto seguro con:',
        `  ${COMANDO_GENERAR_SECRETO}`,
        'y pégalo en el archivo .env así:  JWT_SECRET=<el valor generado>',
        '(Al cambiarlo, las sesiones abiertas se cierran y hay que volver a iniciar sesión.)'
    ].join('\n');
}

// CSP de la aplicación web: solo recursos propios, más Google Fonts y el ícono data: del index.html.
const DIRECTIVAS_CSP = {
    'default-src': ["'self'"],
    'script-src': ["'self'"],
    'style-src': ["'self'", 'https://fonts.googleapis.com'],
    'font-src': ["'self'", 'https://fonts.gstatic.com'],
    'img-src': ["'self'", 'data:'],
    'connect-src': ["'self'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'self'"],
    // Sin upgrade-insecure-requests: en local se sirve por http. En producción el hosting da HTTPS.
    'upgrade-insecure-requests': null
};

module.exports = { LARGO_MINIMO_JWT_SECRET, validarJwtSecret, DIRECTIVAS_CSP };
